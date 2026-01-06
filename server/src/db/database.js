import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import "../config/load-env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "../..");

const DEFAULT_DB_PATH = path.join(serverRoot, "drms.db");

let db = null;
let activeDbPath = null;

function getEnvFlag(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

const SHOULD_SEED_DATA = getEnvFlag(
  "DB_SEED_DATA",
  process.env.NODE_ENV !== "production",
);

function resolveDbPath() {
  const raw = process.env.DB_PATH;
  return raw ? path.resolve(serverRoot, raw) : DEFAULT_DB_PATH;
}

function listTableColumns(table) {
  const stmt = db.prepare(`PRAGMA table_info(${table});`);
  const columns = [];

  while (stmt.step()) {
    columns.push(stmt.getAsObject().name);
  }

  stmt.free();
  return columns;
}

function ensureColumn(table, column, typeWithConstraints) {
  const columns = listTableColumns(table);
  if (columns.includes(column)) return false;

  db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeWithConstraints};`);
  return true;
}

async function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      expiryDate TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      isEnabled INTEGER NOT NULL DEFAULT 1,
      openDays TEXT NOT NULL,
      timeSlots TEXT NOT NULL,
      granularity INTEGER DEFAULT 60,
      openTime TEXT DEFAULT '{"start":"09:00","end":"18:00"}'
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      date TEXT NOT NULL,
      requesterName TEXT,
      requesterId TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      deviceId TEXT NOT NULL,
      date TEXT NOT NULL,
      timeSlot TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      title TEXT,
      description TEXT,
      color TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      requesterId TEXT NOT NULL,
      requesterName TEXT NOT NULL,
      type TEXT NOT NULL,
      targetId TEXT,
      originalData TEXT,
      newData TEXT,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS blocklist (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      deviceId TEXT NOT NULL,
      reason TEXT,
      createdAt TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS device_analysis_templates (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      configJson TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS device_analysis_settings (
      userId TEXT PRIMARY KEY,
      yUnit TEXT NOT NULL DEFAULT 'A',
      updatedAt TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS literature_research_settings (
      userId TEXT PRIMARY KEY,
      configJson TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);
}

async function migrateSchema() {
  // Keep runtime schema consistent with server expectations.
  ensureColumn("devices", "granularity", "INTEGER DEFAULT 60");
  ensureColumn(
    "devices",
    "openTime",
    `TEXT DEFAULT '{"start":"09:00","end":"18:00"}'`,
  );

  // Older databases may miss reservation detail fields.
  ensureColumn("reservations", "title", `TEXT DEFAULT ''`);
  ensureColumn("reservations", "description", `TEXT DEFAULT ''`);
  ensureColumn("reservations", "color", `TEXT DEFAULT 'default'`);

  // Inventory requester fields.
  ensureColumn("inventory", "requesterName", "TEXT");
  ensureColumn("inventory", "requesterId", "TEXT");

  // Prevent double-booking while allowing re-booking after cancellation.
  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS reservations_unique_active
    ON reservations (deviceId, date, timeSlot)
    WHERE status != 'CANCELLED'
  `);

  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS blocklist_unique_user_device
    ON blocklist (userId, deviceId)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS logs_timestamp_idx
    ON logs (timestamp)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS requests_status_createdAt_idx
    ON requests (status, createdAt)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS device_analysis_templates_user_updated_idx
    ON device_analysis_templates (userId, updatedAt)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS device_analysis_settings_updatedAt_idx
    ON device_analysis_settings (updatedAt)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS literature_research_settings_updatedAt_idx
    ON literature_research_settings (updatedAt)
  `);
}

async function insertInitialData() {
  const users = [
    [
      "admin_001",
      "admin",
      "123",
      "SUPER_ADMIN",
      "ACTIVE",
      "Super Admin",
      "admin@example.com",
      null,
    ],
    [
      "manager_001",
      "manager",
      "123",
      "ADMIN",
      "ACTIVE",
      "设备管理员",
      "manager@example.com",
      null,
    ],
    [
      "user_001",
      "user",
      "123",
      "USER",
      "ACTIVE",
      "张三",
      "john@example.com",
      "2026-01-01",
    ],
  ];

  for (const user of users) {
    db.run(
      "INSERT INTO users (id, username, password, role, status, name, email, expiryDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      user,
    );
  }

  const devices = [
    [
      "dev_001",
      "高性能服务器A",
      "32核CPU, 128GB 内存，适用于重型计算。",
      1,
      JSON.stringify([1, 2, 3, 4, 5]),
      JSON.stringify([
        "09:00-10:00",
        "10:00-11:00",
        "11:00-12:00",
        "14:00-15:00",
        "15:00-16:00",
      ]),
    ],
    [
      "dev_002",
      "VR 测试单元",
      "Oculus Quest 2 设备，带动作追踪。",
      1,
      JSON.stringify([1, 3, 5]),
      JSON.stringify(["10:00-12:00", "14:00-16:00"]),
    ],
  ];

  for (const device of devices) {
    db.run(
      "INSERT INTO devices (id, name, description, isEnabled, openDays, timeSlots) VALUES (?, ?, ?, ?, ?, ?)",
      device,
    );
  }
}

export async function initDatabase() {
  const SQL = await initSqlJs();
  activeDbPath = resolveDbPath();
  const dbFileExists = fs.existsSync(activeDbPath);

  if (dbFileExists) {
    const buffer = fs.readFileSync(activeDbPath);
    db = new SQL.Database(buffer);
    console.log("✅ 数据库已加载");
  } else {
    db = new SQL.Database();
    console.log("✅ 创建新数据库");
  }

  await createTables();
  await migrateSchema();

  if (!dbFileExists && SHOULD_SEED_DATA) {
    await insertInitialData();
  }

  // sql.js runs in-memory; persist schema/data changes.
  saveDatabase();
  return db;
}

export function saveDatabase() {
  if (!db) return;
  const dbPath = activeDbPath || resolveDbPath();
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export function getDatabase() {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}
