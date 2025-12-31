import jwt from "jsonwebtoken";
import { db } from "../config/db.js";
import { JWT_SECRET } from "../config/env.js";

export function isAdminRole(role) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function requireAdmin(req, res, next) {
  if (!isAdminRole(req.user?.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

export function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

export const authenticateToken = (req, res, next) => {
  const cookieToken = req.cookies?.token;
  const authHeader = req.headers?.authorization;
  const headerToken =
    typeof authHeader === "string" &&
    authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice("bearer ".length).trim()
      : null;

  const token = cookieToken || headerToken;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(401).json({ error: "Invalid or expired token" });

    const dbUser = db.queryOne(
      "SELECT id, username, role, status, expiryDate FROM users WHERE id = ?",
      [user?.id],
    );
    if (!dbUser)
      return res.status(401).json({ error: "Invalid or expired token" });
    if (dbUser.status !== "ACTIVE") {
      return res.status(401).json({ error: "Account is not active" });
    }
    if (dbUser.expiryDate) {
      const today = new Date().toISOString().slice(0, 10);
      if (dbUser.expiryDate < today) {
        return res.status(401).json({ error: "Account has expired" });
      }
    }

    req.user = { id: dbUser.id, username: dbUser.username, role: dbUser.role };
    next();
  });
};
