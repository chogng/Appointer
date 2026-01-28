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

export function getDashboardActivityDeviceNames(log, { deviceNameById } = {}) {
  const details = typeof log?.details === "string" ? log.details.trim() : "";
  if (!details) return [];

  const ids = new Set();

  // Format A: repeated "device <id>" tokens.
  const repeatedDeviceRe = /\bdevice\s+([a-z0-9_-]+)\b/gi;
  for (const m of details.matchAll(repeatedDeviceRe)) {
    const id = m?.[1];
    if (id) ids.add(id);
  }

  // Format B: single "device <id1> <id2> ... xN" list.
  if (!ids.size) {
    const idx = details.toLowerCase().indexOf("device ");
    if (idx !== -1) {
      const tail = details.slice(idx + "device ".length).trim();
      for (const token of tail.split(/\s+/)) {
        if (!token) continue;
        if (/^x\d+$/i.test(token)) break;
        if (/^[a-z0-9_-]+$/i.test(token)) {
          ids.add(token);
          continue;
        }
        break;
      }
    }
  }

  if (!ids.size) return [];

  const names = [];
  for (const id of ids) {
    const name = deviceNameById?.[id];
    if (name) names.push(name);
  }
  return names;
}

export function getDashboardActivityDetailLabel(log, { deviceNameById } = {}) {
  return getDashboardActivityDeviceNames(log, { deviceNameById }).join(" ");
}
