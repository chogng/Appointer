import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import "../src/config/load-env.js";
import { initDatabase, getDatabase } from "../src/db/database.js";
import { getMySQLPool, initMySQLDatabase } from "../src/db/mysql-adapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const options = { force: false, sqlitePath: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg === "--sqlite" || arg === "--from") {
      const value = argv[i + 1];
      if (!value) throw new Error(`${arg} requires a path argument`);
      options.sqlitePath = value;
      i += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function resolveSqlitePath(override) {
  const raw = override || process.env.DB_PATH || "drms.db";
  return path.isAbsolute(raw) ? raw : path.resolve(serverRoot, raw);
}

function ensureSafeIdentifier(name, label) {
  const safe = String(name || "").trim();
  if (!safe) throw new Error(`${label} is required`);
  if (!/^[a-zA-Z0-9_]+$/.test(safe)) {
    throw new Error(`${label} must contain only letters, numbers, and underscores`);
  }
  return safe;
}

function quoteId(name) {
  return `\`${String(name).replaceAll("`", "``")}\``;
}

function chunk(array, size) {
  if (size <= 0) throw new Error("chunk size must be > 0");
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function sqliteAllRows(table) {
  ensureSafeIdentifier(table, "table");

  const sqlite = getDatabase();
  const stmt = sqlite.prepare(`SELECT * FROM ${quoteId(table)}`);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

async function mysqlTableCounts(conn, tables) {
  const counts = {};

  for (const table of tables) {
    ensureSafeIdentifier(table, "table");
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS count FROM ${quoteId(table)}`,
    );
    counts[table] = Number(rows?.[0]?.count || 0);
  }

  return counts;
}

async function mysqlClearTables(conn, tables) {
  for (const table of tables) {
    ensureSafeIdentifier(table, "table");
    await conn.query(`DELETE FROM ${quoteId(table)}`);
  }
}

function mapDeviceRow(row) {
  const openTimeFallback = JSON.stringify({ start: "09:00", end: "18:00" });

  return {
    ...row,
    granularity:
      row.granularity === undefined || row.granularity === null
        ? 60
        : Number(row.granularity),
    openTime:
      row.openTime === undefined || row.openTime === null ? openTimeFallback : row.openTime,
  };
}

function normalizeRowValue(value) {
  if (value === undefined) return null;
  return value;
}

async function mysqlInsertRows(conn, table, columns, rows, { batchSize = 500 } = {}) {
  ensureSafeIdentifier(table, "table");
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error(`columns for ${table} must be a non-empty array`);
  }

  const safeColumns = columns.map((col) => ensureSafeIdentifier(col, "column"));
  const columnList = safeColumns.map(quoteId).join(", ");

  const valuesPerRow = safeColumns.length;
  const rowPlaceholder = `(${safeColumns.map(() => "?").join(", ")})`;

  for (const batch of chunk(rows, batchSize)) {
    if (batch.length === 0) continue;
    const placeholders = new Array(batch.length).fill(rowPlaceholder).join(", ");
    const params = [];

    for (const row of batch) {
      for (const col of safeColumns) {
        params.push(normalizeRowValue(row?.[col]));
      }
    }

    await conn.query(
      `INSERT INTO ${quoteId(table)} (${columnList}) VALUES ${placeholders}`,
      params,
    );

    if (params.length !== batch.length * valuesPerRow) {
      throw new Error(`parameter mismatch while inserting into ${table}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node scripts/migrate-sqlite-to-mysql.js [--sqlite <path>] [--force]

Options:
  --sqlite, --from   Path to SQLite db file (default: DB_PATH or drms.db)
  --force            Clear MySQL tables before importing
`);
    return;
  }

  const sqlitePath = resolveSqlitePath(args.sqlitePath);
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(
      `SQLite database not found at ${sqlitePath}. Provide --sqlite <path> or set DB_PATH.`,
    );
  }

  // Make sure database.js reads the intended SQLite file.
  process.env.DB_PATH = sqlitePath;

  console.log("[migrate] loading SQLite:", sqlitePath);
  await initDatabase();

  // Prevent sample data from being inserted when initializing an empty MySQL database.
  process.env.DB_SEED_DATA = "0";

  console.log("[migrate] connecting MySQL and ensuring schema...");
  await initMySQLDatabase();

  const pool = getMySQLPool();
  if (!pool) throw new Error("MySQL pool not initialized");

  const tables = [
    "users",
    "devices",
    "inventory",
    "reservations",
    "logs",
    "requests",
    "blocklist",
    "system_settings",
    "device_analysis_templates",
    "device_analysis_settings",
  ];

  const writeOrder = [
    "users",
    "devices",
    "inventory",
    "reservations",
    "logs",
    "requests",
    "blocklist",
    "system_settings",
    "device_analysis_templates",
    "device_analysis_settings",
  ];

  const clearOrder = [...writeOrder].reverse();

  const conn = await pool.getConnection();
  try {
    const counts = await mysqlTableCounts(conn, tables);
    const nonEmpty = Object.entries(counts).filter(([, count]) => count > 0);

    if (nonEmpty.length > 0 && !args.force) {
      const summary = nonEmpty.map(([table, count]) => `${table}=${count}`).join(", ");
      throw new Error(
        `MySQL database is not empty (${summary}). Re-run with --force to clear and re-import.`,
      );
    }

    if (args.force && nonEmpty.length > 0) {
      console.log("[migrate] clearing MySQL tables...");
      await conn.beginTransaction();
      await mysqlClearTables(conn, clearOrder);
      await conn.commit();
    }

    const tableConfigs = [
      {
        table: "users",
        columns: ["id", "username", "password", "role", "status", "name", "email", "expiryDate"],
      },
      {
        table: "devices",
        columns: [
          "id",
          "name",
          "description",
          "isEnabled",
          "openDays",
          "timeSlots",
          "granularity",
          "openTime",
        ],
        mapRow: mapDeviceRow,
      },
      {
        table: "inventory",
        columns: ["id", "name", "category", "quantity", "date", "requesterName", "requesterId"],
      },
      {
        table: "reservations",
        columns: [
          "id",
          "userId",
          "deviceId",
          "date",
          "timeSlot",
          "status",
          "createdAt",
          "title",
          "description",
          "color",
        ],
      },
      {
        table: "logs",
        columns: ["id", "userId", "action", "details", "timestamp"],
      },
      {
        table: "requests",
        columns: [
          "id",
          "requesterId",
          "requesterName",
          "type",
          "targetId",
          "originalData",
          "newData",
          "status",
          "createdAt",
        ],
      },
      {
        table: "blocklist",
        columns: ["id", "userId", "deviceId", "reason", "createdAt"],
      },
      {
        table: "system_settings",
        columns: ["key", "value", "updatedAt"],
      },
      {
        table: "device_analysis_templates",
        columns: ["id", "userId", "name", "configJson", "createdAt", "updatedAt"],
      },
      {
        table: "device_analysis_settings",
        columns: ["userId", "yUnit", "updatedAt"],
      },
    ];

    for (const { table, columns, mapRow } of tableConfigs) {
      console.log(`[migrate] reading SQLite table: ${table}`);
      const rows = sqliteAllRows(table).map((row) => (mapRow ? mapRow(row) : row));
      console.log(`[migrate] writing MySQL table: ${table} (${rows.length} rows)`);

      if (rows.length === 0) continue;

      await conn.beginTransaction();
      await mysqlInsertRows(conn, table, columns, rows);
      await conn.commit();
    }

    const finalCounts = await mysqlTableCounts(conn, tables);
    console.log("[migrate] done. MySQL row counts:", finalCounts);
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      // ignore rollback errors
    }
    throw error;
  } finally {
    conn.release();
  }
}

main().catch((error) => {
  console.error("[migrate] failed:", error);
  process.exitCode = 1;
});
