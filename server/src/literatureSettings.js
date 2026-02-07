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

export function sanitizeSeedUrlTitlesList(input) {
  const values = Array.isArray(input) ? input : [];
  return values
    .slice(0, 50)
    .map((value) => (value == null ? "" : String(value)))
    .map((value) => value.trim())
    .map((value) => {
      if (!value) return "";
      if (/[\r\n]/.test(value)) throw new Error("seedUrlTitle must be single-line");
      if (value.length > 200) throw new Error("seedUrlTitle is too long");
      return value;
    });
}

export function sanitizeSeedUrlSelectedList(input) {
  const values = Array.isArray(input) ? input : [];
  return values
    .slice(0, 50)
    .map((value) => {
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      if (typeof value === "string") {
        const trimmed = value.trim().toLowerCase();
        if (!trimmed) return true;
        if (trimmed === "false" || trimmed === "0" || trimmed === "no") return false;
        return true;
      }
      return true;
    });
}

function normalizeSeedUrlTitlesList(input, desiredLen) {
  const list = Array.isArray(input) ? input : [];
  const n = Math.max(0, Math.floor(Number(desiredLen) || 0));
  const out = new Array(n);
  for (let i = 0; i < n; i += 1) {
    out[i] = typeof list[i] === "string" ? list[i] : "";
  }
  return out;
}

function normalizeSeedUrlSelectedList(input, desiredLen) {
  const list = Array.isArray(input) ? input : [];
  const n = Math.max(0, Math.floor(Number(desiredLen) || 0));
  const out = new Array(n);
  for (let i = 0; i < n; i += 1) {
    out[i] = typeof list[i] === "boolean" ? list[i] : true;
  }
  return out;
}

function pairSeedUrlsAndTitles(seedUrlsInput, seedUrlTitlesInput) {
  const seedUrls = sanitizeSeedUrlsList(seedUrlsInput);
  const seedUrlTitles = sanitizeSeedUrlTitlesList(seedUrlTitlesInput);
  const outSeedUrls = [];
  const outSeedUrlTitles = [];
  for (let i = 0; i < seedUrls.length; i += 1) {
    const url = typeof seedUrls[i] === "string" ? seedUrls[i].trim() : "";
    if (!url) continue;
    const title = typeof seedUrlTitles[i] === "string" ? seedUrlTitles[i].trim() : "";
    outSeedUrls.push(url);
    outSeedUrlTitles.push(title);
  }
  return { seedUrls: outSeedUrls, seedUrlTitles: outSeedUrlTitles };
}

