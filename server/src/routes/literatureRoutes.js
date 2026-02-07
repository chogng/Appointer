import express from "express";
import { randomUUID } from "crypto";
import { Readable } from "stream";

import { db } from "../config/db.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { searchLiterature } from "../literatureService.js";
import { safeJsonParse } from "../utils/json.js";
import { isPlainObject } from "../utils/objects.js";
import { isValidDateString } from "../utils/dateTime.js";
import {
  BIGMODEL_TRANSLATION_MODEL,
  getDefaultTranslationApiKey,
  getDefaultTranslationBaseUrl,
  getDefaultTranslationModel,
  getTranslationProvider,
  maskApiKey,
  validateTranslationBaseUrl,
} from "../literatureTranslationConfig.js";
import {
  cleanupLiteratureTranslationCache,
  fetchWithTimeout,
  literatureTranslationCache,
  makeLiteratureTranslationCacheKey,
  translateWithBigModel,
  translateWithOpenAI,
  translateWithOpenAICompatible,
} from "../literatureTranslationRuntime.js";
import {
  mergeLiteratureSettings,
  sanitizeSeedUrlsList,
  sanitizeSeedUrlSelectedList,
  sanitizeSeedUrlTitlesList,
  splitSeedUrlsBySourceType,
} from "../literatureSettings.js";

const LITERATURE_DOWNLOAD_TTL_MS = 60 * 60 * 1000;
const literatureDownloadTokens = new Map();

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

function sanitizeFilename(value) {
  const raw = typeof value === "string" ? value : String(value || "");
  const sanitized = raw.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim();
  return sanitized || "article";
}

function createLiteratureDownloadToken({ url, filename }) {
  cleanupLiteratureDownloadTokens();
  const token = randomUUID();
  literatureDownloadTokens.set(token, {
    url,
    filename,
    createdAt: Date.now(),
  });
  return token;
}

