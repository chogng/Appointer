import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileDown,
  FileJson,
  Languages,
  Link as LinkIcon,
  Loader2,
  Plus,
  Search,
  Trash2,
  Leaf,
  FlaskConical,
  ListChecks,
  ListX,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { apiService } from "../services/apiService";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../hooks/useLanguage";
import { useLiteratureResearchSession } from "../hooks/useLiteratureResearchSession";

import ToggleButton from "../components/ui/ToggleButton";
import Toast from "../components/ui/Toast";
import DatePicker from "../components/ui/DatePicker";

const NATURE_EXAMPLES = [
  "https://www.nature.com/nature/research-articles",
  "https://www.nature.com/news",
];

const SCIENCE_EXAMPLES = [
  "https://www.science.org/journal/sciadv",
  "https://www.science.org/",
];

const LITERATURE_SESSION_STATE_VERSION = 1;

const pruneTranslationsForSession = (value) => {
  if (!value || typeof value !== "object") return {};
  const next = {};
  for (const [id, entry] of Object.entries(value)) {
    if (!id) continue;
    if (!entry || typeof entry !== "object") continue;
    if (entry.state !== "done") continue;
    const text = typeof entry.text === "string" ? entry.text.trim() : "";
    if (!text) continue;
    const targetLang =
      typeof entry.targetLang === "string" && entry.targetLang
        ? entry.targetLang
        : "zh";
    next[id] = {
      state: "done",
      text,
      error: "",
      showOriginal: Boolean(entry.showOriginal),
      targetLang,
    };
  }
  return next;
};

const getLiteratureItemId = (item) =>
  String(item?.id || item?.articleUrl || item?.title || "").trim();

