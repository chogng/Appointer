import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { db } from "../config/db.js";
import { JWT_SECRET } from "../config/env.js";
import { enforceLogsMaxCount } from "../retention.js";
import { requirePlainObject, requireString } from "../utils/validation.js";

const genericError = { error: "Invalid credentials" };
const makeId = (prefix) => `${prefix}_${randomUUID()}`;

function isRequestSecure(req) {
  if (req?.secure) return true;
  const proto = req?.get?.("x-forwarded-proto");
  if (typeof proto === "string" && proto) {
    return proto.split(",")[0].trim().toLowerCase() === "https";
  }
  return false;
}

export async function login(req, res) {
  const body = requirePlainObject(req.body, "body");
  const username = requireString(body.username, "username", { maxLength: 64 });
  const password = requireString(body.password, "password", {
    trim: false,
    maxLength: 512,
  });

  const user = await db.queryOne("SELECT * FROM users WHERE username = ?", [
    username,
  ]);

  if (!user) return res.status(401).json(genericError);
  if (user.status !== "ACTIVE") {
    return res.status(403).json({ error: "Account is not active" });
  }

  if (user.expiryDate) {
    const today = new Date().toISOString().slice(0, 10);
    if (user.expiryDate < today) {
      return res.status(403).json({ error: "Account has expired" });
    }
  }

  let passwordMatch = false;
  if (user.password.startsWith("$")) {
    passwordMatch = await bcrypt.compare(password, user.password);
  } else {
    passwordMatch = user.password === password; // legacy fallback
  }
  if (!passwordMatch) return res.status(401).json(genericError);

  await db.execute(
    "INSERT INTO logs (id, userId, action, details, timestamp) VALUES (?, ?, ?, ?, ?)",
    [
      makeId("log"),
      user.id,
      "LOGIN",
      String(user.role || "USER"),
      new Date().toISOString(),
    ],
  );
  await enforceLogsMaxCount(db);

  const token = jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    JWT_SECRET,
    { expiresIn: "24h" },
  );

  // Only mark cookies as Secure when the request is actually HTTPS.
  // This prevents "login succeeds but session isn't kept" when NODE_ENV is set to production
  // while running over http://localhost or other non-TLS dev setups.
  const secureCookie =
    process.env.NODE_ENV === "production" ? isRequestSecure(req) : false;

  res.cookie("token", token, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  });

  const { password: _pw, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
}

export function logout(req, res) {
  const secureCookie =
    process.env.NODE_ENV === "production" ? isRequestSecure(req) : false;
  res.clearCookie("token", { httpOnly: true, secure: secureCookie, sameSite: "lax" });
  res.json({ success: true });
}

export async function getMe(req, res) {
  const user = await db.queryOne(
    "SELECT id, username, role, status, name, email, expiryDate, avatarUrl FROM users WHERE id = ?",
    [req.user.id],
  );
  if (!user) return res.sendStatus(404);
  res.json(user);
}
