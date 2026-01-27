import net from "net";
import { lookup as dnsLookup } from "dns/promises";

export const BIGMODEL_TRANSLATION_MODEL = "glm-4.5-flash";

const SYSTEM_SETTINGS_KEYS = {
  literatureDefaultTranslationApiKey: "literature.translationApiKeyDefault",
  literatureDefaultTranslationModel: "literature.translationModelDefault",
  literatureDefaultTranslationBaseUrl: "literature.translationBaseUrlDefault",
  literatureTranslationProvider: "literature.translationProvider",
};

const LEGACY_SYSTEM_SETTINGS_KEYS = {
  literatureDefaultTranslationApiKey: "literature.bigmodelApiKeyDefault",
  literatureDefaultTranslationModel: "literature.bigmodelModelDefault",
};

export const SUPPORTED_TRANSLATION_PROVIDERS = ["bigmodel", "openai", "openai_compatible"];

function normalizeTranslationBaseUrl(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return null;
  if (trimmed.length > 2000) throw new Error("translationBaseUrl is too long");

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("translationBaseUrl must be a valid URL");
  }

  if (url.username || url.password) {
    throw new Error("translationBaseUrl must not include credentials");
  }
  if (url.protocol !== "https:") {
    throw new Error("translationBaseUrl must use https");
  }
  if (url.port && url.port !== "443") {
    throw new Error("translationBaseUrl must use port 443");
  }

  url.hash = "";
  url.search = "";

  const normalizedPath = String(url.pathname || "/").replace(/\/+$/, "");
  const basePath = normalizedPath === "/" ? "" : normalizedPath;

  return `${url.origin}${basePath}`;
}

function isPrivateOrLocalHostname(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return true;
  if (host === "localhost") return true;
  if (host.endsWith(".localhost")) return true;
  if (host.endsWith(".local")) return true;
  if (host === "0") return true;
  return false;
}

function isPrivateIpAddress(address) {
  const ip = String(address || "").trim();
  const ipVersion = net.isIP(ip);
  if (!ipVersion) return false;

  if (ipVersion === 4) {
    const parts = ip.split(".").map((p) => Number(p));
    if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255))
      return true;
    const [a, b, c] = parts;

    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;

    if (a === 192 && b === 0 && c === 0) return true;
    if (a === 192 && b === 0 && c === 2) return true;
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;

    if (a >= 224) return true;
    return false;
  }

  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80")) return true;
  return false;
}

export async function validateTranslationBaseUrl(value) {
  const normalized = normalizeTranslationBaseUrl(value);
  if (!normalized) return null;

  const url = new URL(normalized);
  const hostname = url.hostname;
  if (isPrivateOrLocalHostname(hostname)) {
    throw new Error("translationBaseUrl hostname is not allowed");
  }

  if (net.isIP(hostname)) {
    if (isPrivateIpAddress(hostname)) throw new Error("translationBaseUrl IP is not allowed");
    return normalized;
  }

  const results = await dnsLookup(hostname, { all: true, verbatim: true }).catch(() => null);
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("translationBaseUrl hostname could not be resolved");
  }
  for (const entry of results) {
    const addr = entry?.address;
    if (!addr) continue;
    if (isPrivateIpAddress(addr)) {
      throw new Error("translationBaseUrl resolves to a private IP");
    }
  }

  return normalized;
}

export function maskApiKey(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  if (raw.length <= 8) return "********";
  return `****${raw.slice(-4)}`;
}

async function getSystemSettingValue(db, key) {
  const row = await db.queryOne("SELECT value, updatedAt FROM system_settings WHERE `key` = ?", [key]);
  return row ? { value: row.value ?? null, updatedAt: row.updatedAt ?? null } : null;
}

async function upsertSystemSettingValue(db, key, value, nowIso) {
  const val = String(value ?? "");

  if (db.dialect === "mysql") {
    await db.execute(
      "INSERT INTO system_settings (`key`, value, updatedAt) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?, updatedAt = ?",
      [key, val, nowIso, val, nowIso],
    );
    return;
  }

  await db.execute("INSERT OR REPLACE INTO system_settings (key, value, updatedAt) VALUES (?, ?, ?)", [
    key,
    val,
    nowIso,
  ]);
}

async function deleteSystemSetting(db, key) {
  await db.execute("DELETE FROM system_settings WHERE `key` = ?", [key]);
}

