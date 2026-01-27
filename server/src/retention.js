const SETTINGS_KEYS = {
  logsMaxCount: "retention.logsMaxCount",
  lastCleanupAt: "retention.lastCleanupAt",
};

const DEFAULTS = {
  logsMaxCount: 100,
  maxCount: 1_000_000,
};

function toUtcIso(date) {
  return date.toISOString();
}

function parseIsoDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function getSetting(db, key) {
  const row = await db.queryOne(
    "SELECT value FROM system_settings WHERE `key` = ?",
    [key],
  );
  return row?.value ?? null;
}

async function setSetting(db, key, value, nowIso) {
  const val = String(value);

  if (db.dialect === "mysql") {
    await db.execute(
      "INSERT INTO system_settings (`key`, value, updatedAt) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?, updatedAt = ?",
      [key, val, nowIso, val, nowIso],
    );
    return;
  }

  await db.execute(
    "INSERT OR REPLACE INTO system_settings (key, value, updatedAt) VALUES (?, ?, ?)",
    [key, val, nowIso],
  );
}

function parseRetentionCount(value, fallback, label) {
  if (value === undefined || value === null || value === "") return fallback;
  const asNumber = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(asNumber) || !Number.isInteger(asNumber)) {
    throw new Error(`${label} must be an integer`);
  }
  if (asNumber < 1 || asNumber > DEFAULTS.maxCount) {
    throw new Error(`${label} must be between 1 and ${DEFAULTS.maxCount}`);
  }
  return asNumber;
}

export async function enforceLogsMaxCount(db) {
  const logsMaxCountRaw = await getSetting(db, SETTINGS_KEYS.logsMaxCount);
  const logsMaxCount = parseRetentionCount(
    logsMaxCountRaw,
    DEFAULTS.logsMaxCount,
    "logsMaxCount",
  );

  const total = Number(
    (await db.queryOne("SELECT COUNT(*) AS count FROM logs"))?.count || 0,
  );
  const excess = total - logsMaxCount;
  if (excess <= 0) return { logsMaxCount, deleted: 0 };

  if (db.dialect === "mysql") {
    await db.execute(
      `
        DELETE FROM logs
        WHERE id IN (
          SELECT id FROM (
            SELECT id
            FROM logs
            ORDER BY timestamp ASC
            LIMIT ?
          ) AS t
        )
      `,
      [excess],
    );
  } else {
    await db.execute(
      `
        DELETE FROM logs
        WHERE id IN (
          SELECT id
          FROM logs
          ORDER BY timestamp ASC
          LIMIT ?
        )
      `,
      [excess],
    );
  }

  return { logsMaxCount, deleted: excess };
}

export async function getRetentionSettings(db) {
  const logsMaxCountRaw = await getSetting(db, SETTINGS_KEYS.logsMaxCount);
  const lastCleanupAtRaw = await getSetting(db, SETTINGS_KEYS.lastCleanupAt);

  const logsMaxCount = parseRetentionCount(
    logsMaxCountRaw,
    DEFAULTS.logsMaxCount,
    "logsMaxCount",
  );

  const lastCleanupDate = parseIsoDate(lastCleanupAtRaw);
  const lastCleanupAt = lastCleanupDate ? toUtcIso(lastCleanupDate) : null;

  return {
    logsMaxCount,
    lastCleanupAt,
  };
}

export async function updateRetentionSettings(db, updates, now = new Date()) {
  const current = await getRetentionSettings(db);
  const nextLogsMaxCount = parseRetentionCount(
    updates?.logsMaxCount,
    current.logsMaxCount,
    "logsMaxCount",
  );

  const nowIso = toUtcIso(now);
  await setSetting(db, SETTINGS_KEYS.logsMaxCount, nextLogsMaxCount, nowIso);

  return getRetentionSettings(db);
}

export async function runRetentionTrim(db, now = new Date()) {
  const nowIso = toUtcIso(now);
  const result = await enforceLogsMaxCount(db);
  await setSetting(db, SETTINGS_KEYS.lastCleanupAt, nowIso, nowIso);
  return {
    ...(await getRetentionSettings(db)),
    ranAt: nowIso,
    deleted: { logs: result.deleted },
  };
}
