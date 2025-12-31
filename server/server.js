import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

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
} from "./retention.js";

const app = express();
const httpServer = createServer(app);

const corsOriginEnv = process.env.CORS_ORIGIN || process.env.CLIENT_ORIGIN;
const corsOrigins = (corsOriginEnv || DEFAULT_CLIENT_ORIGIN)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

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
  return (
    msg.includes("UNIQUE constraint failed") ||
    msg.includes("constraint failed")
  );
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

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Socket.IO auth: require a valid session token (cookie or bearer) before receiving broadcasts
io.use((socket, next) => {
  try {
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

    jwt.verify(token, JWT_SECRET, (err, payload) => {
      if (err) return next(new Error("Unauthorized"));

      const dbUser = db.queryOne(
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
    });
  } catch {
    next(new Error("Unauthorized"));
  }
});

const PORT = Number(process.env.PORT) || 3001;

// Middleware
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);
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
  (req, res) => {
    try {
      const users = db.query("SELECT id, username, name, role FROM users");
      const reservations = db.query(
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

app.get("/api/users", authenticateToken, requireAdmin, (req, res) => {
  try {
    const users = db.query(
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

    const existing = db.queryOne("SELECT id FROM users WHERE username = ?", [
      username,
    ]);
    if (existing) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id: "user_" + Date.now(),
      username,
      password: hashedPassword,
      role: "USER",
      status: "PENDING",
      name,
      email,
      expiryDate: expiryDate || null,
    };

    db.execute(
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

      const existing = db.queryOne("SELECT id FROM users WHERE username = ?", [
        username,
      ]);
      if (existing) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = {
        id: "user_" + Date.now(),
        username,
        password: hashedPassword,
        role: role,
        status: "ACTIVE", // Admin-created users are active by default
        name,
        email,
        expiryDate: expiryDate || null,
      };

      db.execute(
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
      db.execute(
        "INSERT INTO logs (id, userId, action, details, timestamp) VALUES (?, ?, ?, ?, ?)",
        [
          "log_" + Date.now(),
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

app.patch("/api/users/:id", authenticateToken, (req, res) => {
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

    const user = db.queryOne("SELECT * FROM users WHERE id = ?", [id]);
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
        const existing = db.queryOne(
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

    db.execute(`UPDATE users SET ${fields} WHERE id = ?`, values);

    const updated = db.queryOne(
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

app.delete("/api/users/:id", authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const user = db.queryOne("SELECT * FROM users WHERE id = ?", [id]);

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

    db.execute("DELETE FROM users WHERE id = ?", [id]);

    // Broadcast user deletion
    broadcast("user:deleted", { id });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Blocklist Management
app.get("/api/users/:id/blocklist", authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    // Allow admins or the user themselves to view blocklist
    if (!isAdminRole(req.user.role) && req.user.id !== id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const blockedDevices = db.query(
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
  (req, res) => {
    try {
      const { id } = req.params;
      const { deviceId, reason } = req.body;

      if (!deviceId)
        return res.status(400).json({ error: "deviceId is required" });

      const blockId = "blk_" + Date.now();
      const createdAt = new Date().toISOString();

      try {
        db.execute(
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
  (req, res) => {
    try {
      const { id, deviceId } = req.params;
      db.execute("DELETE FROM blocklist WHERE userId = ? AND deviceId = ?", [
        id,
        deviceId,
      ]);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ============ 设备相关 API ============

app.get("/api/devices", (req, res) => {
  try {
    const devices = db.query("SELECT * FROM devices");
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

app.get("/api/devices/:id", (req, res) => {
  try {
    const device = db.queryOne("SELECT * FROM devices WHERE id = ?", [
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

app.post("/api/devices", authenticateToken, requireAdmin, (req, res) => {
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
      id: "dev_" + Date.now(),
      name: name.trim(),
      description,
      isEnabled: 1,
      openDays: JSON.stringify(openDays || [1, 2, 3, 4, 5]),
      timeSlots: JSON.stringify(timeSlots || []),
      granularity: parsedGranularity,
      openTime: JSON.stringify(openTime || { start: "09:00", end: "18:00" }),
    };

    db.execute(
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
    db.execute(
      "INSERT INTO logs (id, userId, action, details, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        "log_" + Date.now(),
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

app.patch("/api/devices/:id", authenticateToken, requireAdmin, (req, res) => {
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

    const device = db.queryOne("SELECT * FROM devices WHERE id = ?", [id]);
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

    db.execute(`UPDATE devices SET ${fields} WHERE id = ?`, values);

    const updated = db.queryOne("SELECT * FROM devices WHERE id = ?", [id]);
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
});

app.delete("/api/devices/:id", authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;

    const device = db.queryOne("SELECT * FROM devices WHERE id = ?", [id]);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    db.execute("DELETE FROM devices WHERE id = ?", [id]);

    // 广播设备删除
    broadcast("device:deleted", { id });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 库存相关 API ============

app.get("/api/inventory", authenticateToken, (req, res) => {
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

    const items = db.query(query, params);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/inventory", authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, category, quantity } = req.body;
    if (!name || !category || quantity === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get the authenticated user's information
    const requesterId = req.user.id;
    const user = db.queryOne("SELECT name FROM users WHERE id = ?", [
      requesterId,
    ]);
    const requesterName = user?.name || req.user.username || "Unknown";

    const itemId = "item_" + Date.now();
    const date = new Date().toISOString().split("T")[0];

    db.execute(
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
    const newItem = db.queryOne(
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
});

app.patch("/api/inventory/:id", authenticateToken, requireAdmin, (req, res) => {
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
    db.execute(
      `UPDATE inventory SET ${updates.join(", ")} WHERE id = ?`,
      values,
    );

    const updatedItem = db.queryOne("SELECT * FROM inventory WHERE id = ?", [
      id,
    ]);
    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete(
  "/api/inventory/:id",
  authenticateToken,
  requireAdmin,
  (req, res) => {
    try {
      const { id } = req.params;
      db.execute("DELETE FROM inventory WHERE id = ?", [id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ============ 预约相关 API ============

app.get("/api/reservations", authenticateToken, (req, res) => {
  try {
    const reservations = db.query("SELECT * FROM reservations");
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/reservations", authenticateToken, (req, res) => {
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

    const device = db.queryOne(
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
    const blockEntry = db.queryOne(
      "SELECT reason FROM blocklist WHERE userId = ? AND deviceId = ?",
      [userId, deviceId],
    );

    if (blockEntry) {
      return res.status(403).json({
        error: `You are banned from booking this device. Reason: ${blockEntry.reason || "Violation of usage policy"}`,
      });
    }

    const conflict = db.queryOne(
      `SELECT * FROM reservations WHERE deviceId = ? AND date = ? AND timeSlot = ? AND status != 'CANCELLED'`,
      [deviceId, date, timeSlot],
    );

    if (conflict) {
      return res.status(409).json({ error: "Time slot already booked" });
    }

    const newReservation = {
      id: "res_" + Date.now(),
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
      db.execute(
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
    db.execute(
      "INSERT INTO logs (id, userId, action, details, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        "log_" + Date.now(),
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

app.patch("/api/reservations/:id", authenticateToken, (req, res) => {
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

    const reservation = db.queryOne("SELECT * FROM reservations WHERE id = ?", [
      id,
    ]);
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
      db.execute(`UPDATE reservations SET ${fields} WHERE id = ?`, values);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return res.status(409).json({ error: "Time slot already booked" });
      }
      throw error;
    }

    const updated = db.queryOne("SELECT * FROM reservations WHERE id = ?", [
      id,
    ]);

    // 广播预约更新（取消等操作）
    broadcast("reservation:updated", updated);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/reservations/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    const reservation = db.queryOne("SELECT * FROM reservations WHERE id = ?", [
      id,
    ]);
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    if (!isAdminRole(req.user.role) && reservation.userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    db.execute("DELETE FROM reservations WHERE id = ?", [id]);

    // 广播预约删除
    broadcast("reservation:deleted", { id });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 日志相关 API ============

app.get("/api/logs", authenticateToken, (req, res) => {
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

    const logs = db.query(query, params);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/logs", authenticateToken, requireAdmin, (req, res) => {
  try {
    db.execute("DELETE FROM logs");
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
  (req, res) => {
    try {
      res.json(getRetentionSettings(db));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.patch(
  "/api/admin/retention",
  authenticateToken,
  requireSuperAdmin,
  (req, res) => {
    try {
      const updated = updateRetentionSettings(db, req.body);
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
  (req, res) => {
    try {
      const result = runRetentionCleanup(db);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ============ 申请相关 API ============

app.get("/api/requests", authenticateToken, (req, res) => {
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

    const requests = db.query(query, params);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/requests", authenticateToken, (req, res) => {
  try {
    const { type, targetId, originalData, newData, requesterName } = req.body;

    if (typeof type !== "string" || !type.trim()) {
      return res.status(400).json({ error: "type is required" });
    }

    const resolvedRequesterId = req.user.id;
    const user = db.queryOne("SELECT name FROM users WHERE id = ?", [
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
      id: "req_" + Date.now(),
      requesterId: resolvedRequesterId,
      requesterName: resolvedRequesterName,
      type,
      targetId,
      originalData: JSON.stringify(originalData),
      newData: JSON.stringify(newData),
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };

    db.execute(
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
  (req, res) => {
    try {
      const { id } = req.params;
      const request = db.queryOne("SELECT * FROM requests WHERE id = ?", [id]);

      if (!request) return res.status(404).json({ error: "Request not found" });

      // Apply changes
      if (request.type === "INVENTORY_UPDATE") {
        const updates = JSON.parse(request.newData);
        const { name, category, quantity } = updates;
        const targetId = request.targetId;

        db.execute(
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
        const itemId = "item_" + Date.now();
        const { name, category, quantity } = newItem;
        const date = new Date().toISOString().split("T")[0];

        db.execute(
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
      db.execute("UPDATE requests SET status = 'APPROVED' WHERE id = ?", [id]);

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
  (req, res) => {
    try {
      const { id } = req.params;
      db.execute("UPDATE requests SET status = 'REJECTED' WHERE id = ?", [id]);
      broadcast("request:rejected", { id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.delete("/api/requests/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    const request = db.queryOne(
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

    db.execute("DELETE FROM requests WHERE id = ?", [id]);
    broadcast("request:deleted", { id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 启动服务器
httpServer.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`🔌 WebSocket 已启用`);
});