const LiteratureResearch = () => {
  const containerRef = useRef(null);
  const { user } = useAuth();
  const { t } = useLanguage();
  const literatureSession = useLiteratureResearchSession();

  const today = format(new Date(), "yyyy-MM-dd");
  const defaultStart = format(subDays(new Date(), 7), "yyyy-MM-dd");

  const [seedUrls, setSeedUrls] = useState([""]);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [maxResults, setMaxResults] = useState(100);

  const [sourceType, setSourceType] = useState("nature"); // "nature" | "science"

  const [settingsReady, setSettingsReady] = useState(false);
  const lastSavedSettingsJsonRef = useRef("");
  const [_settingsSync, setSettingsSync] = useState({
    state: "idle", // idle | saving | saved | error
    message: "",
  });

  const [status, setStatus] = useState({
    state: "idle", // idle | loading | error | done
    message: "",
  });
  const [results, setResults] = useState([]);

  const [selectedIds, setSelectedIds] = useState([]);

  const [hasTranslationApiKey, setHasTranslationApiKey] = useState(false);


  const [translations, setTranslations] = useState({});
  const translateInFlightRef = useRef(false);
  const isAnyTranslationInFlight = useMemo(
    () => Object.values(translations).some((v) => v?.state === "loading"),
    [translations],
  );

  const [docxExport, setDocxExport] = useState({
    state: "idle", // idle | translating | building
    current: 0,
    total: 0,
  });
  const isExportingDocx = docxExport.state !== "idle";
  const exportDocxLabel = useMemo(() => {
    if (docxExport.state === "translating") {
      return `${t("literature_export_docx_translating")} (${docxExport.current}/${docxExport.total})`;
    }
    if (docxExport.state === "building") {
      return t("literature_export_docx_building");
    }
    return t("literature_export_docx");
  }, [docxExport, t]);

  const [keywordInput, setKeywordInput] = useState("");
  const [keywordMode, setKeywordMode] = useState("any"); // any | all
  const [resultView, setResultView] = useState("all"); // all | matched | unmatched

  const [toast, setToast] = useState({
    isVisible: false,
    message: "",
    type: "success", // success | error | info
  });

  const handleClearPageSession = () => {
    setStatus({ state: "idle", message: "" });
    setResults([]);
    setSelectedIds([]);
    setKeywordInput("");
    setKeywordMode("any");
    setResultView("all");
    setDocxExport({ state: "idle", current: 0, total: 0 });
    setTranslations({});

    setToast({
      isVisible: true,
      message: t("literature_session_cleared") || "Session cleared.",
      type: "success",
    });
  };

  const hasRestoredSessionRef = useRef(false);
  const isRestoringSessionRef = useRef(false);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId) return;
    if (!literatureSession?.getSession) return;

    const parsed = literatureSession.getSession(userId);
    if (!parsed || parsed?.v !== LITERATURE_SESSION_STATE_VERSION) return;

    hasRestoredSessionRef.current = true;
    isRestoringSessionRef.current = true;

    const restoredSeedUrls = Array.isArray(parsed?.seedUrls)
      ? parsed.seedUrls
      : null;

    const restoredStartDate = typeof parsed?.startDate === "string"
      ? parsed.startDate
      : null;
    const restoredEndDate = typeof parsed?.endDate === "string"
      ? parsed.endDate
      : null;

    const restoredMaxResults =
      typeof parsed?.maxResults === "number" && Number.isFinite(parsed.maxResults)
        ? Math.max(1, Math.min(100, Math.trunc(parsed.maxResults)))
        : null;

    if (restoredSeedUrls && restoredSeedUrls.length > 0) {
      setSeedUrls(restoredSeedUrls);
    }
    if (restoredStartDate) setStartDate(restoredStartDate);
    if (restoredEndDate) setEndDate(restoredEndDate);
    if (restoredMaxResults) setMaxResults(restoredMaxResults);

    if (parsed?.sourceType === "science") setSourceType("science");
    else if (parsed?.sourceType === "nature") setSourceType("nature");

    if (typeof parsed?.keywordInput === "string") setKeywordInput(parsed.keywordInput);
    if (parsed?.keywordMode === "all") setKeywordMode("all");
    else if (parsed?.keywordMode === "any") setKeywordMode("any");
    if (parsed?.resultView === "matched") setResultView("matched");
    else if (parsed?.resultView === "unmatched") setResultView("unmatched");
    else if (parsed?.resultView === "all") setResultView("all");

    if (Array.isArray(parsed?.results)) setResults(parsed.results);
    if (parsed?.status?.state) {
      setStatus({
        state: parsed.status.state,
        message: typeof parsed.status.message === "string" ? parsed.status.message : "",
      });
    } else if (Array.isArray(parsed?.results) && parsed.results.length > 0) {
      setStatus({ state: "done", message: "" });
    }

    const restoredTranslations = pruneTranslationsForSession(parsed?.translations);
    if (Object.keys(restoredTranslations).length > 0) {
      setTranslations(restoredTranslations);
    }

    if (Array.isArray(parsed?.selectedIds)) {
      const cleaned = parsed.selectedIds
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean);
      setSelectedIds([...new Set(cleaned)]);
    }

    if (restoredSeedUrls || restoredMaxResults) {
      const seedUrlsForSettings = (restoredSeedUrls ?? [])
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean);
      lastSavedSettingsJsonRef.current = JSON.stringify({
        seedUrls: seedUrlsForSettings,
        maxResults: restoredMaxResults ?? maxResults,
      });
    }

    setSettingsReady(true);
    queueMicrotask(() => {
      isRestoringSessionRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [literatureSession, maxResults, user?.id]);

  const sanitizedSeedUrls = useMemo(
    () =>
      seedUrls
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter(Boolean),
    [seedUrls],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!user?.id) return;
      try {
        const data = await apiService.getLiteratureSettings();
        if (cancelled) return;

        const savedSeedUrls = Array.isArray(data?.seedUrls)
          ? data.seedUrls
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter(Boolean)
          : [];

        const resolvedSeedUrls = savedSeedUrls.length ? savedSeedUrls : [""];
        const resolvedStartDate =
          typeof data?.startDate === "string" && data.startDate
            ? data.startDate
            : defaultStart;
        const resolvedEndDate =
          typeof data?.endDate === "string" && data.endDate ? data.endDate : today;
        const resolvedMaxResults =
          typeof data?.maxResults === "number" && Number.isFinite(data.maxResults)
            ? Math.max(1, Math.min(100, Math.trunc(data.maxResults)))
            : 100;

        if (!hasRestoredSessionRef.current) {
          setSeedUrls(resolvedSeedUrls);
          setStartDate(resolvedStartDate);
          setEndDate(resolvedEndDate);
          setMaxResults(resolvedMaxResults);

          // Detect source type from first URL
          const firstUrl = resolvedSeedUrls[0] || "";
          if (firstUrl.includes("science.org")) {
            setSourceType("science");
          } else {
            setSourceType("nature");
          }
        }

        if (!lastSavedSettingsJsonRef.current) {
          lastSavedSettingsJsonRef.current = JSON.stringify({
            seedUrls: resolvedSeedUrls
              .map((value) => (typeof value === "string" ? value.trim() : ""))
              .filter(Boolean),
            maxResults: resolvedMaxResults,
          });
        }

        setHasTranslationApiKey(Boolean(data?.hasTranslationApiKey));
      } catch (error) {
        if (!cancelled) {
          setSettingsSync({
            state: "error",
            message: error?.message || String(error),
          });
        }
      } finally {
        if (!cancelled) setSettingsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [defaultStart, today, user?.id]);

  useEffect(() => {
    if (!settingsReady) return;

    const payload = {
      seedUrls: sanitizedSeedUrls,
      maxResults,
    };

    const json = JSON.stringify(payload);
    if (json === lastSavedSettingsJsonRef.current) return;

    setSettingsSync({ state: "saving", message: "" });
    const timer = setTimeout(async () => {
      try {
        await apiService.updateLiteratureSettings(payload);
        lastSavedSettingsJsonRef.current = json;
        setSettingsSync({ state: "saved", message: "" });
        setToast({
          isVisible: true,
          message: t("literature_settings_saved") || "设置已同步",
          type: "success",
        });
      } catch (error) {
        setSettingsSync({
          state: "error",
          message: error?.message || String(error),
        });
        setToast({
          isVisible: true,
          message:
            (t("literature_settings_save_failed") || "璁剧疆鍚屾澶辫触") +
            (error?.message ? `锛?{error.message}` : ""),
          type: "error",
        });
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [settingsReady, sanitizedSeedUrls, maxResults, t]);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId) return;
    if (isRestoringSessionRef.current) return;
    if (!literatureSession?.setSession) return;

    const snapshot = {
      v: LITERATURE_SESSION_STATE_VERSION,
      savedAt: Date.now(),
      seedUrls,
      startDate,
      endDate,
      maxResults,
      sourceType,
      keywordInput,
      keywordMode,
      resultView,
      status,
      results,
      selectedIds,
      translations: pruneTranslationsForSession(translations),
    };

    literatureSession.setSession(userId, snapshot);
  }, [
    endDate,
    keywordInput,
    keywordMode,
    maxResults,
    resultView,
    results,
    selectedIds,
    seedUrls,
    sourceType,
    startDate,
    status,
    translations,
    literatureSession,
    user?.id,
  ]);

  const sortedResults = useMemo(() => {
    const list = Array.isArray(results) ? results : [];
    return [...list].sort((a, b) => {
      const da = a?.publishedDate || "";
      const db = b?.publishedDate || "";
      if (da === db) return String(a?.title || "").localeCompare(b?.title || "");
      if (!da) return 1;
      if (!db) return -1;
      return db.localeCompare(da);
    });
  }, [results]);

  const keywords = useMemo(() => {
    const raw = String(keywordInput || "").trim();
    if (!raw) return [];

    const tokens = raw
      .split(/[\n,;锛岋紱]+/g)
      .flatMap((chunk) => chunk.split(/\s+/g))
      .map((token) => token.trim())
      .filter(Boolean);

    const unique = [];
    const seen = new Set();
    for (const token of tokens) {
      const lower = token.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      unique.push(token);
    }
    return unique.slice(0, 20);
  }, [keywordInput]);

  const isItemMatched = useMemo(() => {
    if (keywords.length === 0) return () => true;

    const lowered = keywords.map((k) => k.toLowerCase());
    return (item) => {
      const haystack = [
        item?.title,
        item?.abstract,
        item?.doi,
        item?.articleUrl,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack) return false;
      if (keywordMode === "all") {
        return lowered.every((k) => haystack.includes(k));
      }
      return lowered.some((k) => haystack.includes(k));
    };
  }, [keywords, keywordMode]);

  const { matchedResults, unmatchedResults } = useMemo(() => {
    const matched = [];
    const unmatched = [];
    for (const item of sortedResults) {
      if (isItemMatched(item)) matched.push(item);
      else unmatched.push(item);
    }
    return { matchedResults: matched, unmatchedResults: unmatched };
  }, [sortedResults, isItemMatched]);

  const visibleResults = useMemo(() => {
    if (resultView === "matched") return matchedResults;
    if (resultView === "unmatched") return unmatchedResults;
    return sortedResults;
  }, [resultView, matchedResults, unmatchedResults, sortedResults]);

  const renderResultCards = (results) => (
    <div className="space-y-4">
      {results.map((item) => {
        const id = getLiteratureItemId(item);
        const translation = id ? translations[id] : null;
        const isTranslated = translation?.state === "done";
        const isTranslating = translation?.state === "loading";
        const showOriginal = Boolean(translation?.showOriginal);
        const translatedTargetLang =
          typeof translation?.targetLang === "string" && translation.targetLang
            ? translation.targetLang
            : null;
        const hasAbstract = typeof item?.abstract === "string" && item.abstract.trim();
        const canTranslate =
          Boolean(hasAbstract) &&
          !isTranslating &&
          (isTranslated || (hasTranslationApiKey && !isAnyTranslationInFlight));

        const abstractText =
          isTranslated && !showOriginal ? translation.text : item?.abstract;

        const isSelected = Boolean(id) && selectedIds.includes(id);

        let translateTitle = t("literature_translate") || "Translate abstract";
        if (!hasAbstract) {
          translateTitle = t("literature_no_abstract") || "No abstract";
        } else if (isTranslated) {
          translateTitle = showOriginal
            ? t("literature_show_translation") || "Show translation"
            : t("literature_show_original") || "Show original abstract";
        } else if (isAnyTranslationInFlight) {
          translateTitle =
            t("literature_translate_wait") ||
            "Another translation is in progress. Please wait.";
        } else if (!hasTranslationApiKey) {
          translateTitle = t("personal_api_key_required") || "Set API Key to translate.";
        }

        return (
          <article
            key={item?.id || item?.articleUrl || item?.title}
            onClick={() => toggleSelectedId(id)}
            className={`border rounded-2xl p-5 shadow-sm cursor-pointer transition-all duration-200 ${isSelected
              ? "border-black bg-black/5"
              : "border-border bg-bg-surface hover:shadow-md"
              }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 w-full">
                <div className="min-w-0 w-full">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Checkbox removed, entire card is clickable */}
                    <a
                      href={item?.articleUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-text-primary font-semibold hover:text-accent transition-colors truncate max-w-full"
                      title={item?.title}
                    >
                      {item?.title || item?.articleUrl}
                    </a>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTranslate(item);
                      }}
                      disabled={!canTranslate}
                      className={`p-2 rounded-xl border transition-colors ${canTranslate
                        ? "border-border text-text-secondary hover:text-text-primary hover:bg-bg-200"
                        : "border-border text-text-tertiary opacity-40 cursor-not-allowed"
                        }`}
                      title={translateTitle}
                    >
                      {isTranslating ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Languages size={16} />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(item?.downloadUrl);
                      }}
                      disabled={!item?.downloadable || !item?.downloadUrl}
                      className={`p-2 rounded-xl border transition-colors ${item?.downloadable && item?.downloadUrl
                        ? "border-border text-text-secondary hover:text-text-primary hover:bg-bg-200"
                        : "border-border text-text-tertiary opacity-40 cursor-not-allowed"
                        }`}
                      title={
                        item?.downloadable
                          ? t("literature_download") || "涓嬭浇"
                          : t("literature_download_unavailable") || "鏃犲彲涓嬭浇鏂囦欢"
                      }
                    >
                      <Download size={16} />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-xs text-text-tertiary">
                    <span className="inline-flex items-center gap-1 px-0 py-0.5 rounded-md text-text-secondary">
                      {item?.sourceContext ? (
                        <span className="truncate max-w-[300px]" title={item.sourceContext}>
                          {item.sourceContext
                            .split(/脙鈥毭偮穦脗路/g)
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .join(" > ")}
                        </span>
                      ) : (
                        <span className="tracking-wide">
                          {item?.source
                            ? item.source.charAt(0).toUpperCase() +
                            item.source.slice(1).toLowerCase()
                            : "-"}
                        </span>
                      )}
                    </span>
                    <span>{item?.publishedDate || "-"}</span>
                    {item?.doi && (
                      <span className="flex items-center gap-2">
                        <span className="text-text-tertiary/50">&gt;</span>
                        <span className="truncate">DOI: {item.doi}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {isTranslated && !showOriginal && (
                <div className="mb-2 text-xs text-text-tertiary">
                  {translatedTargetLang === "zh"
                    ? t("literature_translation_label_zh") || "Chinese translation"
                    : t("literature_translation_label_en") || "English translation"}
                </div>
              )}
              {abstractText || (t("literature_no_abstract") || "（该条目暂无摘要）")}
            </div>
          </article>
        );
      })}
    </div>
  );

  const selectedItems = useMemo(() => {
    if (!Array.isArray(selectedIds) || selectedIds.length === 0) return [];
    const idSet = new Set(selectedIds);
    return sortedResults.filter((item) => {
      const id = getLiteratureItemId(item);
      return id && idSet.has(id);
    });
  }, [selectedIds, sortedResults]);

  const selectedCount = selectedItems.length;

  const toggleSelectedId = (id) => {
    const resolved = typeof id === "string" ? id.trim() : "";
    if (!resolved) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(resolved)) next.delete(resolved);
      else next.add(resolved);
      return [...next];
    });
  };

  const handleSelectAllVisible = () => {
    const ids = visibleResults.map(getLiteratureItemId).filter(Boolean);
    if (ids.length === 0) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));

      if (allSelected) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return [...next];
    });
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const setSeedUrlAt = (index, value) => {
    setSeedUrls((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const removeSeedUrlAt = (index) => {
    setSeedUrls((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [""];
    });
  };

  const addSeedUrl = () => {
    setSeedUrls((prev) => [...prev, ""]);
  };



  const handleTranslate = async (item) => {
    const id = getLiteratureItemId(item);
    const abstract = typeof item?.abstract === "string" ? item.abstract.trim() : "";
    if (!id || !abstract) return;

    const targetLang = "zh";
    const existing = translations[id];
    if (existing?.state === "loading") return;

    if (existing?.state === "done") {
      setTranslations((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          showOriginal: !prev[id]?.showOriginal,
        },
      }));
      return;
    }

    if (!hasTranslationApiKey) {
      setToast({
        isVisible: true,
        message:
          t("personal_api_key_required") ||
          "Please enter your API Key.",
        type: "error",
      });
      return;
    }

    if (translateInFlightRef.current) return;
    translateInFlightRef.current = true;
    setTranslations((prev) => ({
      ...prev,
      [id]: { state: "loading", text: "", error: "", showOriginal: false },
    }));

    try {
      const data = await apiService.translateLiteratureAbstract({
        id,
        text: abstract,
        targetLang,
      });
      const translatedText =
        typeof data?.translatedText === "string" ? data.translatedText.trim() : "";
      if (!translatedText) {
        throw new Error("Translation returned empty text");
      }

      setTranslations((prev) => ({
        ...prev,
        [id]: {
          state: "done",
          text: translatedText,
          error: "",
          showOriginal: false,
          targetLang: data?.targetLang || targetLang,
        },
      }));
    } catch (error) {
      setTranslations((prev) => ({
        ...prev,
        [id]: {
          state: "error",
          text: "",
          error: error?.message || String(error),
          showOriginal: true,
          targetLang,
        },
      }));
      setToast({
        isVisible: true,
        message:
          (t("literature_translate_failed") || "Translation failed.") +
          (error?.message ? ` (${error.message})` : ""),
        type: "error",
      });
    } finally {
      translateInFlightRef.current = false;
    }
  };


  const handleSourceChange = (newSource) => {
    setSourceType(newSource);
    // Optionally reset seed URLs if they look like they belong to the other source
    setSeedUrls((prev) => {
      const isCurrentlyScience = prev.some((u) => u.includes("science.org"));
      const isCurrentlyNature = prev.some((u) => u.includes("nature.com"));

      if (newSource === "science" && isCurrentlyNature) {
        return ["https://www.science.org/journal/sciadv"];
      }
      if (newSource === "nature" && isCurrentlyScience) {
        return ["https://www.nature.com/nature/research-articles"];
      }
      return prev;
    });
  };

  const handleSearch = async () => {
    if (sanitizedSeedUrls.length === 0) {
      setStatus({
        state: "error",
        message:
          t("literature_seed_urls_required") ||
          "请先填写至少一个入口链接。",
      });
      return;
    }

    setStatus({ state: "loading", message: "" });
    setResults([]);
    setSelectedIds([]);
    try {
      const payload = {
        seedUrls: sanitizedSeedUrls,
        startDate,
        endDate,
        maxResults,
      };
      const data = await apiService.searchLiterature(payload);
      setResults(Array.isArray(data) ? data : []);
      setResultView("all");
      setStatus({ state: "done", message: "" });
    } catch (err) {
      setStatus({
        state: "error",
        message: err?.message || String(err),
      });
    }
  };

  const handleDownload = (downloadUrl) => {
    if (!downloadUrl) return;
    let isSameOrigin = false;
    try {
      const resolved = new URL(downloadUrl, window.location.href);
      isSameOrigin = resolved.origin === window.location.origin;
    } catch {
      isSameOrigin = false;
    }
    const a = document.createElement("a");
    a.href = downloadUrl;
    if (isSameOrigin) {
      a.download = "";
    } else {
      a.target = "_blank";
      a.rel = "noreferrer";
    }
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleExportDocx = async () => {
    if (isExportingDocx) return;

    const exportItems = Array.isArray(selectedItems) ? selectedItems : [];
    if (exportItems.length === 0) return;

    if (!hasTranslationApiKey) {
      setToast({
        isVisible: true,
        message:
          t("personal_api_key_required") || "Please enter your API Key.",
        type: "error",
      });
      return;
    }

    const normalizeDocText = (value) =>
      String(value || "")
        .replace(/\s+/g, " ")
        .trim();

    const safeFilePart = (value) =>
      String(value || "")
        .replace(/[\\/:*?"<>|]+/g, "_")
        .replace(/\s+/g, " ")
        .trim() || "literature";

    const resolvedDocTitle = (() => {
      const journalTitles = exportItems
        .map((i) => (typeof i?.journalTitle === "string" ? i.journalTitle.trim() : ""))
        .filter(Boolean);
      const unique = [...new Set(journalTitles)];
      if (unique.length === 1) return unique[0];
      if (sourceType === "nature") return "Nature";
      if (sourceType === "science") return "Science";
      return "Literature";
    })();

    const prevTranslateLock = translateInFlightRef.current;
    translateInFlightRef.current = true;
    setDocxExport({ state: "translating", current: 0, total: exportItems.length });

    try {
      const lines = [];
      for (let index = 0; index < exportItems.length; index += 1) {
        const item = exportItems[index];
        const id = String(item?.id || item?.articleUrl || item?.title || "").trim();
        const title = normalizeDocText(item?.title || item?.articleUrl || `Item ${index + 1}`);
        const abstractEn =
          typeof item?.abstract === "string" ? item.abstract.trim() : "";

        let abstractZh = "";
        if (id && abstractEn) {
          const existing = translations[id];
          if (
            existing?.state === "done" &&
            String(existing?.targetLang || "").toLowerCase().startsWith("zh") &&
            typeof existing?.text === "string" &&
            existing.text.trim()
          ) {
            abstractZh = normalizeDocText(existing.text);
          } else {
            setTranslations((prev) => ({
              ...prev,
              [id]: { state: "loading", text: "", error: "", showOriginal: false, targetLang: "zh" },
            }));
            try {
              const data = await apiService.translateLiteratureAbstract({
                id,
                text: abstractEn,
                targetLang: "zh",
              });
              const translatedText =
                typeof data?.translatedText === "string" ? data.translatedText.trim() : "";
              abstractZh = normalizeDocText(translatedText);
              if (!abstractZh) {
                throw new Error("Translation returned empty text");
              }
              setTranslations((prev) => ({
                ...prev,
                [id]: {
                  state: "done",
                  text: abstractZh,
                  error: "",
                  showOriginal: false,
                  targetLang: "zh",
                },
              }));
            } catch (error) {
              setTranslations((prev) => ({
                ...prev,
                [id]: {
                  state: "error",
                  text: "",
                  error: error?.message || String(error),
                  showOriginal: true,
                  targetLang: "zh",
                },
              }));
              throw new Error(
                `Translation failed for "${title}": ${error?.message || String(error)}`,
              );
            }
          }
        }

        lines.push({
          index: index + 1,
          title,
          abstractZh: abstractZh || "",
          hasAbstract: Boolean(abstractEn),
        });
        setDocxExport({ state: "translating", current: index + 1, total: exportItems.length });
      }

      setDocxExport((prev) => ({ ...prev, state: "building" }));

      const { Document, Packer, Paragraph, TextRun, AlignmentType, LineRuleType } =
        await import("docx");

      const spacing = {
        before: 0,
        after: 0,
        line: 360,
        lineRule: LineRuleType.AUTO,
      };

      const fontTimes = {
        ascii: "Times New Roman",
        hAnsi: "Times New Roman",
        cs: "Times New Roman",
        eastAsia: "Times New Roman",
      };

      const fontSong = {
        ascii: "瀹嬩綋",
        hAnsi: "瀹嬩綋",
        cs: "瀹嬩綋",
        eastAsia: "瀹嬩綋",
      };

      const children = [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing,
          children: [
            new TextRun({
              text: resolvedDocTitle,
              bold: true,
              italics: true,
              font: fontTimes,
              size: 28,
              color: "4472C4",
            }),
          ],
        }),
      ];

      for (const entry of lines) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing,
            children: [
              new TextRun({
                text: `${entry.index}. ${entry.title}`,
                font: fontTimes,
                size: 24,
              }),
            ],
          }),
        );

        if (entry.hasAbstract) {
          children.push(
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing,
              children: [
                new TextRun({
                  text:
                    entry.abstractZh ||
                    (t("literature_no_abstract") || "(No abstract available)"),
                  font: fontSong,
                  size: 24,
                }),
              ],
            }),
          );
        }
      }

      const doc = new Document({
        sections: [
          {
            children,
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const fileName = `${safeFilePart(resolvedDocTitle)}_${safeFilePart(startDate)}-${safeFilePart(endDate)}.docx`;
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        URL.revokeObjectURL(url);
      }

      setToast({
        isVisible: true,
        message: t("literature_export_docx_success") || "DOCX exported.",
        type: "success",
      });
    } catch (error) {
      setToast({
        isVisible: true,
        message:
          (t("literature_export_docx_failed") || "Export failed.") +
          (error?.message ? ` (${error.message})` : ""),
        type: "error",
      });
    } finally {
      translateInFlightRef.current = prevTranslateLock;
      setDocxExport({ state: "idle", current: 0, total: 0 });
    }
  };

  const handleExportJson = () => {
    const exportItems = Array.isArray(selectedItems) ? selectedItems : [];
    if (exportItems.length === 0) return;

    const normalizeDoi = (raw) => {
      if (typeof raw !== "string") return "";
      let doi = raw.trim();
      if (!doi) return "";
      doi = doi.replace(/^doi:\s*/i, "");
      doi = doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
      doi = doi.replace(/[\s).,;]+$/g, "");
      doi = doi.trim();
      return doi ? doi.toLowerCase() : "";
    };

    const missingDoiCount = exportItems.reduce((acc, item) => {
      return normalizeDoi(item?.doi) ? acc : acc + 1;
    }, 0);

    if (missingDoiCount > 0) {
      setToast({
        isVisible: true,
        message:
          (t("literature_export_json_missing_doi") ||
            "JSON export blocked: some selected items are missing DOI.") +
          ` (${missingDoiCount})`,
        type: "error",
      });
      return;
    }

    const seen = new Set();
    const items = [];

    for (const item of exportItems) {
      const doi = normalizeDoi(item?.doi);
      if (!doi) continue;
      if (seen.has(doi)) continue;
      seen.add(doi);

      const title = String(item?.title || item?.articleUrl || item?.id || doi).trim();
      if (!title) continue;

      const entry = { doi, title };

      const source = typeof item?.source === "string" ? item.source.trim() : "";
      if (source) entry.source = source;

      const articleUrl =
        typeof item?.articleUrl === "string" ? item.articleUrl.trim() : "";
      if (articleUrl) entry.articleUrl = articleUrl;

      const publishedDate =
        typeof item?.publishedDate === "string" ? item.publishedDate.trim() : "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(publishedDate)) {
        entry.publishedDate = publishedDate;
      }

      items.push(entry);
    }

    const payload = {
      version: 1,
      generatedAt: new Date().toISOString(),
      items,
    };

    const jsonText = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = "literature_map.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(url);
    }

    setToast({
      isVisible: true,
      message: t("literature_export_json_success") || "JSON exported.",
      type: "success",
    });
  };


  return (
    <div
      className="w-full min-h-screen relative"
      ref={containerRef}
    >
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-medium text-text-primary mb-2">
          {t("literature_research_title") || "鏂囩尞璋冪爺"}
        </h1>
        <p className="text-text-secondary">
          {t("literature_research_subtitle") ||
            "输入需要抓取的栏目/入口链接，按日期范围筛选文章并提取摘要。"}
        </p>
      </div>

      <section className="bg-bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <div className="ui-toolbar_warp">
            <div>

            <ToggleButton
              value={sourceType}
              onChange={handleSourceChange}
              options={[
                { value: "nature", label: "Nature", icon: Leaf },
                { value: "science", label: "Science", icon: FlaskConical },
              ]}
            />
          </div>

          <div className="ui-filter_warp" aria-label="date filter warp">
            <div className="date_btn_warp">
              <label className="date_btn_label">
                {t("literature_start_date") || "开始日期"}
              </label>
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                placeholder={t("literature_start_date") || "开始日期"}
                cta="Literature research"
                ctaPosition="date filter warp"
                ctaCopy="start date"
                className="min-w-0 flex-1"
                textClassName="hidden sm:block"
                aria-label="start date"
              />
            </div>
            <div className="date_btn_warp">
              <label className="date_btn_label">
                {t("literature_end_date") || "鎴鏃ユ湡"}
              </label>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                placeholder={t("literature_end_date") || "鎴鏃ユ湡"}
                className="min-w-0 flex-1"
                textClassName="hidden sm:block"
                aria-label="end date"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm font-medium text-text-secondary whitespace-nowrap">
                {t("literature_max_results") || "最大返回条数"}
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={maxResults}
                onChange={(e) =>
                  setMaxResults(
                    Math.max(1, Math.min(100, Math.trunc(Number(e.target.value) || 0))),
                  )
                }
                className="w-24 px-3 py-2 rounded-xl bg-bg-page border border-border-200 focus:outline-none focus:ring-1 focus:ring-black text-sm text-text-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="max results input"
              />
            </div>
          </div>

          <div className="ui-button_warp">
            <div className="ui-button_row">
              <button
                data-style="ghost"
                data-icon="with"
                data-cta="Literature research"
                data-cta-position="toolbar"
                data-cta-copy="add url"
                type="button"
                onClick={addSeedUrl}
                className="click_btn click_btn--md click_btn--fx click_btn--ghost"
                aria-label="add url"
              >
                <span className="click_btn_content">
                  <Plus size={16} />
                  {t("literature_add_url") || "添加链接"}
                </span>
              </button>

              <button
                data-style={status.state === "loading" ? "disabled" : "primary"}
                data-icon="with"
                data-cta="Literature research"
                data-cta-position="toolbar"
                data-cta-copy="fetch"
                type="button"
                onClick={handleSearch}
                disabled={status.state === "loading"}
                className={`click_btn click_btn--md click_btn--fx ${status.state === "loading"
                  ? "click_btn--disabled"
                  : "click_btn--primary"
                  }`}
                aria-label="fetch"
              >
                <span className="click_btn_content">
                  <Search size={16} />
                  {status.state === "loading"
                    ? t("literature_fetching") || "抓取中..."
                    : t("literature_fetch") || "开始抓取"}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-text-primary">
                {t("literature_seed_urls") || "文献种子链接"}
              </label>
            </div>

            <div className="mt-3 space-y-2">
              {seedUrls.map((value, index) => (
                <div
                  key={`${index}`}
                  className="flex items-center gap-2 group"
                >
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
                      <LinkIcon size={16} />
                    </span>
                    <input
                      value={value}
                      onChange={(e) => setSeedUrlAt(index, e.target.value)}
                      placeholder={
                        sourceType === "science"
                          ? "https://www.science.org"
                          : "https://www.nature.com"
                      }
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-bg-page border border-border-200 focus:outline-none focus:ring-1 focus:ring-black text-sm text-text-primary placeholder:text-text-tertiary"
                      aria-label="literature-seed-url-input"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSeedUrlAt(index)}
                    className="relative group h-[42px] w-[42px] flex items-center justify-center p-0 rounded-xl text-text-tertiary transition-colors hover:text-red-500 before:content-[''] before:absolute before:inset-0 before:rounded-xl before:border before:border-border before:bg-transparent before:pointer-events-none before:transition-transform before:transition-colors hover:before:scale-[1.02]"
                    title={t("literature_remove_url") || "绉婚櫎"}
                  >
                    <span className="relative z-10">
                      <Trash2 size={16} />
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {status.state === "error" && (
          <div className="mt-5 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-500">
            {status.message}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2
            className="text-lg font-semibold text-text-primary"
            aria-label="literature-keyword-matching-title"
          >
            {t("literature_keyword_matching") || "Keyword Matching"}
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleExportDocx}
              disabled={isExportingDocx || selectedCount === 0}
              className={`group relative inline-flex items-center justify-center px-4 h-[38px] rounded-xl text-sm transition-all before:content-[''] before:absolute before:inset-0 before:rounded-xl before:pointer-events-none before:transition-transform before:transition-colors ${isExportingDocx || selectedCount === 0
                ? "text-text-secondary cursor-not-allowed before:bg-bg-200 before:border before:border-border"
                : "text-text-secondary hover:text-text-primary before:bg-transparent before:border before:border-border hover:before:scale-[1.02]"
                }`}
              title={exportDocxLabel}
              aria-label="literature-export-docx-btn"
            >
              <span className="relative z-10 flex items-center gap-2">
                {isExportingDocx ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileDown size={16} />
                )}
                {exportDocxLabel}
                {!isExportingDocx && selectedCount > 0 ? ` (${selectedCount})` : ""}
              </span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              disabled={isExportingDocx || selectedCount === 0}
              className={`group relative inline-flex items-center justify-center px-4 h-[38px] rounded-xl text-sm transition-all before:content-[''] before:absolute before:inset-0 before:rounded-xl before:pointer-events-none before:transition-transform before:transition-colors ${isExportingDocx || selectedCount === 0
                ? "text-text-secondary cursor-not-allowed before:bg-bg-200 before:border before:border-border"
                : "text-text-secondary hover:text-text-primary before:bg-transparent before:border before:border-border hover:before:scale-[1.02]"
                }`}
              title={t("literature_export_json") || "Export JSON"}
              aria-label="literature-export-json-btn"
            >
              <span className="relative z-10 flex items-center gap-2">
                <FileJson size={16} />
                {(t("literature_export_json") || "Export JSON") +
                  (selectedCount > 0 ? ` (${selectedCount})` : "")}
              </span>
            </button>



            <button
              type="button"
              onClick={handleClearPageSession}
              disabled={
                isExportingDocx ||
                status.state === "loading" ||
                isAnyTranslationInFlight
              }
              className={`group relative inline-flex items-center justify-center px-4 h-[38px] rounded-xl text-sm transition-all before:content-[''] before:absolute before:inset-0 before:rounded-xl before:pointer-events-none before:transition-transform before:transition-colors ${isExportingDocx ||
                status.state === "loading" ||
                isAnyTranslationInFlight
                ? "text-text-secondary cursor-not-allowed before:bg-bg-200 before:border before:border-border"
                : "text-text-secondary hover:text-text-primary before:bg-transparent before:border before:border-border hover:before:scale-[1.02]"
                }`}
              title={t("literature_clear_session") || "Clear session"}
              aria-label="literature-clear-session-btn"
            >
              <span className="relative z-10 flex items-center gap-2">
                <Trash2 size={16} />
                {t("literature_clear_session") || "Clear session"}
              </span>
            </button>
          </div>
        </div>

        <div className="bg-bg-surface border border-border rounded-2xl p-4 mb-4">
          <div className="ui-toolbar_warp">
            <div className="flex items-center gap-2">
              <ToggleButton
                options={[
                  { value: "any", label: t("literature_match_any") || "浠绘剰鍖归厤" },
                  { value: "all", label: t("literature_match_all") || "鍏ㄩ儴鍖归厤" },
                ]}
                value={keywordMode}
                onChange={setKeywordMode}
                className="w-fit"
                groupLabel="literature-match-mode-segment"
              />


            </div>
          </div>

          <div className="mt-3">
            <textarea
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder={
                t("literature_keywords_placeholder") ||
                "例如：quantum, AI safety, microfluidics（用空格/换行/逗号分隔）"
              }
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-bg-page border border-border-200 focus:outline-none focus:ring-1 focus:ring-black text-sm text-text-primary placeholder:text-text-tertiary resize-y"
            />
            <div className="mt-2 text-xs text-text-tertiary">
              {(t("literature_keywords_count") || "当前关键词") + `：${keywords.length}`}
            </div>

          </div>
        </div>

        <h2
          className="text-lg font-semibold text-text-primary mb-4"
          aria-label="literature-results-title"
        >
          {t("literature_results_title") || "检索结果"}
        </h2>
        <div
          className="bg-bg-surface border border-border rounded-2xl p-6 shadow-sm min-h-[600px]"
          aria-label="literature-results-container"
        >
          <div className="ui-toolbar_wrap">
            <ToggleButton
              options={[
                {
                  value: "all",
                  label:
                    (t("literature_view_all") || "鍏ㄩ儴") +
                    ` (${sortedResults.length})`,
                  cta: "Literature research",
                  ctaPosition: "result",
                  ctaCopy: "all",
                },
                {
                  value: "matched",
                  label:
                    (t("literature_view_matched") || "匹配") +
                    ` (${matchedResults.length})`,
                  cta: "Literature research",
                  ctaPosition: "result",
                  ctaCopy: "matched",
                },
                {
                  value: "unmatched",
                  label:
                    (t("literature_view_unmatched") || "未匹配") +
                    ` (${unmatchedResults.length})`,
                  cta: "Literature research",
                  ctaPosition: "result",
                  ctaCopy: "unmatched",
                },
              ]}
              value={resultView}
              onChange={setResultView}
              className="w-fit"
              groupLabel="Literature results view"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                disabled={
                  isExportingDocx ||
                  status.state === "loading" ||
                  visibleResults.length === 0
                }
                className={`group relative inline-flex items-center justify-center px-4 h-[38px] rounded-xl text-sm transition-all before:content-[''] before:absolute before:inset-0 before:rounded-xl before:pointer-events-none before:transition-transform before:transition-colors ${isExportingDocx ||
                  status.state === "loading" ||
                  visibleResults.length === 0
                  ? "text-text-secondary cursor-not-allowed before:bg-bg-200 before:border before:border-border"
                  : "text-text-secondary hover:text-text-primary before:bg-transparent before:border before:border-border hover:before:scale-[1.02]"
                  }`}
                title={t("literature_select_all_filtered") || "Select all (filtered)"}
                aria-label="literature-select-all-btn"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <ListChecks size={16} />
                  {t("literature_select_all_filtered") || "Select all (filtered)"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleClearSelection}
                disabled={isExportingDocx || status.state === "loading" || selectedCount === 0}
                className={`group relative inline-flex items-center justify-center px-4 h-[38px] rounded-xl text-sm transition-all before:content-[''] before:absolute before:inset-0 before:rounded-xl before:pointer-events-none before:transition-transform before:transition-colors ${isExportingDocx ||
                  status.state === "loading" ||
                  selectedCount === 0
                  ? "text-text-secondary cursor-not-allowed before:bg-bg-200 before:border before:border-border"
                  : "text-text-secondary hover:text-text-primary before:bg-transparent before:border before:border-border hover:before:scale-[1.02]"
                  }`}
                title={t("literature_clear_selection") || "Clear selection"}
                aria-label="literature-clear-selection-btn"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <ListX size={16} />
                  {t("literature_clear_selection") || "Clear selection"}
                </span>
              </button>
            </div>
          </div>
          {status.state === "done" && sortedResults.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-text-secondary">
              <p className="text-lg font-medium">
                {t("literature_no_results") || "没有找到符合条件的文章。"}
              </p>
              <p className="text-sm mt-1">
                {t("literature_no_results_hint") || "尝试调整日期范围或入口链接。"}
              </p>
            </div>
          )}

          {renderResultCards(visibleResults)}
        </div>
      </section>

      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isVisible: false })}
        containerRef={containerRef}
        position="absolute"
        duration={3000}
      />
    </div>
  );
};

export default LiteratureResearch;
