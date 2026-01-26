import express from "express";
import cors from "cors";
import { createHash, randomUUID } from "crypto";
import { createServer } from "http";
import { Server } from "socket.io";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";
import net from "net";
import { lookup as dnsLookup } from "dns/promises";

import { db } from "./src/config/db.js";
import { DEFAULT_CLIENT_ORIGIN, JWT_SECRET } from "./src/config/env.js";
import {
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  isAdminRole,
} from "./src/middleware/authMiddleware.js";
import authRoutes from "./src/routes/authRoutes.js";
import {
  getRetentionSettings,
  runRetentionCleanup,
  startRetentionScheduler,
  updateRetentionSettings,
} from "./src/retention.js";
import { searchLiterature } from "./src/literatureService.js";
import { asyncHandler } from "./src/middleware/asyncHandler.js";
import { errorMiddleware } from "./src/middleware/errorMiddleware.js";
import {
  assertAllowedKeys,
  optionalInteger,
  optionalString,
  requireInteger,
  requireOneOf,
  requirePlainObject,
  requireString,
} from "./src/utils/validation.js";

const app = express();
const httpServer = createServer(app);
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT) || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistDir = path.resolve(__dirname, "../dist");

const corsOriginEnv = process.env.CORS_ORIGIN || process.env.CLIENT_ORIGIN;
const corsOrigins = (corsOriginEnv || DEFAULT_CLIENT_ORIGIN)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

