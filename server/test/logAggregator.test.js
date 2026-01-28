import test from "node:test";
import assert from "node:assert/strict";

import { __resetLogAggregatorForTests, upsertReservationCreatedLog } from "../src/logAggregator.js";

function createFakeDb() {
  const rowsById = new Map();
  const updates = [];
  const inserts = [];

  return {
    dialect: "mysql",
    rowsById,
    updates,
    inserts,
    async execute(sql, params) {
      const normalized = String(sql).trim().replace(/\s+/g, " ").toUpperCase();
      if (normalized.startsWith("INSERT INTO LOGS")) {
        const [id, userId, action, details, timestamp] = params;
        rowsById.set(id, { id, userId, action, details, timestamp });
        inserts.push({ id, userId, action, details, timestamp });
        return;
      }
      if (normalized.startsWith("UPDATE LOGS SET DETAILS")) {
        const [details, timestamp, id] = params;
        const row = rowsById.get(id);
        if (row) {
          row.details = details;
          row.timestamp = timestamp;
        }
        updates.push({ id, details, timestamp });
        return;
      }
      // retention.js writes system_settings; ignore in this unit test
      return;
    },
    async queryOne(sql) {
      const normalized = String(sql).trim().replace(/\s+/g, " ").toUpperCase();
      if (normalized.startsWith("SELECT VALUE FROM SYSTEM_SETTINGS")) return null;
      if (normalized.startsWith("SELECT COUNT(*) AS COUNT FROM LOGS")) {
        return { count: rowsById.size };
      }
      return null;
    },
  };
}

test("aggregates reservation-created logs across devices with xN", async () => {
  __resetLogAggregatorForTests();
  const db = createFakeDb();

  await upsertReservationCreatedLog(db, { userId: "u1", deviceId: "dev_a", windowMs: 200 });
  assert.equal(db.inserts.length, 1);
  assert.match(db.inserts[0].details, /dev_a/);
  assert.match(db.inserts[0].details, /x1$/);

  await upsertReservationCreatedLog(db, { userId: "u1", deviceId: "dev_b", windowMs: 200 });
  assert.equal(db.inserts.length, 1, "should update the same log row");
  assert.equal(db.updates.length, 1);
  assert.match(db.updates[0].details, /dev_a/);
  assert.match(db.updates[0].details, /dev_b/);
  assert.match(db.updates[0].details, /x2$/);
});

test("starts a new aggregation window after expiry", async () => {
  __resetLogAggregatorForTests();
  const db = createFakeDb();

  await upsertReservationCreatedLog(db, { userId: "u1", deviceId: "dev_a", windowMs: 50 });
  assert.equal(db.inserts.length, 1);

  await new Promise((r) => setTimeout(r, 80));

  await upsertReservationCreatedLog(db, { userId: "u1", deviceId: "dev_c", windowMs: 50 });
  assert.equal(db.inserts.length, 2, "should create a new log after window expiry");
  assert.match(db.inserts[1].details, /dev_c/);
  assert.match(db.inserts[1].details, /x1$/);
});