export async function getDefaultTranslationApiKey(db) {
  const row = await getSystemSettingValue(db, SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationApiKey);
  const raw = typeof row?.value === "string" ? row.value.trim() : "";
  if (raw) {
    return {
      key: raw,
      hasKey: Boolean(raw),
      updatedAt: row?.updatedAt || null,
    };
  }

  const legacyRow = await getSystemSettingValue(db, LEGACY_SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationApiKey);
  const legacyRaw = typeof legacyRow?.value === "string" ? legacyRow.value.trim() : "";
  if (!legacyRaw) {
    if (legacyRow) {
      await deleteSystemSetting(db, LEGACY_SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationApiKey);
    }
    return {
      key: "",
      hasKey: false,
      updatedAt: row?.updatedAt || legacyRow?.updatedAt || null,
    };
  }

  const nowIso = new Date().toISOString();
  await upsertSystemSettingValue(db, SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationApiKey, legacyRaw, nowIso);
  await deleteSystemSetting(db, LEGACY_SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationApiKey);

  return {
    key: legacyRaw,
    hasKey: true,
    updatedAt: legacyRow?.updatedAt || nowIso,
  };
}

export async function setDefaultTranslationApiKey(db, value, nowIso) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    await deleteSystemSetting(db, SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationApiKey);
    await deleteSystemSetting(db, LEGACY_SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationApiKey);
    return { hasKey: false, masked: null, updatedAt: nowIso };
  }

  await upsertSystemSettingValue(db, SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationApiKey, trimmed, nowIso);
  await deleteSystemSetting(db, LEGACY_SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationApiKey);
  return { hasKey: true, masked: maskApiKey(trimmed), updatedAt: nowIso };
}

export async function getDefaultTranslationModel(db) {
  const row = await getSystemSettingValue(db, SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationModel);
  const raw = typeof row?.value === "string" ? row.value.trim() : "";
  if (raw) {
    return {
      model: raw,
      hasModel: Boolean(raw),
      updatedAt: row?.updatedAt || null,
    };
  }

  const legacyRow = await getSystemSettingValue(db, LEGACY_SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationModel);
  const legacyRaw = typeof legacyRow?.value === "string" ? legacyRow.value.trim() : "";
  if (!legacyRaw) {
    if (legacyRow) {
      await deleteSystemSetting(db, LEGACY_SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationModel);
    }
    return {
      model: "",
      hasModel: false,
      updatedAt: row?.updatedAt || legacyRow?.updatedAt || null,
    };
  }

  const nowIso = new Date().toISOString();
  await upsertSystemSettingValue(db, SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationModel, legacyRaw, nowIso);
  await deleteSystemSetting(db, LEGACY_SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationModel);

  return {
    model: legacyRaw,
    hasModel: true,
    updatedAt: legacyRow?.updatedAt || nowIso,
  };
}

export async function setDefaultTranslationModel(db, value, nowIso) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    await deleteSystemSetting(db, SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationModel);
    await deleteSystemSetting(db, LEGACY_SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationModel);
    return { hasModel: false, model: null, updatedAt: nowIso };
  }

  await upsertSystemSettingValue(db, SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationModel, trimmed, nowIso);
  await deleteSystemSetting(db, LEGACY_SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationModel);
  return { hasModel: true, model: trimmed, updatedAt: nowIso };
}

export async function getDefaultTranslationBaseUrl(db) {
  const row = await getSystemSettingValue(db, SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationBaseUrl);
  const raw = typeof row?.value === "string" ? row.value.trim() : "";
  return {
    baseUrl: raw,
    hasBaseUrl: Boolean(raw),
    updatedAt: row?.updatedAt || null,
  };
}

export async function setDefaultTranslationBaseUrl(db, value, nowIso) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    await deleteSystemSetting(db, SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationBaseUrl);
    return { hasBaseUrl: false, baseUrl: null, updatedAt: nowIso };
  }

  const validated = await validateTranslationBaseUrl(trimmed);
  await upsertSystemSettingValue(db, SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationBaseUrl, validated, nowIso);
  return { hasBaseUrl: true, baseUrl: validated, updatedAt: nowIso };
}

export async function getTranslationProvider(db) {
  const row = await getSystemSettingValue(db, SYSTEM_SETTINGS_KEYS.literatureTranslationProvider);
  const raw = typeof row?.value === "string" ? row.value.trim().toLowerCase() : "";
  const provider = raw || "bigmodel";
  return {
    provider,
    hasProvider: Boolean(raw),
    updatedAt: row?.updatedAt || null,
    supportedProviders: SUPPORTED_TRANSLATION_PROVIDERS.slice(),
  };
}

export async function setTranslationProvider(db, value, nowIso) {
  const trimmed = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!trimmed) {
    throw new Error("translationProvider is required");
  }
  if (trimmed.length > 100) {
    throw new Error("translationProvider is too long");
  }
  if (/[\r\n]/.test(trimmed)) {
    throw new Error("translationProvider must be single-line");
  }

  await upsertSystemSettingValue(db, SYSTEM_SETTINGS_KEYS.literatureTranslationProvider, trimmed, nowIso);
  return {
    provider: trimmed,
    hasProvider: true,
    updatedAt: nowIso,
    supportedProviders: SUPPORTED_TRANSLATION_PROVIDERS.slice(),
  };
}

