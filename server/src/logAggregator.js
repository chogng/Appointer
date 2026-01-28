// Aggregates high-frequency log events within a short window to avoid noisy log spam.
// Example: multiple "RESERVATION_CREATED" events for the same user+device become one log with a `xN` suffix.

import { makeId } from "./utils/ids.js";
import { enforceLogsMaxCount } from "./retention.js";

const DEFAULT_WINDOW_MS = 5 * 60 * 1000;

/**
 * @typedef {Object} AggregatedLogEvent
 * @property {string} userId
 * @property {string} action
 * @property {string} details
 * @property {string} [timestamp] ISO string; defaults to now
 * @property {string} [key] Stable aggregation key
 * @property {Array<string>} [keyParts] Alternative to `key` (will be joined with `|`)
 * @property {number} [windowMs] Aggregation window in ms
 */

/** @type {Map<string, {logId:string, userId:string, action:string, details:string, count:number, firstAtMs:number, lastTimestamp:string, timer:NodeJS.Timeout}>} */
const buckets = new Map();

function buildKey(event) {
  if (event.key) return String(event.key);
  if (Array.isArray(event.keyParts) && event.keyParts.length > 0) {
    return event.keyParts.map((p) => String(p)).join("|");
  }
  return [event.userId, event.action, event.details].map((p) => String(p)).join("|");
}

function formatDetails(details, count) {
  if (count <= 1) return details;
  return `${details} x${count}`;
}

function formatDetailsAlwaysCount(details, count) {
  return `${details} x${Math.max(1, count)}`;
}

/**
 * Upsert an aggregated log row immediately, and keep updating it within `windowMs`.
 * This keeps the UI responsive (a log appears right away) while still collapsing spam into `xN`.
 * @param {import("./config/db.js").db} db
 * @param {AggregatedLogEvent} event
 */
export async function upsertAggregatedLog(db, event) {
  const windowMs =
    Number.isFinite(event.windowMs) && event.windowMs > 0
      ? Math.trunc(event.windowMs)
      : DEFAULT_WINDOW_MS;

  const key = buildKey(event);
  const nowIso = event.timestamp || new Date().toISOString();
  const nowMs = Date.now();

  const existing = buckets.get(key);
  if (existing && nowMs - existing.firstAtMs <= windowMs) {
    existing.count += 1;
    existing.lastTimestamp = nowIso;

    const nextDetails = formatDetails(existing.details, existing.count);
    await db.execute("UPDATE logs SET details = ?, timestamp = ? WHERE id = ?", [
      nextDetails,
      nowIso,
      existing.logId,
    ]);
    return;
  }

  if (existing) {
    clearTimeout(existing.timer);
    buckets.delete(key);
  }

  const logId = makeId("log");
  const details = String(event.details);

  await db.execute(
    "INSERT INTO logs (id, userId, action, details, timestamp) VALUES (?, ?, ?, ?, ?)",
    [logId, String(event.userId), String(event.action), details, nowIso],
  );
  await enforceLogsMaxCount(db);

  const timer = setTimeout(() => {
    const bucket = buckets.get(key);
    if (!bucket) return;
    buckets.delete(key);
  }, windowMs);

  buckets.set(key, {
    logId,
    userId: String(event.userId),
    action: String(event.action),
    details,
    count: 1,
    firstAtMs: nowMs,
    lastTimestamp: nowIso,
    timer,
  });
}

/** @type {Map<string, {logId:string, userId:string, deviceIds:Set<string>, count:number, firstAtMs:number, timer:NodeJS.Timeout}>} */
const reservationBuckets = new Map();

function buildReservationDetails(deviceIds, count, verb) {
  const ids = Array.from(deviceIds);
  const details = `${verb} reservation for device ${ids.join(" ")}`.trim();
  return formatDetailsAlwaysCount(details, count);
}

async function upsertReservationAggregate(db, { userId, deviceId, action, verb, windowMs }) {
  const ms =
    Number.isFinite(windowMs) && windowMs > 0 ? Math.trunc(windowMs) : DEFAULT_WINDOW_MS;

  const key = `${userId}|${action}`;
  const nowMs = Date.now();
  const nowIso = new Date().toISOString();

  const existing = reservationBuckets.get(key);
  if (existing && nowMs - existing.firstAtMs <= ms) {
    existing.count += 1;
    if (deviceId) existing.deviceIds.add(String(deviceId));

    const details = buildReservationDetails(existing.deviceIds, existing.count, verb);
    await db.execute("UPDATE logs SET details = ?, timestamp = ? WHERE id = ?", [
      details,
      nowIso,
      existing.logId,
    ]);
    return;
  }

  if (existing) {
    clearTimeout(existing.timer);
    reservationBuckets.delete(key);
  }

  const logId = makeId("log");
  const deviceIds = new Set();
  if (deviceId) deviceIds.add(String(deviceId));

  const details = buildReservationDetails(deviceIds, 1, verb);
  await db.execute(
    "INSERT INTO logs (id, userId, action, details, timestamp) VALUES (?, ?, ?, ?, ?)",
    [logId, String(userId), action, details, nowIso],
  );
  await enforceLogsMaxCount(db);

  const timer = setTimeout(() => {
    const bucket = reservationBuckets.get(key);
    if (!bucket) return;
    reservationBuckets.delete(key);
  }, ms);

  reservationBuckets.set(key, {
    logId,
    userId: String(userId),
    deviceIds,
    count: 1,
    firstAtMs: nowMs,
    timer,
  });
}

export async function upsertReservationCreatedLog(db, { userId, deviceId, windowMs } = {}) {
  return upsertReservationAggregate(db, {
    userId,
    deviceId,
    action: "RESERVATION_CREATED",
    verb: "Created",
    windowMs,
  });
}

export async function upsertReservationCancelledLog(db, { userId, deviceId, windowMs } = {}) {
  return upsertReservationAggregate(db, {
    userId,
    deviceId,
    action: "RESERVATION_CANCELLED",
    verb: "Cancelled",
    windowMs,
  });
}

export function __resetLogAggregatorForTests() {
  for (const bucket of buckets.values()) clearTimeout(bucket.timer);
  buckets.clear();
  for (const bucket of reservationBuckets.values()) clearTimeout(bucket.timer);
  reservationBuckets.clear();
}