export default function createLiteratureRoutes() {
  const router = express.Router();

  router.get(
    "/settings",
    authenticateToken,
    asyncHandler(async (req, res) => {
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
        : splitSeedUrlsBySourceType(
            Array.isArray(config?.seedUrlsUnified) && config.seedUrlsUnified.length > 0
              ? config.seedUrlsUnified
              : config?.seedUrls,
          );

      const seedUrlsUnified = Array.isArray(config?.seedUrlsUnified)
        ? sanitizeSeedUrlsList(config.seedUrlsUnified)
        : [
            ...seedUrlsBySourceType.nature,
            ...seedUrlsBySourceType.science,
          ];

      const seedUrlTitlesBySourceTypeRaw = isPlainObject(config?.seedUrlTitlesBySourceType)
        ? config.seedUrlTitlesBySourceType
        : null;

      const seedUrlTitlesBySourceType = {
        nature: seedUrlTitlesBySourceTypeRaw
          ? sanitizeSeedUrlTitlesList(seedUrlTitlesBySourceTypeRaw.nature).slice(
              0,
              seedUrlsBySourceType.nature.length,
            )
          : [],
        science: seedUrlTitlesBySourceTypeRaw
          ? sanitizeSeedUrlTitlesList(seedUrlTitlesBySourceTypeRaw.science).slice(
              0,
              seedUrlsBySourceType.science.length,
            )
          : [],
      };

      while (seedUrlTitlesBySourceType.nature.length < seedUrlsBySourceType.nature.length) {
        seedUrlTitlesBySourceType.nature.push("");
      }
      while (seedUrlTitlesBySourceType.science.length < seedUrlsBySourceType.science.length) {
        seedUrlTitlesBySourceType.science.push("");
      }

      const seedUrlTitlesUnified = Array.isArray(config?.seedUrlTitlesUnified)
        ? sanitizeSeedUrlTitlesList(config.seedUrlTitlesUnified).slice(0, seedUrlsUnified.length)
        : [
            ...seedUrlTitlesBySourceType.nature,
            ...seedUrlTitlesBySourceType.science,
          ].slice(0, seedUrlsUnified.length);
      while (seedUrlTitlesUnified.length < seedUrlsUnified.length) {
        seedUrlTitlesUnified.push("");
      }

      const seedUrlSelectedUnifiedRaw = Array.isArray(config?.seedUrlSelectedUnified)
        ? sanitizeSeedUrlSelectedList(config.seedUrlSelectedUnified)
        : [];
      const seedUrlSelectedUnified = seedUrlsUnified.map(
        (_, idx) => (typeof seedUrlSelectedUnifiedRaw[idx] === "boolean" ? seedUrlSelectedUnifiedRaw[idx] : true),
      );

      const storedSourceType =
        config?.sourceType === "science" || config?.sourceType === "nature"
          ? config.sourceType
          : null;

      const sourceType =
        storedSourceType ||
        (seedUrlsBySourceType.science.length > 0 &&
        seedUrlsBySourceType.nature.length === 0
          ? "science"
          : "nature");

      const seedUrls =
        sourceType === "science"
          ? seedUrlsBySourceType.science
          : seedUrlsBySourceType.nature;

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
      const translationApiKeySource = hasUserKey
        ? "user"
        : globalKey.hasKey
          ? "default"
          : null;

      const translationModel =
        typeof config?.translationModel === "string"
          ? config.translationModel.trim()
          : typeof config?.bigmodelModel === "string"
            ? config.bigmodelModel.trim()
            : "";

      const translationProvider =
        typeof config?.translationProvider === "string"
          ? config.translationProvider.trim()
          : "";

      const translationBaseUrl =
        typeof config?.translationBaseUrl === "string"
          ? config.translationBaseUrl.trim()
          : "";
      const globalBaseUrl = await getDefaultTranslationBaseUrl(db);

      const provider = await getTranslationProvider(db);

      res.json({
        seedUrlsUnified,
        seedUrlTitlesUnified,
        seedUrlSelectedUnified,
        seedUrlsBySourceType,
        seedUrlTitlesBySourceType,
        sourceType,
        seedUrls,
        startDate,
        endDate,
        maxResults,
        hasTranslationApiKey,
        hasDefaultTranslationApiKey: globalKey.hasKey,
        translationApiKeySource,
        translationApiKeyMasked: hasUserKey ? maskApiKey(translationApiKey) : null,
        translationProvider: translationProvider
          ? translationProvider.toLowerCase()
          : null,
        translationModel: translationModel || null,
        translationBaseUrl: translationBaseUrl || null,
        hasDefaultTranslationBaseUrl: globalBaseUrl.hasBaseUrl,
        defaultTranslationProvider: provider.provider,
        supportedTranslationProviders: provider.supportedProviders,
        updatedAt: row?.updatedAt || null,
      });
    }),
  );

  router.patch(
    "/settings",
    authenticateToken,
    asyncHandler(async (req, res) => {
      const now = new Date().toISOString();

      const row = await db.queryOne(
        "SELECT userId, configJson FROM literature_research_settings WHERE userId = ?",
        [req.user.id],
      );

      const existingConfig = safeJsonParse(row?.configJson, {});
      const settings = mergeLiteratureSettings(existingConfig, req.body);

      if (Object.prototype.hasOwnProperty.call(req.body || {}, "translationBaseUrl")) {
        const validated = await validateTranslationBaseUrl(
          settings.translationBaseUrl || "",
        );
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
        typeof settings.translationApiKey === "string"
          ? settings.translationApiKey.trim()
          : "";
      const globalKey = await getDefaultTranslationApiKey(db);
      const globalBaseUrl = await getDefaultTranslationBaseUrl(db);
      const provider = await getTranslationProvider(db);
      const hasUserKey = Boolean(userKey);
      const hasTranslationApiKey = hasUserKey || globalKey.hasKey;
      const translationApiKeySource = hasUserKey
        ? "user"
        : globalKey.hasKey
          ? "default"
          : null;

      const seedUrlsBySourceType = isPlainObject(settings?.seedUrlsBySourceType)
        ? {
            nature: sanitizeSeedUrlsList(settings.seedUrlsBySourceType.nature),
            science: sanitizeSeedUrlsList(settings.seedUrlsBySourceType.science),
          }
        : { nature: [], science: [] };

      const seedUrlsUnified = Array.isArray(settings?.seedUrlsUnified)
        ? sanitizeSeedUrlsList(settings.seedUrlsUnified)
        : [
            ...seedUrlsBySourceType.nature,
            ...seedUrlsBySourceType.science,
          ];

      const seedUrlTitlesBySourceType = isPlainObject(settings?.seedUrlTitlesBySourceType)
        ? {
            nature: sanitizeSeedUrlTitlesList(settings.seedUrlTitlesBySourceType.nature).slice(
              0,
              seedUrlsBySourceType.nature.length,
            ),
            science: sanitizeSeedUrlTitlesList(settings.seedUrlTitlesBySourceType.science).slice(
              0,
              seedUrlsBySourceType.science.length,
            ),
          }
        : { nature: [], science: [] };
      while (seedUrlTitlesBySourceType.nature.length < seedUrlsBySourceType.nature.length) {
        seedUrlTitlesBySourceType.nature.push("");
      }
      while (seedUrlTitlesBySourceType.science.length < seedUrlsBySourceType.science.length) {
        seedUrlTitlesBySourceType.science.push("");
      }

      const seedUrlTitlesUnified = Array.isArray(settings?.seedUrlTitlesUnified)
        ? sanitizeSeedUrlTitlesList(settings.seedUrlTitlesUnified).slice(0, seedUrlsUnified.length)
        : [
            ...seedUrlTitlesBySourceType.nature,
            ...seedUrlTitlesBySourceType.science,
          ].slice(0, seedUrlsUnified.length);
      while (seedUrlTitlesUnified.length < seedUrlsUnified.length) {
        seedUrlTitlesUnified.push("");
      }

      const seedUrlSelectedUnifiedRaw = Array.isArray(settings?.seedUrlSelectedUnified)
        ? sanitizeSeedUrlSelectedList(settings.seedUrlSelectedUnified)
        : [];
      const seedUrlSelectedUnified = seedUrlsUnified.map(
        (_, idx) => (typeof seedUrlSelectedUnifiedRaw[idx] === "boolean" ? seedUrlSelectedUnifiedRaw[idx] : true),
      );

      const sourceType =
        settings?.sourceType === "science" || settings?.sourceType === "nature"
          ? settings.sourceType
          : null;

      res.json({
        seedUrlsUnified,
        seedUrlTitlesUnified,
        seedUrlSelectedUnified,
        seedUrlsBySourceType,
        seedUrlTitlesBySourceType,
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
          typeof settings.translationProvider === "string" &&
          settings.translationProvider.trim()
            ? settings.translationProvider.trim().toLowerCase()
            : null,
        translationModel: settings.translationModel || null,
        translationBaseUrl: settings.translationBaseUrl || null,
        hasDefaultTranslationBaseUrl: globalBaseUrl.hasBaseUrl,
        defaultTranslationProvider: provider.provider,
        supportedTranslationProviders: provider.supportedProviders,
        updatedAt: now,
      });
    }),
  );

  router.post(
    "/search",
    authenticateToken,
    asyncHandler(async (req, res) => {
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
          seedUrls =
            Array.isArray(config?.seedUrlsUnified) && config.seedUrlsUnified.length > 0
              ? config.seedUrlsUnified
              : config?.seedUrls;
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

      const enriched = items.map((item) => {
        const articleUrl =
          typeof item?.articleUrl === "string" && item.articleUrl.trim()
            ? item.articleUrl.trim()
            : null;

        return {
          ...item,
          downloadable: Boolean(articleUrl),
          downloadUrl: articleUrl,
          downloadToken:
            typeof item?.pdfUrl === "string" && item.pdfUrl
              ? createLiteratureDownloadToken({
                  url: item.pdfUrl,
                  filename: sanitizeFilename(item.title || "article"),
                })
              : null,
        };
      });

      res.json(enriched);
    }),
  );

  router.post(
    "/translate",
    authenticateToken,
    asyncHandler(async (req, res) => {
      let apiKeySource = null;
      let targetLang = "zh";
      let model = null;
      let modelSource = null;
      let translationProvider = "bigmodel";
      let translationProviderSource = null;
      let translationBaseUrlSource = null;
      let translationBaseUrlHost = null;

      const body = isPlainObject(req.body) ? req.body : {};
      const id = typeof body.id === "string" ? body.id.trim() : "";
      const text = typeof body.text === "string" ? body.text.trim() : "";
      const rawTargetLang =
        typeof body.targetLang === "string"
          ? body.targetLang.trim().toLowerCase()
          : "";
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

      cleanupLiteratureTranslationCache();

      const settingsRow = await db.queryOne(
        "SELECT configJson FROM literature_research_settings WHERE userId = ?",
        [req.user.id],
      );
      const config = safeJsonParse(settingsRow?.configJson, {});

      const userApiKey =
        typeof config?.translationApiKey === "string"
          ? config.translationApiKey.trim()
          : "";
      const userModel =
        typeof config?.translationModel === "string"
          ? config.translationModel.trim()
          : "";
      const userProvider =
        typeof config?.translationProvider === "string"
          ? config.translationProvider.trim().toLowerCase()
          : "";
      const userBaseUrl =
        typeof config?.translationBaseUrl === "string"
          ? config.translationBaseUrl.trim()
          : "";

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
      const apiKey = forceKeySource
        ? resolvedGlobalApiKey
        : userApiKey || resolvedGlobalApiKey || "";

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
            error: `Default ${providerLabel} model is not configured. Please set the default model as SUPER_ADMIN.`,
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
            error: `${providerLabel} model is not configured. Please set your own model in Literature settings or ask an admin to configure the default model.`,
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
          typeof globalBaseUrl?.baseUrl === "string"
            ? globalBaseUrl.baseUrl.trim()
            : "";

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
            translationBaseUrlSource,
            targetLang,
            model,
            modelSource,
          });
        }

        const validatedBaseUrl = await validateTranslationBaseUrl(translationBaseUrl);
        translationBaseUrl = validatedBaseUrl;
        translationBaseUrlHost = validatedBaseUrl ? new URL(validatedBaseUrl).host : null;
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
        const cached = literatureTranslationCache.get(cacheKey);
        if (cached?.translatedText) {
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
      } else {
        literatureTranslationCache.delete(cacheKey);
      }

      const translatedText =
        translationAdapter === "openai"
          ? await translateWithOpenAI(apiKey, text, targetLang, model)
          : translationAdapter === "openai_compatible"
            ? await translateWithOpenAICompatible(
                apiKey,
                text,
                targetLang,
                model,
                translationBaseUrl,
              )
            : await translateWithBigModel(
                apiKey,
                text,
                targetLang,
                model || BIGMODEL_TRANSLATION_MODEL,
              );

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
    }),
  );

  router.get(
    "/download/:token",
    authenticateToken,
    asyncHandler(async (req, res) => {
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
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${entry.filename || "article.pdf"}"`,
      );
      res.setHeader("Cache-Control", "no-store");
      if (contentLength) res.setHeader("Content-Length", contentLength);

      if (!upstream.body) {
        return res.status(502).json({ error: "Upstream body missing" });
      }

      Readable.fromWeb(upstream.body).pipe(res);
    }),
  );

  return router;
}
