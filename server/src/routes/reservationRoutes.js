import express from "express";

import { db } from "../config/db.js";
import { upsertReservationCancelledLog, upsertReservationCreatedLog } from "../logAggregator.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticateToken, isAdminRole } from "../middleware/authMiddleware.js";
import { isUniqueConstraintError } from "../utils/dbErrors.js";
import { isValidDateString, isValidTimeSlot } from "../utils/dateTime.js";
import { makeId } from "../utils/ids.js";
import { assertAllowedKeys, requirePlainObject } from "../utils/validation.js";

export default function createReservationRoutes({ broadcast } = {}) {
  const router = express.Router();

  router.get(
    "/",
    authenticateToken,
    asyncHandler(async (req, res) => {
      const deviceId =
        typeof req.query.deviceId === "string" ? req.query.deviceId.trim() : "";
      const from = typeof req.query.from === "string" ? req.query.from.trim() : "";
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
          return res.status(400).json({ error: "Invalid from (expected YYYY-MM-DD)" });
        }
        conditions.push("date >= ?");
        params.push(from);
      }

      if (to) {
        if (!isValidDateString(to)) {
          return res.status(400).json({ error: "Invalid to (expected YYYY-MM-DD)" });
        }
        conditions.push("date <= ?");
        params.push(to);
      }

      if (active) {
        conditions.push("status != 'CANCELLED'");
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const reservations = await db.query(`SELECT * FROM reservations ${where}`, params);
      res.json(reservations);
    }),
  );

  router.post(
    "/",
    authenticateToken,
    asyncHandler(async (req, res) => {
      const body = requirePlainObject(req.body, "body");
      const { deviceId, date, timeSlot, title, description, color } = body;
      const userId = req.user.id;
      if (typeof deviceId !== "string" || !deviceId.trim()) {
        return res.status(400).json({ error: "deviceId is required" });
      }
      if (!isValidDateString(date)) {
        return res.status(400).json({ error: "Invalid date (expected YYYY-MM-DD)" });
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
        "SELECT * FROM reservations WHERE deviceId = ? AND date = ? AND timeSlot = ? AND status != 'CANCELLED'",
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

      await upsertReservationCreatedLog(db, {
        userId: newReservation.userId,
        deviceId: newReservation.deviceId,
      });

      broadcast?.("reservation:created", newReservation);

      res.status(201).json(newReservation);
    }),
  );

  router.patch(
    "/:id",
    authenticateToken,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const rawUpdates = requirePlainObject(req.body, "update payload");
      assertAllowedKeys(rawUpdates, [
        "status",
        "date",
        "timeSlot",
        "title",
        "description",
        "color",
      ]);

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
          return res.status(400).json({ error: "Invalid date (expected YYYY-MM-DD)" });
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
        if (rawUpdates.description !== null && typeof rawUpdates.description !== "string") {
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
        await db.execute(`UPDATE reservations SET ${fields} WHERE id = ?`, values);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return res.status(409).json({ error: "Time slot already booked" });
        }
        throw error;
      }

      const updated = await db.queryOne("SELECT * FROM reservations WHERE id = ?", [
        id,
      ]);

      if (updates.status === "CANCELLED" && reservation.status !== "CANCELLED") {
        await upsertReservationCancelledLog(db, {
          userId: reservation.userId,
          deviceId: reservation.deviceId,
        });
      }

      broadcast?.("reservation:updated", updated);

      res.json(updated);
    }),
  );

  router.delete(
    "/:id",
    authenticateToken,
    asyncHandler(async (req, res) => {
      const { id } = req.params;

      const reservation = await db.queryOne("SELECT * FROM reservations WHERE id = ?", [
        id,
      ]);
      if (!reservation) {
        return res.status(404).json({ error: "Reservation not found" });
      }

      if (!isAdminRole(req.user.role) && reservation.userId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await db.execute("DELETE FROM reservations WHERE id = ?", [id]);

      broadcast?.("reservation:deleted", {
        id,
        deviceId: reservation.deviceId,
        date: reservation.date,
        timeSlot: reservation.timeSlot,
        status: reservation.status,
      });

      res.json({ success: true });
    }),
  );

  return router;
}
