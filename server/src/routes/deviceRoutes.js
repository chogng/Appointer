import express from "express";

import { db } from "../config/db.js";
import { enforceLogsMaxCount } from "../retention.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticateToken, requireAdmin } from "../middleware/authMiddleware.js";
import { safeJsonParse } from "../utils/json.js";
import { isPlainObject } from "../utils/objects.js";
import { makeId } from "../utils/ids.js";
import { assertAllowedKeys, requirePlainObject } from "../utils/validation.js";

export default function createDeviceRoutes({ broadcast } = {}) {
  const router = express.Router();

  router.get(
    "/",
    asyncHandler(async (_req, res) => {
      const devices = await db.query("SELECT * FROM devices");
      const parsed = devices.map((device) => ({
        ...device,
        isEnabled: Boolean(device.isEnabled),
        openDays: safeJsonParse(device.openDays, [1, 2, 3, 4, 5]),
        timeSlots: safeJsonParse(device.timeSlots, []),
        granularity: device.granularity || 60,
        openTime: device.openTime
          ? safeJsonParse(device.openTime, { start: "09:00", end: "18:00" })
          : { start: "09:00", end: "18:00" },
      }));
      res.json(parsed);
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
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
    }),
  );

  router.post(
    "/",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const body = requirePlainObject(req.body, "body");
      const {
        name,
        description,
        openDays,
        timeSlots,
        granularity = 60,
        openTime,
      } = body;
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Device name is required" });
      }
      if (typeof description !== "string") {
        return res.status(400).json({ error: "Invalid device description" });
      }
      if (openDays !== undefined && !Array.isArray(openDays)) {
        return res.status(400).json({ error: "Invalid openDays (expected array)" });
      }
      if (timeSlots !== undefined && !Array.isArray(timeSlots)) {
        return res.status(400).json({ error: "Invalid timeSlots (expected array)" });
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

      broadcast?.("device:created", result);

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
      await enforceLogsMaxCount(db);

      res.status(201).json(result);
    }),
  );

  router.patch(
    "/:id",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const rawUpdates = requirePlainObject(req.body, "update payload");
      assertAllowedKeys(rawUpdates, [
        "name",
        "description",
        "isEnabled",
        "openDays",
        "timeSlots",
        "granularity",
        "openTime",
      ]);

      const device = await db.queryOne("SELECT * FROM devices WHERE id = ?", [id]);
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
          return res.status(400).json({ error: "Invalid openDays (expected array)" });
        }
        updates.openDays = JSON.stringify(rawUpdates.openDays);
      }
      if ("timeSlots" in rawUpdates) {
        if (!Array.isArray(rawUpdates.timeSlots)) {
          return res.status(400).json({ error: "Invalid timeSlots (expected array)" });
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

      const updated = await db.queryOne("SELECT * FROM devices WHERE id = ?", [id]);
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

      broadcast?.("device:updated", result);

      res.json(result);
    }),
  );

  router.delete(
    "/:id",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { id } = req.params;

      const device = await db.queryOne("SELECT * FROM devices WHERE id = ?", [id]);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      await db.execute("DELETE FROM devices WHERE id = ?", [id]);

      broadcast?.("device:deleted", { id });

      res.json({ success: true });
    }),
  );

  return router;
}