for (const origin of [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`]) {
  if (!corsOrigins.includes(origin)) corsOrigins.push(origin);
}

function safeJsonParse(value, fallback) {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTimeSlot(value) {
  return typeof value === "string" && /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(value);
}

function isUniqueConstraintError(error) {
  const msg = String(error?.message || "");
  const code = String(error?.code || "");
  const errno = Number(error?.errno);
  return (
    msg.includes("UNIQUE constraint failed") ||
    msg.includes("constraint failed") ||
    msg.includes("Duplicate entry") ||
    code === "ER_DUP_ENTRY" ||
    errno === 1062
  );
}

function sanitizeDeviceAnalysisTemplateConfig(input) {
  const src = isPlainObject(input) ? input : {};

  const name = typeof src.name === "string" ? src.name.trim() : "";

  const selectedColumns = Array.isArray(src.selectedColumns)
    ? src.selectedColumns
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0)
    : [];

  const vgKeywordRaw = src.vgKeyword == null ? "" : String(src.vgKeyword).trim();
  const vdKeywordRaw = src.vdKeyword == null ? "" : String(src.vdKeyword).trim();

  // Back-compat: some clients send Var1/Var2 as bottomTitle/legendPrefix instead of vgKeyword/vdKeyword.
  const bottomTitleRaw = src.bottomTitle == null ? "" : String(src.bottomTitle).trim();
  const legendPrefixRaw = src.legendPrefix == null ? "" : String(src.legendPrefix).trim();
  const bottomTitle = bottomTitleRaw || vgKeywordRaw;
  const legendPrefix = legendPrefixRaw || vdKeywordRaw;

  const leftTitle = src.leftTitle == null ? "" : String(src.leftTitle).trim();
  const matchPattern = src.matchPattern == null ? "" : String(src.matchPattern).trim();
  const fileNameVgKeywords =
    src.fileNameVgKeywords == null
      ? src.vgFileKeywords == null
        ? ""
        : String(src.vgFileKeywords).trim()
      : String(src.fileNameVgKeywords).trim();
  const fileNameVdKeywords =
    src.fileNameVdKeywords == null
      ? src.vdFileKeywords == null
        ? ""
        : String(src.vdFileKeywords).trim()
      : String(src.fileNameVdKeywords).trim();

  return {
    name,
    xDataStart: src.xDataStart == null ? "" : String(src.xDataStart),
    xDataEnd: src.xDataEnd == null ? "" : String(src.xDataEnd),
    xPoints: src.xPoints == null ? "" : String(src.xPoints),
    yDataStart: src.yDataStart == null ? "" : String(src.yDataStart),
    yDataEnd: src.yDataEnd == null ? "" : String(src.yDataEnd),
    yPoints: src.yPoints == null ? "" : String(src.yPoints),
    yCount: src.yCount == null ? "" : String(src.yCount),
    yStep: src.yStep == null ? "" : String(src.yStep),
    stopOnError: Boolean(src.stopOnError),
    bottomTitle,
    legendPrefix,
    leftTitle,
    matchPattern,
    fileNameVgKeywords,
    fileNameVdKeywords,
    vgKeyword: bottomTitle,
    vdKeyword: legendPrefix,
    selectedColumns,
  };
}

function sanitizeDeviceAnalysisSettings(input) {
  const src = isPlainObject(input) ? input : {};
  const patch = {};
  const errors = [];

  const has = (key) => Object.prototype.hasOwnProperty.call(src, key);

  if (has("yUnit")) {
    const yUnitRaw = src.yUnit;
    const yUnit =
      yUnitRaw === "A" || yUnitRaw === "uA" || yUnitRaw === "nA"
        ? yUnitRaw
        : null;
    if (!yUnit) errors.push("yUnit");
    else patch.yUnit = yUnit;
  }

  if (has("ssMethodDefault")) {
    const raw = src.ssMethodDefault;
    const method = typeof raw === "string" ? raw.trim() : String(raw || "").trim();
    const allowed = new Set(["auto", "manual", "idWindow", "legacy"]);
    if (!allowed.has(method)) errors.push("ssMethodDefault");
    else patch.ssMethodDefault = method;
  }

  if (has("ssDiagnosticsEnabled")) {
    patch.ssDiagnosticsEnabled = src.ssDiagnosticsEnabled ? 1 : 0;
  }

  if (has("ssIdLow")) {
    const n = typeof src.ssIdLow === "number" ? src.ssIdLow : Number(src.ssIdLow);
    if (!Number.isFinite(n) || n <= 0) errors.push("ssIdLow");
    else patch.ssIdLow = n;
  }

  if (has("ssIdHigh")) {
    const n = typeof src.ssIdHigh === "number" ? src.ssIdHigh : Number(src.ssIdHigh);
    if (!Number.isFinite(n) || n <= 0) errors.push("ssIdHigh");
    else patch.ssIdHigh = n;
  }

  if (has("stopOnErrorDefault")) {
    patch.stopOnErrorDefault = src.stopOnErrorDefault ? 1 : 0;
  }

  if (has("lastTemplateId")) {
    const raw = src.lastTemplateId;
    if (raw == null || raw === "") {
      patch.lastTemplateId = null;
    } else {
      const value = String(raw).trim();
      if (!value || value.length > 64) errors.push("lastTemplateId");
      else patch.lastTemplateId = value;
    }
  }

  return { patch, errors };
}

function sanitizeSeedUrlsList(input) {
  const values = Array.isArray(input) ? input : [];
  return values
    .map((value) => (value == null ? "" : String(value)))
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function splitSeedUrlsBySourceType(input) {
  const nature = [];
  const science = [];

  for (const value of Array.isArray(input) ? input : []) {
    const url = value == null ? "" : String(value).trim();
    if (!url) continue;
    if (url.includes("science.org")) science.push(url);
    else nature.push(url);
  }

  return {
    nature: sanitizeSeedUrlsList(nature),
    science: sanitizeSeedUrlsList(science),
  };
}

function sanitizeLiteratureSettings(input) {
  const src = isPlainObject(input) ? input : {};

  const seedUrls = sanitizeSeedUrlsList(src.seedUrls);

  const seedSourceRaw = src.seedSource;
  const seedSource =
    seedSourceRaw === "nature" || seedSourceRaw === "science" ? seedSourceRaw : null;

  const sourceTypeRaw = src.sourceType;
  const sourceType =
    sourceTypeRaw === "nature" || sourceTypeRaw === "science" ? sourceTypeRaw : null;

  const seedUrlsBySourceTypeRaw = src.seedUrlsBySourceType;
  const seedUrlsBySourceType = isPlainObject(seedUrlsBySourceTypeRaw)
    ? {
        nature: sanitizeSeedUrlsList(seedUrlsBySourceTypeRaw.nature),
        science: sanitizeSeedUrlsList(seedUrlsBySourceTypeRaw.science),
      }
    : null;

  const startDate = isValidDateString(src.startDate) ? src.startDate : "";
  const endDate = isValidDateString(src.endDate) ? src.endDate : "";

  const maxResultsRaw = src.maxResults;
  const maxResultsNumber =
    typeof maxResultsRaw === "number" ? maxResultsRaw : Number(maxResultsRaw);
  const maxResults = Number.isFinite(maxResultsNumber)
    ? Math.max(1, Math.trunc(maxResultsNumber))
    : null;

  const translationApiKeyRaw = Object.prototype.hasOwnProperty.call(src, "translationApiKey")
    ? src.translationApiKey
    : src.bigmodelApiKey;
  const translationApiKey =
    typeof translationApiKeyRaw === "string"
      ? translationApiKeyRaw.trim()
      : translationApiKeyRaw == null
        ? ""
        : String(translationApiKeyRaw).trim();

  const translationModelRaw = Object.prototype.hasOwnProperty.call(src, "translationModel")
    ? src.translationModel
    : src.bigmodelModel;
  const translationModel =
    typeof translationModelRaw === "string"
      ? translationModelRaw.trim()
      : translationModelRaw == null
        ? ""
        : String(translationModelRaw).trim();

  const translationProviderRaw = src.translationProvider;
  const translationProvider =
    typeof translationProviderRaw === "string"
      ? translationProviderRaw.trim()
      : translationProviderRaw == null
        ? ""
        : String(translationProviderRaw).trim();

  const translationBaseUrlRaw = src.translationBaseUrl;
  const translationBaseUrl =
    typeof translationBaseUrlRaw === "string"
      ? translationBaseUrlRaw.trim()
      : translationBaseUrlRaw == null
        ? ""
        : String(translationBaseUrlRaw).trim();

  return {
    seedUrls,
    seedUrlsBySourceType,
    seedSource,
    sourceType,
    startDate,
    endDate,
    maxResults,
    translationApiKey: translationApiKey || null,
    translationProvider: translationProvider ? translationProvider.toLowerCase() : null,
    translationModel: translationModel || null,
    translationBaseUrl: translationBaseUrl || null,
  };
}

function mergeLiteratureSettings(existingSettings, patchInput) {
  const existing = isPlainObject(existingSettings) ? existingSettings : {};
  const patch = isPlainObject(patchInput) ? patchInput : {};
  const sanitized = sanitizeLiteratureSettings(patch);

  const next = { ...existing };

  const existingSeedUrlsBySourceTypeRaw = next.seedUrlsBySourceType;
  if (isPlainObject(existingSeedUrlsBySourceTypeRaw)) {
    next.seedUrlsBySourceType = {
      nature: sanitizeSeedUrlsList(existingSeedUrlsBySourceTypeRaw.nature),
      science: sanitizeSeedUrlsList(existingSeedUrlsBySourceTypeRaw.science),
    };
  } else {
    next.seedUrlsBySourceType = splitSeedUrlsBySourceType(next.seedUrls);
  }

  if (next.sourceType !== "science" && next.sourceType !== "nature") {
    next.sourceType = null;
  }

  if (!Object.prototype.hasOwnProperty.call(next, "translationApiKey")) {
    const legacyKey =
      typeof next.bigmodelApiKey === "string" ? next.bigmodelApiKey.trim() : "";
    if (legacyKey) next.translationApiKey = legacyKey;
  }

  if (!Object.prototype.hasOwnProperty.call(next, "translationModel")) {
    const legacyModel =
      typeof next.bigmodelModel === "string" ? next.bigmodelModel.trim() : "";
    if (legacyModel) next.translationModel = legacyModel;
  }

  delete next.bigmodelApiKey;
  delete next.bigmodelModel;

  if (
    Object.prototype.hasOwnProperty.call(patch, "seedUrlsBySourceType") &&
    sanitized.seedUrlsBySourceType
  ) {
    next.seedUrlsBySourceType = sanitized.seedUrlsBySourceType;
    const resolvedSourceType =
      sanitized.sourceType ||
      sanitized.seedSource ||
      (next.sourceType === "science" || next.sourceType === "nature" ? next.sourceType : null) ||
      "nature";
    next.sourceType = resolvedSourceType;
    next.seedUrls = next.seedUrlsBySourceType[resolvedSourceType] || [];
  }

  if (Object.prototype.hasOwnProperty.call(patch, "seedUrls")) {
    const targetSourceType =
      sanitized.seedSource ||
      sanitized.sourceType ||
      (next.sourceType === "science" || next.sourceType === "nature" ? next.sourceType : null) ||
      (sanitized.seedUrls.some((url) => url.includes("science.org")) ? "science" : "nature");

    next.seedUrlsBySourceType = isPlainObject(next.seedUrlsBySourceType)
      ? next.seedUrlsBySourceType
      : { nature: [], science: [] };
    next.seedUrlsBySourceType[targetSourceType] = sanitized.seedUrls;
    next.sourceType = targetSourceType;
    next.seedUrls = sanitized.seedUrls;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "sourceType")) {
    next.sourceType = sanitized.sourceType;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "startDate")) {
    next.startDate = sanitized.startDate;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "endDate")) {
    next.endDate = sanitized.endDate;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "maxResults")) {
    next.maxResults = sanitized.maxResults;
  }
  const wantsTranslationApiKey =
    Object.prototype.hasOwnProperty.call(patch, "translationApiKey") ||
    Object.prototype.hasOwnProperty.call(patch, "bigmodelApiKey");
  if (wantsTranslationApiKey) {
    next.translationApiKey = sanitized.translationApiKey;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "translationProvider")) {
    next.translationProvider = sanitized.translationProvider;
  }

  const wantsTranslationModel =
    Object.prototype.hasOwnProperty.call(patch, "translationModel") ||
    Object.prototype.hasOwnProperty.call(patch, "bigmodelModel");
  if (wantsTranslationModel) {
    next.translationModel = sanitized.translationModel;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "translationBaseUrl")) {
    next.translationBaseUrl = sanitized.translationBaseUrl;
  }

  if (!isPlainObject(next.seedUrlsBySourceType)) {
    next.seedUrlsBySourceType = { nature: [], science: [] };
  }
  if (!Array.isArray(next.seedUrlsBySourceType.nature)) next.seedUrlsBySourceType.nature = [];
  if (!Array.isArray(next.seedUrlsBySourceType.science))
    next.seedUrlsBySourceType.science = [];

  if (next.sourceType !== "science" && next.sourceType !== "nature") {
    next.sourceType =
      next.seedUrlsBySourceType.science.length > 0 &&
      next.seedUrlsBySourceType.nature.length === 0
        ? "science"
        : "nature";
  }

  next.seedUrls =
    next.seedUrlsBySourceType[next.sourceType] ||
    next.seedUrlsBySourceType.nature ||
    [];
  if (typeof next.startDate !== "string") next.startDate = "";
  if (typeof next.endDate !== "string") next.endDate = "";
  if (next.maxResults == null) {
    next.maxResults = null;
  } else {
    const maxResultsNumber = Number(next.maxResults);
    next.maxResults = Number.isFinite(maxResultsNumber)
      ? Math.max(1, Math.trunc(maxResultsNumber))
      : null;
  }

  if (typeof next.translationApiKey !== "string") {
    next.translationApiKey = next.translationApiKey ? String(next.translationApiKey) : null;
  }
  if (typeof next.translationApiKey === "string") {
    const trimmed = next.translationApiKey.trim();
    next.translationApiKey = trimmed ? trimmed : null;
  }

  if (typeof next.translationProvider !== "string") {
    next.translationProvider = next.translationProvider ? String(next.translationProvider) : null;
  }
  if (typeof next.translationProvider === "string") {
    const trimmed = next.translationProvider.trim().toLowerCase();
    if (!trimmed) {
      next.translationProvider = null;
    } else {
      if (trimmed.length > 100) throw new Error("translationProvider is too long");
      if (/[\r\n]/.test(trimmed)) throw new Error("translationProvider must be single-line");
      next.translationProvider = trimmed;
    }
  }

  if (typeof next.translationModel !== "string") {
    next.translationModel = next.translationModel ? String(next.translationModel) : null;
  }
  if (typeof next.translationModel === "string") {
    const trimmed = next.translationModel.trim();
    next.translationModel = trimmed ? trimmed : null;
  }

  if (typeof next.translationBaseUrl !== "string") {
    next.translationBaseUrl = next.translationBaseUrl ? String(next.translationBaseUrl) : null;
  }
  if (typeof next.translationBaseUrl === "string") {
    const trimmed = next.translationBaseUrl.trim();
    next.translationBaseUrl = trimmed ? trimmed : null;
  }

  return next;
}

function makeId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

const LITERATURE_DOWNLOAD_TTL_MS = 60 * 60 * 1000;
const literatureDownloadTokens = new Map();

const LITERATURE_TRANSLATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const literatureTranslationCache = new Map();

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

// Built-in providers; any other provider value is treated as OpenAI-compatible and requires a base URL.
const SUPPORTED_TRANSLATION_PROVIDERS = ["bigmodel", "openai", "openai_compatible"];

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
    if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) return true;
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
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
  if (normalized.startsWith("fe80")) return true; // link-local
  return false;
}

async function validateTranslationBaseUrl(value) {
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

function maskApiKey(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  if (raw.length <= 8) return "********";
  return `****${raw.slice(-4)}`;
}

async function getSystemSettingValue(db, key) {
  const row = await db.queryOne(
    "SELECT value, updatedAt FROM system_settings WHERE `key` = ?",
    [key],
  );
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

  await db.execute(
    "INSERT OR REPLACE INTO system_settings (key, value, updatedAt) VALUES (?, ?, ?)",
    [key, val, nowIso],
  );
}

async function deleteSystemSetting(db, key) {
  await db.execute("DELETE FROM system_settings WHERE `key` = ?", [key]);
}

async function getDefaultTranslationApiKey(db) {
  const row = await getSystemSettingValue(
    db,
    SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationApiKey,
  );
  const raw = typeof row?.value === "string" ? row.value.trim() : "";
  if (raw) {
    return {
      key: raw,
      hasKey: Boolean(raw),
      updatedAt: row?.updatedAt || null,
    };
  }

  const legacyRow = await getSystemSettingValue(
    db,
    LEGACY_SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationApiKey,
  );
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
  await upsertSystemSettingValue(
    db,
    SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationApiKey,
    legacyRaw,
    nowIso,
  );
  await deleteSystemSetting(db, LEGACY_SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationApiKey);

  return {
    key: legacyRaw,
    hasKey: true,
    updatedAt: legacyRow?.updatedAt || nowIso,
  };
}

async function setDefaultTranslationApiKey(db, value, nowIso) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    await deleteSystemSetting(db, SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationApiKey);
    await deleteSystemSetting(db, LEGACY_SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationApiKey);
    return { hasKey: false, masked: null, updatedAt: nowIso };
  }

  await upsertSystemSettingValue(
    db,
    SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationApiKey,
    trimmed,
    nowIso,
  );
  await deleteSystemSetting(db, LEGACY_SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationApiKey);
  return { hasKey: true, masked: maskApiKey(trimmed), updatedAt: nowIso };
}

async function getDefaultTranslationModel(db) {
  const row = await getSystemSettingValue(
    db,
    SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationModel,
  );
  const raw = typeof row?.value === "string" ? row.value.trim() : "";
  if (raw) {
    return {
      model: raw,
      hasModel: Boolean(raw),
      updatedAt: row?.updatedAt || null,
    };
  }

  const legacyRow = await getSystemSettingValue(
    db,
    LEGACY_SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationModel,
  );
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
  await upsertSystemSettingValue(
    db,
    SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationModel,
    legacyRaw,
    nowIso,
  );
  await deleteSystemSetting(db, LEGACY_SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationModel);

  return {
    model: legacyRaw,
    hasModel: true,
    updatedAt: legacyRow?.updatedAt || nowIso,
  };
}

async function setDefaultTranslationModel(db, value, nowIso) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    await deleteSystemSetting(db, SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationModel);
    await deleteSystemSetting(db, LEGACY_SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationModel);
    return { hasModel: false, model: null, updatedAt: nowIso };
  }

  await upsertSystemSettingValue(
    db,
    SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationModel,
    trimmed,
    nowIso,
  );
  await deleteSystemSetting(db, LEGACY_SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationModel);
  return { hasModel: true, model: trimmed, updatedAt: nowIso };
}

async function getDefaultTranslationBaseUrl(db) {
  const row = await getSystemSettingValue(
    db,
    SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationBaseUrl,
  );
  const raw = typeof row?.value === "string" ? row.value.trim() : "";
  return {
    baseUrl: raw,
    hasBaseUrl: Boolean(raw),
    updatedAt: row?.updatedAt || null,
  };
}

async function setDefaultTranslationBaseUrl(db, value, nowIso) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    await deleteSystemSetting(db, SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationBaseUrl);
    return { hasBaseUrl: false, baseUrl: null, updatedAt: nowIso };
  }

  const validated = await validateTranslationBaseUrl(trimmed);
  await upsertSystemSettingValue(
    db,
    SYSTEM_SETTINGS_KEYS.literatureDefaultTranslationBaseUrl,
    validated,
    nowIso,
  );
  return { hasBaseUrl: true, baseUrl: validated, updatedAt: nowIso };
}

async function getTranslationProvider(db) {
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

async function setTranslationProvider(db, value, nowIso) {
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

function cleanupLiteratureTranslationCache() {
  const now = Date.now();
  for (const [key, entry] of literatureTranslationCache.entries()) {
    if (!entry?.createdAt) {
      literatureTranslationCache.delete(key);
      continue;
    }
    if (now - entry.createdAt > LITERATURE_TRANSLATION_TTL_MS) {
      literatureTranslationCache.delete(key);
    }
  }
}

function makeLiteratureTranslationCacheKey({ userId, id, text, model, targetLang, provider, baseUrl }) {
  const normalizedUserId = String(userId || "");
  const normalizedId = typeof id === "string" && id.trim() ? id.trim() : "";
  const normalizedText = typeof text === "string" ? text.trim() : "";
  const normalizedModel = typeof model === "string" && model.trim()
    ? model.trim()
    : "glm-4.5-flash";
  const normalizedProvider = typeof provider === "string" && provider.trim()
    ? provider.trim().toLowerCase()
    : "bigmodel";
  const normalizedBaseUrl = typeof baseUrl === "string" ? baseUrl.trim() : "";
  const normalizedTargetLang = String(targetLang || "").trim().toLowerCase();
  const target = normalizedTargetLang.startsWith("en") ? "en" : "zh";

  const stableTextHash = createHash("sha256")
    .update(normalizedText, "utf8")
    .digest("hex")
    .slice(0, 16);

  const stableBaseHash = normalizedBaseUrl
    ? createHash("sha256")
      .update(normalizedBaseUrl, "utf8")
      .digest("hex")
      .slice(0, 12)
    : "none";

  const itemKey = normalizedId ? `id:${normalizedId}` : `h:${stableTextHash}`;
  return `${normalizedUserId}|${itemKey}|to:${target}|p:${normalizedProvider}|model:${normalizedModel}|base:${stableBaseHash}`;
}

function cleanupLiteratureDownloadTokens() {
  const now = Date.now();
  for (const [token, entry] of literatureDownloadTokens.entries()) {
    if (!entry?.createdAt) {
      literatureDownloadTokens.delete(token);
      continue;
    }
    if (now - entry.createdAt > LITERATURE_DOWNLOAD_TTL_MS) {
      literatureDownloadTokens.delete(token);
    }
  }
}

function _sanitizeFilename(value) {
  const raw = typeof value === "string" ? value : String(value || "");
  const sanitized = raw
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || "article";
}

function _createLiteratureDownloadToken({ url, filename }) {
  cleanupLiteratureDownloadTokens();
  const token = randomUUID();
  literatureDownloadTokens.set(token, {
    url,
    filename,
    createdAt: Date.now(),
  });
  return token;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function _probePdfUrl(pdfUrl) {
  if (typeof pdfUrl !== "string" || !pdfUrl) {
    return { ok: false, status: 0, contentType: "" };
  }

  try {
    const head = await fetchWithTimeout(
      pdfUrl,
      {
        method: "HEAD",
        redirect: "follow",
        headers: {
          "User-Agent":
            "AppointerLiterature/0.1 (+https://localhost; purpose=literature-research)",
        },
      },
      10_000,
    );

    return {
      ok: head.ok,
      status: head.status,
      contentType: String(head.headers.get("content-type") || "").toLowerCase(),
    };
  } catch {
    return { ok: false, status: 0, contentType: "" };
  }
}

const BIGMODEL_CHAT_COMPLETIONS_URL =
  "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const BIGMODEL_TRANSLATION_MODEL = "glm-4.5-flash";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterToMs(retryAfter) {
  if (retryAfter == null) return null;
  const raw = String(retryAfter).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const seconds = Number(raw);
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return seconds * 1000;
  }
  const date = new Date(raw);
  const time = date.getTime();
  if (!Number.isFinite(time)) return null;
  const diff = time - Date.now();
  return diff > 0 ? diff : 0;
}

function isRetryableBigModelError(error) {
  const status = Number(error?.status);
  if (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true;
  }

  const message = String(error?.message || "");
  if (message.includes("请求过多") || message.toLowerCase().includes("rate")) {
    return true;
  }

  if (error?.name === "AbortError") return true;
  return false;
}

function isRetryableOpenAIError(error) {
  const status = Number(error?.status);
  if (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true;
  }

  const message = String(error?.message || "");
  if (message.toLowerCase().includes("rate") || message.includes("请求过多")) {
    return true;
  }

  if (error?.name === "AbortError") return true;
  return false;
}

async function translateWithBigModel(apiKey, text, targetLang = "zh", model = BIGMODEL_TRANSLATION_MODEL) {
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!key) throw new Error("BigModel API key is not configured");

  const inputText = typeof text === "string" ? text.trim() : "";
  if (!inputText) throw new Error("text is required");

  const normalizedTargetLang = String(targetLang || "").trim().toLowerCase();
  const target = normalizedTargetLang.startsWith("en") ? "en" : "zh";
  const resolvedModel =
    typeof model === "string" && model.trim() ? model.trim() : BIGMODEL_TRANSLATION_MODEL;

  const systemPrompt =
    target === "zh"
      ? "You are a translation engine. Translate the user's text to Simplified Chinese only. Output only the translated text. Preserve DOIs, citations, units, symbols, and equations. Do not add any explanations."
      : "You are a translation engine. Translate the user's text to English only. Output only the translated text. Preserve DOIs, citations, units, symbols, and equations. Do not add any explanations.";

  const maxAttempts = 3;
  const baseDelayMs = 800;
  const maxDelayMs = 10_000;

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetchWithTimeout(
        BIGMODEL_CHAT_COMPLETIONS_URL,
        {
          method: "POST",
          redirect: "follow",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            "User-Agent":
              "AppointerLiterature/0.1 (+https://localhost; purpose=abstract-translation)",
          },
           body: JSON.stringify({
            model: resolvedModel,
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              { role: "user", content: inputText },
            ],
            temperature: 0.2,
            stream: false,
          }),
        },
        25_000,
      );

      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      const data = contentType.includes("application/json")
        ? await res.json().catch(() => null)
        : { raw: await res.text().catch(() => "") };

      if (!res.ok) {
        const upstreamMessage =
          data?.error?.message ||
          data?.message ||
          data?.raw ||
          `BigModel failed: ${res.status} ${res.statusText}`;
        const err = new Error(upstreamMessage);
        err.status = res.status;
        err.retryAfter = res.headers.get("retry-after") || null;
        throw err;
      }

      const translated = data?.choices?.[0]?.message?.content;
      const result = typeof translated === "string" ? translated.trim() : "";
      if (!result) throw new Error("BigModel returned empty translation");
      return result;
    } catch (error) {
      lastError = error;

      const shouldRetry = attempt < maxAttempts && isRetryableBigModelError(error);
      if (!shouldRetry) throw error;

      const jitter = Math.floor(Math.random() * 250);
      const exponential = baseDelayMs * 2 ** (attempt - 1) + jitter;
      const retryAfterMs = parseRetryAfterToMs(error?.retryAfter);
      const delayMs = Math.min(
        maxDelayMs,
        Math.max(exponential, retryAfterMs ?? 0),
      );
      await sleep(delayMs);
    }
  }

  throw lastError || new Error("BigModel translation failed");
}

async function translateWithOpenAI(apiKey, text, targetLang = "zh", model) {
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!key) throw new Error("OpenAI API key is not configured");

  const resolvedModel = typeof model === "string" ? model.trim() : "";
  if (!resolvedModel) throw new Error("OpenAI model is not configured");

  const inputText = typeof text === "string" ? text.trim() : "";
  if (!inputText) throw new Error("text is required");

  const normalizedTargetLang = String(targetLang || "").trim().toLowerCase();
  const target = normalizedTargetLang.startsWith("en") ? "en" : "zh";

  const systemPrompt =
    target === "zh"
      ? "You are a translation engine. Translate the user's text to Simplified Chinese only. Output only the translated text. Preserve DOIs, citations, units, symbols, and equations. Do not add any explanations."
      : "You are a translation engine. Translate the user's text to English only. Output only the translated text. Preserve DOIs, citations, units, symbols, and equations. Do not add any explanations.";

  const maxAttempts = 3;
  const baseDelayMs = 800;
  const maxDelayMs = 10_000;

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetchWithTimeout(
        OPENAI_CHAT_COMPLETIONS_URL,
        {
          method: "POST",
          redirect: "follow",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            "User-Agent":
              "AppointerLiterature/0.1 (+https://localhost; purpose=abstract-translation)",
          },
          body: JSON.stringify({
            model: resolvedModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: inputText },
            ],
            temperature: 0.2,
            stream: false,
          }),
        },
        25_000,
      );

      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      const data = contentType.includes("application/json")
        ? await res.json().catch(() => null)
        : { raw: await res.text().catch(() => "") };

      if (!res.ok) {
        const upstreamMessage =
          data?.error?.message ||
          data?.message ||
          data?.raw ||
          `OpenAI failed: ${res.status} ${res.statusText}`;
        const err = new Error(upstreamMessage);
        err.status = res.status;
        err.retryAfter = res.headers.get("retry-after") || null;
        throw err;
      }

      const translated = data?.choices?.[0]?.message?.content;
      const result = typeof translated === "string" ? translated.trim() : "";
      if (!result) throw new Error("OpenAI returned empty translation");
      return result;
    } catch (error) {
      lastError = error;

      const shouldRetry = attempt < maxAttempts && isRetryableOpenAIError(error);
      if (!shouldRetry) throw error;

      const jitter = Math.floor(Math.random() * 250);
      const exponential = baseDelayMs * 2 ** (attempt - 1) + jitter;
      const retryAfterMs = parseRetryAfterToMs(error?.retryAfter);
      const delayMs = Math.min(
        maxDelayMs,
        Math.max(exponential, retryAfterMs ?? 0),
      );
      await sleep(delayMs);
    }
  }

  throw lastError || new Error("OpenAI translation failed");
}

async function translateWithOpenAICompatible(apiKey, text, targetLang = "zh", model, baseUrl) {
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!key) throw new Error("OpenAI-compatible API key is not configured");

  const resolvedModel = typeof model === "string" ? model.trim() : "";
  if (!resolvedModel) throw new Error("OpenAI-compatible model is not configured");

  const normalizedBaseUrl = typeof baseUrl === "string" ? baseUrl.trim() : "";
  if (!normalizedBaseUrl) throw new Error("OpenAI-compatible base URL is not configured");

  const inputText = typeof text === "string" ? text.trim() : "";
  if (!inputText) throw new Error("text is required");

  const normalizedTargetLang = String(targetLang || "").trim().toLowerCase();
  const target = normalizedTargetLang.startsWith("en") ? "en" : "zh";

  const systemPrompt =
    target === "zh"
      ? "You are a translation engine. Translate the user's text to Simplified Chinese only. Output only the translated text. Preserve DOIs, citations, units, symbols, and equations. Do not add any explanations."
      : "You are a translation engine. Translate the user's text to English only. Output only the translated text. Preserve DOIs, citations, units, symbols, and equations. Do not add any explanations.";

  const endpoint = new URL(
    "./chat/completions",
    normalizedBaseUrl.endsWith("/") ? normalizedBaseUrl : `${normalizedBaseUrl}/`,
  ).toString();

  const maxAttempts = 3;
  const baseDelayMs = 800;
  const maxDelayMs = 10_000;

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          redirect: "manual",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            "User-Agent":
              "AppointerLiterature/0.1 (+https://localhost; purpose=abstract-translation)",
          },
          body: JSON.stringify({
            model: resolvedModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: inputText },
            ],
            temperature: 0.2,
            stream: false,
          }),
        },
        25_000,
      );

      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      const data = contentType.includes("application/json")
        ? await res.json().catch(() => null)
        : { raw: await res.text().catch(() => "") };

      if (!res.ok) {
        const upstreamMessage =
          data?.error?.message ||
          data?.message ||
          data?.raw ||
          `OpenAI-compatible upstream failed: ${res.status} ${res.statusText}`;
        const err = new Error(upstreamMessage);
        err.status = res.status;
        err.retryAfter = res.headers.get("retry-after") || null;
        throw err;
      }

      const translated = data?.choices?.[0]?.message?.content;
      const result = typeof translated === "string" ? translated.trim() : "";
      if (!result) throw new Error("OpenAI-compatible returned empty translation");
      return result;
    } catch (error) {
      lastError = error;

      const shouldRetry = attempt < maxAttempts && isRetryableOpenAIError(error);
      if (!shouldRetry) throw error;

      const jitter = Math.floor(Math.random() * 250);
      const exponential = baseDelayMs * 2 ** (attempt - 1) + jitter;
      const retryAfterMs = parseRetryAfterToMs(error?.retryAfter);
      const delayMs = Math.min(
        maxDelayMs,
        Math.max(exponential, retryAfterMs ?? 0),
      );
      await sleep(delayMs);
    }
  }

  throw lastError || new Error("OpenAI-compatible translation failed");
}

async function _mapWithConcurrency(items, concurrency, mapper) {
  const list = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Math.min(10, Number(concurrency) || 6));
  const results = new Array(list.length);
  let index = 0;

  const workers = Array.from({ length: Math.min(limit, list.length) }, () =>
    (async () => {
      while (true) {
        const currentIndex = index;
        index += 1;
        if (currentIndex >= list.length) return;
        results[currentIndex] = await mapper(list[currentIndex], currentIndex);
      }
    })(),
  );

  await Promise.all(workers);
  return results;
}

function getCookieValue(cookieHeader, key) {
  if (typeof cookieHeader !== "string" || !cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${key}=`)) {
      return part.slice(key.length + 1);
    }
  }
  return null;
}

