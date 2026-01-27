import express from "express";

import { db } from "../config/db.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  authenticateToken,
  requireAdmin,
  isAdminRole,
} from "../middleware/authMiddleware.js";
import { makeId } from "../utils/ids.js";
import {
  optionalInteger,
  optionalString,
  requireOneOf,
  requirePlainObject,
  requireString,
} from "../utils/validation.js";

export default function createRequestRoutes({ broadcast } = {}) {
  const router = express.Router();

  router.get(
    "/",
    authenticateToken,
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

      query += " ORDER BY r.createdAt DESC";

      if (limit !== undefined) {
        query += " LIMIT ?";
        params.push(limit);
      }

      if (offset !== undefined) {
        query += " OFFSET ?";
        params.push(offset);
      }

      const requests = await db.query(query, params);
      res.json(requests);
    }),
  );

  router.post(
    "/",
    authenticateToken,
    asyncHandler(async (req, res) => {
      const body = requirePlainObject(req.body, "body");
      const type = requireOneOf(body.type, "type", [
        "INVENTORY_UPDATE",
        "INVENTORY_ADD",
      ]);

      const resolvedRequesterId = req.user.id;
      const user = await db.queryOne("SELECT name FROM users WHERE id = ?", [
        resolvedRequesterId,
      ]);
      const requesterNameInput = optionalString(body.requesterName, "requesterName", {
        maxLength: 255,
      });
      const resolvedRequesterName =
        user?.name || requesterNameInput || req.user.username || "Unknown";

      const targetId =
        type === "INVENTORY_UPDATE"
          ? requireString(body.targetId, "targetId", { maxLength: 64 })
          : null;

      const originalDataJson = JSON.stringify(body.originalData ?? null);
      const newData = requirePlainObject(body.newData, "newData");
      const newDataJson = JSON.stringify(newData);

      const newRequest = {
        id: makeId("req"),
        requesterId: resolvedRequesterId,
        requesterName: resolvedRequesterName,
        type,
        targetId,
        originalData: originalDataJson,
        newData: newDataJson,
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

      broadcast?.("request:created", newRequest);
      res.status(201).json(newRequest);
    }),
  );

  router.post(
    "/:id/approve",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const request = await db.queryOne("SELECT * FROM requests WHERE id = ?", [
        id,
      ]);

      if (!request) return res.status(404).json({ error: "Request not found" });
      if (request.status !== "PENDING") {
        return res
          .status(400)
          .json({ error: "Only pending requests can be approved" });
      }

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

      await db.execute("UPDATE requests SET status = 'APPROVED' WHERE id = ?", [
        id,
      ]);

      broadcast?.("request:approved", { id });
      res.json({ success: true });
    }),
  );

  router.post(
    "/:id/reject",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const request = await db.queryOne(
        "SELECT id, status FROM requests WHERE id = ?",
        [id],
      );
      if (!request) return res.status(404).json({ error: "Request not found" });
      if (request.status !== "PENDING") {
        return res
          .status(400)
          .json({ error: "Only pending requests can be rejected" });
      }

      await db.execute("UPDATE requests SET status = 'REJECTED' WHERE id = ?", [
        id,
      ]);
      broadcast?.("request:rejected", { id });
      res.json({ success: true });
    }),
  );

  router.delete(
    "/:id",
    authenticateToken,
    asyncHandler(async (req, res) => {
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
          return res.status(400).json({ error: "Only pending requests can be revoked" });
        }
      }

      await db.execute("DELETE FROM requests WHERE id = ?", [id]);
      broadcast?.("request:deleted", { id });
      res.json({ success: true });
    }),
  );

  return router;
}

