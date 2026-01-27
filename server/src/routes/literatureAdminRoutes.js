import express from "express";

import { db } from "../config/db.js";
import { authenticateToken, requireSuperAdmin } from "../middleware/authMiddleware.js";
import {
  BIGMODEL_TRANSLATION_MODEL,
  getDefaultTranslationApiKey,
  getDefaultTranslationBaseUrl,
  getDefaultTranslationModel,
  getTranslationProvider,
  maskApiKey,
  setDefaultTranslationApiKey,
  setDefaultTranslationBaseUrl,
  setDefaultTranslationModel,
  setTranslationProvider,
} from "../literatureTranslationConfig.js";
import { literatureTranslationCache } from "../literatureTranslationRuntime.js";
import { isPlainObject } from "../utils/objects.js";

export default function createLiteratureAdminRoutes() {
  const router = express.Router();

  router.get("/translation-key", authenticateToken, requireSuperAdmin, async (_req, res) => {
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
  });

  router.patch("/translation-key", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const now = new Date().toISOString();
      const body = isPlainObject(req.body) ? req.body : {};
      const value = typeof body.defaultTranslationApiKey === "string" ? body.defaultTranslationApiKey : "";
      const updated = await setDefaultTranslationApiKey(db, value, now);
      res.json({
        hasDefaultTranslationApiKey: updated.hasKey,
        defaultTranslationApiKeyMasked: updated.masked,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get("/translation-model", authenticateToken, requireSuperAdmin, async (_req, res) => {
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
  });

  router.patch("/translation-model", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const now = new Date().toISOString();
      const body = isPlainObject(req.body) ? req.body : {};
      const value = typeof body.defaultTranslationModel === "string" ? body.defaultTranslationModel : "";
      const updated = await setDefaultTranslationModel(db, value, now);
      res.json({
        hasDefaultTranslationModel: updated.hasModel,
        defaultTranslationModel: typeof updated.model === "string" && updated.model.trim() ? updated.model : null,
        updatedAt: updated.updatedAt,
        builtinDefaultTranslationModel: BIGMODEL_TRANSLATION_MODEL,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get("/translation-base-url", authenticateToken, requireSuperAdmin, async (_req, res) => {
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
  });

  router.patch("/translation-base-url", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const now = new Date().toISOString();
      const body = isPlainObject(req.body) ? req.body : {};
      const value = typeof body.defaultTranslationBaseUrl === "string" ? body.defaultTranslationBaseUrl : "";
      const updated = await setDefaultTranslationBaseUrl(db, value, now);
      res.json({
        hasDefaultTranslationBaseUrl: updated.hasBaseUrl,
        defaultTranslationBaseUrl: typeof updated.baseUrl === "string" && updated.baseUrl.trim() ? updated.baseUrl : null,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Legacy endpoints (kept for backwards compatibility)
  router.get("/bigmodel-key", authenticateToken, requireSuperAdmin, async (_req, res) => {
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
  });

  router.patch("/bigmodel-key", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const now = new Date().toISOString();
      const body = isPlainObject(req.body) ? req.body : {};
      const value = typeof body.defaultBigmodelApiKey === "string" ? body.defaultBigmodelApiKey : "";
      const updated = await setDefaultTranslationApiKey(db, value, now);
      res.json({
        hasDefaultBigmodelApiKey: updated.hasKey,
        defaultBigmodelApiKeyMasked: updated.masked,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get("/bigmodel-model", authenticateToken, requireSuperAdmin, async (_req, res) => {
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
  });

  router.patch("/bigmodel-model", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const now = new Date().toISOString();
      const body = isPlainObject(req.body) ? req.body : {};
      const value = typeof body.defaultBigmodelModel === "string" ? body.defaultBigmodelModel : "";
      const updated = await setDefaultTranslationModel(db, value, now);
      res.json({
        hasDefaultBigmodelModel: updated.hasModel,
        defaultBigmodelModel: typeof updated.model === "string" && updated.model.trim() ? updated.model : null,
        updatedAt: updated.updatedAt,
        builtinDefaultBigmodelModel: BIGMODEL_TRANSLATION_MODEL,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get("/translation-provider", authenticateToken, requireSuperAdmin, async (_req, res) => {
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
  });

  router.patch("/translation-provider", authenticateToken, requireSuperAdmin, async (req, res) => {
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
  });

  return router;
}