function getLanUrls(port) {
  try {
    const nets = os.networkInterfaces();
    const urls = new Set();

    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family !== "IPv4") continue;
        if (net.internal) continue;
        if (!net.address) continue;
        urls.add(`http://${net.address}:${port}`);
      }
    }

    return [...urls];
  } catch {
    return [];
  }
}

const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

function isSocketOriginAllowed(origin, host) {
  if (!origin) return true; // non-browser clients
  try {
    const url = new URL(origin);
    if (host && url.host === host) return true;
    return corsOrigins.includes(origin);
  } catch {
    return false;
  }
}

// Socket.IO auth: require a valid session token (cookie or bearer) before receiving broadcasts
io.use((socket, next) => {
  try {
    const originHeader = socket.handshake.headers?.origin;
    const hostHeader = socket.handshake.headers?.host;
    if (!isSocketOriginAllowed(originHeader, hostHeader)) {
      return next(new Error("Unauthorized"));
    }

    const cookieHeader = socket.handshake.headers?.cookie || "";
    const cookieToken = getCookieValue(cookieHeader, "token");

    const authHeader = socket.handshake.headers?.authorization;
    const headerToken =
      typeof authHeader === "string" &&
        authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice("bearer ".length).trim()
        : null;

    const token = cookieToken || headerToken || socket.handshake.auth?.token;
    if (!token) return next(new Error("Unauthorized"));

    jwt.verify(token, JWT_SECRET, async (err, payload) => {
      if (err) return next(new Error("Unauthorized"));

      try {
        const dbUser = await db.queryOne(
          "SELECT id, username, role, status, expiryDate FROM users WHERE id = ?",
          [payload?.id],
        );
        if (!dbUser) return next(new Error("Unauthorized"));
        if (dbUser.status !== "ACTIVE") return next(new Error("Unauthorized"));
        if (dbUser.expiryDate) {
          const today = new Date().toISOString().slice(0, 10);
          if (dbUser.expiryDate < today) return next(new Error("Unauthorized"));
        }

        socket.data.user = {
          id: dbUser.id,
          username: dbUser.username,
          role: dbUser.role,
        };
        next();
      } catch {
        next(new Error("Unauthorized"));
      }
    });
  } catch {
    next(new Error("Unauthorized"));
  }
});

// Middleware
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (!origin) return next();

  try {
    const url = new URL(origin);
    const host = req.get("host");
    if (host && url.host === host) return next();
  } catch {
    // ignore invalid origin header; cors middleware will drop it
  }

  return cors({
    origin: corsOrigins,
    credentials: true,
  })(req, res, next);
});
app.use(express.json());
app.use(cookieParser());

// 初始化数据库
await db.init();
startRetentionScheduler(db);

// WebSocket 连接管理
io.on("connection", (socket) => {
  console.log("✅ 客户端连接:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ 客户端断开:", socket.id);
  });
});

// 广播函数：通知所有客户端数据变化
function broadcast(event, data) {
  io.emit(event, data);
  console.log(`📡 广播事件: ${event}`, data);
}

function calculateDuration(timeSlot) {
  if (!timeSlot || !timeSlot.includes("-")) return 0;
  const [start, end] = timeSlot.split("-");
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  return endH * 60 + endM - (startH * 60 + startM);
}

// ============ 统计报表 API ============

app.get(
  "/api/admin/leaderboard",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const users = await db.query("SELECT id, username, name, role FROM users");
    const reservations = await db.query(
      "SELECT userId, timeSlot FROM reservations",
    );

    const stats = {};

    // Initialize user stats
    users.forEach((user) => {
      stats[user.id] = {
        id: user.id,
        username: user.username,
        name: user.name || user.username, // Fallback to username if name is empty
        role: user.role,
        totalMinutes: 0,
      };
    });

    // Aggregate reservation duration
    reservations.forEach((res) => {
      if (stats[res.userId]) {
        stats[res.userId].totalMinutes += calculateDuration(res.timeSlot);
      }
    });

    // Convert to array and sort by totalMinutes descending
    const leaderboard = Object.values(stats)
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      // Optional: Filter out users with 0 minutes if desired, or keep them
      // .filter(u => u.totalMinutes > 0)
      .map((u) => ({
        ...u,
        totalHours: parseFloat((u.totalMinutes / 60).toFixed(1)),
      }));

    res.json(leaderboard);
  }),
);

// ============ 用户相关 API ============

app.use("/api/auth", authRoutes);

app.get(
  "/api/users",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const users = await db.query(
      "SELECT id, username, role, status, name, email, expiryDate FROM users",
    );
    res.json(users);
  }),
);

app.post(
  "/api/users",
  asyncHandler(async (req, res) => {
    const body = requirePlainObject(req.body, "body");

    const username = requireString(body.username, "username", { maxLength: 64 });
    const password = requireString(body.password, "password", {
      trim: false,
      maxLength: 512,
    });
    const name = requireString(body.name, "name", { maxLength: 255 });
    const email = requireString(body.email, "email", { maxLength: 255 });

    const expiryDateInput = optionalString(body.expiryDate, "expiryDate", {
      maxLength: 10,
    });
    const expiryDate = expiryDateInput ? expiryDateInput.trim() : "";
    if (expiryDate && !isValidDateString(expiryDate)) {
      return res
        .status(400)
        .json({ error: "Invalid expiryDate (expected YYYY-MM-DD)" });
    }

    const existing = await db.queryOne(
      "SELECT id FROM users WHERE username = ?",
      [username],
    );
    if (existing) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id: makeId("user"),
      username,
      password: hashedPassword,
      role: "USER",
      status: "PENDING",
      name,
      email,
      expiryDate: expiryDate || null,
    };

    try {
      await db.execute(
        "INSERT INTO users (id, username, password, role, status, name, email, expiryDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          newUser.id,
          newUser.username,
          newUser.password,
          newUser.role,
          newUser.status,
          newUser.name,
          newUser.email,
          newUser.expiryDate,
        ],
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return res.status(409).json({ error: "Username already exists" });
      }
      throw error;
    }

    const { password: _, ...userWithoutPassword } = newUser;

    // 广播新用户创建
    broadcast("user:created", userWithoutPassword);

    res.status(201).json(userWithoutPassword);
  }),
);

