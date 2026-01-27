import express from "express";

import { db } from "../config/db.js";
import {
  authenticateToken,
  requireAdmin,
} from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { calculateDuration } from "../utils/dateTime.js";

import retentionRoutes from "./retentionRoutes.js";

export default function createAdminRoutes() {
  const router = express.Router();

  router.get(
    "/leaderboard",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const users = await db.query("SELECT id, username, name, role FROM users");
      const reservations = await db.query(
        "SELECT userId, timeSlot FROM reservations",
      );

      const stats = {};

      users.forEach((user) => {
        stats[user.id] = {
          id: user.id,
          username: user.username,
          name: user.name || user.username,
          role: user.role,
          totalMinutes: 0,
        };
      });

      reservations.forEach((reservation) => {
        if (stats[reservation.userId]) {
          stats[reservation.userId].totalMinutes += calculateDuration(
            reservation.timeSlot,
          );
        }
      });

      const leaderboard = Object.values(stats)
        .sort((a, b) => b.totalMinutes - a.totalMinutes)
        .map((user) => ({
          ...user,
          totalHours: parseFloat((user.totalMinutes / 60).toFixed(1)),
        }));

      res.json(leaderboard);
    }),
  );

  router.use("/retention", retentionRoutes);

  return router;
}

