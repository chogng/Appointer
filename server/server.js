import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import fs from "fs";
import multer from "multer";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

import { db } from "./src/config/db.js";
import { DEFAULT_CLIENT_ORIGIN, JWT_SECRET } from "./src/config/env.js";
import authRoutes from "./src/routes/authRoutes.js";
import logRoutes from "./src/routes/logRoutes.js";
import createAdminRoutes from "./src/routes/adminRoutes.js";
import createUserRoutes from "./src/routes/userRoutes.js";
import createDeviceRoutes from "./src/routes/deviceRoutes.js";
import createInventoryRoutes from "./src/routes/inventoryRoutes.js";
import createReservationRoutes from "./src/routes/reservationRoutes.js";
import createRequestRoutes from "./src/routes/requestRoutes.js";
import createDeviceAnalysisRoutes from "./src/routes/deviceAnalysisRoutes.js";
import createLiteratureRoutes from "./src/routes/literatureRoutes.js";
import createLiteratureAdminRoutes from "./src/routes/literatureAdminRoutes.js";
import { createBroadcast } from "./src/ws/broadcast.js";
import { errorMiddleware } from "./src/middleware/errorMiddleware.js";

const app = express();
const httpServer = createServer(app);
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT) || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistDir = path.resolve(__dirname, "../dist");
const uploadsDir = path.resolve(__dirname, "uploads");
const avatarsDir = path.join(uploadsDir, "avatars");

try {
  fs.mkdirSync(avatarsDir, { recursive: true });
} catch (error) {
  console.warn(`[uploads] failed to ensure uploads dir: ${error?.message || error}`);
}

const corsOriginEnv = process.env.CORS_ORIGIN || process.env.CLIENT_ORIGIN;
const corsOrigins = (corsOriginEnv || DEFAULT_CLIENT_ORIGIN)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

for (const origin of [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`]) {
  if (!corsOrigins.includes(origin)) corsOrigins.push(origin);
}

function getCookieValue(cookieHeader, key) {
  if (typeof cookieHeader !== "string" || !cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${key}=`)) {
      return part.slice(key.length + 1);
    }
  }
  return null;
}

function getLanUrls(port) {
  try {
    const nets = os.networkInterfaces();
    const urls = new Set();

    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family !== "IPv4") continue;
        if (net.internal) continue;
        if (!net.address) continue;
        urls.add(`http://${net.address}:${port}`);
      }
    }

    return [...urls];
  } catch {
    return [];
  }
}

const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

function isSocketOriginAllowed(origin, host) {
  if (!origin) return true; // non-browser clients
  try {
    const url = new URL(origin);
    if (host && url.host === host) return true;
    return corsOrigins.includes(origin);
  } catch {
    return false;
  }
}

// Socket.IO auth: require a valid session token (cookie or bearer) before receiving broadcasts
io.use((socket, next) => {
  try {
    const originHeader = socket.handshake.headers?.origin;
    const hostHeader = socket.handshake.headers?.host;
    if (!isSocketOriginAllowed(originHeader, hostHeader)) {
      return next(new Error("Unauthorized"));
    }

    const cookieHeader = socket.handshake.headers?.cookie || "";
    const cookieToken = getCookieValue(cookieHeader, "token");

    const authHeader = socket.handshake.headers?.authorization;
    const headerToken =
      typeof authHeader === "string" &&
        authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice("bearer ".length).trim()
        : null;

    const token = cookieToken || headerToken || socket.handshake.auth?.token;
    if (!token) return next(new Error("Unauthorized"));

    jwt.verify(token, JWT_SECRET, async (err, payload) => {
      if (err) return next(new Error("Unauthorized"));

      try {
        const dbUser = await db.queryOne(
          "SELECT id, username, role, status, expiryDate FROM users WHERE id = ?",
          [payload?.id],
        );
        if (!dbUser) return next(new Error("Unauthorized"));
        if (dbUser.status !== "ACTIVE") return next(new Error("Unauthorized"));
        if (dbUser.expiryDate) {
          const today = new Date().toISOString().slice(0, 10);
          if (dbUser.expiryDate < today) return next(new Error("Unauthorized"));
        }

        socket.data.user = {
          id: dbUser.id,
          username: dbUser.username,
          role: dbUser.role,
        };
        next();
      } catch {
        next(new Error("Unauthorized"));
      }
    });
  } catch {
    next(new Error("Unauthorized"));
  }
});

