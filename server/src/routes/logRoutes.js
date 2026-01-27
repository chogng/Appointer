import express from "express";
import { db } from "../config/db.js";
import {
  authenticateToken,
  requireAdmin,
  isAdminRole,
} from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();

router.get(
  "/",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { search } = req.query;
    const limitRaw = req.query.limit;
    const isAdmin = isAdminRole(req.user.role);
    const defaultLimit = isAdmin ? 100 : 20;
    const maxLimit = isAdmin ? 100 : 20;
    const limitParsed = limitRaw === undefined ? defaultLimit : Number(limitRaw);
    const limit = Number.isFinite(limitParsed)
      ? Math.max(1, Math.min(maxLimit, Math.trunc(limitParsed)))
      : defaultLimit;

    let query = `
            SELECT l.*, u.name as userName, u.role as userRole
            FROM logs l
            LEFT JOIN users u ON l.userId = u.id
        `;
    const conditions = [];
    const params = [];

    if (!isAdmin) {
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

    query += ` ORDER BY l.timestamp DESC LIMIT ${limit}`;

    const logs = await db.query(query, params);
    res.json(logs);
  }),
);

router.delete(
  "/",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    await db.execute("DELETE FROM logs");
    res.json({ success: true });
  }),
);

export default router;

