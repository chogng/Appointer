import express from "express";
import { db } from "../config/db.js";
import {
  authenticateToken,
  requireSuperAdmin,
} from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requirePlainObject } from "../utils/validation.js";
import {
  getRetentionSettings,
  runRetentionTrim,
  updateRetentionSettings,
} from "../retention.js";

const router = express.Router();

router.get(
  "/",
  authenticateToken,
  requireSuperAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await getRetentionSettings(db));
  }),
);

router.patch(
  "/",
  authenticateToken,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const updates = req.body === undefined ? {} : requirePlainObject(req.body);
    try {
      const updated = await updateRetentionSettings(db, updates);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }),
);

router.post(
  "/run",
  authenticateToken,
  requireSuperAdmin,
  asyncHandler(async (_req, res) => {
    const result = await runRetentionTrim(db);
    res.json(result);
  }),
);

export default router;

