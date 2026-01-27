import express from "express";

import { db } from "../config/db.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { makeId } from "../utils/ids.js";
import { safeJsonParse } from "../utils/json.js";
import { isPlainObject } from "../utils/objects.js";

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
    const yUnit = yUnitRaw === "A" || yUnitRaw === "uA" || yUnitRaw === "nA" ? yUnitRaw : null;
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

export default function createDeviceAnalysisRoutes() {
  const router = express.Router();

  router.get(
    "/templates",
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

  router.post(
    "/templates",
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

  router.post(
    "/templates/bulk",
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

  router.patch(
    "/templates/:id",
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

  router.delete(
    "/templates/:id",
    authenticateToken,
    asyncHandler(async (req, res) => {
      const templateId = String(req.params.id || "");
      const existing = await db.queryOne(
        "SELECT id FROM device_analysis_templates WHERE id = ? AND userId = ?",
        [templateId, req.user.id],
      );
      if (!existing) return res.sendStatus(404);

      await db.execute("DELETE FROM device_analysis_templates WHERE id = ? AND userId = ?", [
        templateId,
        req.user.id,
      ]);
      res.json({ success: true });
    }),
  );

  router.get(
    "/settings",
    authenticateToken,
    asyncHandler(async (req, res) => {
      const row = await db.queryOne(
        "SELECT yUnit, ssMethodDefault, ssDiagnosticsEnabled, ssIdLow, ssIdHigh, lastTemplateId, stopOnErrorDefault, updatedAt FROM device_analysis_settings WHERE userId = ?",
        [req.user.id],
      );

      res.json({
        yUnit: row?.yUnit === "A" || row?.yUnit === "uA" || row?.yUnit === "nA" ? row.yUnit : "A",
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

  router.patch(
    "/settings",
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
          patch.ssDiagnosticsEnabled == null ? ssDiagExisting : Boolean(patch.ssDiagnosticsEnabled),
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

  return router;
}

