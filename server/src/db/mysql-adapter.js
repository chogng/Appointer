import "../config/load-env.js";

import mysql from "mysql2/promise";

let pool = null;

function getEnvFlag(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

function getEnvInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMySqlConfig() {
  const host = process.env.DB_HOST || "localhost";
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "drms";
  const connectionLimit = Number(process.env.DB_CONNECTION_LIMIT || 10);

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("Invalid DB_PORT (expected a positive number)");
  }
  if (!Number.isFinite(connectionLimit) || connectionLimit <= 0) {
    throw new Error("Invalid DB_CONNECTION_LIMIT (expected a positive number)");
  }

  return { host, port, user, password, database, connectionLimit };
}

async function maybeCreateDatabase({ host, port, user, password, database }) {
  if (!getEnvFlag("DB_CREATE_DATABASE")) return;

  const safeName = String(database || "").trim();
  if (!safeName) throw new Error("DB_NAME is required");
  if (!/^[a-zA-Z0-9_]+$/.test(safeName)) {
    throw new Error(
      "DB_NAME must contain only letters, numbers, and underscores",
    );
  }

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: false,
  });

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${safeName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await conn.end();
  }
}

async function waitForMySqlReady(db) {
  const retries = getEnvInt("DB_CONNECT_RETRIES", 15);
  const delayMs = getEnvInt("DB_CONNECT_RETRY_DELAY_MS", 1000);

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await db.query("SELECT 1");
      return;
    } catch (error) {
      const code = error?.code;
      if (code === "ER_ACCESS_DENIED_ERROR" || code === "ER_BAD_DB_ERROR") {
        throw error;
      }
      if (attempt >= retries) throw error;
      attempt += 1;
      await sleep(delayMs);
    }
  }
}

