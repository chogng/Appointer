import { isValidDateString } from "./utils/dateTime.js";
import { isPlainObject } from "./utils/objects.js";

export function sanitizeSeedUrlsList(input) {
  const values = Array.isArray(input) ? input : [];
  return values
    .map((value) => (value == null ? "" : String(value)))
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 50);
}

export function splitSeedUrlsBySourceType(input) {
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
  const seedSource = seedSourceRaw === "nature" || seedSourceRaw === "science" ? seedSourceRaw : null;

  const sourceTypeRaw = src.sourceType;
  const sourceType = sourceTypeRaw === "nature" || sourceTypeRaw === "science" ? sourceTypeRaw : null;

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
  const maxResultsNumber = typeof maxResultsRaw === "number" ? maxResultsRaw : Number(maxResultsRaw);
  const maxResults = Number.isFinite(maxResultsNumber) ? Math.max(1, Math.trunc(maxResultsNumber)) : null;

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

export function mergeLiteratureSettings(existingSettings, patchInput) {
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
    const legacyKey = typeof next.bigmodelApiKey === "string" ? next.bigmodelApiKey.trim() : "";
    if (legacyKey) next.translationApiKey = legacyKey;
  }

  if (!Object.prototype.hasOwnProperty.call(next, "translationModel")) {
    const legacyModel = typeof next.bigmodelModel === "string" ? next.bigmodelModel.trim() : "";
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
  if (!Array.isArray(next.seedUrlsBySourceType.science)) next.seedUrlsBySourceType.science = [];

  if (next.sourceType !== "science" && next.sourceType !== "nature") {
    next.sourceType =
      next.seedUrlsBySourceType.science.length > 0 && next.seedUrlsBySourceType.nature.length === 0
        ? "science"
        : "nature";
  }

  next.seedUrls =
    next.seedUrlsBySourceType[next.sourceType] || next.seedUrlsBySourceType.nature || [];
  if (typeof next.startDate !== "string") next.startDate = "";
  if (typeof next.endDate !== "string") next.endDate = "";
  if (next.maxResults == null) {
    next.maxResults = null;
  } else {
    const maxResultsNumber = Number(next.maxResults);
    next.maxResults = Number.isFinite(maxResultsNumber) ? Math.max(1, Math.trunc(maxResultsNumber)) : null;
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

