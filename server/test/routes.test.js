import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SERVER_CWD = path.resolve(import.meta.dirname, "..");
const TMP_DIR = path.join(SERVER_CWD, ".tmp");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(baseUrl, timeoutMs = 12_000) {
  const startedAt = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await fetch(`${baseUrl}/api`, { method: "GET" });
      if (res.status === 404) return;
    } catch {
      // ignore until ready
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Server did not become ready within ${timeoutMs}ms`);
    }
    await sleep(200);
  }
}

function extractTokenCookie(setCookieHeader) {
  if (!setCookieHeader) return null;
  const first = setCookieHeader.split(";")[0] || "";
  return first.startsWith("token=") ? first : null;
}

async function readJson(res) {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  return res.json();
}

async function startServer() {
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const attempts = 6;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const port = 3100 + Math.floor(Math.random() * 700);
    const dbPath = path.join(TMP_DIR, `routes-${port}.db`);
    try {
      fs.rmSync(dbPath, { force: true });
    } catch {
      // ignore
    }

    const child = spawn(process.execPath, ["server.js"], {
      cwd: SERVER_CWD,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: String(port),
        SERVE_CLIENT: "0",
        JWT_SECRET: "test-secret",
        DB_TYPE: "sqlite",
        DB_PATH: dbPath,
        DB_SEED_DATA: "1",
      },
    });

    let stderr = "";
    child.stderr?.on("data", (buf) => {
      stderr += String(buf);
    });

    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      await waitForServer(baseUrl);
      return { child, baseUrl, dbPath };
    } catch (error) {
      child.kill("SIGTERM");
      await sleep(200);

      if (stderr.includes("EADDRINUSE")) continue;
      throw new Error(
        `Failed to start server: ${error?.message || error}\n${stderr}`,
      );
    }
  }

  throw new Error("Failed to start server after multiple attempts (ports busy?)");
}

async function login(baseUrl, username, password = "123") {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const json = await readJson(res);
  const cookie = extractTokenCookie(res.headers.get("set-cookie"));
  return { res, json, cookie };
}

async function authedFetch(baseUrl, cookie, pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  return fetch(`${baseUrl}${pathname}`, { ...options, headers });
}

function isoDate(daysFromNow = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

test("routes: exercise all API route groups", async (t) => {
  const { child, baseUrl, dbPath } = await startServer();
  t.after(async () => {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
    await sleep(150);
    try {
      fs.rmSync(dbPath, { force: true });
    } catch {
      // ignore
    }
  });

  const adminLogin = await login(baseUrl, "admin", "123");
  assert.equal(adminLogin.res.status, 200);
  assert.ok(adminLogin.cookie);

  // Seeded "user" account may have an expiryDate in the past relative to this environment date.
  // Create a fresh ACTIVE USER for non-admin route coverage.
  const userUsername = `test_user_${Date.now()}`;
  const createUserRes = await authedFetch(baseUrl, adminLogin.cookie, "/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: userUsername,
      password: "123",
      name: "Test User",
      email: "test-user@example.com",
      role: "USER",
    }),
  });
  assert.equal(createUserRes.status, 201);

  const userLogin = await login(baseUrl, userUsername, "123");
  assert.equal(userLogin.res.status, 200);
  assert.ok(userLogin.cookie);

  await t.test("auth routes", async () => {
    const meUnauthed = await authedFetch(baseUrl, null, "/api/auth/me");
    assert.equal(meUnauthed.status, 401);

    const meAuthed = await authedFetch(baseUrl, adminLogin.cookie, "/api/auth/me");
    assert.equal(meAuthed.status, 200);
    const me = await meAuthed.json();
    assert.equal(me.username, "admin");

    const logoutRes = await authedFetch(baseUrl, adminLogin.cookie, "/api/auth/logout", {
      method: "POST",
    });
    assert.equal(logoutRes.status, 200);
  });

  let createdDeviceId = null;
  await t.test("device routes", async () => {
    const listUnauthed = await authedFetch(baseUrl, null, "/api/devices");
    assert.equal(listUnauthed.status, 401);

    const listAuthed = await authedFetch(baseUrl, adminLogin.cookie, "/api/devices");
    assert.equal(listAuthed.status, 200);
    const devices = await listAuthed.json();
    assert.ok(Array.isArray(devices));
    const first = devices.find((d) => d && d.id);
    assert.ok(first?.id);

    const getOne = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      `/api/devices/${first.id}`,
    );
    assert.equal(getOne.status, 200);

    const createRes = await authedFetch(baseUrl, adminLogin.cookie, "/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Device",
        description: "created by routes test",
        openDays: [1, 2, 3, 4, 5],
        timeSlots: ["09:00-10:00"],
        granularity: 60,
        openTime: { start: "09:00", end: "18:00" },
      }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.ok(created?.id);
    createdDeviceId = created.id;

    const patchRes = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      `/api/devices/${createdDeviceId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: false }),
      },
    );
    assert.equal(patchRes.status, 200);

    const deleteRes = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      `/api/devices/${createdDeviceId}`,
      { method: "DELETE" },
    );
    assert.equal(deleteRes.status, 200);
  });

  let createdInventoryId = null;
  await t.test("inventory routes", async () => {
    const listUnauthed = await authedFetch(baseUrl, null, "/api/inventory");
    assert.equal(listUnauthed.status, 401);

    const listAuthed = await authedFetch(baseUrl, userLogin.cookie, "/api/inventory");
    assert.equal(listAuthed.status, 200);

    const createForbidden = await authedFetch(baseUrl, userLogin.cookie, "/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x", category: "y", quantity: 1 }),
    });
    assert.equal(createForbidden.status, 403);

    const createRes = await authedFetch(baseUrl, adminLogin.cookie, "/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Item", category: "Test", quantity: 2 }),
    });
    assert.equal(createRes.status, 201);
    const item = await createRes.json();
    assert.ok(item?.id);
    createdInventoryId = item.id;

    const patchRes = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      `/api/inventory/${createdInventoryId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: 3 }),
      },
    );
    assert.equal(patchRes.status, 200);

    const deleteRes = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      `/api/inventory/${createdInventoryId}`,
      { method: "DELETE" },
    );
    assert.equal(deleteRes.status, 200);
  });

  let createdReservationId = null;
  let reservationDeviceId = null;
  await t.test("reservation routes", async () => {
    const listUnauthed = await authedFetch(baseUrl, null, "/api/reservations");
    assert.equal(listUnauthed.status, 401);

    const devicesRes = await authedFetch(baseUrl, userLogin.cookie, "/api/devices");
    assert.equal(devicesRes.status, 200);
    const devices = await devicesRes.json();
    reservationDeviceId = devices.find((d) => d?.id)?.id || null;
    assert.ok(reservationDeviceId);

    const createRes = await authedFetch(baseUrl, userLogin.cookie, "/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: reservationDeviceId,
        date: isoDate(1),
        timeSlot: "09:00-10:00",
        title: "Test reservation",
        description: "created by routes test",
        color: "default",
      }),
    });
    assert.equal(createRes.status, 201);
    const reservation = await createRes.json();
    assert.ok(reservation?.id);
    createdReservationId = reservation.id;

    const listRes = await authedFetch(
      baseUrl,
      userLogin.cookie,
      `/api/reservations?deviceId=${encodeURIComponent(reservationDeviceId)}&active=1`,
    );
    assert.equal(listRes.status, 200);

    const patchRes = await authedFetch(
      baseUrl,
      userLogin.cookie,
      `/api/reservations/${createdReservationId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      },
    );
    assert.equal(patchRes.status, 200);

    const deleteRes = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      `/api/reservations/${createdReservationId}`,
      { method: "DELETE" },
    );
    assert.equal(deleteRes.status, 200);
  });

  let createdRequestId = null;
  await t.test("request routes", async () => {
    const listUnauthed = await authedFetch(baseUrl, null, "/api/requests");
    assert.equal(listUnauthed.status, 401);

    const createRes = await authedFetch(baseUrl, userLogin.cookie, "/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "INVENTORY_ADD",
        requesterName: "User",
        newData: { name: "Req Item", category: "Req", quantity: 1 },
      }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.ok(created?.id);
    createdRequestId = created.id;

    const listUser = await authedFetch(baseUrl, userLogin.cookie, "/api/requests");
    assert.equal(listUser.status, 200);
    const userRequests = await listUser.json();
    assert.ok(Array.isArray(userRequests));

    const approveForbidden = await authedFetch(
      baseUrl,
      userLogin.cookie,
      `/api/requests/${createdRequestId}/approve`,
      { method: "POST" },
    );
    assert.equal(approveForbidden.status, 403);

    const approveRes = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      `/api/requests/${createdRequestId}/approve`,
      { method: "POST" },
    );
    assert.equal(approveRes.status, 200);

    const listAdmin = await authedFetch(baseUrl, adminLogin.cookie, "/api/requests");
    assert.equal(listAdmin.status, 200);
  });

  let createdUserId = null;
  await t.test("user routes", async () => {
    const registerRes = await authedFetch(baseUrl, null, "/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `pending_${Date.now()}`,
        password: "pw",
        name: "Pending User",
        email: "pending@example.com",
      }),
    });
    assert.equal(registerRes.status, 201);
    const pendingUser = await registerRes.json();
    assert.ok(pendingUser?.id);

    const listForbidden = await authedFetch(baseUrl, userLogin.cookie, "/api/users");
    assert.equal(listForbidden.status, 403);

    const listRes = await authedFetch(baseUrl, adminLogin.cookie, "/api/users");
    assert.equal(listRes.status, 200);
    const users = await listRes.json();
    assert.ok(Array.isArray(users));

    const adminCreateRes = await authedFetch(baseUrl, adminLogin.cookie, "/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `u_${Date.now()}`,
        password: "123",
        name: "Created User",
        email: "created@example.com",
        role: "USER",
      }),
    });
    assert.equal(adminCreateRes.status, 201);
    const created = await adminCreateRes.json();
    assert.ok(created?.id);
    createdUserId = created.id;

    const patchUserRes = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      `/api/users/${createdUserId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      },
    );
    assert.equal(patchUserRes.status, 200);

    const pngBytes = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
      0x0a, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0x0f, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0x18, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const avatarForm = new FormData();
    avatarForm.append(
      "avatar",
      new Blob([pngBytes], { type: "image/png" }),
      "avatar.png",
    );
    const avatarRes = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      `/api/users/${createdUserId}/avatar`,
      { method: "POST", body: avatarForm },
    );
    assert.equal(avatarRes.status, 200);
    const avatarUser = await avatarRes.json();
    assert.ok(
      typeof avatarUser?.avatarUrl === "string" &&
        avatarUser.avatarUrl.startsWith("/api/uploads/avatars/"),
    );

    const blocklistGet = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      `/api/users/${createdUserId}/blocklist`,
    );
    assert.equal(blocklistGet.status, 200);

    const blockRes = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      `/api/users/${createdUserId}/blocklist`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: reservationDeviceId || "dev_001",
          reason: "test",
        }),
      },
    );
    assert.equal(blockRes.status, 201);

    const unblockRes = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      `/api/users/${createdUserId}/blocklist/${encodeURIComponent(
        reservationDeviceId || "dev_001",
      )}`,
      { method: "DELETE" },
    );
    assert.equal(unblockRes.status, 200);

    const deleteRes = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      `/api/users/${createdUserId}`,
      { method: "DELETE" },
    );
    assert.equal(deleteRes.status, 200);
  });

  await t.test("log routes", async () => {
    const listUser = await authedFetch(baseUrl, userLogin.cookie, "/api/logs");
    assert.equal(listUser.status, 200);

    const listAdmin = await authedFetch(baseUrl, adminLogin.cookie, "/api/logs?limit=50");
    assert.equal(listAdmin.status, 200);

    const deleteForbidden = await authedFetch(baseUrl, userLogin.cookie, "/api/logs", {
      method: "DELETE",
    });
    assert.equal(deleteForbidden.status, 403);
  });

  await t.test("admin routes (leaderboard + retention)", async () => {
    const leaderboardForbidden = await authedFetch(
      baseUrl,
      userLogin.cookie,
      "/api/admin/leaderboard",
    );
    assert.equal(leaderboardForbidden.status, 403);

    const leaderboardRes = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      "/api/admin/leaderboard",
    );
    assert.equal(leaderboardRes.status, 200);
    const leaderboard = await leaderboardRes.json();
    assert.ok(Array.isArray(leaderboard));

    const retentionGet = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      "/api/admin/retention",
    );
    assert.equal(retentionGet.status, 200);

    const retentionPatch = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      "/api/admin/retention",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logsMaxCount: 50 }),
      },
    );
    assert.equal(retentionPatch.status, 200);

    const retentionRun = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      "/api/admin/retention/run",
      { method: "POST" },
    );
    assert.equal(retentionRun.status, 200);
  });

  await t.test("device analysis routes", async () => {
    const listTemplates = await authedFetch(
      baseUrl,
      userLogin.cookie,
      "/api/device-analysis/templates",
    );
    assert.equal(listTemplates.status, 200);

    const createTemplate = await authedFetch(
      baseUrl,
      userLogin.cookie,
      "/api/device-analysis/templates",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "T1", selectedColumns: [0, 1, 2] }),
      },
    );
    assert.equal(createTemplate.status, 201);
    const tpl = await createTemplate.json();
    assert.ok(tpl?.id);

    const patchTemplate = await authedFetch(
      baseUrl,
      userLogin.cookie,
      `/api/device-analysis/templates/${tpl.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "T1b", selectedColumns: [0] }),
      },
    );
    assert.equal(patchTemplate.status, 200);

    const bulk = await authedFetch(
      baseUrl,
      userLogin.cookie,
      "/api/device-analysis/templates/bulk",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ name: "Tbulk", selectedColumns: [1] }]),
      },
    );
    assert.equal(bulk.status, 201);

    const getSettings = await authedFetch(
      baseUrl,
      userLogin.cookie,
      "/api/device-analysis/settings",
    );
    assert.equal(getSettings.status, 200);

    const patchSettings = await authedFetch(
      baseUrl,
      userLogin.cookie,
      "/api/device-analysis/settings",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yUnit: "uA", ssIdLow: 1e-12, ssIdHigh: 1e-10 }),
      },
    );
    assert.equal(patchSettings.status, 200);

    const deleteTemplate = await authedFetch(
      baseUrl,
      userLogin.cookie,
      `/api/device-analysis/templates/${tpl.id}`,
      { method: "DELETE" },
    );
    assert.equal(deleteTemplate.status, 200);
  });

  await t.test("literature routes (non-network paths)", async () => {
    const settingsGet = await authedFetch(
      baseUrl,
      userLogin.cookie,
      "/api/literature/settings",
    );
    assert.equal(settingsGet.status, 200);

    const settingsPatch = await authedFetch(
      baseUrl,
      userLogin.cookie,
      "/api/literature/settings",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxResults: 5,
          sourceType: "nature",
          seedUrls: [],
        }),
      },
    );
    assert.equal(settingsPatch.status, 200);

    // Avoid external fetch: invalid dates throw in literatureService before any network.
    const searchRes = await authedFetch(
      baseUrl,
      userLogin.cookie,
      "/api/literature/search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedUrls: [], startDate: "bad", endDate: "bad", maxResults: 1 }),
      },
    );
    assert.equal(searchRes.status, 500);

    const translateMissingText = await authedFetch(
      baseUrl,
      userLogin.cookie,
      "/api/literature/translate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    assert.equal(translateMissingText.status, 400);

    const downloadMissing = await authedFetch(
      baseUrl,
      userLogin.cookie,
      "/api/literature/download/not-a-token",
    );
    assert.equal(downloadMissing.status, 404);
  });

  await t.test("literature admin routes", async () => {
    const forbidden = await authedFetch(
      baseUrl,
      userLogin.cookie,
      "/api/admin/literature/translation-key",
    );
    assert.equal(forbidden.status, 403);

    const keyRes = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      "/api/admin/literature/translation-key",
    );
    assert.equal(keyRes.status, 200);

    const providerRes = await authedFetch(
      baseUrl,
      adminLogin.cookie,
      "/api/admin/literature/translation-provider",
    );
    assert.equal(providerRes.status, 200);
  });
});
