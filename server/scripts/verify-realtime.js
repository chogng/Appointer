import { io } from "socket.io-client";

const DEFAULT_API_BASE = "http://localhost:3001/api";
const API_BASE = (process.env.API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");

const DEFAULT_WS_URL = "http://localhost:3001";
const WS_URL = (process.env.WS_URL || DEFAULT_WS_URL).replace(/\/$/, "");

function extractTokenCookie(setCookieHeader) {
  if (!setCookieHeader) return null;
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

async function loginAsAdmin() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "123" }),
  });
  if (!res.ok) {
    throw new Error(
      `Login failed (${res.status}): ${await readErrorBody(res)}`,
    );
  }

  const cookie = extractTokenCookie(res.headers.get("set-cookie"));
  if (!cookie) throw new Error("Login did not return a token cookie.");
  return cookie;
}

async function verify() {
  console.log("Verifying realtime features...");
  console.log(`API: ${API_BASE}`);
  console.log(`WS : ${WS_URL}`);

  const authCookie = await loginAsAdmin();

  return new Promise((resolve, reject) => {
    const socket = io(WS_URL, {
      transports: ["websocket", "polling"],
      extraHeaders: { Cookie: authCookie },
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Timeout: no realtime event received within 5 seconds."));
    }, 5000);

    socket.on("connect_error", (err) => {
      clearTimeout(timeout);
      socket.disconnect();
      reject(new Error(`Socket connect error: ${err?.message || err}`));
    });

    socket.on("connect", async () => {
      try {
        const postData = {
          name: `Test Device ${Date.now()}`,
          description: "Automated test device",
          granularity: 60,
          openDays: [1, 2, 3, 4, 5],
          openTime: { start: "09:00", end: "18:00" },
        };

        const res = await fetch(`${API_BASE}/devices`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: authCookie },
          body: JSON.stringify(postData),
        });

        console.log(`REST Request Status: ${res.status}`);
        if (!res.ok) {
          clearTimeout(timeout);
          socket.disconnect();
          reject(
            new Error(`Failed to create device: ${await readErrorBody(res)}`),
          );
        }
      } catch (error) {
        clearTimeout(timeout);
        socket.disconnect();
        reject(error);
      }
    });

    socket.on("device:created", (data) => {
      clearTimeout(timeout);
      console.log(`Received device:created event: ${data?.name || data?.id}`);
      socket.disconnect();
      resolve();
    });
  });
}

verify()
  .then(() => {
    console.log("Realtime verification passed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Realtime verification failed:", error?.message || error);
    console.error("Hint: ensure backend is running (npm run server).");
    process.exit(1);
  });