function pairSeedUrlsTitlesAndSelected(seedUrlsInput, seedUrlTitlesInput, seedUrlSelectedInput) {
  const seedUrls = sanitizeSeedUrlsList(seedUrlsInput);
  const seedUrlTitles = sanitizeSeedUrlTitlesList(seedUrlTitlesInput);
  const seedUrlSelected = sanitizeSeedUrlSelectedList(seedUrlSelectedInput);

  const outSeedUrls = [];
  const outSeedUrlTitles = [];
  const outSeedUrlSelected = [];

  for (let i = 0; i < seedUrls.length; i += 1) {
    const url = typeof seedUrls[i] === "string" ? seedUrls[i].trim() : "";
    if (!url) continue;
    const title = typeof seedUrlTitles[i] === "string" ? seedUrlTitles[i].trim() : "";
    const selected = typeof seedUrlSelected[i] === "boolean" ? seedUrlSelected[i] : true;
    outSeedUrls.push(url);
    outSeedUrlTitles.push(title);
    outSeedUrlSelected.push(selected);
  }

  return {
    seedUrls: outSeedUrls,
    seedUrlTitles: outSeedUrlTitles,
    seedUrlSelected: outSeedUrlSelected,
  };
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

function splitSeedUrlTitlesBySourceTypeFromUnified(seedUrlsUnified, seedUrlTitlesUnified) {
  const seedUrls = Array.isArray(seedUrlsUnified) ? seedUrlsUnified : [];
  const seedUrlTitles = Array.isArray(seedUrlTitlesUnified) ? seedUrlTitlesUnified : [];

  const nature = [];
  const science = [];

  for (let i = 0; i < seedUrls.length; i += 1) {
    const url = typeof seedUrls[i] === "string" ? seedUrls[i].trim() : "";
    if (!url) continue;
    const title = typeof seedUrlTitles[i] === "string" ? seedUrlTitles[i].trim() : "";
    if (url.includes("science.org")) {
      science.push(title);
    } else if (url.includes("nature.com")) {
      nature.push(title);
    }
  }

  return {
    nature: sanitizeSeedUrlTitlesList(nature),
    science: sanitizeSeedUrlTitlesList(science),
  };
}

function sanitizeLiteratureSettings(input) {
  const src = isPlainObject(input) ? input : {};

  const seedUrls = sanitizeSeedUrlsList(src.seedUrls);
  const seedUrlTitles = sanitizeSeedUrlTitlesList(src.seedUrlTitles);
  const seedUrlsUnified = sanitizeSeedUrlsList(src.seedUrlsUnified);
  const seedUrlTitlesUnified = sanitizeSeedUrlTitlesList(src.seedUrlTitlesUnified);
  const seedUrlSelectedUnified = sanitizeSeedUrlSelectedList(src.seedUrlSelectedUnified);

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

  const seedUrlTitlesBySourceTypeRaw = src.seedUrlTitlesBySourceType;
  const seedUrlTitlesBySourceType = isPlainObject(seedUrlTitlesBySourceTypeRaw)
    ? {
        nature: sanitizeSeedUrlTitlesList(seedUrlTitlesBySourceTypeRaw.nature),
        science: sanitizeSeedUrlTitlesList(seedUrlTitlesBySourceTypeRaw.science),
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
    seedUrlTitles,
    seedUrlTitlesBySourceType,
    seedUrlsUnified,
    seedUrlTitlesUnified,
    seedUrlSelectedUnified,
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

  const existingSeedUrlsUnifiedRaw = next.seedUrlsUnified;
  const existingSeedUrlTitlesUnifiedRaw = next.seedUrlTitlesUnified;
  const existingUnifiedPaired = pairSeedUrlsTitlesAndSelected(
    existingSeedUrlsUnifiedRaw,
    existingSeedUrlTitlesUnifiedRaw,
    next.seedUrlSelectedUnified,
  );
  next.seedUrlsUnified = existingUnifiedPaired.seedUrls;
  next.seedUrlTitlesUnified = existingUnifiedPaired.seedUrlTitles;
  next.seedUrlSelectedUnified = normalizeSeedUrlSelectedList(
    existingUnifiedPaired.seedUrlSelected,
    next.seedUrlsUnified.length,
  );

  const existingSeedUrlsBySourceTypeRaw = next.seedUrlsBySourceType;
  if (isPlainObject(existingSeedUrlsBySourceTypeRaw)) {
    next.seedUrlsBySourceType = {
      nature: sanitizeSeedUrlsList(existingSeedUrlsBySourceTypeRaw.nature),
      science: sanitizeSeedUrlsList(existingSeedUrlsBySourceTypeRaw.science),
    };
  } else {
    next.seedUrlsBySourceType = splitSeedUrlsBySourceType(next.seedUrls);
  }

  const existingSeedUrlTitlesBySourceTypeRaw = next.seedUrlTitlesBySourceType;
  if (isPlainObject(existingSeedUrlTitlesBySourceTypeRaw)) {
    next.seedUrlTitlesBySourceType = {
      nature: normalizeSeedUrlTitlesList(
        sanitizeSeedUrlTitlesList(existingSeedUrlTitlesBySourceTypeRaw.nature),
        next.seedUrlsBySourceType.nature.length,
      ),
      science: normalizeSeedUrlTitlesList(
        sanitizeSeedUrlTitlesList(existingSeedUrlTitlesBySourceTypeRaw.science),
        next.seedUrlsBySourceType.science.length,
      ),
    };
  } else {
    next.seedUrlTitlesBySourceType = {
      nature: normalizeSeedUrlTitlesList(null, next.seedUrlsBySourceType.nature.length),
      science: normalizeSeedUrlTitlesList(null, next.seedUrlsBySourceType.science.length),
    };
  }

  if (!next.seedUrlsUnified.length) {
    next.seedUrlsUnified = [
      ...next.seedUrlsBySourceType.nature,
      ...next.seedUrlsBySourceType.science,
    ];
    next.seedUrlTitlesUnified = [
      ...normalizeSeedUrlTitlesList(
        next.seedUrlTitlesBySourceType.nature,
        next.seedUrlsBySourceType.nature.length,
      ),
      ...normalizeSeedUrlTitlesList(
        next.seedUrlTitlesBySourceType.science,
        next.seedUrlsBySourceType.science.length,
      ),
    ];
    const paired = pairSeedUrlsAndTitles(next.seedUrlsUnified, next.seedUrlTitlesUnified);
    next.seedUrlsUnified = paired.seedUrls;
    next.seedUrlTitlesUnified = paired.seedUrlTitles;
    next.seedUrlSelectedUnified = normalizeSeedUrlSelectedList(null, next.seedUrlsUnified.length);
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

  if (
    Object.prototype.hasOwnProperty.call(patch, "seedUrlTitlesBySourceType") &&
    sanitized.seedUrlTitlesBySourceType
  ) {
    next.seedUrlTitlesBySourceType = {
      nature: normalizeSeedUrlTitlesList(
        sanitized.seedUrlTitlesBySourceType.nature,
        next.seedUrlsBySourceType.nature.length,
      ),
      science: normalizeSeedUrlTitlesList(
        sanitized.seedUrlTitlesBySourceType.science,
        next.seedUrlsBySourceType.science.length,
      ),
    };
  }

  const hasUnifiedSeedPatch =
    Object.prototype.hasOwnProperty.call(patch, "seedUrlsUnified") ||
    Object.prototype.hasOwnProperty.call(patch, "seedUrlTitlesUnified") ||
    Object.prototype.hasOwnProperty.call(patch, "seedUrlSelectedUnified");

  if (hasUnifiedSeedPatch) {
    const baseSeedUrlsUnified = Object.prototype.hasOwnProperty.call(patch, "seedUrlsUnified")
      ? sanitized.seedUrlsUnified
      : next.seedUrlsUnified;
    const baseSeedUrlTitlesUnified = Object.prototype.hasOwnProperty.call(patch, "seedUrlTitlesUnified")
      ? sanitized.seedUrlTitlesUnified
      : next.seedUrlTitlesUnified;
    const baseSeedUrlSelectedUnified = Object.prototype.hasOwnProperty.call(patch, "seedUrlSelectedUnified")
      ? sanitized.seedUrlSelectedUnified
      : next.seedUrlSelectedUnified;

    const paired = pairSeedUrlsTitlesAndSelected(
      baseSeedUrlsUnified,
      baseSeedUrlTitlesUnified,
      baseSeedUrlSelectedUnified,
    );
    next.seedUrlsUnified = paired.seedUrls;
    next.seedUrlTitlesUnified = paired.seedUrlTitles;
    next.seedUrlSelectedUnified = normalizeSeedUrlSelectedList(paired.seedUrlSelected, next.seedUrlsUnified.length);
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

    next.seedUrlTitlesBySourceType = isPlainObject(next.seedUrlTitlesBySourceType)
      ? next.seedUrlTitlesBySourceType
      : { nature: [], science: [] };
    next.seedUrlTitlesBySourceType[targetSourceType] = normalizeSeedUrlTitlesList(
      next.seedUrlTitlesBySourceType[targetSourceType],
      sanitized.seedUrls.length,
    );
  }

  if (Object.prototype.hasOwnProperty.call(patch, "seedUrlTitles")) {
    const targetSourceType =
      sanitized.seedSource ||
      sanitized.sourceType ||
      (next.sourceType === "science" || next.sourceType === "nature" ? next.sourceType : null) ||
      (next.seedUrlsBySourceType.science.length > 0 &&
      next.seedUrlsBySourceType.nature.length === 0
        ? "science"
        : "nature");

    next.seedUrlTitlesBySourceType = isPlainObject(next.seedUrlTitlesBySourceType)
      ? next.seedUrlTitlesBySourceType
      : { nature: [], science: [] };

    const seedUrlsForSource = next.seedUrlsBySourceType[targetSourceType] || [];
    next.seedUrlTitlesBySourceType[targetSourceType] = normalizeSeedUrlTitlesList(
      sanitized.seedUrlTitles,
      seedUrlsForSource.length,
    );
  }

  const hasNonUnifiedSeedPatch =
    Object.prototype.hasOwnProperty.call(patch, "seedUrlsBySourceType") ||
    Object.prototype.hasOwnProperty.call(patch, "seedUrlTitlesBySourceType") ||
    Object.prototype.hasOwnProperty.call(patch, "seedUrls") ||
    Object.prototype.hasOwnProperty.call(patch, "seedUrlTitles") ||
    Object.prototype.hasOwnProperty.call(patch, "seedSource") ||
    Object.prototype.hasOwnProperty.call(patch, "sourceType");

  if (!hasUnifiedSeedPatch && hasNonUnifiedSeedPatch) {
    const previousSelectionByUrl = (() => {
      const map = new Map();
      const urls = Array.isArray(next.seedUrlsUnified) ? next.seedUrlsUnified : [];
      const selected = Array.isArray(next.seedUrlSelectedUnified) ? next.seedUrlSelectedUnified : [];
      for (let i = 0; i < urls.length; i += 1) {
        const url = typeof urls[i] === "string" ? urls[i].trim() : "";
        if (!url) continue;
        map.set(url, typeof selected[i] === "boolean" ? selected[i] : true);
      }
      return map;
    })();

    next.seedUrlsUnified = [
      ...sanitizeSeedUrlsList(next.seedUrlsBySourceType.nature),
      ...sanitizeSeedUrlsList(next.seedUrlsBySourceType.science),
    ];
    next.seedUrlTitlesUnified = [
      ...normalizeSeedUrlTitlesList(
        next.seedUrlTitlesBySourceType.nature,
        next.seedUrlsBySourceType.nature.length,
      ),
      ...normalizeSeedUrlTitlesList(
        next.seedUrlTitlesBySourceType.science,
        next.seedUrlsBySourceType.science.length,
      ),
    ];
    const paired = pairSeedUrlsAndTitles(next.seedUrlsUnified, next.seedUrlTitlesUnified);
    next.seedUrlsUnified = paired.seedUrls;
    next.seedUrlTitlesUnified = paired.seedUrlTitles;
    next.seedUrlSelectedUnified = next.seedUrlsUnified.map(
      (url) => previousSelectionByUrl.get(url) ?? true,
    );
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

  if (!isPlainObject(next.seedUrlTitlesBySourceType)) {
    next.seedUrlTitlesBySourceType = { nature: [], science: [] };
  }
  if (!Array.isArray(next.seedUrlTitlesBySourceType.nature)) next.seedUrlTitlesBySourceType.nature = [];
  if (!Array.isArray(next.seedUrlTitlesBySourceType.science)) next.seedUrlTitlesBySourceType.science = [];

  if (next.sourceType !== "science" && next.sourceType !== "nature") {
    next.sourceType =
      next.seedUrlsBySourceType.science.length > 0 && next.seedUrlsBySourceType.nature.length === 0
        ? "science"
        : "nature";
  }

  next.seedUrls =
    next.seedUrlsBySourceType[next.sourceType] || next.seedUrlsBySourceType.nature || [];
  next.seedUrlTitlesBySourceType = {
    nature: normalizeSeedUrlTitlesList(
      next.seedUrlTitlesBySourceType.nature,
      next.seedUrlsBySourceType.nature.length,
    ),
    science: normalizeSeedUrlTitlesList(
      next.seedUrlTitlesBySourceType.science,
      next.seedUrlsBySourceType.science.length,
    ),
  };
  if (typeof next.startDate !== "string") next.startDate = "";
  if (typeof next.endDate !== "string") next.endDate = "";
  const finalUnifiedPaired = pairSeedUrlsTitlesAndSelected(
    next.seedUrlsUnified,
    next.seedUrlTitlesUnified,
    next.seedUrlSelectedUnified,
  );
  next.seedUrlsUnified = finalUnifiedPaired.seedUrls;
  next.seedUrlTitlesUnified = finalUnifiedPaired.seedUrlTitles;
  next.seedUrlSelectedUnified = normalizeSeedUrlSelectedList(
    finalUnifiedPaired.seedUrlSelected,
    next.seedUrlsUnified.length,
  );

  next.seedUrlsBySourceType = splitSeedUrlsBySourceType(next.seedUrlsUnified);
  const titlesBySource = splitSeedUrlTitlesBySourceTypeFromUnified(
    next.seedUrlsUnified,
    next.seedUrlTitlesUnified,
  );
  next.seedUrlTitlesBySourceType = {
    nature: normalizeSeedUrlTitlesList(
      titlesBySource.nature,
      next.seedUrlsBySourceType.nature.length,
    ),
    science: normalizeSeedUrlTitlesList(
      titlesBySource.science,
      next.seedUrlsBySourceType.science.length,
    ),
  };

  if (next.sourceType !== "science" && next.sourceType !== "nature") {
    next.sourceType =
      next.seedUrlsBySourceType.science.length > 0 && next.seedUrlsBySourceType.nature.length === 0
        ? "science"
        : "nature";
  }

  next.seedUrls =
    next.seedUrlsBySourceType[next.sourceType] || next.seedUrlsBySourceType.nature || [];

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