app.post(
  "/api/admin/users",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = requirePlainObject(req.body, "body");

    const username = requireString(body.username, "username", { maxLength: 64 });
    const password = requireString(body.password, "password", {
      trim: false,
      maxLength: 512,
    });
    const name = requireString(body.name, "name", { maxLength: 255 });
    const email = requireString(body.email, "email", { maxLength: 255 });
    const role = requireOneOf(body.role, "role", ["ADMIN", "USER"]);

    const expiryDateInput = optionalString(body.expiryDate, "expiryDate", {
      maxLength: 10,
    });
    const expiryDate = expiryDateInput ? expiryDateInput.trim() : "";
    if (expiryDate && !isValidDateString(expiryDate)) {
      return res
        .status(400)
        .json({ error: "Invalid expiryDate (expected YYYY-MM-DD)" });
    }

    // Validate role assignment permissions
    // ADMIN can only create USER
    if (req.user.role === "ADMIN" && role !== "USER") {
      return res
        .status(403)
        .json({ error: "Admins can only create ordinary users" });
    }

    const existing = await db.queryOne(
      "SELECT id FROM users WHERE username = ?",
      [username],
    );
    if (existing) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id: makeId("user"),
      username,
      password: hashedPassword,
      role,
      status: "ACTIVE", // Admin-created users are active by default
      name,
      email,
      expiryDate: expiryDate || null,
    };

    try {
      await db.execute(
        "INSERT INTO users (id, username, password, role, status, name, email, expiryDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          newUser.id,
          newUser.username,
          newUser.password,
          newUser.role,
          newUser.status,
          newUser.name,
          newUser.email,
          newUser.expiryDate,
        ],
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return res.status(409).json({ error: "Username already exists" });
      }
      throw error;
    }

    const { password: _, ...userWithoutPassword } = newUser;

    // Broadcast
    broadcast("user:created", userWithoutPassword);

    // Audit log
    await db.execute(
      "INSERT INTO logs (id, userId, action, details, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        makeId("log"),
        req.user.id,
        "USER_CREATED",
        `Created user ${username} (${role})`,
        new Date().toISOString(),
      ],
    );

    res.status(201).json(userWithoutPassword);
  }),
);

app.patch(
  "/api/users/:id",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rawUpdates = requirePlainObject(req.body, "update payload");
    assertAllowedKeys(rawUpdates, [
      "role",
      "status",
      "name",
      "email",
      "expiryDate",
      "username",
    ]);

    const user = await db.queryOne("SELECT * FROM users WHERE id = ?", [id]);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isSelf = req.user.id === id;
    const isAdmin = isAdminRole(req.user.role);

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const selfAllowedKeys = new Set(["name", "email", "username"]);
    const adminAllowedKeys = new Set([
      ...selfAllowedKeys,
      "status",
      "expiryDate",
    ]);
    const superAdminAllowedKeys = new Set([...adminAllowedKeys, "role"]);

    let permittedKeys = selfAllowedKeys;
    if (!isSelf) {
      if (req.user.role === "ADMIN") {
        if (user.role !== "USER") {
          return res.status(403).json({ error: "Forbidden" });
        }
        permittedKeys = adminAllowedKeys;
      } else if (req.user.role === "SUPER_ADMIN") {
        permittedKeys = superAdminAllowedKeys;
      }
    }

    const forbiddenKeys = Object.keys(rawUpdates).filter(
      (key) => !permittedKeys.has(key),
    );
    if (forbiddenKeys.length > 0) {
      return res.status(403).json({
        error: `Not allowed to update: ${forbiddenKeys.join(", ")}`,
      });
    }

    const updates = {};
    if ("name" in rawUpdates) {
      if (typeof rawUpdates.name !== "string" || !rawUpdates.name.trim()) {
        return res.status(400).json({ error: "Invalid name" });
      }
      updates.name = rawUpdates.name.trim();
    }
    if ("username" in rawUpdates) {
      if (typeof rawUpdates.username !== "string") {
        return res.status(400).json({ error: "Invalid username" });
      }
      const newUsername = rawUpdates.username.trim();
      if (!newUsername) {
        return res.status(400).json({ error: "Invalid username" });
      }
      // Check uniqueness if changed
      if (newUsername !== user.username) {
        const existing = await db.queryOne(
          "SELECT id FROM users WHERE username = ?",
          [newUsername],
        );
        if (existing) {
          return res.status(409).json({ error: "Username already taken" });
        }
        updates.username = newUsername;
      }
    }
    if ("email" in rawUpdates) {
      if (typeof rawUpdates.email !== "string" || !rawUpdates.email.trim()) {
        return res.status(400).json({ error: "Invalid email" });
      }
      updates.email = rawUpdates.email.trim();
    }
    if ("expiryDate" in rawUpdates) {
      if (
        rawUpdates.expiryDate !== null &&
        !isValidDateString(rawUpdates.expiryDate)
      ) {
        return res
          .status(400)
          .json({ error: "Invalid expiryDate (expected YYYY-MM-DD or null)" });
      }
      updates.expiryDate = rawUpdates.expiryDate;
    }
    if ("status" in rawUpdates) {
      const allowedStatuses = new Set(["ACTIVE", "PENDING", "DISABLED"]);
      if (
        typeof rawUpdates.status !== "string" ||
        !allowedStatuses.has(rawUpdates.status)
      ) {
        return res.status(400).json({ error: "Invalid status" });
      }
      updates.status = rawUpdates.status;
    }
    if ("role" in rawUpdates) {
      const allowedRoles = new Set(["USER", "ADMIN", "SUPER_ADMIN"]);
      if (
        typeof rawUpdates.role !== "string" ||
        !allowedRoles.has(rawUpdates.role)
      ) {
        return res.status(400).json({ error: "Invalid role" });
      }
      updates.role = rawUpdates.role;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const fields = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = [...Object.values(updates), id];

    await db.execute(`UPDATE users SET ${fields} WHERE id = ?`, values);

    const updated = await db.queryOne(
      "SELECT id, username, role, status, name, email, expiryDate FROM users WHERE id = ?",
      [id],
    );

    // 广播用户更新
    broadcast("user:updated", updated);

    res.json(updated);
  }),
);

app.delete(
  "/api/users/:id",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await db.queryOne("SELECT * FROM users WHERE id = ?", [id]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent deleting self (optional safety)
    if (user.id === req.user.id) {
      return res.status(400).json({ error: "Cannot delete yourself" });
    }

    if (req.user.role === "ADMIN" && user.role !== "USER") {
      return res.status(403).json({ error: "Forbidden" });
    }

    await db.execute("DELETE FROM users WHERE id = ?", [id]);

    // Broadcast user deletion
    broadcast("user:deleted", { id });

    res.json({ success: true });
  }),
);

// Blocklist Management
app.get(
  "/api/users/:id/blocklist",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    // Allow admins or the user themselves to view blocklist
    if (!isAdminRole(req.user.role) && req.user.id !== id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const blockedDevices = await db.query(
      "SELECT deviceId, reason, createdAt FROM blocklist WHERE userId = ?",
      [id],
    );
    res.json(blockedDevices);
  }),
);

app.post(
  "/api/users/:id/blocklist",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = requirePlainObject(req.body, "body");
    const deviceId = requireString(body.deviceId, "deviceId", { maxLength: 64 });
    const reason = optionalString(body.reason, "reason", {
      maxLength: 1024,
    });

    const blockId = makeId("blk");
    const createdAt = new Date().toISOString();

    try {
      await db.execute(
        "INSERT INTO blocklist (id, userId, deviceId, reason, createdAt) VALUES (?, ?, ?, ?, ?)",
        [blockId, id, deviceId, reason || "", createdAt],
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return res
          .status(409)
          .json({ error: "User is already blocked from this device" });
      }
      throw error;
    }

    res.status(201).json({ success: true });
  }),
);

app.delete(
  "/api/users/:id/blocklist/:deviceId",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id, deviceId } = req.params;
    await db.execute("DELETE FROM blocklist WHERE userId = ? AND deviceId = ?", [
      id,
      deviceId,
    ]);

    res.json({ success: true });
  }),
);

// ============ 设备相关 API ============

app.get(
  "/api/devices",
  asyncHandler(async (req, res) => {
    const devices = await db.query("SELECT * FROM devices");
    const parsed = devices.map((d) => ({
      ...d,
      isEnabled: Boolean(d.isEnabled),
      openDays: safeJsonParse(d.openDays, [1, 2, 3, 4, 5]),
      timeSlots: safeJsonParse(d.timeSlots, []),
      granularity: d.granularity || 60,
      openTime: d.openTime
        ? safeJsonParse(d.openTime, { start: "09:00", end: "18:00" })
        : { start: "09:00", end: "18:00" },
    }));
    res.json(parsed);
  }),
);

app.get(
  "/api/devices/:id",
  asyncHandler(async (req, res) => {
    const device = await db.queryOne("SELECT * FROM devices WHERE id = ?", [
      req.params.id,
    ]);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    res.json({
      ...device,
      isEnabled: Boolean(device.isEnabled),
      openDays: safeJsonParse(device.openDays, [1, 2, 3, 4, 5]),
      timeSlots: safeJsonParse(device.timeSlots, []),
      granularity: device.granularity || 60,
      openTime: device.openTime
        ? safeJsonParse(device.openTime, { start: "09:00", end: "18:00" })
        : { start: "09:00", end: "18:00" },
    });
  }),
);

app.post(
  "/api/devices",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = requirePlainObject(req.body, "body");
    const {
      name,
      description,
      openDays,
      timeSlots,
      granularity = 60,
      openTime,
    } = body;
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Device name is required" });
    }
    if (typeof description !== "string") {
      return res.status(400).json({ error: "Invalid device description" });
    }
    if (openDays !== undefined && !Array.isArray(openDays)) {
      return res
        .status(400)
        .json({ error: "Invalid openDays (expected array)" });
    }
    if (timeSlots !== undefined && !Array.isArray(timeSlots)) {
      return res
        .status(400)
        .json({ error: "Invalid timeSlots (expected array)" });
    }
    const parsedGranularity = Number(granularity);
    if (!Number.isInteger(parsedGranularity) || parsedGranularity <= 0) {
      return res.status(400).json({ error: "Invalid granularity" });
    }
    if (
      openTime !== undefined &&
      (!isPlainObject(openTime) ||
        typeof openTime.start !== "string" ||
        typeof openTime.end !== "string")
    ) {
      return res
        .status(400)
        .json({ error: "Invalid openTime (expected {start,end})" });
    }

    const newDevice = {
      id: makeId("dev"),
      name: name.trim(),
      description,
      isEnabled: 1,
      openDays: JSON.stringify(openDays || [1, 2, 3, 4, 5]),
      timeSlots: JSON.stringify(timeSlots || []),
      granularity: parsedGranularity,
      openTime: JSON.stringify(openTime || { start: "09:00", end: "18:00" }),
    };

    await db.execute(
      "INSERT INTO devices (id, name, description, isEnabled, openDays, timeSlots, granularity, openTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        newDevice.id,
        newDevice.name,
        newDevice.description,
        newDevice.isEnabled,
        newDevice.openDays,
        newDevice.timeSlots,
        newDevice.granularity,
        newDevice.openTime,
      ],
    );

    const result = {
      ...newDevice,
      isEnabled: Boolean(newDevice.isEnabled),
      openDays: safeJsonParse(newDevice.openDays, [1, 2, 3, 4, 5]),
      timeSlots: safeJsonParse(newDevice.timeSlots, []),
      openTime: safeJsonParse(newDevice.openTime, {
        start: "09:00",
        end: "18:00",
      }),
    };

    // 广播新设备创建
    broadcast("device:created", result);

    // 记录日志
    await db.execute(
      "INSERT INTO logs (id, userId, action, details, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        makeId("log"),
        req.user.id,
        "DEVICE_CREATED",
        `Created device: ${result.name}`,
        new Date().toISOString(),
      ],
    );

    res.status(201).json(result);
  }),
);

app.patch(
  "/api/devices/:id",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rawUpdates = requirePlainObject(req.body, "update payload");
    assertAllowedKeys(rawUpdates, [
      "name",
      "description",
      "isEnabled",
      "openDays",
      "timeSlots",
      "granularity",
      "openTime",
    ]);

    const device = await db.queryOne("SELECT * FROM devices WHERE id = ?", [id]);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    const updates = {};
    if ("name" in rawUpdates) {
      if (typeof rawUpdates.name !== "string" || !rawUpdates.name.trim()) {
        return res.status(400).json({ error: "Invalid device name" });
      }
      updates.name = rawUpdates.name.trim();
    }
    if ("description" in rawUpdates) {
      if (typeof rawUpdates.description !== "string") {
        return res.status(400).json({ error: "Invalid device description" });
      }
      updates.description = rawUpdates.description;
    }
    if ("isEnabled" in rawUpdates) {
      updates.isEnabled = rawUpdates.isEnabled ? 1 : 0;
    }
    if ("openDays" in rawUpdates) {
      if (!Array.isArray(rawUpdates.openDays)) {
        return res
          .status(400)
          .json({ error: "Invalid openDays (expected array)" });
      }
      updates.openDays = JSON.stringify(rawUpdates.openDays);
    }
    if ("timeSlots" in rawUpdates) {
      if (!Array.isArray(rawUpdates.timeSlots)) {
        return res
          .status(400)
          .json({ error: "Invalid timeSlots (expected array)" });
      }
      updates.timeSlots = JSON.stringify(rawUpdates.timeSlots);
    }
    if ("granularity" in rawUpdates) {
      const parsedGranularity = Number(rawUpdates.granularity);
      if (!Number.isInteger(parsedGranularity) || parsedGranularity <= 0) {
        return res.status(400).json({ error: "Invalid granularity" });
      }
      updates.granularity = parsedGranularity;
    }
    if ("openTime" in rawUpdates) {
      if (
        !isPlainObject(rawUpdates.openTime) ||
        typeof rawUpdates.openTime.start !== "string" ||
        typeof rawUpdates.openTime.end !== "string"
      ) {
        return res
          .status(400)
          .json({ error: "Invalid openTime (expected {start,end})" });
      }
      updates.openTime = JSON.stringify(rawUpdates.openTime);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const fields = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = [...Object.values(updates), id];

    await db.execute(`UPDATE devices SET ${fields} WHERE id = ?`, values);

    const updated = await db.queryOne("SELECT * FROM devices WHERE id = ?", [id]);
    const result = {
      ...updated,
      isEnabled: Boolean(updated.isEnabled),
      openDays: safeJsonParse(updated.openDays, [1, 2, 3, 4, 5]),
      timeSlots: safeJsonParse(updated.timeSlots, []),
      granularity: updated.granularity || 60,
      openTime: updated.openTime
        ? safeJsonParse(updated.openTime, { start: "09:00", end: "18:00" })
        : { start: "09:00", end: "18:00" },
    };

    // 广播设备更新（重要：启用/停用状态）
    broadcast("device:updated", result);

    res.json(result);
  }),
);

