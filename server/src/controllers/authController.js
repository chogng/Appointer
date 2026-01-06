import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { db } from "../config/db.js";
import { JWT_SECRET } from "../config/env.js";

const genericError = { error: "Invalid credentials" };
const makeId = (prefix) => `${prefix}_${randomUUID()}`;

export async function login(req, res) {
  try {
    const { username, password } = req.body;
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
        "User logged in",
        new Date().toISOString(),
      ],
    );

    const token = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    const { password: _pw, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export function logout(req, res) {
  res.clearCookie("token");
  res.json({ success: true });
}

export async function getMe(req, res) {
  try {
    const user = await db.queryOne(
      "SELECT id, username, role, status, name, email, expiryDate FROM users WHERE id = ?",
      [req.user.id],
    );
    if (!user) return res.sendStatus(404);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