async function ensureSchema(db) {
  // Notes:
  // - Keep most date/time fields as strings to match existing server logic (ISO/YYYY-MM-DD).
  // - Avoid foreign keys to preserve current behavior (e.g., deleting users without cascading).
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      username VARCHAR(64) NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      expiryDate VARCHAR(10) NULL,
      avatarUrl TEXT NULL,
      UNIQUE KEY users_username_unique (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_applications (
      id VARCHAR(64) PRIMARY KEY,
      username VARCHAR(64) NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      expiryDate VARCHAR(10) NULL,
      status VARCHAR(32) NOT NULL,
      createdAt VARCHAR(30) NOT NULL,
      reviewedAt VARCHAR(30) NULL,
      reviewerId VARCHAR(64) NULL,
      approvedUserId VARCHAR(64) NULL,
      UNIQUE KEY user_applications_username_unique (username),
      INDEX user_applications_status_created_idx (status, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS devices (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      isEnabled TINYINT(1) NOT NULL DEFAULT 1,
      openDays TEXT NOT NULL,
      timeSlots TEXT NOT NULL,
      granularity INT NOT NULL DEFAULT 60,
      openTime TEXT NOT NULL,
      INDEX devices_enabled_idx (isEnabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(255) NOT NULL,
      quantity INT NOT NULL,
      date VARCHAR(10) NOT NULL,
      requesterName VARCHAR(255) NULL,
      requesterId VARCHAR(64) NULL,
      INDEX inventory_date_idx (date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id VARCHAR(64) PRIMARY KEY,
      userId VARCHAR(64) NOT NULL,
      deviceId VARCHAR(64) NOT NULL,
      date VARCHAR(10) NOT NULL,
      timeSlot VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL,
      createdAt VARCHAR(30) NOT NULL,
      title TEXT NULL,
      description TEXT NULL,
      color VARCHAR(32) NULL,
      activeSlotKey VARCHAR(128) GENERATED ALWAYS AS (
        CASE
          WHEN status <> 'CANCELLED' THEN CONCAT(date, '|', timeSlot)
          ELSE id
        END
      ) STORED,
      UNIQUE KEY reservations_unique_active (deviceId, activeSlotKey),
      INDEX reservations_device_date_idx (deviceId, date),
      INDEX reservations_user_idx (userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS logs (
      id VARCHAR(64) PRIMARY KEY,
      userId VARCHAR(64) NOT NULL,
      action VARCHAR(64) NOT NULL,
      details TEXT NULL,
      timestamp VARCHAR(30) NOT NULL,
      INDEX logs_timestamp_idx (timestamp)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS requests (
      id VARCHAR(64) PRIMARY KEY,
      requesterId VARCHAR(64) NOT NULL,
      requesterName VARCHAR(255) NOT NULL,
      type VARCHAR(64) NOT NULL,
      targetId VARCHAR(64) NULL,
      originalData TEXT NULL,
      newData TEXT NULL,
      status VARCHAR(32) NOT NULL,
      createdAt VARCHAR(30) NOT NULL,
      INDEX requests_status_createdAt_idx (status, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS blocklist (
      id VARCHAR(64) PRIMARY KEY,
      userId VARCHAR(64) NOT NULL,
      deviceId VARCHAR(64) NOT NULL,
      reason TEXT NULL,
      createdAt VARCHAR(30) NOT NULL,
      UNIQUE KEY blocklist_unique_user_device (userId, deviceId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      \`key\` VARCHAR(128) PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS device_analysis_templates (
      id VARCHAR(64) PRIMARY KEY,
      userId VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      configJson TEXT NOT NULL,
      createdAt VARCHAR(30) NOT NULL,
      updatedAt VARCHAR(30) NOT NULL,
      INDEX device_analysis_templates_user_updated_idx (userId, updatedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS device_analysis_settings (
      userId VARCHAR(64) PRIMARY KEY,
      yUnit VARCHAR(8) NOT NULL DEFAULT 'A',
      ssMethodDefault VARCHAR(16) NOT NULL DEFAULT 'auto',
      ssDiagnosticsEnabled TINYINT(1) NOT NULL DEFAULT 1,
      ssIdLow DOUBLE NOT NULL DEFAULT 1e-11,
      ssIdHigh DOUBLE NOT NULL DEFAULT 1e-9,
      lastTemplateId VARCHAR(64) NULL,
      stopOnErrorDefault TINYINT(1) NOT NULL DEFAULT 0,
      updatedAt VARCHAR(30) NOT NULL,
      INDEX device_analysis_settings_updatedAt_idx (updatedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Runtime migrations for existing MySQL schemas.
  // MySQL lacks a portable "ADD COLUMN IF NOT EXISTS" across versions, so we ignore ER_DUP_FIELDNAME.
  const ensureColumn = async (table, column, definition) => {
    try {
      await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      return true;
    } catch (error) {
      if (error?.code === "ER_DUP_FIELDNAME") return false;
      throw error;
    }
  };

  const ensureIndex = async (table, indexName, definition) => {
    try {
      await db.query(`CREATE INDEX ${indexName} ON ${table} (${definition})`);
      return true;
    } catch (error) {
      if (error?.code === "ER_DUP_KEYNAME") return false;
      throw error;
    }
  };

  await ensureColumn(
    "users",
    "avatarUrl",
    "TEXT NULL",
  );

  // Older schemas may have a reduced logs table (missing retention fields).
  await ensureColumn(
    "logs",
    "details",
    "TEXT NULL",
  );
  await ensureColumn(
    "logs",
    "timestamp",
    "VARCHAR(30) NOT NULL DEFAULT ''",
  );
  await ensureIndex("logs", "logs_timestamp_idx", "timestamp");

  await ensureIndex(
    "requests",
    "requests_pending_dedupe_idx",
    "requesterId, type, status, targetId, createdAt",
  );

  await ensureIndex(
    "requests",
    "requests_requester_status_createdAt_idx",
    "requesterId, status, createdAt",
  );

  await ensureColumn(
    "device_analysis_settings",
    "ssMethodDefault",
    "VARCHAR(16) NOT NULL DEFAULT 'auto'",
  );
  await ensureColumn(
    "device_analysis_settings",
    "ssDiagnosticsEnabled",
    "TINYINT(1) NOT NULL DEFAULT 1",
  );
  await ensureColumn(
    "device_analysis_settings",
    "ssIdLow",
    "DOUBLE NOT NULL DEFAULT 1e-11",
  );
  await ensureColumn(
    "device_analysis_settings",
    "ssIdHigh",
    "DOUBLE NOT NULL DEFAULT 1e-9",
  );
  await ensureColumn(
    "device_analysis_settings",
    "lastTemplateId",
    "VARCHAR(64) NULL",
  );
  await ensureColumn(
    "device_analysis_settings",
    "stopOnErrorDefault",
    "TINYINT(1) NOT NULL DEFAULT 0",
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS literature_research_settings (
      userId VARCHAR(64) PRIMARY KEY,
      configJson TEXT NOT NULL,
      updatedAt VARCHAR(30) NOT NULL,
      INDEX literature_research_settings_updatedAt_idx (updatedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function seedInitialData(db) {
  if (!getEnvFlag("DB_SEED_DATA", process.env.NODE_ENV !== "production"))
    return;

  const [rows] = await db.query(`SELECT COUNT(*) AS count FROM users`);
  const count = Number(rows?.[0]?.count || 0);
  if (count > 0) return;

  await db.query(
    `INSERT IGNORE INTO users (id, username, password, role, status, name, email, expiryDate)
     VALUES
       (?, ?, ?, ?, ?, ?, ?, ?),
       (?, ?, ?, ?, ?, ?, ?, ?),
       (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "admin_001",
      "admin",
      "123",
      "SUPER_ADMIN",
      "ACTIVE",
      "Super Admin",
      "admin@example.com",
      null,

      "manager_001",
      "manager",
      "123",
      "ADMIN",
      "ACTIVE",
      "设备管理员",
      "manager@example.com",
      null,

      "user_001",
      "user",
      "123",
      "USER",
      "ACTIVE",
      "张三",
      "john@example.com",
      "2026-01-01",
    ],
  );

  await db.query(
    `INSERT IGNORE INTO devices (id, name, description, isEnabled, openDays, timeSlots, granularity, openTime)
     VALUES
       (?, ?, ?, ?, ?, ?, ?, ?),
       (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "dev_001",
      "高性能服务器 A",
      "32核CPU, 128GB 内存, 适用于重型计算。",
      1,
      JSON.stringify([1, 2, 3, 4, 5]),
      JSON.stringify([
        "09:00-10:00",
        "10:00-11:00",
        "11:00-12:00",
        "14:00-15:00",
        "15:00-16:00",
      ]),
      60,
      JSON.stringify({ start: "09:00", end: "18:00" }),

      "dev_002",
      "VR 测试单元",
      "Oculus Quest 2 设备，带动作追踪。",
      1,
      JSON.stringify([1, 3, 5]),
      JSON.stringify(["10:00-12:00", "14:00-16:00"]),
      60,
      JSON.stringify({ start: "09:00", end: "18:00" }),
    ],
  );
}

export async function initMySQLDatabase() {
  const cfg = getMySqlConfig();
  await maybeCreateDatabase(cfg);

  pool = mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    waitForConnections: true,
    connectionLimit: cfg.connectionLimit,
    queueLimit: 0,
    // Keep date/time as strings to match existing code paths.
    dateStrings: true,
  });

  await waitForMySqlReady(pool);

  await ensureSchema(pool);
  await seedInitialData(pool);
  return pool;
}

export async function mysqlQuery(sql, params = []) {
  if (!pool) throw new Error("MySQL pool not initialized");
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function mysqlExecute(sql, params = []) {
  if (!pool) throw new Error("MySQL pool not initialized");
  const [result] = await pool.execute(sql, params);
  return result;
}

export function getMySQLPool() {
  return pool;
}