app.delete(
  "/api/devices/:id",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const device = await db.queryOne("SELECT * FROM devices WHERE id = ?", [id]);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    await db.execute("DELETE FROM devices WHERE id = ?", [id]);

    // 广播设备删除
    broadcast("device:deleted", { id });

    res.json({ success: true });
  }),
);

// ============ 库存相关 API ============

app.get(
  "/api/inventory",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    const where = search ? "WHERE i.name LIKE ?" : "";
    const params = search ? [`%${search}%`] : [];

    const query = `
            SELECT
                i.*,
                COALESCE(uById.name, uByUsername.name, i.requesterName, 'System') AS requesterDisplayName
            FROM inventory i
            LEFT JOIN users uById ON i.requesterId = uById.id
            LEFT JOIN users uByUsername ON i.requesterId IS NULL AND i.requesterName = uByUsername.username
            ${where}
            ORDER BY i.date DESC
        `;

    const items = await db.query(query, params);
    res.json(items);
  }),
);

app.post(
  "/api/inventory",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = requirePlainObject(req.body, "body");
    const name = requireString(body.name, "name", { maxLength: 255 });
    const category = requireString(body.category, "category", { maxLength: 255 });
    const quantity = requireInteger(body.quantity, "quantity", { min: 0 });

    // Get the authenticated user's information
    const requesterId = req.user.id;
    const user = await db.queryOne("SELECT name FROM users WHERE id = ?", [
      requesterId,
    ]);
    const requesterName = user?.name || req.user.username || "Unknown";

    const itemId = makeId("item");
    const date = new Date().toISOString().split("T")[0];

    await db.execute(
      "INSERT INTO inventory (id, name, category, quantity, date, requesterName, requesterId) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [itemId, name, category, quantity, date, requesterName, requesterId],
    );

    // Query the item back with the join to include requesterDisplayName
    const newItem = await db.queryOne(
      `
          SELECT
              i.*,
              COALESCE(uById.name, uByUsername.name, i.requesterName, 'System') AS requesterDisplayName
          FROM inventory i
          LEFT JOIN users uById ON i.requesterId = uById.id
          LEFT JOIN users uByUsername ON i.requesterId IS NULL AND i.requesterName = uByUsername.username
          WHERE i.id = ?
      `,
      [itemId],
    );

    res.status(201).json(newItem);
  }),
);

app.patch(
  "/api/inventory/:id",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = requirePlainObject(req.body, "body");
    assertAllowedKeys(body, ["name", "category", "quantity"]);

    const updates = [];
    const values = [];

    if ("name" in body) {
      const name = requireString(body.name, "name", { maxLength: 255 });
      updates.push("name = ?");
      values.push(name);
    }
    if ("category" in body) {
      const category = requireString(body.category, "category", {
        maxLength: 255,
      });
      updates.push("category = ?");
      values.push(category);
    }
    if ("quantity" in body) {
      const quantity = requireInteger(body.quantity, "quantity", { min: 0 });
      updates.push("quantity = ?");
      values.push(quantity);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(id);
    await db.execute(`UPDATE inventory SET ${updates.join(", ")} WHERE id = ?`, [
      ...values,
    ]);

    const updatedItem = await db.queryOne(
      "SELECT * FROM inventory WHERE id = ?",
      [id],
    );
    if (!updatedItem) {
      return res.status(404).json({ error: "Inventory item not found" });
    }
    res.json(updatedItem);
  }),
);

app.delete(
  "/api/inventory/:id",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await db.queryOne("SELECT id FROM inventory WHERE id = ?", [
      id,
    ]);
    if (!existing) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    await db.execute("DELETE FROM inventory WHERE id = ?", [id]);
    res.json({ success: true });
  }),
);

// ============ 预约相关 API ============

app.get(
  "/api/reservations",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const deviceId =
      typeof req.query.deviceId === "string" ? req.query.deviceId.trim() : "";
    const from =
      typeof req.query.from === "string" ? req.query.from.trim() : "";
    const to = typeof req.query.to === "string" ? req.query.to.trim() : "";
    const active = req.query.active === "1" || req.query.active === "true";

    const conditions = [];
    const params = [];

    if (deviceId) {
      conditions.push("deviceId = ?");
      params.push(deviceId);
    }

    if (from) {
      if (!isValidDateString(from)) {
        return res
          .status(400)
          .json({ error: "Invalid from (expected YYYY-MM-DD)" });
      }
      conditions.push("date >= ?");
      params.push(from);
    }

    if (to) {
      if (!isValidDateString(to)) {
        return res
          .status(400)
          .json({ error: "Invalid to (expected YYYY-MM-DD)" });
      }
      conditions.push("date <= ?");
      params.push(to);
    }

    if (active) {
      conditions.push("status != 'CANCELLED'");
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const reservations = await db.query(
      `SELECT * FROM reservations ${where}`,
      params,
    );
    res.json(reservations);
  }),
);

app.post(
  "/api/reservations",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const body = requirePlainObject(req.body, "body");
    const { deviceId, date, timeSlot, title, description, color } = body;
    const userId = req.user.id;
    if (typeof deviceId !== "string" || !deviceId.trim()) {
      return res.status(400).json({ error: "deviceId is required" });
    }
    if (!isValidDateString(date)) {
      return res
        .status(400)
        .json({ error: "Invalid date (expected YYYY-MM-DD)" });
    }
    if (!isValidTimeSlot(timeSlot)) {
      return res
        .status(400)
        .json({ error: "Invalid timeSlot (expected HH:MM-HH:MM)" });
    }

    const device = await db.queryOne(
      "SELECT id, isEnabled FROM devices WHERE id = ?",
      [deviceId],
    );
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    if (!device.isEnabled) {
      return res.status(403).json({ error: "Device is disabled" });
    }

    // Check if user is blocked from this device
    const blockEntry = await db.queryOne(
      "SELECT reason FROM blocklist WHERE userId = ? AND deviceId = ?",
      [userId, deviceId],
    );

    if (blockEntry) {
      return res.status(403).json({
        error: `You are banned from booking this device. Reason: ${blockEntry.reason || "Violation of usage policy"}`,
      });
    }

    const conflict = await db.queryOne(
      `SELECT * FROM reservations WHERE deviceId = ? AND date = ? AND timeSlot = ? AND status != 'CANCELLED'`,
      [deviceId, date, timeSlot],
    );

    if (conflict) {
      return res.status(409).json({ error: "Time slot already booked" });
    }

    const newReservation = {
      id: makeId("res"),
      userId,
      deviceId,
      date,
      timeSlot,
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
      title: title || "",
      description: description || "",
      color: color || "default",
    };

    try {
      await db.execute(
        "INSERT INTO reservations (id, userId, deviceId, date, timeSlot, status, createdAt, title, description, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          newReservation.id,
          newReservation.userId,
          newReservation.deviceId,
          newReservation.date,
          newReservation.timeSlot,
          newReservation.status,
          newReservation.createdAt,
          newReservation.title,
          newReservation.description,
          newReservation.color,
        ],
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return res.status(409).json({ error: "Time slot already booked" });
      }
      throw error;
    }

    // 广播新预约（重要：实时显示）
    broadcast("reservation:created", newReservation);

    // 记录日志
    await db.execute(
      "INSERT INTO logs (id, userId, action, details, timestamp) VALUES (?, ?, ?, ?, ?)",
      [
        makeId("log"),
        newReservation.userId,
        "RESERVATION_CREATED",
        `Created reservation for device ${newReservation.deviceId}`,
        new Date().toISOString(),
      ],
    );

    res.status(201).json(newReservation);
  }),
);

app.patch(
  "/api/reservations/:id",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rawUpdates = requirePlainObject(req.body, "update payload");
    assertAllowedKeys(rawUpdates, [
      "status",
      "date",
      "timeSlot",
      "title",
      "description",
      "color",
    ]);

    const reservation = await db.queryOne(
      "SELECT * FROM reservations WHERE id = ?",
      [id],
    );
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    if (!isAdminRole(req.user.role) && reservation.userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const updates = {};
    if ("status" in rawUpdates) {
      const allowedStatuses = new Set(["CONFIRMED", "CANCELLED"]);
      if (
        typeof rawUpdates.status !== "string" ||
        !allowedStatuses.has(rawUpdates.status)
      ) {
        return res.status(400).json({ error: "Invalid status" });
      }
      updates.status = rawUpdates.status;
    }
    if ("date" in rawUpdates) {
      if (!isValidDateString(rawUpdates.date)) {
        return res
          .status(400)
          .json({ error: "Invalid date (expected YYYY-MM-DD)" });
      }
      updates.date = rawUpdates.date;
    }
    if ("timeSlot" in rawUpdates) {
      if (!isValidTimeSlot(rawUpdates.timeSlot)) {
        return res
          .status(400)
          .json({ error: "Invalid timeSlot (expected HH:MM-HH:MM)" });
      }
      updates.timeSlot = rawUpdates.timeSlot;
    }
    if ("title" in rawUpdates) {
      if (rawUpdates.title !== null && typeof rawUpdates.title !== "string") {
        return res.status(400).json({ error: "Invalid title" });
      }
      updates.title = rawUpdates.title ?? "";
    }
    if ("description" in rawUpdates) {
      if (
        rawUpdates.description !== null &&
        typeof rawUpdates.description !== "string"
      ) {
        return res.status(400).json({ error: "Invalid description" });
      }
      updates.description = rawUpdates.description ?? "";
    }
    if ("color" in rawUpdates) {
      if (rawUpdates.color !== null && typeof rawUpdates.color !== "string") {
        return res.status(400).json({ error: "Invalid color" });
      }
      updates.color = rawUpdates.color ?? "default";
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const fields = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = [...Object.values(updates), id];

    try {
      await db.execute(
        `UPDATE reservations SET ${fields} WHERE id = ?`,
        values,
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return res.status(409).json({ error: "Time slot already booked" });
      }
      throw error;
    }

    const updated = await db.queryOne(
      "SELECT * FROM reservations WHERE id = ?",
      [id],
    );

    // 广播预约更新（取消等操作）
    broadcast("reservation:updated", updated);

    res.json(updated);
  }),
);

app.delete(
  "/api/reservations/:id",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const reservation = await db.queryOne(
      "SELECT * FROM reservations WHERE id = ?",
      [id],
    );
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    if (!isAdminRole(req.user.role) && reservation.userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await db.execute("DELETE FROM reservations WHERE id = ?", [id]);

    // 广播预约删除
    broadcast("reservation:deleted", {
      id,
      deviceId: reservation.deviceId,
      date: reservation.date,
      timeSlot: reservation.timeSlot,
      status: reservation.status,
    });

    res.json({ success: true });
  }),
);

// ============ 日志相关 API ============

app.get(
  "/api/logs",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { search } = req.query;
    const limitRaw = req.query.limit;
    const limitParsed = limitRaw === undefined ? 50 : Number(limitRaw);
    const limit = Number.isFinite(limitParsed)
      ? Math.max(1, Math.min(200, Math.trunc(limitParsed)))
      : 50;

    let query = `
            SELECT l.*, u.name as userName
            FROM logs l
            LEFT JOIN users u ON l.userId = u.id
        `;
    const conditions = [];
    const params = [];

    if (!isAdminRole(req.user.role)) {
      conditions.push("l.userId = ?");
      params.push(req.user.id);
    }

    if (search) {
      conditions.push("(l.action LIKE ? OR l.details LIKE ? OR u.name LIKE ?)");
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY l.timestamp DESC LIMIT ${limit}`;

    const logs = await db.query(query, params);
    res.json(logs);
  }),
);

app.delete(
  "/api/logs",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await db.execute("DELETE FROM logs");
    res.json({ success: true });
  }),
);

// ============ Data Retention (SUPER_ADMIN) ============

app.get(
  "/api/admin/retention",
  authenticateToken,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    res.json(await getRetentionSettings(db));
  }),
);

app.patch(
  "/api/admin/retention",
  authenticateToken,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const updates = req.body === undefined ? {} : requirePlainObject(req.body);
    try {
      const updated = await updateRetentionSettings(db, updates);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }),
);

app.post(
  "/api/admin/retention/run",
  authenticateToken,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const result = await runRetentionCleanup(db);
    res.json(result);
  }),
);

// ============ Device Analysis Templates ============

app.get(
  "/api/device-analysis/templates",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const rows = await db.query(
      `
        SELECT id, name, configJson, createdAt, updatedAt
        FROM device_analysis_templates
        WHERE userId = ?
        ORDER BY updatedAt DESC
      `,
      [req.user.id],
    );

    // Deduplicate by name (keep most recently updated first).
    const seenNames = new Set();
    const templates = [];
    for (const row of rows) {
      const name = typeof row?.name === "string" ? row.name.trim() : "";
      if (!name) continue;
      if (seenNames.has(name)) continue;
      seenNames.add(name);

      const config = safeJsonParse(row.configJson, {});
      templates.push({
        ...(isPlainObject(config) ? config : {}),
        id: row.id,
        name,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    }

    res.json(templates);
  }),
);

app.post(
  "/api/device-analysis/templates",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const config = sanitizeDeviceAnalysisTemplateConfig(req.body);
    if (!config.name) {
      return res.status(400).json({ error: "Template name is required" });
    }

    const now = new Date().toISOString();
    const existing = await db.queryOne(
      `
        SELECT id, createdAt
        FROM device_analysis_templates
        WHERE userId = ? AND name = ?
        ORDER BY updatedAt DESC
        LIMIT 1
      `,
      [req.user.id, config.name],
    );

    if (existing?.id) {
      await db.execute(
        `
          UPDATE device_analysis_templates
          SET configJson = ?, updatedAt = ?
          WHERE id = ? AND userId = ?
        `,
        [JSON.stringify(config), now, existing.id, req.user.id],
      );

      // Best-effort cleanup: remove any accidental duplicates with the same name.
      await db.execute(
        `
          DELETE FROM device_analysis_templates
          WHERE userId = ? AND name = ? AND id != ?
        `,
        [req.user.id, config.name, existing.id],
      );

      res.status(200).json({
        ...config,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: now,
      });
      return;
    }

    const id = makeId("da_template");
    await db.execute(
      `
        INSERT INTO device_analysis_templates (id, userId, name, configJson, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [id, req.user.id, config.name, JSON.stringify(config), now, now],
    );

    res.status(201).json({ ...config, id, createdAt: now, updatedAt: now });
  }),
);