// Middleware
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (!origin) return next();

  try {
    const url = new URL(origin);
    const host = req.get("host");
    if (host && url.host === host) return next();
  } catch {
    // ignore invalid origin header; cors middleware will drop it
  }

  return cors({
    origin: corsOrigins,
    credentials: true,
  })(req, res, next);
});
app.use(express.json());
app.use(cookieParser());
app.use("/api/uploads", express.static(uploadsDir, { maxAge: "7d" }));

const AVATAR_MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, avatarsDir),
    filename: (req, file, cb) => {
      const ext =
        path.extname(file.originalname || "").toLowerCase() ||
        AVATAR_MIME_TO_EXT[file.mimetype] ||
        "";
      cb(null, `${req.params.id}_${Date.now()}_${randomUUID()}${ext}`);
    },
  }),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: (_req, file, cb) => {
    if (Object.prototype.hasOwnProperty.call(AVATAR_MIME_TO_EXT, file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Invalid avatar file type (expected jpg/png/webp/gif)"));
  },
});

// Initialize database
await db.init();

// WebSocket connection management
io.on("connection", (socket) => {
  console.log("[ws] connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("[ws] disconnected:", socket.id);
  });
});

const broadcast = createBroadcast(io);

// ============ Admin API ============

app.use("/api/admin", createAdminRoutes());

// ============ Auth / Users API ============

app.use("/api/auth", authRoutes);

app.use(
  "/api",
  createUserRoutes({ broadcast, avatarUpload, avatarsDir }),
);

// ============ Devices API ============

app.use("/api/devices", createDeviceRoutes({ broadcast }));

// ============ Inventory API ============

app.use("/api/inventory", createInventoryRoutes());

// ============ Reservations API ============

app.use("/api/reservations", createReservationRoutes({ broadcast }));

// ============ Logs API ============

app.use("/api/logs", logRoutes);

app.use("/api/device-analysis", createDeviceAnalysisRoutes());
app.use("/api/literature", createLiteratureRoutes());
app.use("/api/admin/literature", createLiteratureAdminRoutes());

// ============ Requests API ============

app.use("/api/requests", createRequestRoutes({ broadcast }));

// API fallback (keep JSON responses for unknown endpoints)
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Central error handler
app.use(errorMiddleware);

const shouldServeClient = (() => {
  const raw = process.env.SERVE_CLIENT;
  if (raw === undefined) return process.env.NODE_ENV === "production";
  return raw === "1" || raw.toLowerCase() === "true";
})();

if (shouldServeClient) {
  if (fs.existsSync(clientDistDir)) {
    app.use(express.static(clientDistDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
        return next();
      }
      res.sendFile(path.join(clientDistDir, "index.html"));
    });
    console.log(`[static] serving dist from ${clientDistDir}`);
  } else {
    console.warn(
      `[static] SERVE_CLIENT is enabled, but dist not found at ${clientDistDir}. Run 'npm run build' from repo root.`,
    );
  }
}

// 启动服务器
const onListen = () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);

  const lanUrls = getLanUrls(PORT);
  if (lanUrls.length > 0) {
    console.log(`LAN: ${lanUrls.join(", ")}`);
  }

  console.log(`🔌 WebSocket 已启用`);
};

if (process.env.HOST) {
  httpServer.listen(PORT, process.env.HOST, onListen);
} else {
  httpServer.listen(PORT, onListen);
}
