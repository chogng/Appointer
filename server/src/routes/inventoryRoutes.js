import express from "express";

import { db } from "../config/db.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticateToken, requireAdmin } from "../middleware/authMiddleware.js";
import { makeId } from "../utils/ids.js";
import {
  assertAllowedKeys,
  requireInteger,
  requirePlainObject,
  requireString,
} from "../utils/validation.js";

export default function createInventoryRoutes() {
  const router = express.Router();

  router.get(
    "/",
    authenticateToken,
    asyncHandler(async (req, res) => {
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
    }),
  );

  router.post(
    "/",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const body = requirePlainObject(req.body, "body");
      const name = requireString(body.name, "name", { maxLength: 255 });
      const category = requireString(body.category, "category", { maxLength: 255 });
      const quantity = requireInteger(body.quantity, "quantity", { min: 0 });

      const requesterId = req.user.id;
      const user = await db.queryOne("SELECT name FROM users WHERE id = ?", [
        requesterId,
      ]);
      const requesterName = user?.name || req.user.username || "Unknown";

      const itemId = makeId("item");
      const date = new Date().toISOString().split("T")[0];

      await db.execute(
        "INSERT INTO inventory (id, name, category, quantity, date, requesterName, requesterId) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [itemId, name, category, quantity, date, requesterName, requesterId],
      );

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
    }),
  );

  router.patch(
    "/:id",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const body = requirePlainObject(req.body, "body");
      assertAllowedKeys(body, ["name", "category", "quantity"]);

      const updates = [];
      const values = [];

      if ("name" in body) {
        const name = requireString(body.name, "name", { maxLength: 255 });
        updates.push("name = ?");
        values.push(name);
      }
      if ("category" in body) {
        const category = requireString(body.category, "category", { maxLength: 255 });
        updates.push("category = ?");
        values.push(category);
      }
      if ("quantity" in body) {
        const quantity = requireInteger(body.quantity, "quantity", { min: 0 });
        updates.push("quantity = ?");
        values.push(quantity);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      values.push(id);
      await db.execute(`UPDATE inventory SET ${updates.join(", ")} WHERE id = ?`, [
        ...values,
      ]);

      const updatedItem = await db.queryOne("SELECT * FROM inventory WHERE id = ?", [
        id,
      ]);
      if (!updatedItem) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      res.json(updatedItem);
    }),
  );

  router.delete(
    "/:id",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const existing = await db.queryOne("SELECT id FROM inventory WHERE id = ?", [
        id,
      ]);
      if (!existing) {
        return res.status(404).json({ error: "Inventory item not found" });
      }

      await db.execute("DELETE FROM inventory WHERE id = ?", [id]);
      res.json({ success: true });
    }),
  );

  return router;
}