app.post(
  "/api/device-analysis/templates/bulk",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const input = Array.isArray(req.body)
      ? req.body
      : Array.isArray(req.body?.templates)
        ? req.body.templates
        : [];

    if (!input.length) return res.json([]);

    const now = new Date().toISOString();
    const upserted = [];

    for (const raw of input) {
      const config = sanitizeDeviceAnalysisTemplateConfig(raw);
      if (!config.name) continue;

      const existing = await db.queryOne(
        `
            SELECT id, createdAt
            FROM device_analysis_templates
            WHERE userId = ? AND name = ?
            ORDER BY updatedAt DESC
            LIMIT 1
          `,
        [req.user.id, config.name],
      );

      if (existing?.id) {
        await db.execute(
          `
              UPDATE device_analysis_templates
              SET configJson = ?, updatedAt = ?
              WHERE id = ? AND userId = ?
            `,
          [JSON.stringify(config), now, existing.id, req.user.id],
        );

        await db.execute(
          `
              DELETE FROM device_analysis_templates
              WHERE userId = ? AND name = ? AND id != ?
            `,
          [req.user.id, config.name, existing.id],
        );

        upserted.push({
          ...config,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: now,
        });
        continue;
      }

      const id = makeId("da_template");
      await db.execute(
        `
            INSERT INTO device_analysis_templates (id, userId, name, configJson, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
        [id, req.user.id, config.name, JSON.stringify(config), now, now],
      );
      upserted.push({ ...config, id, createdAt: now, updatedAt: now });
    }

    res.status(201).json(upserted);
  }),
);

app.patch(
  "/api/device-analysis/templates/:id",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const templateId = String(req.params.id || "");
    const existing = await db.queryOne(
      "SELECT id FROM device_analysis_templates WHERE id = ? AND userId = ?",
      [templateId, req.user.id],
    );
    if (!existing) return res.sendStatus(404);

    const config = sanitizeDeviceAnalysisTemplateConfig(req.body);
    if (!config.name) {
      return res.status(400).json({ error: "Template name is required" });
    }

    const now = new Date().toISOString();
    const nameConflict = await db.queryOne(
      `
          SELECT id
          FROM device_analysis_templates
          WHERE userId = ? AND name = ? AND id != ?
          ORDER BY updatedAt DESC
          LIMIT 1
        `,
      [req.user.id, config.name, templateId],
    );

    await db.execute(
      `
          UPDATE device_analysis_templates
          SET name = ?, configJson = ?, updatedAt = ?
          WHERE id = ? AND userId = ?
        `,
      [config.name, JSON.stringify(config), now, templateId, req.user.id],
    );

    if (nameConflict?.id) {
      // Best-effort cleanup: keep the edited template as the canonical one for this name.
      await db.execute(
        `
            DELETE FROM device_analysis_templates
            WHERE userId = ? AND name = ? AND id != ?
          `,
        [req.user.id, config.name, templateId],
      );
    }

    res.json({ ...config, id: templateId, updatedAt: now });
  }),
);

app.delete(
  "/api/device-analysis/templates/:id",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const templateId = String(req.params.id || "");
    const existing = await db.queryOne(
      "SELECT id FROM device_analysis_templates WHERE id = ? AND userId = ?",
      [templateId, req.user.id],
    );
    if (!existing) return res.sendStatus(404);

    await db.execute(
      "DELETE FROM device_analysis_templates WHERE id = ? AND userId = ?",
      [templateId, req.user.id],
    );
    res.json({ success: true });
  }),
);

// ============ Device Analysis Settings ============

app.get(
  "/api/device-analysis/settings",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const row = await db.queryOne(
      "SELECT yUnit, ssMethodDefault, ssDiagnosticsEnabled, ssIdLow, ssIdHigh, lastTemplateId, stopOnErrorDefault, updatedAt FROM device_analysis_settings WHERE userId = ?",
      [req.user.id],
    );

    res.json({
      yUnit:
        row?.yUnit === "A" || row?.yUnit === "uA" || row?.yUnit === "nA"
          ? row.yUnit
          : "A",
      ssMethodDefault:
        row?.ssMethodDefault === "auto" ||
        row?.ssMethodDefault === "manual" ||
        row?.ssMethodDefault === "idWindow" ||
        row?.ssMethodDefault === "legacy"
          ? row.ssMethodDefault
          : "auto",
      ssDiagnosticsEnabled:
        typeof row?.ssDiagnosticsEnabled === "number"
          ? Boolean(row.ssDiagnosticsEnabled)
          : row?.ssDiagnosticsEnabled == null
            ? true
            : Boolean(row.ssDiagnosticsEnabled),
      ssIdLow: Number.isFinite(Number(row?.ssIdLow)) ? Number(row.ssIdLow) : 1e-11,
      ssIdHigh: Number.isFinite(Number(row?.ssIdHigh)) ? Number(row.ssIdHigh) : 1e-9,
      lastTemplateId:
        typeof row?.lastTemplateId === "string" && row.lastTemplateId.trim()
          ? row.lastTemplateId.trim()
          : null,
      stopOnErrorDefault:
        typeof row?.stopOnErrorDefault === "number"
          ? Boolean(row.stopOnErrorDefault)
          : Boolean(row?.stopOnErrorDefault),
      updatedAt: row?.updatedAt || null,
    });
  }),
);

app.patch(
  "/api/device-analysis/settings",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { patch, errors } = sanitizeDeviceAnalysisSettings(req.body);
    if (errors.length) {
      return res.status(400).json({ error: `Invalid ${errors.join(", ")}` });
    }
    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: "No valid settings provided" });
    }

    const now = new Date().toISOString();
    const existing = await db.queryOne(
      "SELECT yUnit, ssMethodDefault, ssDiagnosticsEnabled, ssIdLow, ssIdHigh, lastTemplateId, stopOnErrorDefault FROM device_analysis_settings WHERE userId = ?",
      [req.user.id],
    );

    const yUnitExisting =
      existing?.yUnit === "A" || existing?.yUnit === "uA" || existing?.yUnit === "nA"
        ? existing.yUnit
        : "A";
    const ssMethodExisting =
      existing?.ssMethodDefault === "auto" ||
      existing?.ssMethodDefault === "manual" ||
      existing?.ssMethodDefault === "idWindow" ||
      existing?.ssMethodDefault === "legacy"
        ? existing.ssMethodDefault
        : "auto";
    const ssDiagExisting =
      typeof existing?.ssDiagnosticsEnabled === "number"
        ? Boolean(existing.ssDiagnosticsEnabled)
        : existing?.ssDiagnosticsEnabled == null
          ? true
          : Boolean(existing.ssDiagnosticsEnabled);
    const ssIdLowExisting = Number.isFinite(Number(existing?.ssIdLow))
      ? Number(existing.ssIdLow)
      : 1e-11;
    const ssIdHighExisting = Number.isFinite(Number(existing?.ssIdHigh))
      ? Number(existing.ssIdHigh)
      : 1e-9;
    const lastTemplateExisting =
      typeof existing?.lastTemplateId === "string" && existing.lastTemplateId.trim()
        ? existing.lastTemplateId.trim()
        : null;
    const stopOnErrorDefaultExisting =
      typeof existing?.stopOnErrorDefault === "number"
        ? Boolean(existing.stopOnErrorDefault)
        : Boolean(existing?.stopOnErrorDefault);

    const next = {
      yUnit: patch.yUnit ?? yUnitExisting,
      ssMethodDefault: patch.ssMethodDefault ?? ssMethodExisting,
      ssDiagnosticsEnabled:
        patch.ssDiagnosticsEnabled == null
          ? ssDiagExisting
          : Boolean(patch.ssDiagnosticsEnabled),
      ssIdLow: patch.ssIdLow ?? ssIdLowExisting,
      ssIdHigh: patch.ssIdHigh ?? ssIdHighExisting,
      lastTemplateId:
        patch.lastTemplateId === undefined ? lastTemplateExisting : patch.lastTemplateId,
      stopOnErrorDefault:
        patch.stopOnErrorDefault == null
          ? stopOnErrorDefaultExisting
          : Boolean(patch.stopOnErrorDefault),
    };

    if (next.ssIdLow > next.ssIdHigh) {
      const tmp = next.ssIdLow;
      next.ssIdLow = next.ssIdHigh;
      next.ssIdHigh = tmp;
    }

    if (existing) {
      await db.execute(
        "UPDATE device_analysis_settings SET yUnit = ?, ssMethodDefault = ?, ssDiagnosticsEnabled = ?, ssIdLow = ?, ssIdHigh = ?, lastTemplateId = ?, stopOnErrorDefault = ?, updatedAt = ? WHERE userId = ?",
        [
          next.yUnit,
          next.ssMethodDefault,
          next.ssDiagnosticsEnabled ? 1 : 0,
          next.ssIdLow,
          next.ssIdHigh,
          next.lastTemplateId,
          next.stopOnErrorDefault ? 1 : 0,
          now,
          req.user.id,
        ],
      );
    } else {
      await db.execute(
        "INSERT INTO device_analysis_settings (userId, yUnit, ssMethodDefault, ssDiagnosticsEnabled, ssIdLow, ssIdHigh, lastTemplateId, stopOnErrorDefault, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          req.user.id,
          next.yUnit,
          next.ssMethodDefault,
          next.ssDiagnosticsEnabled ? 1 : 0,
          next.ssIdLow,
          next.ssIdHigh,
          next.lastTemplateId,
          next.stopOnErrorDefault ? 1 : 0,
          now,
        ],
      );
    }

    res.json({ ...next, updatedAt: now });
  }),
);

// ============ Literature Research ============

app.get(
  "/api/admin/literature/translation-key",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const globalKey = await getDefaultTranslationApiKey(db);
      res.json({
        hasDefaultTranslationApiKey: globalKey.hasKey,
        defaultTranslationApiKeyMasked: globalKey.hasKey ? maskApiKey(globalKey.key) : null,
        updatedAt: globalKey.updatedAt,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.patch(
  "/api/admin/literature/translation-key",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const now = new Date().toISOString();
      const body = isPlainObject(req.body) ? req.body : {};
      const value =
        typeof body.defaultTranslationApiKey === "string" ? body.defaultTranslationApiKey : "";
      const updated = await setDefaultTranslationApiKey(db, value, now);
      res.json({
        hasDefaultTranslationApiKey: updated.hasKey,
        defaultTranslationApiKeyMasked: updated.masked,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },
);

app.get(
  "/api/admin/literature/translation-model",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const globalModel = await getDefaultTranslationModel(db);
      res.json({
        hasDefaultTranslationModel: globalModel.hasModel,
        defaultTranslationModel: globalModel.hasModel ? globalModel.model : null,
        updatedAt: globalModel.updatedAt,
        builtinDefaultTranslationModel: BIGMODEL_TRANSLATION_MODEL,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.patch(
  "/api/admin/literature/translation-model",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const now = new Date().toISOString();
      const body = isPlainObject(req.body) ? req.body : {};
      const value =
        typeof body.defaultTranslationModel === "string" ? body.defaultTranslationModel : "";
      const updated = await setDefaultTranslationModel(db, value, now);
      res.json({
        hasDefaultTranslationModel: updated.hasModel,
        defaultTranslationModel:
          typeof updated.model === "string" && updated.model.trim() ? updated.model : null,
        updatedAt: updated.updatedAt,
        builtinDefaultTranslationModel: BIGMODEL_TRANSLATION_MODEL,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },
);

app.get(
  "/api/admin/literature/translation-base-url",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const globalBaseUrl = await getDefaultTranslationBaseUrl(db);
      res.json({
        hasDefaultTranslationBaseUrl: globalBaseUrl.hasBaseUrl,
        defaultTranslationBaseUrl: globalBaseUrl.hasBaseUrl ? globalBaseUrl.baseUrl : null,
        updatedAt: globalBaseUrl.updatedAt,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.patch(
  "/api/admin/literature/translation-base-url",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const now = new Date().toISOString();
      const body = isPlainObject(req.body) ? req.body : {};
      const value =
        typeof body.defaultTranslationBaseUrl === "string" ? body.defaultTranslationBaseUrl : "";
      const updated = await setDefaultTranslationBaseUrl(db, value, now);
      res.json({
        hasDefaultTranslationBaseUrl: updated.hasBaseUrl,
        defaultTranslationBaseUrl:
          typeof updated.baseUrl === "string" && updated.baseUrl.trim() ? updated.baseUrl : null,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },
);

// Legacy endpoints (kept for backwards compatibility)
app.get(
  "/api/admin/literature/bigmodel-key",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const globalKey = await getDefaultTranslationApiKey(db);
      res.json({
        hasDefaultBigmodelApiKey: globalKey.hasKey,
        defaultBigmodelApiKeyMasked: globalKey.hasKey ? maskApiKey(globalKey.key) : null,
        updatedAt: globalKey.updatedAt,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.patch(
  "/api/admin/literature/bigmodel-key",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const now = new Date().toISOString();
      const body = isPlainObject(req.body) ? req.body : {};
      const value =
        typeof body.defaultBigmodelApiKey === "string" ? body.defaultBigmodelApiKey : "";
      const updated = await setDefaultTranslationApiKey(db, value, now);
      res.json({
        hasDefaultBigmodelApiKey: updated.hasKey,
        defaultBigmodelApiKeyMasked: updated.masked,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },
);

app.get(
  "/api/admin/literature/bigmodel-model",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const globalModel = await getDefaultTranslationModel(db);
      res.json({
        hasDefaultBigmodelModel: globalModel.hasModel,
        defaultBigmodelModel: globalModel.hasModel ? globalModel.model : null,
        updatedAt: globalModel.updatedAt,
        builtinDefaultBigmodelModel: BIGMODEL_TRANSLATION_MODEL,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.patch(
  "/api/admin/literature/bigmodel-model",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const now = new Date().toISOString();
      const body = isPlainObject(req.body) ? req.body : {};
      const value = typeof body.defaultBigmodelModel === "string" ? body.defaultBigmodelModel : "";
      const updated = await setDefaultTranslationModel(db, value, now);
      res.json({
        hasDefaultBigmodelModel: updated.hasModel,
        defaultBigmodelModel:
          typeof updated.model === "string" && updated.model.trim() ? updated.model : null,
        updatedAt: updated.updatedAt,
        builtinDefaultBigmodelModel: BIGMODEL_TRANSLATION_MODEL,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },
);

app.get(
  "/api/admin/literature/translation-provider",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const info = await getTranslationProvider(db);
      res.json({
        translationProvider: info.provider,
        hasTranslationProvider: info.hasProvider,
        supportedProviders: info.supportedProviders,
        updatedAt: info.updatedAt,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.patch(
  "/api/admin/literature/translation-provider",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const now = new Date().toISOString();
      const body = isPlainObject(req.body) ? req.body : {};
      const value = typeof body.translationProvider === "string" ? body.translationProvider : "";

      const current = await getTranslationProvider(db);
      const nextProvider = String(value || "").trim().toLowerCase();
      const providerChanged = nextProvider && nextProvider !== current.provider;

      if (providerChanged) {
        await setDefaultTranslationApiKey(db, "", now);
        await setDefaultTranslationModel(db, "", now);
        await setDefaultTranslationBaseUrl(db, "", now);
        literatureTranslationCache.clear();
      }

      const updated = await setTranslationProvider(db, value, now);
      res.json({
        translationProvider: updated.provider,
        hasTranslationProvider: updated.hasProvider,
        supportedProviders: updated.supportedProviders,
        updatedAt: updated.updatedAt,
        clearedDefaults: providerChanged,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },
);

app.get("/api/literature/settings", authenticateToken, async (req, res) => {
  try {
    const row = await db.queryOne(
      "SELECT configJson, updatedAt FROM literature_research_settings WHERE userId = ?",
      [req.user.id],
    );

    const config = safeJsonParse(row?.configJson, {});

    const seedUrlsBySourceTypeRaw = isPlainObject(config?.seedUrlsBySourceType)
      ? config.seedUrlsBySourceType
      : null;

    const seedUrlsBySourceType = seedUrlsBySourceTypeRaw
      ? {
          nature: sanitizeSeedUrlsList(seedUrlsBySourceTypeRaw.nature),
          science: sanitizeSeedUrlsList(seedUrlsBySourceTypeRaw.science),
        }
      : splitSeedUrlsBySourceType(config?.seedUrls);

    const storedSourceType =
      config?.sourceType === "science" || config?.sourceType === "nature"
        ? config.sourceType
        : null;

    const sourceType =
      storedSourceType ||
      (seedUrlsBySourceType.science.length > 0 && seedUrlsBySourceType.nature.length === 0
        ? "science"
        : "nature");

    const seedUrls =
      sourceType === "science" ? seedUrlsBySourceType.science : seedUrlsBySourceType.nature;

    const startDate = isValidDateString(config?.startDate)
      ? config.startDate
      : null;
    const endDate = isValidDateString(config?.endDate) ? config.endDate : null;
    const maxResultsNumber = Number(config?.maxResults);
    const maxResults = Number.isFinite(maxResultsNumber)
      ? Math.max(1, Math.min(100, Math.trunc(maxResultsNumber)))
      : 100;

    const translationApiKey =
      typeof config?.translationApiKey === "string"
        ? config.translationApiKey.trim()
        : typeof config?.bigmodelApiKey === "string"
          ? config.bigmodelApiKey.trim()
          : "";
    const globalKey = await getDefaultTranslationApiKey(db);
    const hasUserKey = Boolean(translationApiKey);
    const hasTranslationApiKey = hasUserKey || globalKey.hasKey;
    const translationApiKeySource = hasUserKey ? "user" : globalKey.hasKey ? "default" : null;

    const translationModel =
      typeof config?.translationModel === "string"
        ? config.translationModel.trim()
        : typeof config?.bigmodelModel === "string"
          ? config.bigmodelModel.trim()
          : "";

    const translationProvider =
      typeof config?.translationProvider === "string" ? config.translationProvider.trim() : "";

    const translationBaseUrl =
      typeof config?.translationBaseUrl === "string" ? config.translationBaseUrl.trim() : "";
    const globalBaseUrl = await getDefaultTranslationBaseUrl(db);

	    const provider = await getTranslationProvider(db);

	    res.json({
	      seedUrlsBySourceType,
	      sourceType,
	      seedUrls,
	      startDate,
      endDate,
      maxResults,
      hasTranslationApiKey,
      hasDefaultTranslationApiKey: globalKey.hasKey,
      translationApiKeySource,
      translationApiKeyMasked: hasUserKey ? maskApiKey(translationApiKey) : null,
      translationProvider: translationProvider ? translationProvider.toLowerCase() : null,
      translationModel: translationModel || null,
      translationBaseUrl: translationBaseUrl || null,
      hasDefaultTranslationBaseUrl: globalBaseUrl.hasBaseUrl,
      defaultTranslationProvider: provider.provider,
      supportedTranslationProviders: provider.supportedProviders,
      updatedAt: row?.updatedAt || null,
    });
  } catch (error) {
    const message = error?.message || String(error) || "Request failed";
    res.status(500).json({ error: message });
  }
});

app.patch("/api/literature/settings", authenticateToken, async (req, res) => {
  try {
    const now = new Date().toISOString();

    const row = await db.queryOne(
      "SELECT userId, configJson FROM literature_research_settings WHERE userId = ?",
      [req.user.id],
    );

	    const existingConfig = safeJsonParse(row?.configJson, {});
	    const settings = mergeLiteratureSettings(existingConfig, req.body);

	    if (Object.prototype.hasOwnProperty.call(req.body || {}, "translationBaseUrl")) {
	      const validated = await validateTranslationBaseUrl(settings.translationBaseUrl || "");
	      settings.translationBaseUrl = validated;
	    }

	    const configJson = JSON.stringify(settings);

	    if (row?.userId) {
	      await db.execute(
	        "UPDATE literature_research_settings SET configJson = ?, updatedAt = ? WHERE userId = ?",
        [configJson, now, req.user.id],
      );
    } else {
      await db.execute(
        "INSERT INTO literature_research_settings (userId, configJson, updatedAt) VALUES (?, ?, ?)",
        [req.user.id, configJson, now],
      );
    }

    const userKey =
      typeof settings.translationApiKey === "string" ? settings.translationApiKey.trim() : "";
    const globalKey = await getDefaultTranslationApiKey(db);
    const globalBaseUrl = await getDefaultTranslationBaseUrl(db);
    const provider = await getTranslationProvider(db);
    const hasUserKey = Boolean(userKey);
    const hasTranslationApiKey = hasUserKey || globalKey.hasKey;
    const translationApiKeySource = hasUserKey ? "user" : globalKey.hasKey ? "default" : null;

    const seedUrlsBySourceType = isPlainObject(settings?.seedUrlsBySourceType)
      ? {
          nature: sanitizeSeedUrlsList(settings.seedUrlsBySourceType.nature),
          science: sanitizeSeedUrlsList(settings.seedUrlsBySourceType.science),
        }
      : { nature: [], science: [] };

    const sourceType =
      settings?.sourceType === "science" || settings?.sourceType === "nature"
        ? settings.sourceType
        : null;

    res.json({
      seedUrlsBySourceType,
      sourceType,
      seedUrls: Array.isArray(settings.seedUrls) ? settings.seedUrls : [],
      startDate: settings.startDate || null,
      endDate: settings.endDate || null,
      maxResults: settings.maxResults,
      hasTranslationApiKey,
      hasDefaultTranslationApiKey: globalKey.hasKey,
      translationApiKeySource,
      translationApiKeyMasked: hasUserKey ? maskApiKey(userKey) : null,
      translationProvider:
        typeof settings.translationProvider === "string" && settings.translationProvider.trim()
          ? settings.translationProvider.trim().toLowerCase()
          : null,
      translationModel: settings.translationModel || null,
      translationBaseUrl: settings.translationBaseUrl || null,
      hasDefaultTranslationBaseUrl: globalBaseUrl.hasBaseUrl,
      defaultTranslationProvider: provider.provider,
      supportedTranslationProviders: provider.supportedProviders,
      updatedAt: now,
    });
  } catch (error) {
    const message = error?.message || String(error) || "Request failed";
    res.status(400).json({ error: message });
  }
	});

app.post("/api/literature/search", authenticateToken, async (req, res) => {
  try {
    const body = isPlainObject(req.body) ? req.body : {};
    let { seedUrls, startDate, endDate, maxResults } = body;

    const needsStoredFallback =
      !Array.isArray(seedUrls) ||
      seedUrls.length === 0 ||
      !isValidDateString(startDate) ||
      !isValidDateString(endDate) ||
      maxResults == null;

    if (needsStoredFallback) {
      const row = await db.queryOne(
        "SELECT configJson FROM literature_research_settings WHERE userId = ?",
        [req.user.id],
      );
      const config = safeJsonParse(row?.configJson, {});

      if (!Array.isArray(seedUrls) || seedUrls.length === 0) {
        seedUrls = config?.seedUrls;
      }
      if (!isValidDateString(startDate)) startDate = config?.startDate;
      if (!isValidDateString(endDate)) endDate = config?.endDate;
      if (maxResults == null) maxResults = config?.maxResults;
    }

    const items = await searchLiterature({
      seedUrls,
      startDate,
      endDate,
      maxResults,
    });

    // Safety-first: never proxy-download PDFs through the backend (which would concentrate traffic on the server IP).
    // Instead, always send users to the publisher/article landing page so downloads happen in the browser.
    const enriched = items.map((item) => {
      const articleUrl =
        typeof item?.articleUrl === "string" && item.articleUrl.trim()
          ? item.articleUrl.trim()
          : null;

      return {
        ...item,
        downloadable: Boolean(articleUrl),
        downloadUrl: articleUrl,
      };
    });

    res.json(enriched);
  } catch (error) {
    const message = error?.message || String(error) || "Request failed";
    res.status(400).json({ error: message });
  }
});

app.post("/api/literature/translate", authenticateToken, async (req, res) => {
  let apiKeySource = null;
  let targetLang = "zh";
  let model = null;
  let modelSource = null;
  let translationProvider = "bigmodel";
  let translationProviderSource = null;
  let translationBaseUrlSource = null;
  let translationBaseUrlHost = null;

  try {
    const body = isPlainObject(req.body) ? req.body : {};
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const rawTargetLang =
      typeof body.targetLang === "string" ? body.targetLang.trim().toLowerCase() : "";
    targetLang = rawTargetLang.startsWith("en") ? "en" : "zh";
    const bypassCache = Boolean(body.bypassCache);
    const rawForceKeySource =
      typeof body.forceKeySource === "string"
        ? body.forceKeySource.trim().toLowerCase()
        : "";
    const forceKeySource = rawForceKeySource === "default" ? "default" : null;

    if (forceKeySource && req.user?.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        error: "Not allowed to force key source",
        apiKeySource: null,
        targetLang,
      });
    }

    if (!text) {
      return res.status(400).json({ error: "text is required" });
    }
    if (text.length > 20_000) {
      return res.status(400).json({ error: "text is too long" });
    }

    const row = await db.queryOne(
      "SELECT configJson FROM literature_research_settings WHERE userId = ?",
      [req.user.id],
    );

    const config = safeJsonParse(row?.configJson, {});
    const userApiKey =
      typeof config?.translationApiKey === "string"
        ? config.translationApiKey.trim()
        : typeof config?.bigmodelApiKey === "string"
          ? config.bigmodelApiKey.trim()
          : "";
    const userModel =
      typeof config?.translationModel === "string"
        ? config.translationModel.trim()
        : typeof config?.bigmodelModel === "string"
          ? config.bigmodelModel.trim()
          : "";
    const userProvider =
      typeof config?.translationProvider === "string" ? config.translationProvider.trim().toLowerCase() : "";
    const userBaseUrl =
      typeof config?.translationBaseUrl === "string" ? config.translationBaseUrl.trim() : "";

    const globalKey = await getDefaultTranslationApiKey(db);
    const globalModel = await getDefaultTranslationModel(db);
    const globalBaseUrl = await getDefaultTranslationBaseUrl(db);
    const providerInfo = await getTranslationProvider(db);
    const defaultProvider = providerInfo.provider;
    const resolvedGlobalApiKey = globalKey.key || "";
    apiKeySource = forceKeySource
      ? "default"
      : userApiKey
        ? "user"
        : globalKey.hasKey
           ? "default"
           : null;
    const apiKey = forceKeySource ? resolvedGlobalApiKey : userApiKey || resolvedGlobalApiKey || "";
    const useUserProvider = apiKeySource === "user" && Boolean(userProvider);
    translationProviderSource = useUserProvider ? "user" : "default";
    translationProvider = useUserProvider ? userProvider : defaultProvider;
    const translationAdapter =
      translationProvider === "bigmodel"
        ? "bigmodel"
        : translationProvider === "openai"
          ? "openai"
          : "openai_compatible";
    const providerLabel =
      translationAdapter === "openai"
        ? "OpenAI"
        : translationAdapter === "bigmodel"
          ? "BigModel"
          : translationProvider === "openai_compatible"
            ? "OpenAI-compatible"
            : translationProvider;

    if (!apiKey) {
      return res.status(400).json({
        error: forceKeySource
          ? `Default ${providerLabel} API key is not configured. Please set the default key as SUPER_ADMIN.`
          : `${providerLabel} API key is not configured. Please set your own key in Literature settings or ask an admin to configure the default key.`,
        apiKeySource,
        translationProvider,
        translationProviderSource,
        targetLang,
        model: null,
        modelSource: null,
      });
    }

    const resolvedGlobalModel =
      typeof globalModel?.model === "string" ? globalModel.model.trim() : "";
    const hasGlobalModel = Boolean(resolvedGlobalModel);

    if (apiKeySource === "default") {
      if (!hasGlobalModel) {
        return res.status(400).json({
          error:
            `Default ${providerLabel} model is not configured. Please set the default model as SUPER_ADMIN.`,
          apiKeySource,
          translationProvider,
          translationProviderSource,
          targetLang,
          model: null,
          modelSource: null,
        });
      }
      model = resolvedGlobalModel;
      modelSource = "default";
    } else if (userModel) {
      model = userModel;
      modelSource = "user";
    } else {
      if (!hasGlobalModel) {
        return res.status(400).json({
          error:
            `${providerLabel} model is not configured. Please set your own model in Literature settings or ask an admin to configure the default model.`,
          apiKeySource,
          translationProvider,
          translationProviderSource,
          targetLang,
          model: null,
          modelSource: null,
        });
      }
      model = resolvedGlobalModel;
      modelSource = "default";
    }

    let translationBaseUrl = "";
    if (translationAdapter === "openai_compatible") {
      const resolvedGlobalBaseUrl =
        typeof globalBaseUrl?.baseUrl === "string" ? globalBaseUrl.baseUrl.trim() : "";

      if (apiKeySource === "default") {
        translationBaseUrlSource = globalBaseUrl.hasBaseUrl ? "default" : null;
        translationBaseUrl = resolvedGlobalBaseUrl;
      } else if (userBaseUrl) {
        translationBaseUrlSource = "user";
        translationBaseUrl = userBaseUrl;
      } else if (globalBaseUrl.hasBaseUrl) {
        translationBaseUrlSource = "default";
        translationBaseUrl = resolvedGlobalBaseUrl;
      } else {
        translationBaseUrlSource = null;
        translationBaseUrl = "";
      }

      if (!translationBaseUrl) {
        return res.status(400).json({
          error:
            apiKeySource === "default"
              ? `Default ${providerLabel} base URL is not configured. Please set it as SUPER_ADMIN.`
              : `${providerLabel} base URL is not configured. Please set your own base URL in Literature settings or ask an admin to configure the default base URL.`,
          apiKeySource,
          translationProvider,
          translationProviderSource,
          targetLang,
          model,
          modelSource,
          translationBaseUrlSource,
          translationBaseUrlHost: null,
        });
      }

      const validatedBaseUrl = await validateTranslationBaseUrl(translationBaseUrl);
      translationBaseUrl = validatedBaseUrl || "";
      translationBaseUrlHost = translationBaseUrl ? new URL(translationBaseUrl).host : null;
    }

    const cacheKey = makeLiteratureTranslationCacheKey({
      userId: req.user.id,
      id,
      text,
      model,
      targetLang,
      provider: translationProvider,
      baseUrl: translationBaseUrl,
    });

    if (!bypassCache) {
      cleanupLiteratureTranslationCache();
      const cached = literatureTranslationCache.get(cacheKey);
      if (cached?.translatedText && cached?.createdAt) {
        if (Date.now() - cached.createdAt <= LITERATURE_TRANSLATION_TTL_MS) {
          return res.json({
            id: id || null,
            model,
            modelSource,
            targetLang,
            apiKeySource,
            translationProvider,
            translationProviderSource,
            translationBaseUrlSource,
            translationBaseUrlHost,
            translatedText: cached.translatedText,
            cached: true,
            bypassCache,
          });
        }
        literatureTranslationCache.delete(cacheKey);
      }
    }

    const translatedText =
      translationAdapter === "openai"
        ? await translateWithOpenAI(apiKey, text, targetLang, model)
        : translationAdapter === "openai_compatible"
          ? await translateWithOpenAICompatible(apiKey, text, targetLang, model, translationBaseUrl)
          : await translateWithBigModel(apiKey, text, targetLang, model);
    if (!bypassCache) {
      literatureTranslationCache.set(cacheKey, {
        translatedText,
        createdAt: Date.now(),
      });
    }

    res.json({
      id: id || null,
      model,
      modelSource,
      targetLang,
      apiKeySource,
      translationProvider,
      translationProviderSource,
      translationBaseUrlSource,
      translationBaseUrlHost,
      translatedText,
      cached: false,
      bypassCache,
    });
  } catch (error) {
    const status =
      typeof error?.status === "number" && error.status >= 400 && error.status < 600
        ? error.status
        : 400;
    const retryAfter = error?.retryAfter;
    if (retryAfter && (status === 429 || status === 503)) {
      res.set("Retry-After", String(retryAfter));
    }
    res.status(status).json({
      error: error.message,
      apiKeySource,
      translationProvider,
      translationProviderSource,
      translationBaseUrlSource,
      translationBaseUrlHost,
      targetLang,
      model,
      modelSource,
    });
  }
});

app.get(
  "/api/literature/download/:token",
  authenticateToken,
  async (req, res) => {
    try {
      cleanupLiteratureDownloadTokens();
      const token = String(req.params.token || "");
      const entry = literatureDownloadTokens.get(token);
      if (!entry?.url) return res.status(404).json({ error: "Not found" });

      const upstream = await fetchWithTimeout(
        entry.url,
        {
          method: "GET",
          redirect: "follow",
          headers: {
            "User-Agent":
              "AppointerLiterature/0.1 (+https://localhost; purpose=literature-research)",
          },
        },
        20_000,
      );

      if (!upstream.ok) {
        return res.status(502).json({
          error: `Upstream failed: ${upstream.status} ${upstream.statusText}`,
        });
      }

      const contentType =
        upstream.headers.get("content-type") || "application/octet-stream";
      const contentLength = upstream.headers.get("content-length");

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${entry.filename || "article.pdf"}"`);
      res.setHeader("Cache-Control", "no-store");
      if (contentLength) res.setHeader("Content-Length", contentLength);

      if (!upstream.body) {
        return res.status(502).json({ error: "Upstream body missing" });
      }

      Readable.fromWeb(upstream.body).pipe(res);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ============ 申请相关 API ============

app.get(
  "/api/requests",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const statusParam =
      typeof req.query.status === "string" ? req.query.status : "";
    const statuses = statusParam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => ["PENDING", "APPROVED", "REJECTED"].includes(s));

    const limit = optionalInteger(req.query.limit, "limit", {
      min: 1,
      max: 1000,
    });
    const offset = optionalInteger(req.query.offset, "offset", {
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });

    let query = `
            SELECT
                r.*,
                COALESCE(u.name, r.requesterName, 'Unknown') AS requesterDisplayName
            FROM requests r
            LEFT JOIN users u ON r.requesterId = u.id
        `;

    const conditions = [];
    const params = [];

    if (!isAdminRole(req.user.role)) {
      conditions.push("r.requesterId = ?");
      params.push(req.user.id);
    }

    if (statuses.length > 0) {
      conditions.push(`r.status IN (${statuses.map(() => "?").join(", ")})`);
      params.push(...statuses);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY r.createdAt DESC`;

    if (limit !== undefined) {
      query += ` LIMIT ?`;
      params.push(limit);
    }

    if (offset !== undefined) {
      query += ` OFFSET ?`;
      params.push(offset);
    }

    const requests = await db.query(query, params);
    res.json(requests);
  }),
);

app.post(
  "/api/requests",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const body = requirePlainObject(req.body, "body");
    const type = requireOneOf(body.type, "type", [
      "INVENTORY_UPDATE",
      "INVENTORY_ADD",
    ]);

    const resolvedRequesterId = req.user.id;
    const user = await db.queryOne("SELECT name FROM users WHERE id = ?", [
      resolvedRequesterId,
    ]);
    const requesterNameInput = optionalString(body.requesterName, "requesterName", {
      maxLength: 255,
    });
    const resolvedRequesterName =
      user?.name || requesterNameInput || req.user.username || "Unknown";

    const targetId =
      type === "INVENTORY_UPDATE"
        ? requireString(body.targetId, "targetId", { maxLength: 64 })
        : null;

    const originalDataJson = JSON.stringify(body.originalData ?? null);
    const newData = requirePlainObject(body.newData, "newData");
    const newDataJson = JSON.stringify(newData);

    const newRequest = {
      id: makeId("req"),
      requesterId: resolvedRequesterId,
      requesterName: resolvedRequesterName,
      type,
      targetId,
      originalData: originalDataJson,
      newData: newDataJson,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };

    await db.execute(
      "INSERT INTO requests (id, requesterId, requesterName, type, targetId, originalData, newData, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        newRequest.id,
        newRequest.requesterId,
        newRequest.requesterName,
        newRequest.type,
        newRequest.targetId,
        newRequest.originalData,
        newRequest.newData,
        newRequest.status,
        newRequest.createdAt,
      ],
    );

    broadcast("request:created", newRequest);
    res.status(201).json(newRequest);
  }),
);

app.post(
  "/api/requests/:id/approve",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const request = await db.queryOne("SELECT * FROM requests WHERE id = ?", [
      id,
    ]);

    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "PENDING") {
      return res.status(400).json({ error: "Only pending requests can be approved" });
    }

    // Apply changes
    if (request.type === "INVENTORY_UPDATE") {
      const updates = JSON.parse(request.newData);
      const { name, category, quantity } = updates;
      const targetId = request.targetId;

      await db.execute(
        "UPDATE inventory SET name = ?, category = ?, quantity = ?, requesterName = ?, requesterId = ? WHERE id = ?",
        [
          name,
          category,
          quantity,
          request.requesterName,
          request.requesterId,
          targetId,
        ],
      );
    } else if (request.type === "INVENTORY_ADD") {
      const newItem = JSON.parse(request.newData);
      const itemId = makeId("item");
      const { name, category, quantity } = newItem;
      const date = new Date().toISOString().split("T")[0];

      await db.execute(
        "INSERT INTO inventory (id, name, category, quantity, date, requesterName, requesterId) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          itemId,
          name,
          category,
          quantity,
          date,
          request.requesterName,
          request.requesterId,
        ],
      );
    }

    // Update request status instead of deleting
    await db.execute("UPDATE requests SET status = 'APPROVED' WHERE id = ?", [
      id,
    ]);

    broadcast("request:approved", { id });
    res.json({ success: true });
  }),
);

app.post(
  "/api/requests/:id/reject",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const request = await db.queryOne("SELECT id, status FROM requests WHERE id = ?", [
      id,
    ]);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "PENDING") {
      return res.status(400).json({ error: "Only pending requests can be rejected" });
    }

    await db.execute("UPDATE requests SET status = 'REJECTED' WHERE id = ?", [
      id,
    ]);
    broadcast("request:rejected", { id });
    res.json({ success: true });
  }),
);

app.delete(
  "/api/requests/:id",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const request = await db.queryOne(
      "SELECT id, requesterId, status FROM requests WHERE id = ?",
      [id],
    );
    if (!request) return res.status(404).json({ error: "Request not found" });

    if (!isAdminRole(req.user.role)) {
      if (request.requesterId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (request.status !== "PENDING") {
        return res
          .status(400)
          .json({ error: "Only pending requests can be revoked" });
      }
    }

    await db.execute("DELETE FROM requests WHERE id = ?", [id]);
    broadcast("request:deleted", { id });
    res.json({ success: true });
  }),
);

// API fallback (keep JSON responses for unknown endpoints)
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Central error handler
app.use(errorMiddleware);

const shouldServeClient = (() => {
  const raw = process.env.SERVE_CLIENT;
  if (raw === undefined) return process.env.NODE_ENV === "production";
  return raw === "1" || raw.toLowerCase() === "true";
})();

if (shouldServeClient) {
  if (fs.existsSync(clientDistDir)) {
    app.use(express.static(clientDistDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
        return next();
      }
      res.sendFile(path.join(clientDistDir, "index.html"));
    });
    console.log(`[static] serving dist from ${clientDistDir}`);
  } else {
    console.warn(
      `[static] SERVE_CLIENT is enabled, but dist not found at ${clientDistDir}. Run 'npm run build' from repo root.`,
    );
  }
}

// 启动服务器
const onListen = () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);

  const lanUrls = getLanUrls(PORT);
  if (lanUrls.length > 0) {
    console.log(`LAN: ${lanUrls.join(", ")}`);
  }

  console.log(`🔌 WebSocket 已启用`);
};

if (process.env.HOST) {
  httpServer.listen(PORT, process.env.HOST, onListen);
} else {
  httpServer.listen(PORT, onListen);
}
