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

const REQUEST_TYPES = ["INVENTORY_UPDATE", "INVENTORY_ADD"];
const REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"];

export default function createRequestRoutes({ broadcast } = {}) {
  const router = express.Router();

  const normalizeInventoryData = (value) => {
    if (!value) return null;
    let parsed = value;
    if (typeof value === "string") {
      try {
        parsed = JSON.parse(value);
      } catch {
        return null;
      }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    const name = typeof parsed.name === "string" ? parsed.name : "";
    const category = typeof parsed.category === "string" ? parsed.category : "";
    const quantity = Number(parsed.quantity);

    return {
      name,
      category,
      quantity: Number.isFinite(quantity) ? quantity : 0,
    };
  };

  router.delete(
    "/reviewed",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const statuses = ["APPROVED", "REJECTED"];
      const countRow = await db.queryOne(
        `SELECT COUNT(*) AS count FROM requests WHERE status IN (?, ?)`,
        statuses,
      );
      const deletedCount = Number(countRow?.count || 0);

      await db.execute(`DELETE FROM requests WHERE status IN (?, ?)`, statuses);

      broadcast?.("request:bulk_deleted", { statuses, deletedCount });
      res.json({ success: true, deletedCount });
    }),
  );

  router.get(
    "/",
      authenticateToken,
      asyncHandler(async (req, res) => {
        const statusParam = typeof req.query.status === "string" ? req.query.status : "";

        const statuses = statusParam
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
          .filter((s) => REQUEST_STATUSES.includes(s));

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
        if (db.dialect === "mysql") {
          query += ` LIMIT ${limit}`;
        } else {
          query += " LIMIT ?";
          params.push(limit);
        }
      }

      if (offset !== undefined) {
        if (db.dialect === "mysql") {
          // MySQL requires LIMIT when using OFFSET. Use a very large LIMIT when offset is provided alone.
          if (limit === undefined) query += " LIMIT 18446744073709551615";
          query += ` OFFSET ${offset}`;
        } else {
          query += " OFFSET ?";
          params.push(offset);
        }
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
      const type = requireOneOf(body.type, "type", REQUEST_TYPES);

      const resolvedRequesterId = req.user.id;
      const requesterNameInput = optionalString(body.requesterName, "requesterName", {
        maxLength: 255,
      });
      const resolvedRequesterName =
        req.user?.name || requesterNameInput || req.user.username || "Unknown";

      const targetId =
        type === "INVENTORY_UPDATE"
          ? requireString(body.targetId, "targetId", { maxLength: 64 })
          : null;

      const originalDataNormalized =
        type === "INVENTORY_UPDATE" ? normalizeInventoryData(body.originalData) : null;
      const newData = requirePlainObject(body.newData, "newData");
      const newDataNormalized = normalizeInventoryData(newData);
      if (!newDataNormalized) {
        return res.status(400).json({ error: "Invalid newData" });
      }

      const originalDataJson = JSON.stringify(originalDataNormalized);
      const newDataJson = JSON.stringify(newDataNormalized);

      // De-dupe only applies to inventory modifications (INVENTORY_UPDATE).
      // Inventory additions (INVENTORY_ADD) should allow multiple pending requests.
      if (type === "INVENTORY_UPDATE") {
        const findExistingPendingSql =
          "SELECT * FROM requests WHERE requesterId = ? AND type = ? AND status = 'PENDING' AND ((targetId IS NULL AND ? IS NULL) OR targetId = ?) ORDER BY createdAt DESC LIMIT 1";
        const existingPending = await db.queryOne(
          findExistingPendingSql,
          [resolvedRequesterId, type, targetId, targetId],
        );

        if (existingPending) {
          // If the user re-submits the same request, don't create duplicates.
          if (
            String(existingPending.newData || "") === newDataJson &&
            String(existingPending.originalData || "") === originalDataJson
          ) {
            return res.json({ ...existingPending, deduped: true });
          }

          await db.execute(
            "UPDATE requests SET originalData = ?, newData = ? WHERE id = ?",
            [originalDataJson, newDataJson, existingPending.id],
          );

          broadcast?.("request:updated", { id: existingPending.id });
          return res.json({
            ...existingPending,
            originalData: originalDataJson,
            newData: newDataJson,
          });
        }
      }

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
        const updates = normalizeInventoryData(request.newData);
        if (!updates) return res.status(400).json({ error: "Invalid request newData" });
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
        const newItem = normalizeInventoryData(request.newData);
        if (!newItem) return res.status(400).json({ error: "Invalid request newData" });
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
