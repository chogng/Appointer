// Simple API smoke test (Node 18+)
const DEFAULT_API_BASE = "http://localhost:3001/api";
const API_BASE = (process.env.API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");

function extractTokenCookie(setCookieHeader) {
  if (!setCookieHeader) return null;
  // set-cookie: "token=...; Path=/; HttpOnly; ..."
  return setCookieHeader.split(";")[0] || null;
}

async function readErrorBody(res) {
  const contentType = res.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const json = await res.json();
      return json?.error || json?.message || JSON.stringify(json);
    }
    return await res.text();
  } catch {
    return "";
  }
}

async function test() {
  console.log("Running API smoke test...");

  console.log("1) Login (admin/123)");
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "123" }),
  });
  if (!loginRes.ok) {
    throw new Error(
      `POST /auth/login failed (${loginRes.status}): ${await readErrorBody(loginRes)}`,
    );
  }
  const authCookie = extractTokenCookie(loginRes.headers.get("set-cookie"));
  if (!authCookie) {
    throw new Error("Login did not return a token cookie (set-cookie missing).");
  }
  const user = await loginRes.json();
  console.log(`   OK: logged in as ${user.username} (${user.role})`);

  console.log("2) Fetch devices (auth required)");
  const devicesRes = await fetch(`${API_BASE}/devices`, {
    headers: { Cookie: authCookie },
  });
  if (!devicesRes.ok) {
    throw new Error(
      `GET /devices failed (${devicesRes.status}): ${await readErrorBody(devicesRes)}`,
    );
  }
  const devices = await devicesRes.json();
  console.log(`   OK: ${devices.length} device(s)`);

  console.log("3) Toggle first device isEnabled=false (admin-only)");
  const deviceId = devices?.[0]?.id;
  if (!deviceId) throw new Error("No devices found to update.");

  const updateRes = await fetch(`${API_BASE}/devices/${deviceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: authCookie },
    body: JSON.stringify({ isEnabled: false }),
  });
  if (!updateRes.ok) {
    throw new Error(
      `PATCH /devices/:id failed (${updateRes.status}): ${await readErrorBody(updateRes)}`,
    );
  }
  const updated = await updateRes.json();
  console.log(`   OK: ${updated.name} -> isEnabled=${updated.isEnabled}`);

  console.log("4) Verify device state");
  const verifyRes = await fetch(`${API_BASE}/devices/${deviceId}`, {
    headers: { Cookie: authCookie },
  });
  if (!verifyRes.ok) {
    throw new Error(
      `GET /devices/:id failed (${verifyRes.status}): ${await readErrorBody(verifyRes)}`,
    );
  }
  const verified = await verifyRes.json();
  console.log(`   OK: isEnabled=${verified.isEnabled}`);

  console.log("All tests passed.");
}

test().catch((error) => {
  console.error("Test failed:", error?.message || error);
  console.error("Hint: ensure backend is running (npm run server).");
  process.exit(1);
});
