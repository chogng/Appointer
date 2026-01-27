import { createHash } from "crypto";

import { BIGMODEL_TRANSLATION_MODEL } from "./literatureTranslationConfig.js";

const BIGMODEL_CHAT_COMPLETIONS_URL =
  "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";

export const LITERATURE_TRANSLATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const literatureTranslationCache = new Map();

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

export async function fetchWithTimeout(url, options = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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

export function cleanupLiteratureTranslationCache() {
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

export function makeLiteratureTranslationCacheKey({
  userId,
  id,
  text,
  model,
  targetLang,
  provider,
  baseUrl,
}) {
  const normalizedUserId = String(userId || "");
  const normalizedId = typeof id === "string" && id.trim() ? id.trim() : "";
  const normalizedText = typeof text === "string" ? text.trim() : "";
  const normalizedModel =
    typeof model === "string" && model.trim()
      ? model.trim()
      : BIGMODEL_TRANSLATION_MODEL;
  const normalizedProvider =
    typeof provider === "string" && provider.trim()
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

export async function translateWithBigModel(
  apiKey,
  text,
  targetLang = "zh",
  model = BIGMODEL_TRANSLATION_MODEL,
) {
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!key) throw new Error("BigModel API key is not configured");

  const inputText = typeof text === "string" ? text.trim() : "";
  if (!inputText) throw new Error("text is required");

  const normalizedTargetLang = String(targetLang || "").trim().toLowerCase();
  const target = normalizedTargetLang.startsWith("en") ? "en" : "zh";
  const resolvedModel =
    typeof model === "string" && model.trim()
      ? model.trim()
      : BIGMODEL_TRANSLATION_MODEL;

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
      const delayMs = Math.min(maxDelayMs, Math.max(exponential, retryAfterMs ?? 0));
      await sleep(delayMs);
    }
  }

  throw lastError || new Error("BigModel translation failed");
}

export async function translateWithOpenAI(apiKey, text, targetLang = "zh", model) {
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
      const delayMs = Math.min(maxDelayMs, Math.max(exponential, retryAfterMs ?? 0));
      await sleep(delayMs);
    }
  }

  throw lastError || new Error("OpenAI translation failed");
}

export async function translateWithOpenAICompatible(
  apiKey,
  text,
  targetLang = "zh",
  model,
  baseUrl,
) {
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
      const delayMs = Math.min(maxDelayMs, Math.max(exponential, retryAfterMs ?? 0));
      await sleep(delayMs);
    }
  }

  throw lastError || new Error("OpenAI-compatible translation failed");
}

