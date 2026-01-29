import bcrypt from "bcrypt";
import express from "express";
import fs from "fs";
import path from "path";

import { db } from "../config/db.js";
import {
  authenticateToken,
  requireAdmin,
  isAdminRole,
} from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  assertAllowedKeys,
  optionalInteger,
  optionalString,
  requireOneOf,
  requirePlainObject,
  requireString,
} from "../utils/validation.js";
import { isUniqueConstraintError } from "../utils/dbErrors.js";
import { isValidDateString } from "../utils/dateTime.js";
import { makeId } from "../utils/ids.js";
import { enforceLogsMaxCount } from "../retention.js";

export default function createUserRoutes({
  broadcast,
  avatarUpload,
  avatarsDir,
} = {}) {
  const router = express.Router();

  if (!avatarUpload) {
    throw new Error("[userRoutes] avatarUpload is required");
  }
  if (!avatarsDir) {
    throw new Error("[userRoutes] avatarsDir is required");
  }

  router.get(
    "/users",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const users = await db.query(
        "SELECT id, username, role, status, name, email, expiryDate, avatarUrl FROM users",
      );
      res.json(users);
    }),
  );

  router.get(
    "/user-applications",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const statusParam = typeof req.query.status === "string" ? req.query.status : "";
      const statuses = statusParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => ["PENDING", "APPROVED", "REJECTED"].includes(s));

      const limit = optionalInteger(req.query.limit, "limit", {
        min: 1,
        max: 1000,
      });
      const offset = optionalInteger(req.query.offset, "offset", {
        min: 0,
        max: Number.MAX_SAFE_INTEGER,
      });

      const conditions = [];
      const params = [];
      if (statuses.length > 0) {
        conditions.push(`status IN (${statuses.map(() => "?").join(", ")})`);
        params.push(...statuses);
      }

      let query =
        "SELECT id, username, status, name, email, expiryDate, createdAt, reviewedAt, reviewerId, approvedUserId FROM user_applications";
      if (conditions.length > 0) query += ` WHERE ${conditions.join(" AND ")}`;
      query += " ORDER BY createdAt DESC";

      if (limit !== undefined) {
        query += " LIMIT ?";
        params.push(limit);
      }
      if (offset !== undefined) {
        query += " OFFSET ?";
        params.push(offset);
      }

      const applications = await db.query(query, params);
      res.json(applications);
    }),
  );

  router.post(
    "/user-applications/:id/approve",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const application = await db.queryOne(
        "SELECT * FROM user_applications WHERE id = ?",
        [id],
      );

      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      if (application.status !== "PENDING") {
        return res
          .status(400)
          .json({ error: "Only pending applications can be approved" });
      }

      const username = application.username;
      const existingUser = await db.queryOne(
        "SELECT id FROM users WHERE username = ?",
        [username],
      );
      if (existingUser) {
        return res.status(409).json({ error: "Username already exists" });
      }

      const createdUser = {
        id: makeId("user"),
        username,
        password: application.password,
        role: "USER",
        status: "ACTIVE",
        name: application.name,
        email: application.email,
        expiryDate: application.expiryDate || null,
        avatarUrl: null,
      };

      await db.execute(
        "INSERT INTO users (id, username, password, role, status, name, email, expiryDate, avatarUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          createdUser.id,
          createdUser.username,
          createdUser.password,
          createdUser.role,
          createdUser.status,
          createdUser.name,
          createdUser.email,
          createdUser.expiryDate,
          createdUser.avatarUrl,
        ],
      );

      const reviewedAt = new Date().toISOString();
      await db.execute(
        "UPDATE user_applications SET status = 'APPROVED', reviewedAt = ?, reviewerId = ?, approvedUserId = ? WHERE id = ?",
        [reviewedAt, req.user.id, createdUser.id, id],
      );

      broadcast?.("user_application:approved", { id, approvedUserId: createdUser.id });
      broadcast?.("user:created", {
        id: createdUser.id,
        username: createdUser.username,
        role: createdUser.role,
        status: createdUser.status,
        name: createdUser.name,
        email: createdUser.email,
        expiryDate: createdUser.expiryDate,
        avatarUrl: createdUser.avatarUrl,
      });

      await db.execute(
        "INSERT INTO logs (id, userId, action, details, timestamp) VALUES (?, ?, ?, ?, ?)",
        [
          makeId("log"),
          req.user.id,
          "USER_CREATED",
          `Approved application for ${username}`,
          reviewedAt,
        ],
      );
      await enforceLogsMaxCount(db);

      res.json({ success: true, approvedUserId: createdUser.id });
    }),
  );

  router.post(
    "/user-applications/:id/reject",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const application = await db.queryOne(
        "SELECT id, status FROM user_applications WHERE id = ?",
        [id],
      );

      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      if (application.status !== "PENDING") {
        return res
          .status(400)
          .json({ error: "Only pending applications can be rejected" });
      }

      const reviewedAt = new Date().toISOString();
      await db.execute(
        "UPDATE user_applications SET status = 'REJECTED', reviewedAt = ?, reviewerId = ? WHERE id = ?",
        [reviewedAt, req.user.id, id],
      );

      broadcast?.("user_application:rejected", { id });
      res.json({ success: true });
    }),
  );

  router.delete(
    "/user-applications/reviewed",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const countRow = await db.queryOne(
        "SELECT COUNT(*) AS count FROM user_applications WHERE status <> 'PENDING'",
      );
      const deletedCount = Number(countRow?.count || 0);

      await db.execute("DELETE FROM user_applications WHERE status <> 'PENDING'");

      broadcast?.("user_application:reviewed_deleted", { deletedCount });
      res.json({ success: true, deletedCount });
    }),
  );

  router.post(
    "/users/:id/avatar",
    authenticateToken,
    avatarUpload.single("avatar"),
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      if (!req.file) {
        return res.status(400).json({ error: "Missing avatar file" });
      }

      const target = await db.queryOne(
        "SELECT id, role, avatarUrl FROM users WHERE id = ?",
        [id],
      );
      if (!target) {
        return res.status(404).json({ error: "User not found" });
      }

      const isSelf = req.user.id === id;
      if (!isSelf) {
        if (!isAdminRole(req.user.role)) {
          return res.status(403).json({ error: "Forbidden" });
        }
        if (req.user.role === "ADMIN" && target.role !== "USER") {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      const avatarUrl = `/api/uploads/avatars/${req.file.filename}`;

      const previous =
        typeof target.avatarUrl === "string" ? target.avatarUrl : "";
      if (previous.startsWith("/api/uploads/avatars/")) {
        const previousName = path.basename(previous);
        const previousPath = path.join(avatarsDir, previousName);
        fs.promises.unlink(previousPath).catch(() => {});
      }

      await db.execute("UPDATE users SET avatarUrl = ? WHERE id = ?", [
        avatarUrl,
        id,
      ]);

      const updated = await db.queryOne(
        "SELECT id, username, role, status, name, email, expiryDate, avatarUrl FROM users WHERE id = ?",
        [id],
      );

      broadcast?.("user:updated", updated);
      res.json(updated);
    }),
  );

  router.post(
    "/users",
    asyncHandler(async (req, res) => {
      const body = requirePlainObject(req.body, "body");

      const username = requireString(body.username, "username", { maxLength: 64 });
      const password = requireString(body.password, "password", {
        trim: false,
        maxLength: 512,
      });
      const name = requireString(body.name, "name", { maxLength: 255 });
      const email = requireString(body.email, "email", { maxLength: 255 });

      const expiryDateInput = optionalString(body.expiryDate, "expiryDate", {
        maxLength: 10,
      });
      const expiryDate = expiryDateInput ? expiryDateInput.trim() : "";
      if (expiryDate && !isValidDateString(expiryDate)) {
        return res
          .status(400)
          .json({ error: "Invalid expiryDate (expected YYYY-MM-DD)" });
      }

      const existing = await db.queryOne(
        "SELECT id FROM users WHERE username = ?",
        [username],
      );
      if (existing) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const existingApplication = await db.queryOne(
        "SELECT id FROM user_applications WHERE username = ?",
        [username],
      );
      if (existingApplication) {
        return res.status(409).json({ error: "Username already exists" });
      }

      const application = {
        id: makeId("app"),
        username,
        password: hashedPassword,
        status: "PENDING",
        name,
        email,
        expiryDate: expiryDate || null,
        createdAt: new Date().toISOString(),
      };

      try {
        await db.execute(
          "INSERT INTO user_applications (id, username, password, status, name, email, expiryDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            application.id,
            application.username,
            application.password,
            application.status,
            application.name,
            application.email,
            application.expiryDate,
            application.createdAt,
          ],
        );
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return res.status(409).json({ error: "Username already exists" });
        }
        throw error;
      }

      const { password: _, ...appWithoutPassword } = application;

      broadcast?.("user_application:created", appWithoutPassword);

      res.status(201).json(appWithoutPassword);
    }),
  );

  router.post(
    "/admin/users",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const body = requirePlainObject(req.body, "body");

      const username = requireString(body.username, "username", { maxLength: 64 });
      const password = requireString(body.password, "password", {
        trim: false,
        maxLength: 512,
      });
      const name = requireString(body.name, "name", { maxLength: 255 });
      const email = requireString(body.email, "email", { maxLength: 255 });
      const role = requireOneOf(body.role, "role", ["ADMIN", "USER"]);

      const expiryDateInput = optionalString(body.expiryDate, "expiryDate", {
        maxLength: 10,
      });
      const expiryDate = expiryDateInput ? expiryDateInput.trim() : "";
      if (expiryDate && !isValidDateString(expiryDate)) {
        return res
          .status(400)
          .json({ error: "Invalid expiryDate (expected YYYY-MM-DD)" });
      }

      if (req.user.role === "ADMIN" && role !== "USER") {
        return res
          .status(403)
          .json({ error: "Admins can only create ordinary users" });
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
        role,
        status: "ACTIVE",
        name,
        email,
        expiryDate: expiryDate || null,
      };

      try {
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
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return res.status(409).json({ error: "Username already exists" });
        }
        throw error;
      }

      const { password: _, ...userWithoutPassword } = newUser;

      broadcast?.("user:created", userWithoutPassword);

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
      await enforceLogsMaxCount(db);

      res.status(201).json(userWithoutPassword);
    }),
  );

  router.patch(
    "/users/:id",
    authenticateToken,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const rawUpdates = requirePlainObject(req.body, "update payload");
      assertAllowedKeys(rawUpdates, [
        "role",
        "status",
        "name",
        "email",
        "expiryDate",
        "username",
      ]);

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
        "SELECT id, username, role, status, name, email, expiryDate, avatarUrl FROM users WHERE id = ?",
        [id],
      );

      broadcast?.("user:updated", updated);

      res.json(updated);
    }),
  );

  router.delete(
    "/users/:id",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const user = await db.queryOne("SELECT * FROM users WHERE id = ?", [id]);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.id === req.user.id) {
        return res.status(400).json({ error: "Cannot delete yourself" });
      }

      if (req.user.role === "ADMIN" && user.role !== "USER") {
        return res.status(403).json({ error: "Forbidden" });
      }

      await db.execute("DELETE FROM users WHERE id = ?", [id]);

      broadcast?.("user:deleted", { id });

      res.json({ success: true });
    }),
  );

  router.get(
    "/users/:id/blocklist",
    authenticateToken,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      if (!isAdminRole(req.user.role) && req.user.id !== id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const blockedDevices = await db.query(
        "SELECT deviceId, reason, createdAt FROM blocklist WHERE userId = ?",
        [id],
      );
      res.json(blockedDevices);
    }),
  );

  router.post(
    "/users/:id/blocklist",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const body = requirePlainObject(req.body, "body");
      const deviceId = requireString(body.deviceId, "deviceId", { maxLength: 64 });
      const reason = optionalString(body.reason, "reason", { maxLength: 1024 });

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
    }),
  );

  router.delete(
    "/users/:id/blocklist/:deviceId",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { id, deviceId } = req.params;
      await db.execute("DELETE FROM blocklist WHERE userId = ? AND deviceId = ?", [
        id,
        deviceId,
      ]);

      res.json({ success: true });
    }),
  );

  return router;
}
