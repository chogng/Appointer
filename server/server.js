import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { createServer } from "http";
import { Server } from "socket.io";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";

import { db } from "./src/config/db.js";
import { DEFAULT_CLIENT_ORIGIN, JWT_SECRET } from "./src/config/env.js";
import {
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  isAdminRole,
} from "./src/middleware/authMiddleware.js";
import authRoutes from "./src/routes/authRoutes.js";
import {
  getRetentionSettings,
  runRetentionCleanup,
  startRetentionScheduler,
  updateRetentionSettings,
} from "./src/retention.js";
import { searchLiterature } from "./src/literatureService.js";

const app = express();
const httpServer = createServer(app);
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT) || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistDir = path.resolve(__dirname, "../dist");

const corsOriginEnv = process.env.CORS_ORIGIN || process.env.CLIENT_ORIGIN;
const corsOrigins = (corsOriginEnv || DEFAULT_CLIENT_ORIGIN)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

for (const origin of [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`]) {
  if (!corsOrigins.includes(origin)) corsOrigins.push(origin);
}

function safeJsonParse(value, fallback) {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTimeSlot(value) {
  return typeof value === "string" && /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(value);
}

function isUniqueConstraintError(error) {
  const msg = String(error?.message || "");
  const code = String(error?.code || "");
  const errno = Number(error?.errno);
  return (
    msg.includes("UNIQUE constraint failed") ||
    msg.includes("constraint failed") ||
    msg.includes("Duplicate entry") ||
    code === "ER_DUP_ENTRY" ||
    errno === 1062
  );
}

function sanitizeDeviceAnalysisTemplateConfig(input) {
  const src = isPlainObject(input) ? input : {};

  const name = typeof src.name === "string" ? src.name.trim() : "";

  const selectedColumns = Array.isArray(src.selectedColumns)
    ? src.selectedColumns
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0)
    : [];

  return {
    name,
    xDataStart: src.xDataStart == null ? "" : String(src.xDataStart),
    xDataEnd: src.xDataEnd == null ? "" : String(src.xDataEnd),
    xPoints: src.xPoints == null ? "" : String(src.xPoints),
    yDataStart: src.yDataStart == null ? "" : String(src.yDataStart),
    yDataEnd: src.yDataEnd == null ? "" : String(src.yDataEnd),
    yPoints: src.yPoints == null ? "" : String(src.yPoints),
    yCount: src.yCount == null ? "" : String(src.yCount),
    yStep: src.yStep == null ? "" : String(src.yStep),
    stopOnError: Boolean(src.stopOnError),
    selectedColumns,
  };
}

function sanitizeDeviceAnalysisSettings(input) {
  const src = isPlainObject(input) ? input : {};
  const yUnitRaw = src.yUnit;
  const yUnit =
    yUnitRaw === "A" || yUnitRaw === "uA" || yUnitRaw === "nA"
      ? yUnitRaw
      : null;
  return { yUnit };
}

function sanitizeLiteratureSettings(input) {
  const src = isPlainObject(input) ? input : {};

  const seedUrls = Array.isArray(src.seedUrls)
    ? src.seedUrls
        .map((value) => (value == null ? "" : String(value)))
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 50)
    : [];

  const startDate = isValidDateString(src.startDate) ? src.startDate : "";
  const endDate = isValidDateString(src.endDate) ? src.endDate : "";

  const maxResultsRaw = src.maxResults;
  const maxResultsNumber =
    typeof maxResultsRaw === "number" ? maxResultsRaw : Number(maxResultsRaw);
  const maxResults = Number.isFinite(maxResultsNumber)
    ? Math.max(1, Math.min(100, Math.trunc(maxResultsNumber)))
    : 100;

  return { seedUrls, startDate, endDate, maxResults };
}

function makeId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

const LITERATURE_DOWNLOAD_TTL_MS = 60 * 60 * 1000;
const literatureDownloadTokens = new Map();

function cleanupLiteratureDownloadTokens() {
  const now = Date.now();
  for (const [token, entry] of literatureDownloadTokens.entries()) {
    if (!entry?.createdAt) {
      literatureDownloadTokens.delete(token);
      continue;
    }
    if (now - entry.createdAt > LITERATURE_DOWNLOAD_TTL_MS) {
      literatureDownloadTokens.delete(token);
    }
  }
}

function sanitizeFilename(value) {
  const raw = typeof value === "string" ? value : String(value || "");
  const sanitized = raw
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || "article";
}

function createLiteratureDownloadToken({ url, filename }) {
  cleanupLiteratureDownloadTokens();
  const token = randomUUID();
  literatureDownloadTokens.set(token, {
    url,
    filename,
    createdAt: Date.now(),
  });
  return token;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function probePdfUrl(pdfUrl) {
  if (typeof pdfUrl !== "string" || !pdfUrl) {
    return { ok: false, status: 0, contentType: "" };
  }

  try {
    const head = await fetchWithTimeout(
      pdfUrl,
      {
        method: "HEAD",
        redirect: "follow",
        headers: {
          "User-Agent":
            "AppointerLiterature/0.1 (+https://localhost; purpose=literature-research)",
        },
      },
      10_000,
    );

    return {
      ok: head.ok,
      status: head.status,
      contentType: String(head.headers.get("content-type") || "").toLowerCase(),
    };
  } catch {
    return { ok: false, status: 0, contentType: "" };
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const list = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Math.min(10, Number(concurrency) || 6));
  const results = new Array(list.length);
  let index = 0;

  const workers = Array.from({ length: Math.min(limit, list.length) }, () =>
    (async () => {
      while (true) {
        const currentIndex = index;
        index += 1;
        if (currentIndex >= list.length) return;
        results[currentIndex] = await mapper(list[currentIndex], currentIndex);
      }
    })(),
  );

  await Promise.all(workers);
  return results;
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

// 初始化数据库
await db.init();
startRetentionScheduler(db);

// WebSocket 连接管理
io.on("connection", (socket) => {
  console.log("✅ 客户端连接:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ 客户端断开:", socket.id);
  });
});

// 广播函数：通知所有客户端数据变化
function broadcast(event, data) {
  io.emit(event, data);
  console.log(`📡 广播事件: ${event}`, data);
}

function calculateDuration(timeSlot) {
  if (!timeSlot || !timeSlot.includes("-")) return 0;
  const [start, end] = timeSlot.split("-");
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  return endH * 60 + endM - (startH * 60 + startM);
}

// ============ 统计报表 API ============

app.get(
  "/api/admin/leaderboard",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const users = await db.query(
        "SELECT id, username, name, role FROM users",
      );
      const reservations = await db.query(
        "SELECT userId, timeSlot FROM reservations",
      );

      const stats = {};

      // Initialize user stats
      users.forEach((user) => {
        stats[user.id] = {
          id: user.id,
          username: user.username,
          name: user.name || user.username, // Fallback to username if name is empty
          role: user.role,
          totalMinutes: 0,
        };
      });

      // Aggregate reservation duration
      reservations.forEach((res) => {
        if (stats[res.userId]) {
          stats[res.userId].totalMinutes += calculateDuration(res.timeSlot);
        }
      });

      // Convert to array and sort by totalMinutes descending
      const leaderboard = Object.values(stats)
        .sort((a, b) => b.totalMinutes - a.totalMinutes)
        // Optional: Filter out users with 0 minutes if desired, or keep them
        // .filter(u => u.totalMinutes > 0)
        .map((u) => ({
          ...u,
          totalHours: parseFloat((u.totalMinutes / 60).toFixed(1)),
        }));

      res.json(leaderboard);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ============ 用户相关 API ============

app.use("/api/auth", authRoutes);

app.get("/api/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await db.query(
      "SELECT id, username, role, status, name, email, expiryDate FROM users",
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { username, password, name, email, expiryDate } = req.body;

    const existing = await db.queryOne(
      "SELECT id FROM users WHERE username = ?",
      [username],
    );
    if (existing) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id: makeId("user"),
      username,
      password: hashedPassword,
      role: "USER",
      status: "PENDING",
      name,
      email,
      expiryDate: expiryDate || null,
    };

    await db.execute(
      "INSERT INTO users (id, username, password, role, status, name, email, expiryDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        newUser.id,
        newUser.username,
        newUser.password,
        newUser.role,
        newUser.status,
        newUser.name,
        newUser.email,
        newUser.expiryDate,
      ],
    );

    const { password: _, ...userWithoutPassword } = newUser;

    // 广播新用户创建
    broadcast("user:created", userWithoutPassword);

    res.status(201).json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  "/api/admin/users",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { username, password, name, email, role, expiryDate } = req.body;

      // Validate role assignment permissions
      // ADMIN can only create USER
      if (req.user.role === "ADMIN" && role !== "USER") {
        return res
          .status(403)
          .json({ error: "Admins can only create ordinary users" });
      }

      // SUPER_ADMIN can create ADMIN or USER
      if (
        req.user.role === "SUPER_ADMIN" &&
        !["ADMIN", "USER"].includes(role)
      ) {
        return res.status(400).json({ error: "Invalid role" });
      }

      const existing = await db.queryOne(
        "SELECT id FROM users WHERE username = ?",
        [username],
      );
      if (existing) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = {
        id: makeId("user"),
        username,
        password: hashedPassword,
        role: role,
        status: "ACTIVE", // Admin-created users are active by default
        name,
        email,
        expiryDate: expiryDate || null,
      };

      await db.execute(
        "INSERT INTO users (id, username, password, role, status, name, email, expiryDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          newUser.id,
          newUser.username,
          newUser.password,
          newUser.role,
          newUser.status,
          newUser.name,
          newUser.email,
          newUser.expiryDate,
        ],
      );

      const { password: _, ...userWithoutPassword } = newUser;

      // Broadcast
      broadcast("user:created", userWithoutPassword);

      // Audit log
      await db.execute(
        "INSERT INTO logs (id, userId, action, details, timestamp) VALUES (?, ?, ?, ?, ?)",
        [
          makeId("log"),
          req.user.id,
          "USER_CREATED",
          `Created user ${username} (${role})`,
          new Date().toISOString(),
        ],
      );

      res.status(201).json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.patch("/api/users/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: "Invalid update payload" });
    }

    const rawUpdates = req.body;
    const allowedKeys = new Set([
      "role",
      "status",
      "name",
      "email",
      "expiryDate",
      "username",
    ]);
    const unknownKeys = Object.keys(rawUpdates).filter(
      (key) => !allowedKeys.has(key),
    );
    if (unknownKeys.length > 0) {
      return res
        .status(400)
        .json({ error: `Unknown fields: ${unknownKeys.join(", ")}` });
    }

    const user = await db.queryOne("SELECT * FROM users WHERE id = ?", [id]);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isSelf = req.user.id === id;
    const isAdmin = isAdminRole(req.user.role);

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const selfAllowedKeys = new Set(["name", "email", "username"]);
    const adminAllowedKeys = new Set([
      ...selfAllowedKeys,
      "status",
      "expiryDate",
    ]);
    const superAdminAllowedKeys = new Set([...adminAllowedKeys, "role"]);

    let permittedKeys = selfAllowedKeys;
    if (!isSelf) {
      if (req.user.role === "ADMIN") {
        if (user.role !== "USER") {
          return res.status(403).json({ error: "Forbidden" });
        }
        permittedKeys = adminAllowedKeys;
      } else if (req.user.role === "SUPER_ADMIN") {
        permittedKeys = superAdminAllowedKeys;
      }
    }

    const forbiddenKeys = Object.keys(rawUpdates).filter(
      (key) => !permittedKeys.has(key),
    );
    if (forbiddenKeys.length > 0) {
      return res.status(403).json({
        error: `Not allowed to update: ${forbiddenKeys.join(", ")}`,
      });
    }

    const updates = {};
    if ("name" in rawUpdates) {
      if (typeof rawUpdates.name !== "string" || !rawUpdates.name.trim()) {
        return res.status(400).json({ error: "Invalid name" });
      }
      updates.name = rawUpdates.name.trim();
    }
    if ("username" in rawUpdates) {
      if (typeof rawUpdates.username !== "string") {
        return res.status(400).json({ error: "Invalid username" });
      }
      const newUsername = rawUpdates.username.trim();
      if (!newUsername) {
        return res.status(400).json({ error: "Invalid username" });
      }
      // Check uniqueness if changed
      if (newUsername !== user.username) {
        const existing = await db.queryOne(
          "SELECT id FROM users WHERE username = ?",
          [newUsername],
        );
        if (existing) {
          return res.status(409).json({ error: "Username already taken" });
        }
        updates.username = newUsername;
      }
    }
    if ("email" in rawUpdates) {
      if (typeof rawUpdates.email !== "string" || !rawUpdates.email.trim()) {
        return res.status(400).json({ error: "Invalid email" });
      }
      updates.email = rawUpdates.email.trim();
    }
    if ("expiryDate" in rawUpdates) {
      if (
        rawUpdates.expiryDate !== null &&
        !isValidDateString(rawUpdates.expiryDate)
      ) {
        return res
          .status(400)
          .json({ error: "Invalid expiryDate (expected YYYY-MM-DD or null)" });
      }
      updates.expiryDate = rawUpdates.expiryDate;
    }
    if ("status" in rawUpdates) {
      const allowedStatuses = new Set(["ACTIVE", "PENDING", "DISABLED"]);
      if (
        typeof rawUpdates.status !== "string" ||
        !allowedStatuses.has(rawUpdates.status)
      ) {
        return res.status(400).json({ error: "Invalid status" });
      }
      updates.status = rawUpdates.status;
    }
    if ("role" in rawUpdates) {
      const allowedRoles = new Set(["USER", "ADMIN", "SUPER_ADMIN"]);
      if (
        typeof rawUpdates.role !== "string" ||
        !allowedRoles.has(rawUpdates.role)
      ) {
        return res.status(400).json({ error: "Invalid role" });
      }
      updates.role = rawUpdates.role;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const fields = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = [...Object.values(updates), id];

    await db.execute(`UPDATE users SET ${fields} WHERE id = ?`, values);

    const updated = await db.queryOne(
      "SELECT id, username, role, status, name, email, expiryDate FROM users WHERE id = ?",
      [id],
    );

    // 广播用户更新
    broadcast("user:updated", updated);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete(
  "/api/users/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const user = await db.queryOne("SELECT * FROM users WHERE id = ?", [id]);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Prevent deleting self (optional safety)
      if (user.id === req.user.id) {
        return res.status(400).json({ error: "Cannot delete yourself" });
      }

      if (req.user.role === "ADMIN" && user.role !== "USER") {
        return res.status(403).json({ error: "Forbidden" });
      }

      await db.execute("DELETE FROM users WHERE id = ?", [id]);

      // Broadcast user deletion
      broadcast("user:deleted", { id });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Blocklist Management
app.get("/api/users/:id/blocklist", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    // Allow admins or the user themselves to view blocklist
    if (!isAdminRole(req.user.role) && req.user.id !== id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const blockedDevices = await db.query(
      "SELECT deviceId, reason, createdAt FROM blocklist WHERE userId = ?",
      [id],
    );
    res.json(blockedDevices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  "/api/users/:id/blocklist",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { deviceId, reason } = req.body;

      if (!deviceId)
        return res.status(400).json({ error: "deviceId is required" });

      const blockId = makeId("blk");
      const createdAt = new Date().toISOString();

      try {
        await db.execute(
          "INSERT INTO blocklist (id, userId, deviceId, reason, createdAt) VALUES (?, ?, ?, ?, ?)",
          [blockId, id, deviceId, reason || "", createdAt],
        );
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return res
            .status(409)
            .json({ error: "User is already blocked from this device" });
        }
        throw error;
      }

      res.status(201).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.delete(
  "/api/users/:id/blocklist/:deviceId",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id, deviceId } = req.params;
      await db.execute(
        "DELETE FROM blocklist WHERE userId = ? AND deviceId = ?",
        [id, deviceId],
      );

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ============ 设备相关 API ============

app.get("/api/devices", async (req, res) => {
  try {
    const devices = await db.query("SELECT * FROM devices");
    const parsed = devices.map((d) => ({
      ...d,
      isEnabled: Boolean(d.isEnabled),
      openDays: safeJsonParse(d.openDays, [1, 2, 3, 4, 5]),
      timeSlots: safeJsonParse(d.timeSlots, []),
      granularity: d.granularity || 60,
      openTime: d.openTime
        ? safeJsonParse(d.openTime, { start: "09:00", end: "18:00" })
        : { start: "09:00", end: "18:00" },
    }));
    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/devices/:id", async (req, res) => {
  try {
    const device = await db.queryOne("SELECT * FROM devices WHERE id = ?", [
      req.params.id,
    ]);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    res.json({
      ...device,
      isEnabled: Boolean(device.isEnabled),
      openDays: safeJsonParse(device.openDays, [1, 2, 3, 4, 5]),
      timeSlots: safeJsonParse(device.timeSlots, []),
      granularity: device.granularity || 60,
      openTime: device.openTime
        ? safeJsonParse(device.openTime, { start: "09:00", end: "18:00" })
        : { start: "09:00", end: "18:00" },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/devices", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      openDays,
      timeSlots,
      granularity = 60,
      openTime,
    } = req.body;
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Device name is required" });
    }
    if (typeof description !== "string") {
      return res.status(400).json({ error: "Invalid device description" });
    }
    if (openDays !== undefined && !Array.isArray(openDays)) {
      return res
        .status(400)
        .json({ error: "Invalid openDays (expected array)" });
    }
    if (timeSlots !== undefined && !Array.isArray(timeSlots)) {
      return res
        .status(400)
        .json({ error: "Invalid timeSlots (expected array)" });
    }
    const parsedGranularity = Number(granularity);
    if (!Number.isInteger(parsedGranularity) || parsedGranularity <= 0) {
      return res.status(400).json({ error: "Invalid granularity" });
    }
    if (
      openTime !== undefined &&
      (!isPlainObject(openTime) ||
        typeof openTime.start !== "string" ||
        typeof openTime.end !== "string")
    ) {
      return res
        .status(400)
        .json({ error: "Invalid openTime (expected {start,end})" });
    }

    const newDevice = {
      id: makeId("dev"),
      name: name.trim(),
      description,
      isEnabled: 1,
      openDays: JSON.stringify(openDays || [1, 2, 3, 4, 5]),
      timeSlots: JSON.stringify(timeSlots || []),
      granularity: parsedGranularity,
      openTime: JSON.stringify(openTime || { start: "09:00", end: "18:00" }),
    };

    await db.execute(
      "INSERT INTO devices (id, name, description, isEnabled, openDays, timeSlots, granularity, openTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        newDevice.id,
        newDevice.name,
        newDevice.description,
        newDevice.isEnabled,
        newDevice.openDays,
        newDevice.timeSlots,
        newDevice.granularity,
        newDevice.openTime,
      ],
    );

    const result = {
      ...newDevice,
      isEnabled: Boolean(newDevice.isEnabled),
      openDays: safeJsonParse(newDevice.openDays, [1, 2, 3, 4, 5]),
      timeSlots: safeJsonParse(newDevice.timeSlots, []),
      openTime: safeJsonParse(newDevice.openTime, {
        start: "09:00",
        end: "18:00",
      }),
    };

    // 广播新设备创建
    broadcast("device:created", result);

    // 记录日志
    await db.execute(
      "INSERT INTO logs (id, userId, action, details, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        makeId("log"),
        req.user.id,
        "DEVICE_CREATED",
        `Created device: ${result.name}`,
        new Date().toISOString(),
      ],
    );

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch(
  "/api/devices/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!isPlainObject(req.body)) {
        return res.status(400).json({ error: "Invalid update payload" });
      }

      const rawUpdates = { ...req.body };
      const allowedKeys = new Set([
        "name",
        "description",
        "isEnabled",
        "openDays",
        "timeSlots",
        "granularity",
        "openTime",
      ]);
      const unknownKeys = Object.keys(rawUpdates).filter(
        (key) => !allowedKeys.has(key),
      );
      if (unknownKeys.length > 0) {
        return res
          .status(400)
          .json({ error: `Unknown fields: ${unknownKeys.join(", ")}` });
      }

      const device = await db.queryOne("SELECT * FROM devices WHERE id = ?", [
        id,
      ]);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      const updates = {};
      if ("name" in rawUpdates) {
        if (typeof rawUpdates.name !== "string" || !rawUpdates.name.trim()) {
          return res.status(400).json({ error: "Invalid device name" });
        }
        updates.name = rawUpdates.name.trim();
      }
      if ("description" in rawUpdates) {
        if (typeof rawUpdates.description !== "string") {
          return res.status(400).json({ error: "Invalid device description" });
        }
        updates.description = rawUpdates.description;
      }
      if ("isEnabled" in rawUpdates) {
        updates.isEnabled = rawUpdates.isEnabled ? 1 : 0;
      }
      if ("openDays" in rawUpdates) {
        if (!Array.isArray(rawUpdates.openDays)) {
          return res
            .status(400)
            .json({ error: "Invalid openDays (expected array)" });
        }
        updates.openDays = JSON.stringify(rawUpdates.openDays);
      }
      if ("timeSlots" in rawUpdates) {
        if (!Array.isArray(rawUpdates.timeSlots)) {
          return res
            .status(400)
            .json({ error: "Invalid timeSlots (expected array)" });
        }
        updates.timeSlots = JSON.stringify(rawUpdates.timeSlots);
      }
      if ("granularity" in rawUpdates) {
        const parsedGranularity = Number(rawUpdates.granularity);
        if (!Number.isInteger(parsedGranularity) || parsedGranularity <= 0) {
          return res.status(400).json({ error: "Invalid granularity" });
        }
        updates.granularity = parsedGranularity;
      }
      if ("openTime" in rawUpdates) {
        if (
          !isPlainObject(rawUpdates.openTime) ||
          typeof rawUpdates.openTime.start !== "string" ||
          typeof rawUpdates.openTime.end !== "string"
        ) {
          return res
            .status(400)
            .json({ error: "Invalid openTime (expected {start,end})" });
        }
        updates.openTime = JSON.stringify(rawUpdates.openTime);
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const fields = Object.keys(updates)
        .map((key) => `${key} = ?`)
        .join(", ");
      const values = [...Object.values(updates), id];

      await db.execute(`UPDATE devices SET ${fields} WHERE id = ?`, values);

      const updated = await db.queryOne("SELECT * FROM devices WHERE id = ?", [
        id,
      ]);
      const result = {
        ...updated,
        isEnabled: Boolean(updated.isEnabled),
        openDays: safeJsonParse(updated.openDays, [1, 2, 3, 4, 5]),
        timeSlots: safeJsonParse(updated.timeSlots, []),
        granularity: updated.granularity || 60,
        openTime: updated.openTime
          ? safeJsonParse(updated.openTime, { start: "09:00", end: "18:00" })
          : { start: "09:00", end: "18:00" },
      };

      // 广播设备更新（重要：启用/停用状态）
      broadcast("device:updated", result);

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.delete(
  "/api/devices/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      const device = await db.queryOne("SELECT * FROM devices WHERE id = ?", [
        id,
      ]);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      await db.execute("DELETE FROM devices WHERE id = ?", [id]);

      // 广播设备删除
      broadcast("device:deleted", { id });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ============ 库存相关 API ============

app.get("/api/inventory", authenticateToken, async (req, res) => {
  try {
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    const where = search ? "WHERE i.name LIKE ?" : "";
    const params = search ? [`%${search}%`] : [];

    const query = `
            SELECT
                i.*,
                COALESCE(uById.name, uByUsername.name, i.requesterName, 'System') AS requesterDisplayName
            FROM inventory i
            LEFT JOIN users uById ON i.requesterId = uById.id
            LEFT JOIN users uByUsername ON i.requesterId IS NULL AND i.requesterName = uByUsername.username
            ${where}
            ORDER BY i.date DESC
        `;

    const items = await db.query(query, params);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  "/api/inventory",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { name, category, quantity } = req.body;
      if (!name || !category || quantity === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Get the authenticated user's information
      const requesterId = req.user.id;
      const user = await db.queryOne("SELECT name FROM users WHERE id = ?", [
        requesterId,
      ]);
      const requesterName = user?.name || req.user.username || "Unknown";

      const itemId = makeId("item");
      const date = new Date().toISOString().split("T")[0];

      await db.execute(
        "INSERT INTO inventory (id, name, category, quantity, date, requesterName, requesterId) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          itemId,
          name,
          category,
          Number(quantity),
          date,
          requesterName,
          requesterId,
        ],
      );

      // Query the item back with the join to include requesterDisplayName
      const newItem = await db.queryOne(
        `
            SELECT
                i.*,
                COALESCE(uById.name, uByUsername.name, i.requesterName, 'System') AS requesterDisplayName
            FROM inventory i
            LEFT JOIN users uById ON i.requesterId = uById.id
            LEFT JOIN users uByUsername ON i.requesterId IS NULL AND i.requesterName = uByUsername.username
            WHERE i.id = ?
        `,
        [itemId],
      );

      res.status(201).json(newItem);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.patch(
  "/api/inventory/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, category, quantity } = req.body;

      const updates = [];
      const values = [];

      if (name) {
        updates.push("name = ?");
        values.push(name);
      }
      if (category) {
        updates.push("category = ?");
        values.push(category);
      }
      if (quantity !== undefined) {
        updates.push("quantity = ?");
        values.push(Number(quantity));
      }

      if (updates.length === 0)
        return res.status(400).json({ error: "No fields to update" });

      values.push(id);
      await db.execute(
        `UPDATE inventory SET ${updates.join(", ")} WHERE id = ?`,
        values,
      );

      const updatedItem = await db.queryOne(
        "SELECT * FROM inventory WHERE id = ?",
        [id],
      );
      res.json(updatedItem);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.delete(
  "/api/inventory/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      await db.execute("DELETE FROM inventory WHERE id = ?", [id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ============ 预约相关 API ============

app.get("/api/reservations", authenticateToken, async (req, res) => {
  try {
    const deviceId =
      typeof req.query.deviceId === "string" ? req.query.deviceId.trim() : "";
    const from =
      typeof req.query.from === "string" ? req.query.from.trim() : "";
    const to = typeof req.query.to === "string" ? req.query.to.trim() : "";
    const active = req.query.active === "1" || req.query.active === "true";

    const conditions = [];
    const params = [];

    if (deviceId) {
      conditions.push("deviceId = ?");
      params.push(deviceId);
    }

    if (from) {
      if (!isValidDateString(from)) {
        return res
          .status(400)
          .json({ error: "Invalid from (expected YYYY-MM-DD)" });
      }
      conditions.push("date >= ?");
      params.push(from);
    }

    if (to) {
      if (!isValidDateString(to)) {
        return res
          .status(400)
          .json({ error: "Invalid to (expected YYYY-MM-DD)" });
      }
      conditions.push("date <= ?");
      params.push(to);
    }

    if (active) {
      conditions.push("status != 'CANCELLED'");
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const reservations = await db.query(
      `SELECT * FROM reservations ${where}`,
      params,
    );
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/reservations", authenticateToken, async (req, res) => {
  try {
    const { deviceId, date, timeSlot, title, description, color } = req.body;
    const userId = req.user.id;
    if (typeof deviceId !== "string" || !deviceId.trim()) {
      return res.status(400).json({ error: "deviceId is required" });
    }
    if (!isValidDateString(date)) {
      return res
        .status(400)
        .json({ error: "Invalid date (expected YYYY-MM-DD)" });
    }
    if (!isValidTimeSlot(timeSlot)) {
      return res
        .status(400)
        .json({ error: "Invalid timeSlot (expected HH:MM-HH:MM)" });
    }

    const device = await db.queryOne(
      "SELECT id, isEnabled FROM devices WHERE id = ?",
      [deviceId],
    );
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    if (!device.isEnabled) {
      return res.status(403).json({ error: "Device is disabled" });
    }

    // Check if user is blocked from this device
    const blockEntry = await db.queryOne(
      "SELECT reason FROM blocklist WHERE userId = ? AND deviceId = ?",
      [userId, deviceId],
    );

    if (blockEntry) {
      return res.status(403).json({
        error: `You are banned from booking this device. Reason: ${blockEntry.reason || "Violation of usage policy"}`,
      });
    }

    const conflict = await db.queryOne(
      `SELECT * FROM reservations WHERE deviceId = ? AND date = ? AND timeSlot = ? AND status != 'CANCELLED'`,
      [deviceId, date, timeSlot],
    );

    if (conflict) {
      return res.status(409).json({ error: "Time slot already booked" });
    }

    const newReservation = {
      id: makeId("res"),
      userId,
      deviceId,
      date,
      timeSlot,
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
      title: title || "",
      description: description || "",
      color: color || "default",
    };

    try {
      await db.execute(
        "INSERT INTO reservations (id, userId, deviceId, date, timeSlot, status, createdAt, title, description, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          newReservation.id,
          newReservation.userId,
          newReservation.deviceId,
          newReservation.date,
          newReservation.timeSlot,
          newReservation.status,
          newReservation.createdAt,
          newReservation.title,
          newReservation.description,
          newReservation.color,
        ],
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return res.status(409).json({ error: "Time slot already booked" });
      }
      throw error;
    }

    // 广播新预约（重要：实时显示）
    broadcast("reservation:created", newReservation);

    // 记录日志
    await db.execute(
      "INSERT INTO logs (id, userId, action, details, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        makeId("log"),
        newReservation.userId,
        "RESERVATION_CREATED",
        `Created reservation for device ${newReservation.deviceId}`,
        new Date().toISOString(),
      ],
    );

    res.status(201).json(newReservation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/reservations/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: "Invalid update payload" });
    }
    const rawUpdates = req.body;
    const allowedKeys = new Set([
      "status",
      "date",
      "timeSlot",
      "title",
      "description",
      "color",
    ]);
    const unknownKeys = Object.keys(rawUpdates).filter(
      (key) => !allowedKeys.has(key),
    );
    if (unknownKeys.length > 0) {
      return res
        .status(400)
        .json({ error: `Unknown fields: ${unknownKeys.join(", ")}` });
    }

    const reservation = await db.queryOne(
      "SELECT * FROM reservations WHERE id = ?",
      [id],
    );
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    if (!isAdminRole(req.user.role) && reservation.userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const updates = {};
    if ("status" in rawUpdates) {
      const allowedStatuses = new Set(["CONFIRMED", "CANCELLED"]);
      if (
        typeof rawUpdates.status !== "string" ||
        !allowedStatuses.has(rawUpdates.status)
      ) {
        return res.status(400).json({ error: "Invalid status" });
      }
      updates.status = rawUpdates.status;
    }
    if ("date" in rawUpdates) {
      if (!isValidDateString(rawUpdates.date)) {
        return res
          .status(400)
          .json({ error: "Invalid date (expected YYYY-MM-DD)" });
      }
      updates.date = rawUpdates.date;
    }
    if ("timeSlot" in rawUpdates) {
      if (!isValidTimeSlot(rawUpdates.timeSlot)) {
        return res
          .status(400)
          .json({ error: "Invalid timeSlot (expected HH:MM-HH:MM)" });
      }
      updates.timeSlot = rawUpdates.timeSlot;
    }
    if ("title" in rawUpdates) {
      if (rawUpdates.title !== null && typeof rawUpdates.title !== "string") {
        return res.status(400).json({ error: "Invalid title" });
      }
      updates.title = rawUpdates.title ?? "";
    }
    if ("description" in rawUpdates) {
      if (
        rawUpdates.description !== null &&
        typeof rawUpdates.description !== "string"
      ) {
        return res.status(400).json({ error: "Invalid description" });
      }
      updates.description = rawUpdates.description ?? "";
    }
    if ("color" in rawUpdates) {
      if (rawUpdates.color !== null && typeof rawUpdates.color !== "string") {
        return res.status(400).json({ error: "Invalid color" });
      }
      updates.color = rawUpdates.color ?? "default";
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const fields = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = [...Object.values(updates), id];

    try {
      await db.execute(
        `UPDATE reservations SET ${fields} WHERE id = ?`,
        values,
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return res.status(409).json({ error: "Time slot already booked" });
      }
      throw error;
    }

    const updated = await db.queryOne(
      "SELECT * FROM reservations WHERE id = ?",
      [id],
    );

    // 广播预约更新（取消等操作）
    broadcast("reservation:updated", updated);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/reservations/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const reservation = await db.queryOne(
      "SELECT * FROM reservations WHERE id = ?",
      [id],
    );
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    if (!isAdminRole(req.user.role) && reservation.userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await db.execute("DELETE FROM reservations WHERE id = ?", [id]);

    // 广播预约删除
    broadcast("reservation:deleted", {
      id,
      deviceId: reservation.deviceId,
      date: reservation.date,
      timeSlot: reservation.timeSlot,
      status: reservation.status,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 日志相关 API ============

app.get("/api/logs", authenticateToken, async (req, res) => {
  try {
    const { search } = req.query;
    const limitRaw = req.query.limit;
    const limitParsed = limitRaw === undefined ? 50 : Number(limitRaw);
    const limit = Number.isFinite(limitParsed)
      ? Math.max(1, Math.min(200, Math.trunc(limitParsed)))
      : 50;

    let query = `
            SELECT l.*, u.name as userName
            FROM logs l
            LEFT JOIN users u ON l.userId = u.id
        `;
    const conditions = [];
    const params = [];

    if (!isAdminRole(req.user.role)) {
      conditions.push("l.userId = ?");
      params.push(req.user.id);
    }

    if (search) {
      conditions.push("(l.action LIKE ? OR l.details LIKE ? OR u.name LIKE ?)");
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY l.timestamp DESC LIMIT ?`;
    params.push(limit);

    const logs = await db.query(query, params);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/logs", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.execute("DELETE FROM logs");
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Data Retention (SUPER_ADMIN) ============

app.get(
  "/api/admin/retention",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      res.json(await getRetentionSettings(db));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.patch(
  "/api/admin/retention",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const updated = await updateRetentionSettings(db, req.body);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },
);

app.post(
  "/api/admin/retention/run",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const result = await runRetentionCleanup(db);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ============ Device Analysis Templates ============

app.get(
  "/api/device-analysis/templates",
  authenticateToken,
  async (req, res) => {
    try {
      const rows = await db.query(
        `
        SELECT id, name, configJson, createdAt, updatedAt
        FROM device_analysis_templates
        WHERE userId = ?
        ORDER BY updatedAt DESC
      `,
        [req.user.id],
      );

      // Deduplicate by name (keep most recently updated first).
      const seenNames = new Set();
      const templates = [];
      for (const row of rows) {
        const name = typeof row?.name === "string" ? row.name.trim() : "";
        if (!name) continue;
        if (seenNames.has(name)) continue;
        seenNames.add(name);

        const config = safeJsonParse(row.configJson, {});
        templates.push({
          ...(isPlainObject(config) ? config : {}),
          id: row.id,
          name,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        });
      }

      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.post(
  "/api/device-analysis/templates",
  authenticateToken,
  async (req, res) => {
    try {
      const config = sanitizeDeviceAnalysisTemplateConfig(req.body);
      if (!config.name) {
        return res.status(400).json({ error: "Template name is required" });
      }

      const now = new Date().toISOString();
      const existing = await db.queryOne(
        `
        SELECT id, createdAt
        FROM device_analysis_templates
        WHERE userId = ? AND name = ?
        ORDER BY updatedAt DESC
        LIMIT 1
      `,
        [req.user.id, config.name],
      );

      if (existing?.id) {
        await db.execute(
          `
          UPDATE device_analysis_templates
          SET configJson = ?, updatedAt = ?
          WHERE id = ? AND userId = ?
        `,
          [JSON.stringify(config), now, existing.id, req.user.id],
        );

        // Best-effort cleanup: remove any accidental duplicates with the same name.
        await db.execute(
          `
          DELETE FROM device_analysis_templates
          WHERE userId = ? AND name = ? AND id != ?
        `,
          [req.user.id, config.name, existing.id],
        );

        res.status(200).json({
          ...config,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: now,
        });
        return;
      }

      const id = makeId("da_template");
      await db.execute(
        `
        INSERT INTO device_analysis_templates (id, userId, name, configJson, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [id, req.user.id, config.name, JSON.stringify(config), now, now],
      );

      res.status(201).json({ ...config, id, createdAt: now, updatedAt: now });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.post(
  "/api/device-analysis/templates/bulk",
  authenticateToken,
  async (req, res) => {
    try {
      const input = Array.isArray(req.body)
        ? req.body
        : Array.isArray(req.body?.templates)
          ? req.body.templates
          : [];

      if (!input.length) return res.json([]);

      const now = new Date().toISOString();
      const upserted = [];

      for (const raw of input) {
        const config = sanitizeDeviceAnalysisTemplateConfig(raw);
        if (!config.name) continue;

        const existing = await db.queryOne(
          `
            SELECT id, createdAt
            FROM device_analysis_templates
            WHERE userId = ? AND name = ?
            ORDER BY updatedAt DESC
            LIMIT 1
          `,
          [req.user.id, config.name],
        );

        if (existing?.id) {
          await db.execute(
            `
              UPDATE device_analysis_templates
              SET configJson = ?, updatedAt = ?
              WHERE id = ? AND userId = ?
            `,
            [JSON.stringify(config), now, existing.id, req.user.id],
          );

          await db.execute(
            `
              DELETE FROM device_analysis_templates
              WHERE userId = ? AND name = ? AND id != ?
            `,
            [req.user.id, config.name, existing.id],
          );

          upserted.push({
            ...config,
            id: existing.id,
            createdAt: existing.createdAt,
            updatedAt: now,
          });
          continue;
        }

        const id = makeId("da_template");
        await db.execute(
          `
            INSERT INTO device_analysis_templates (id, userId, name, configJson, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [id, req.user.id, config.name, JSON.stringify(config), now, now],
        );
        upserted.push({ ...config, id, createdAt: now, updatedAt: now });
      }

      res.status(201).json(upserted);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.patch(
  "/api/device-analysis/templates/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const templateId = String(req.params.id || "");
      const existing = await db.queryOne(
        "SELECT id FROM device_analysis_templates WHERE id = ? AND userId = ?",
        [templateId, req.user.id],
      );
      if (!existing) return res.sendStatus(404);

      const config = sanitizeDeviceAnalysisTemplateConfig(req.body);
      if (!config.name) {
        return res.status(400).json({ error: "Template name is required" });
      }

      const now = new Date().toISOString();
      const nameConflict = await db.queryOne(
        `
          SELECT id
          FROM device_analysis_templates
          WHERE userId = ? AND name = ? AND id != ?
          ORDER BY updatedAt DESC
          LIMIT 1
        `,
        [req.user.id, config.name, templateId],
      );

      await db.execute(
        `
          UPDATE device_analysis_templates
          SET name = ?, configJson = ?, updatedAt = ?
          WHERE id = ? AND userId = ?
        `,
        [config.name, JSON.stringify(config), now, templateId, req.user.id],
      );

      if (nameConflict?.id) {
        // Best-effort cleanup: keep the edited template as the canonical one for this name.
        await db.execute(
          `
            DELETE FROM device_analysis_templates
            WHERE userId = ? AND name = ? AND id != ?
          `,
          [req.user.id, config.name, templateId],
        );
      }

      res.json({ ...config, id: templateId, updatedAt: now });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.delete(
  "/api/device-analysis/templates/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const templateId = String(req.params.id || "");
      const existing = await db.queryOne(
        "SELECT id FROM device_analysis_templates WHERE id = ? AND userId = ?",
        [templateId, req.user.id],
      );
      if (!existing) return res.sendStatus(404);

      await db.execute(
        "DELETE FROM device_analysis_templates WHERE id = ? AND userId = ?",
        [templateId, req.user.id],
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ============ Device Analysis Settings ============

app.get(
  "/api/device-analysis/settings",
  authenticateToken,
  async (req, res) => {
    try {
      const row = await db.queryOne(
        "SELECT yUnit, updatedAt FROM device_analysis_settings WHERE userId = ?",
        [req.user.id],
      );

      res.json({
        yUnit:
          row?.yUnit === "A" || row?.yUnit === "uA" || row?.yUnit === "nA"
            ? row.yUnit
            : "A",
        updatedAt: row?.updatedAt || null,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.patch(
  "/api/device-analysis/settings",
  authenticateToken,
  async (req, res) => {
    try {
      const settings = sanitizeDeviceAnalysisSettings(req.body);
      if (!settings.yUnit) {
        return res.status(400).json({ error: "Invalid yUnit" });
      }

      const now = new Date().toISOString();
      const existing = await db.queryOne(
        "SELECT userId FROM device_analysis_settings WHERE userId = ?",
        [req.user.id],
      );

      if (existing?.userId) {
        await db.execute(
          "UPDATE device_analysis_settings SET yUnit = ?, updatedAt = ? WHERE userId = ?",
          [settings.yUnit, now, req.user.id],
        );
      } else {
        await db.execute(
          "INSERT INTO device_analysis_settings (userId, yUnit, updatedAt) VALUES (?, ?, ?)",
          [req.user.id, settings.yUnit, now],
        );
      }

      res.json({ yUnit: settings.yUnit, updatedAt: now });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ============ Literature Research ============

app.get("/api/literature/settings", authenticateToken, async (req, res) => {
  try {
    const row = await db.queryOne(
      "SELECT configJson, updatedAt FROM literature_research_settings WHERE userId = ?",
      [req.user.id],
    );

    const config = safeJsonParse(row?.configJson, {});
    const seedUrls = Array.isArray(config?.seedUrls)
      ? config.seedUrls
          .map((value) => (value == null ? "" : String(value)))
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

    const startDate = isValidDateString(config?.startDate)
      ? config.startDate
      : null;
    const endDate = isValidDateString(config?.endDate) ? config.endDate : null;
    const maxResultsNumber = Number(config?.maxResults);
    const maxResults = Number.isFinite(maxResultsNumber)
      ? Math.max(1, Math.min(100, Math.trunc(maxResultsNumber)))
      : 100;

    res.json({
      seedUrls,
      startDate,
      endDate,
      maxResults,
      updatedAt: row?.updatedAt || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/literature/settings", authenticateToken, async (req, res) => {
  try {
    const settings = sanitizeLiteratureSettings(req.body);
    const now = new Date().toISOString();

    const existing = await db.queryOne(
      "SELECT userId FROM literature_research_settings WHERE userId = ?",
      [req.user.id],
    );

    const configJson = JSON.stringify(settings);

    if (existing?.userId) {
      await db.execute(
        "UPDATE literature_research_settings SET configJson = ?, updatedAt = ? WHERE userId = ?",
        [configJson, now, req.user.id],
      );
    } else {
      await db.execute(
        "INSERT INTO literature_research_settings (userId, configJson, updatedAt) VALUES (?, ?, ?)",
        [req.user.id, configJson, now],
      );
    }

    res.json({ ...settings, updatedAt: now });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/literature/search", authenticateToken, async (req, res) => {
  try {
    const body = isPlainObject(req.body) ? req.body : {};
    let { seedUrls, startDate, endDate, maxResults } = body;

    const needsStoredFallback =
      !Array.isArray(seedUrls) ||
      seedUrls.length === 0 ||
      !isValidDateString(startDate) ||
      !isValidDateString(endDate) ||
      maxResults == null;

    if (needsStoredFallback) {
      const row = await db.queryOne(
        "SELECT configJson FROM literature_research_settings WHERE userId = ?",
        [req.user.id],
      );
      const config = safeJsonParse(row?.configJson, {});

      if (!Array.isArray(seedUrls) || seedUrls.length === 0) {
        seedUrls = config?.seedUrls;
      }
      if (!isValidDateString(startDate)) startDate = config?.startDate;
      if (!isValidDateString(endDate)) endDate = config?.endDate;
      if (maxResults == null) maxResults = config?.maxResults;
    }

    const items = await searchLiterature({
      seedUrls,
      startDate,
      endDate,
      maxResults,
    });

    const enriched = await mapWithConcurrency(items, 6, async (item) => {
      const pdfUrl = typeof item?.pdfUrl === "string" ? item.pdfUrl : null;
      if (!pdfUrl) {
        return { ...item, downloadable: false, downloadUrl: null };
      }

      const probe = await probePdfUrl(pdfUrl);
      const isHtml = probe.contentType.includes("text/html");
      const looksLikePdf =
        probe.contentType.includes("pdf") ||
        probe.contentType.includes("octet-stream") ||
        pdfUrl.toLowerCase().endsWith(".pdf");

      // 1) Publicly fetchable PDF: proxy through backend for stable browser download.
      if (probe.ok && !isHtml && looksLikePdf) {
        const datePrefix = item?.publishedDate
          ? `${item.publishedDate} - `
          : "";
        const filename = sanitizeFilename(
          `${datePrefix}${item?.title || "article"}`,
        ).slice(0, 160);

        const token = createLiteratureDownloadToken({
          url: pdfUrl,
          filename: `${filename}.pdf`,
        });

        return {
          ...item,
          downloadable: true,
          downloadUrl: `/api/literature/download/${token}`,
        };
      }

      // 2) Not proxyable (e.g. 401/403, or returns HTML) but likely exists: let browser handle it directly.
      if (probe.status === 401 || probe.status === 403 || (probe.ok && isHtml)) {
        return {
          ...item,
          downloadable: true,
          downloadUrl: pdfUrl,
        };
      }

      // 3) Not found / unknown: disable.
      if (probe.status === 404) {
        return { ...item, downloadable: false, downloadUrl: null };
      }

      return {
        ...item,
        downloadable: false,
        downloadUrl: null,
      };
    });

    res.json(enriched);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get(
  "/api/literature/download/:token",
  authenticateToken,
  async (req, res) => {
    try {
      cleanupLiteratureDownloadTokens();
      const token = String(req.params.token || "");
      const entry = literatureDownloadTokens.get(token);
      if (!entry?.url) return res.status(404).json({ error: "Not found" });

      const upstream = await fetchWithTimeout(
        entry.url,
        {
          method: "GET",
          redirect: "follow",
          headers: {
            "User-Agent":
              "AppointerLiterature/0.1 (+https://localhost; purpose=literature-research)",
          },
        },
        20_000,
      );

      if (!upstream.ok) {
        return res.status(502).json({
          error: `Upstream failed: ${upstream.status} ${upstream.statusText}`,
        });
      }

      const contentType =
        upstream.headers.get("content-type") || "application/octet-stream";
      const contentLength = upstream.headers.get("content-length");

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${entry.filename || "article.pdf"}"`);
      res.setHeader("Cache-Control", "no-store");
      if (contentLength) res.setHeader("Content-Length", contentLength);

      if (!upstream.body) {
        return res.status(502).json({ error: "Upstream body missing" });
      }

      Readable.fromWeb(upstream.body).pipe(res);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ============ 申请相关 API ============

app.get("/api/requests", authenticateToken, async (req, res) => {
  try {
    const statusParam =
      typeof req.query.status === "string" ? req.query.status : "";
    const statuses = statusParam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => ["PENDING", "APPROVED", "REJECTED"].includes(s));

    const limitRaw = req.query.limit;
    const limitParsed = limitRaw === undefined ? null : Number(limitRaw);
    const limit = Number.isFinite(limitParsed)
      ? Math.max(1, Math.min(1000, Math.trunc(limitParsed)))
      : null;

    const offsetRaw = req.query.offset;
    const offsetParsed = offsetRaw === undefined ? null : Number(offsetRaw);
    const offset = Number.isFinite(offsetParsed)
      ? Math.max(0, Math.trunc(offsetParsed))
      : null;

    let query = `
            SELECT
                r.*,
                COALESCE(u.name, r.requesterName, 'Unknown') AS requesterDisplayName
            FROM requests r
            LEFT JOIN users u ON r.requesterId = u.id
        `;

    const conditions = [];
    const params = [];

    if (!isAdminRole(req.user.role)) {
      conditions.push("r.requesterId = ?");
      params.push(req.user.id);
    }

    if (statuses.length > 0) {
      conditions.push(`r.status IN (${statuses.map(() => "?").join(", ")})`);
      params.push(...statuses);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY r.createdAt DESC`;

    if (limit !== null) {
      query += ` LIMIT ?`;
      params.push(limit);
    }

    if (offset !== null) {
      query += ` OFFSET ?`;
      params.push(offset);
    }

    const requests = await db.query(query, params);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/requests", authenticateToken, async (req, res) => {
  try {
    const { type, targetId, originalData, newData, requesterName } = req.body;

    if (typeof type !== "string" || !type.trim()) {
      return res.status(400).json({ error: "type is required" });
    }

    const resolvedRequesterId = req.user.id;
    const user = await db.queryOne("SELECT name FROM users WHERE id = ?", [
      resolvedRequesterId,
    ]);
    const resolvedRequesterName =
      user?.name ||
      (typeof requesterName === "string" && requesterName.trim()
        ? requesterName.trim()
        : null) ||
      req.user.username ||
      "Unknown";

    const newRequest = {
      id: makeId("req"),
      requesterId: resolvedRequesterId,
      requesterName: resolvedRequesterName,
      type,
      targetId,
      originalData: JSON.stringify(originalData),
      newData: JSON.stringify(newData),
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };

    await db.execute(
      "INSERT INTO requests (id, requesterId, requesterName, type, targetId, originalData, newData, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        newRequest.id,
        newRequest.requesterId,
        newRequest.requesterName,
        newRequest.type,
        newRequest.targetId,
        newRequest.originalData,
        newRequest.newData,
        newRequest.status,
        newRequest.createdAt,
      ],
    );

    broadcast("request:created", newRequest);
    res.status(201).json(newRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  "/api/requests/:id/approve",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const request = await db.queryOne("SELECT * FROM requests WHERE id = ?", [
        id,
      ]);

      if (!request) return res.status(404).json({ error: "Request not found" });

      // Apply changes
      if (request.type === "INVENTORY_UPDATE") {
        const updates = JSON.parse(request.newData);
        const { name, category, quantity } = updates;
        const targetId = request.targetId;

        await db.execute(
          "UPDATE inventory SET name = ?, category = ?, quantity = ?, requesterName = ?, requesterId = ? WHERE id = ?",
          [
            name,
            category,
            quantity,
            request.requesterName,
            request.requesterId,
            targetId,
          ],
        );
      } else if (request.type === "INVENTORY_ADD") {
        const newItem = JSON.parse(request.newData);
        const itemId = makeId("item");
        const { name, category, quantity } = newItem;
        const date = new Date().toISOString().split("T")[0];

        await db.execute(
          "INSERT INTO inventory (id, name, category, quantity, date, requesterName, requesterId) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            itemId,
            name,
            category,
            quantity,
            date,
            request.requesterName,
            request.requesterId,
          ],
        );
      }

      // Update request status instead of deleting
      await db.execute("UPDATE requests SET status = 'APPROVED' WHERE id = ?", [
        id,
      ]);

      broadcast("request:approved", { id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.post(
  "/api/requests/:id/reject",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      await db.execute("UPDATE requests SET status = 'REJECTED' WHERE id = ?", [
        id,
      ]);
      broadcast("request:rejected", { id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.delete("/api/requests/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const request = await db.queryOne(
      "SELECT id, requesterId, status FROM requests WHERE id = ?",
      [id],
    );
    if (!request) return res.status(404).json({ error: "Request not found" });

    if (!isAdminRole(req.user.role)) {
      if (request.requesterId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (request.status !== "PENDING") {
        return res
          .status(400)
          .json({ error: "Only pending requests can be revoked" });
      }
    }

    await db.execute("DELETE FROM requests WHERE id = ?", [id]);
    broadcast("request:deleted", { id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
