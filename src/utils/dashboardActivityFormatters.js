// Dashboard activity helpers: build device index and format activity detail label (device name).

export function buildDeviceNameById(devices) {
  const deviceNameById = {};
  for (const device of Array.isArray(devices) ? devices : []) {
    if (!device?.id) continue;
    const deviceName = typeof device.name === "string" ? device.name.trim() : "";
    if (!deviceName) continue;
    deviceNameById[String(device.id)] = deviceName;
  }
  return deviceNameById;
}

export function getDashboardActivityDetailLabel(log, { deviceNameById } = {}) {
  const details = typeof log?.details === "string" ? log.details.trim() : "";
  if (!details) return "";

  const deviceIdMatch = details.match(/\bdevice\s+([a-z0-9_-]+)\b/i);
  if (!deviceIdMatch?.[1]) return "";

  const deviceId = deviceIdMatch[1];
  const deviceName = deviceNameById?.[deviceId];
  return deviceName || "";
}

