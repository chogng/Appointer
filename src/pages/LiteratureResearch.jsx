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
import Input from "../components/ui/Input";
import Card from "../components/ui/Card";

const NATURE_EXAMPLES = [
  "https://www.nature.com/nature/research-articles",
  "https://www.nature.com/news",
];

const SCIENCE_EXAMPLES = [
  "https://www.science.org/journal/sciadv",
  "https://www.science.org/",
];

const LITERATURE_SESSION_STATE_VERSION = 2;

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

const normalizeSeedUrlsList = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

const areStringArraysEqual = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((item, idx) => item === b[idx]);
};

const LiteratureResearch = () => {
  const containerRef = useRef(null);
  const { user } = useAuth();
  const { t } = useLanguage();
  const literatureSession = useLiteratureResearchSession();

  const today = format(new Date(), "yyyy-MM-dd");
  const defaultStart = format(subDays(new Date(), 7), "yyyy-MM-dd");

  const [seedUrlsBySourceType, setSeedUrlsBySourceType] = useState({
    nature: [""],
    science: [""],
  });

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [maxResults, setMaxResults] = useState("");

  const [sourceType, setSourceType] = useState("nature"); // "nature" | "science"

  const seedUrls = seedUrlsBySourceType[sourceType] || [""];

  const seedUrlsBySourceTypeRef = useRef(seedUrlsBySourceType);
  const sourceTypeRef = useRef(sourceType);
  const maxResultsRef = useRef(maxResults);

  useEffect(() => {
    seedUrlsBySourceTypeRef.current = seedUrlsBySourceType;
  }, [seedUrlsBySourceType]);

  useEffect(() => {
    sourceTypeRef.current = sourceType;
  }, [sourceType]);

  useEffect(() => {
    maxResultsRef.current = maxResults;
  }, [maxResults]);

  const committedSettingsRef = useRef({
    seedUrlsBySourceType: { nature: [], science: [] },
    maxResults: null,
  });

  const seedUrlsDirtyBySourceRef = useRef({
    nature: false,
    science: false,
  });
  const lastEditedSeedSourceRef = useRef(null);
  const maxResultsDirtyRef = useRef(false);
  const settingsSyncQueueRef = useRef(Promise.resolve());
  const settingsAutosaveTimerRef = useRef(null);
  const settingsFocusCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const userIdRef = useRef(user?.id ?? null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  const setSeedUrlsForSourceType = (nextSeedUrls) => {
    const resolvedNextSeedUrls =
      Array.isArray(nextSeedUrls) && nextSeedUrls.length ? nextSeedUrls : [""];

    seedUrlsDirtyBySourceRef.current[sourceType] = true;
    lastEditedSeedSourceRef.current = sourceType;

    seedUrlsBySourceTypeRef.current = {
      ...seedUrlsBySourceTypeRef.current,
      [sourceType]: resolvedNextSeedUrls,
    };
    setSeedUrlsBySourceType((prev) => ({
      ...prev,
      [sourceType]: resolvedNextSeedUrls,
    }));

    scheduleSettingsAutosave();
  };

  const handleMaxResultsInputChange = (nextValue) => {
    maxResultsDirtyRef.current = true;
    maxResultsRef.current = nextValue;
    setMaxResults(nextValue);
    scheduleSettingsAutosave();
  };

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
    [translations]
  );

  const [docxExport, setDocxExport] = useState({
    state: "idle", // idle | translating | building
    current: 0,
    total: 0,
  });
  const isExportingDocx = docxExport.state !== "idle";
  const exportDocxLabel = useMemo(() => {
    if (docxExport.state === "translating") {
      return `${t("literature_export_docx_translating")} (${docxExport.current
        }/${docxExport.total})`;
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
  const restoredUserIdRef = useRef(null);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId) return;
    if (!literatureSession?.getSession) return;
    if (restoredUserIdRef.current === userId) return;
    restoredUserIdRef.current = userId;
    hasRestoredSessionRef.current = false;
    isRestoringSessionRef.current = false;

    const parsed = literatureSession.getSession(userId);
    if (!parsed || parsed?.v !== LITERATURE_SESSION_STATE_VERSION) return;

    hasRestoredSessionRef.current = true;
    isRestoringSessionRef.current = true;

    const restoredSeedUrlsBySourceType =
      parsed?.seedUrlsBySourceType &&
        typeof parsed.seedUrlsBySourceType === "object"
        ? {
          nature: Array.isArray(parsed.seedUrlsBySourceType.nature)
            ? parsed.seedUrlsBySourceType.nature
            : [],
          science: Array.isArray(parsed.seedUrlsBySourceType.science)
            ? parsed.seedUrlsBySourceType.science
            : [],
        }
        : null;

    const restoredSeedUrls = Array.isArray(parsed?.seedUrls)
      ? parsed.seedUrls
      : null;

    const restoredStartDate =
      typeof parsed?.startDate === "string" ? parsed.startDate : null;
    const restoredEndDate =
      typeof parsed?.endDate === "string" ? parsed.endDate : null;

    const restoredMaxResults =
      typeof parsed?.maxResults === "string" ? parsed.maxResults : null;

    if (restoredSeedUrlsBySourceType) {
      setSeedUrlsBySourceType((prev) => ({
        ...prev,
        nature: restoredSeedUrlsBySourceType.nature.length
          ? restoredSeedUrlsBySourceType.nature
          : [""],
        science: restoredSeedUrlsBySourceType.science.length
          ? restoredSeedUrlsBySourceType.science
          : [""],
      }));
    } else if (restoredSeedUrls && restoredSeedUrls.length > 0) {
      setSeedUrlsBySourceType((prev) => ({
        ...prev,
        [parsed?.sourceType === "science" ? "science" : "nature"]:
          restoredSeedUrls.length ? restoredSeedUrls : [""],
      }));
    }
    if (restoredStartDate) setStartDate(restoredStartDate);
    if (restoredEndDate) setEndDate(restoredEndDate);
    if (typeof restoredMaxResults === "string")
      setMaxResults(restoredMaxResults);

    if (parsed?.sourceType === "science") setSourceType("science");
    else if (parsed?.sourceType === "nature") setSourceType("nature");

    if (typeof parsed?.keywordInput === "string")
      setKeywordInput(parsed.keywordInput);
    if (parsed?.keywordMode === "all") setKeywordMode("all");
    else if (parsed?.keywordMode === "any") setKeywordMode("any");
    if (parsed?.resultView === "matched") setResultView("matched");
    else if (parsed?.resultView === "unmatched") setResultView("unmatched");
    else if (parsed?.resultView === "all") setResultView("all");

    if (Array.isArray(parsed?.results)) setResults(parsed.results);
    if (parsed?.status?.state) {
      setStatus({
        state: parsed.status.state,
        message:
          typeof parsed.status.message === "string"
            ? parsed.status.message
            : "",
      });
    } else if (Array.isArray(parsed?.results) && parsed.results.length > 0) {
      setStatus({ state: "done", message: "" });
    }

    const restoredTranslations = pruneTranslationsForSession(
      parsed?.translations
    );
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
    queueMicrotask(() => {
      isRestoringSessionRef.current = false;
    });
  }, [literatureSession, user?.id]);

  const sanitizedSeedUrls = useMemo(
    () =>
      seedUrls
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter(Boolean),
    [seedUrls]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!user?.id) return;
      try {
        const data = await apiService.getLiteratureSettings();
        if (cancelled) return;

        const hasSeedUrlsBySourceType =
          data?.seedUrlsBySourceType &&
          typeof data.seedUrlsBySourceType === "object";

        const savedNatureSeedUrls = normalizeSeedUrlsList(
          data?.seedUrlsBySourceType?.nature
        );
        const savedScienceSeedUrls = normalizeSeedUrlsList(
          data?.seedUrlsBySourceType?.science
        );

        const legacySeedUrls = Array.isArray(data?.seedUrls)
          ? data.seedUrls
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter(Boolean)
          : [];

        const committedSeedUrlsBySourceType = hasSeedUrlsBySourceType
          ? { nature: savedNatureSeedUrls, science: savedScienceSeedUrls }
          : (() => {
            const split = { nature: [], science: [] };
            for (const url of legacySeedUrls) {
              if (String(url || "").includes("science.org"))
                split.science.push(url);
              else split.nature.push(url);
            }
            return split;
          })();

        const resolvedSeedUrlsBySourceType = {
          nature: committedSeedUrlsBySourceType.nature.length
            ? committedSeedUrlsBySourceType.nature
            : [""],
          science: committedSeedUrlsBySourceType.science.length
            ? committedSeedUrlsBySourceType.science
            : [""],
        };

        const resolvedStartDate =
          typeof data?.startDate === "string" && data.startDate
            ? data.startDate
            : defaultStart;
        const resolvedEndDate =
          typeof data?.endDate === "string" && data.endDate
            ? data.endDate
            : today;

        const resolvedMaxResults =
          typeof data?.maxResults === "number" &&
            Number.isFinite(data.maxResults)
            ? data.maxResults
            : null;

        const resolvedSourceType =
          data?.sourceType === "science" || data?.sourceType === "nature"
            ? data.sourceType
            : (() => {
              const hasScience =
                committedSeedUrlsBySourceType.science.length > 0;
              const hasNature =
                committedSeedUrlsBySourceType.nature.length > 0;
              if (hasScience && !hasNature) return "science";
              return "nature";
            })();

        committedSettingsRef.current = {
          seedUrlsBySourceType: committedSeedUrlsBySourceType,
          maxResults: resolvedMaxResults,
        };

        if (!hasRestoredSessionRef.current) {
          setSeedUrlsBySourceType((prev) => ({
            ...prev,
            nature: resolvedSeedUrlsBySourceType.nature,
            science: resolvedSeedUrlsBySourceType.science,
          }));
          setStartDate(resolvedStartDate);
          setEndDate(resolvedEndDate);
          setMaxResults(
            resolvedMaxResults == null ? "" : String(resolvedMaxResults)
          );
          setSourceType(resolvedSourceType);
        }

        setHasTranslationApiKey(Boolean(data?.hasTranslationApiKey));
      } catch {
        // best-effort only; search will still work with user-provided inputs
      } finally {
        // no-op
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [defaultStart, today, user?.id]);

  const enqueueSettingsSync = (job) => {
    const run = () => Promise.resolve().then(job);
    const next = settingsSyncQueueRef.current.then(run, run);
    settingsSyncQueueRef.current = next.catch(() => { });
    return next;
  };

  const cancelSettingsAutosave = () => {
    if (!settingsAutosaveTimerRef.current) return;
    clearTimeout(settingsAutosaveTimerRef.current);
    settingsAutosaveTimerRef.current = null;
  };

  const scheduleSettingsAutosave = () => {
    cancelSettingsAutosave();

    const seedSource = lastEditedSeedSourceRef.current;
    const hasSeedDirty =
      seedSource && Boolean(seedUrlsDirtyBySourceRef.current?.[seedSource]);
    const hasMaxDirty = Boolean(maxResultsDirtyRef.current);
    if (!hasSeedDirty && !hasMaxDirty) return;

    if (settingsFocusCountRef.current > 0) return;
    settingsAutosaveTimerRef.current = setTimeout(() => {
      const latestSeedSource = lastEditedSeedSourceRef.current;
      const seedUrlsToPersist =
        latestSeedSource && seedUrlsDirtyBySourceRef.current?.[latestSeedSource]
          ? normalizeSeedUrlsList(
            seedUrlsBySourceTypeRef.current?.[latestSeedSource]
          )
          : [];

      syncSettingsForFetch({
        seedSource: latestSeedSource,
        seedUrlsToPersist,
      }).catch(() => { });
    }, 1500);
  };

  const handleSettingsInputFocus = () => {
    settingsFocusCountRef.current += 1;
    cancelSettingsAutosave();
  };

  const handleSettingsInputBlur = () => {
    settingsFocusCountRef.current = Math.max(
      0,
      settingsFocusCountRef.current - 1
    );
    scheduleSettingsAutosave();
  };

  const syncSettingsForFetch = ({ seedSource, seedUrlsToPersist }) => {
    return enqueueSettingsSync(async () => {
      const updates = {};

      const shouldSyncSeedUrls =
        seedSource && Boolean(seedUrlsDirtyBySourceRef.current?.[seedSource]);
      if (shouldSyncSeedUrls) {
        const committedSeedUrls =
          committedSettingsRef.current.seedUrlsBySourceType?.[seedSource] || [];
        const nextSeedUrls = normalizeSeedUrlsList(seedUrlsToPersist);
        if (!areStringArraysEqual(nextSeedUrls, committedSeedUrls)) {
          updates.seedUrls = nextSeedUrls;
          updates.seedSource = seedSource;
        } else {
          seedUrlsDirtyBySourceRef.current[seedSource] = false;
        }
      }

      if (maxResultsDirtyRef.current) {
        const maxResultsTrimmed = String(maxResultsRef.current || "").trim();
        const nextMaxResults =
          maxResultsTrimmed === ""
            ? null
            : (() => {
              const parsed = Number(maxResultsTrimmed);
              if (!Number.isFinite(parsed)) {
                throw new Error(
                  t("literature_max_results_invalid") ||
                  "最大返回条数必须是数字。"
                );
              }
              return Math.max(1, Math.trunc(parsed));
            })();

        const committedMaxResults =
          committedSettingsRef.current.maxResults == null
            ? null
            : Number(committedSettingsRef.current.maxResults);

        if (
          (nextMaxResults == null && committedMaxResults != null) ||
          (nextMaxResults != null && committedMaxResults == null) ||
          (nextMaxResults != null &&
            committedMaxResults != null &&
            nextMaxResults !== committedMaxResults)
        ) {
          updates.maxResults = nextMaxResults;
        } else {
          maxResultsDirtyRef.current = false;
        }
      }

      if (Object.keys(updates).length === 0) {
        return;
      }

      const data = await apiService.updateLiteratureSettings(updates);
      const nextCommittedSeedUrlsBySourceType =
        data?.seedUrlsBySourceType &&
          typeof data.seedUrlsBySourceType === "object"
          ? {
            nature: normalizeSeedUrlsList(data.seedUrlsBySourceType.nature),
            science: normalizeSeedUrlsList(data.seedUrlsBySourceType.science),
          }
          : committedSettingsRef.current.seedUrlsBySourceType || {
            nature: [],
            science: [],
          };
      committedSettingsRef.current = {
        seedUrlsBySourceType: nextCommittedSeedUrlsBySourceType,
        maxResults:
          data?.maxResults == null
            ? null
            : Number.isFinite(Number(data.maxResults))
              ? Number(data.maxResults)
              : null,
      };

      if (
        seedSource &&
        Object.prototype.hasOwnProperty.call(updates, "seedUrls")
      ) {
        seedUrlsDirtyBySourceRef.current[seedSource] = false;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "maxResults")) {
        maxResultsDirtyRef.current = false;
      }

      if (isMountedRef.current) {
        setToast({
          isVisible: true,
          message: t("literature_settings_saved") || "设置已同步",
          type: "success",
        });
      }
    }).catch((error) => {
      if (isMountedRef.current) {
        setToast({
          isVisible: true,
          message:
            (t("literature_settings_save_failed") || "设置同步失败") +
            (error?.message ? ` (${error.message})` : ""),
          type: "error",
        });
      }
      throw error;
    });
  };

  useEffect(() => {
    return () => {
      cancelSettingsAutosave();

      const updates = {};

      const committedSeedUrlsBySourceType = committedSettingsRef.current
        .seedUrlsBySourceType || {
        nature: [],
        science: [],
      };

      const nextSeedUrlsBySourceType = {
        nature: normalizeSeedUrlsList(seedUrlsBySourceTypeRef.current?.nature),
        science: normalizeSeedUrlsList(
          seedUrlsBySourceTypeRef.current?.science
        ),
      };

      const dirtySources = ["nature", "science"].filter(
        (source) => seedUrlsDirtyBySourceRef.current?.[source]
      );

      const seedUrlsShouldUpdate = dirtySources.some((source) => {
        const committedList = committedSeedUrlsBySourceType[source] || [];
        const nextList = nextSeedUrlsBySourceType[source] || [];
        if (areStringArraysEqual(nextList, committedList)) {
          seedUrlsDirtyBySourceRef.current[source] = false;
          return false;
        }
        return true;
      });

      if (seedUrlsShouldUpdate) {
        updates.seedUrlsBySourceType = nextSeedUrlsBySourceType;
      }

      if (maxResultsDirtyRef.current) {
        const raw = String(maxResultsRef.current || "").trim();
        const parsed =
          raw === ""
            ? null
            : (() => {
              const n = Number(raw);
              if (!Number.isFinite(n)) return null;
              return Math.max(1, Math.trunc(n));
            })();

        const committedMaxResults =
          committedSettingsRef.current.maxResults == null
            ? null
            : Number(committedSettingsRef.current.maxResults);

        if (
          (parsed == null && committedMaxResults != null) ||
          (parsed != null && committedMaxResults == null) ||
          (parsed != null &&
            committedMaxResults != null &&
            parsed !== committedMaxResults)
        ) {
          updates.maxResults = parsed;
        } else {
          maxResultsDirtyRef.current = false;
        }
      }

      if (Object.keys(updates).length === 0) return;

      apiService
        .updateLiteratureSettings(updates)
        .then((data) => {
          const nextCommittedSeedUrlsBySourceType =
            data?.seedUrlsBySourceType &&
              typeof data.seedUrlsBySourceType === "object"
              ? {
                nature: normalizeSeedUrlsList(
                  data.seedUrlsBySourceType.nature
                ),
                science: normalizeSeedUrlsList(
                  data.seedUrlsBySourceType.science
                ),
              }
              : committedSettingsRef.current.seedUrlsBySourceType || {
                nature: [],
                science: [],
              };
          committedSettingsRef.current = {
            seedUrlsBySourceType: nextCommittedSeedUrlsBySourceType,
            maxResults:
              data?.maxResults == null
                ? null
                : Number.isFinite(Number(data.maxResults))
                  ? Number(data.maxResults)
                  : null,
          };
          if (
            Object.prototype.hasOwnProperty.call(
              updates,
              "seedUrlsBySourceType"
            )
          ) {
            for (const source of ["nature", "science"]) {
              seedUrlsDirtyBySourceRef.current[source] = false;
            }
          }
          if (Object.prototype.hasOwnProperty.call(updates, "maxResults")) {
            maxResultsDirtyRef.current = false;
          }
        })
        .catch(() => {
          // ignore on unmount
        });
    };
  }, []);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId) return;
    if (isRestoringSessionRef.current) return;
    if (!literatureSession?.setSession) return;

    const snapshot = {
      v: LITERATURE_SESSION_STATE_VERSION,
      savedAt: Date.now(),
      seedUrlsBySourceType,
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
    maxResults,
    keywordInput,
    keywordMode,
    resultView,
    results,
    selectedIds,
    seedUrlsBySourceType,
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
      if (da === db)
        return String(a?.title || "").localeCompare(b?.title || "");
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
        const hasAbstract =
          typeof item?.abstract === "string" && item.abstract.trim();
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
          translateTitle =
            t("personal_api_key_required") || "Set API Key to translate.";
        }

        return (
          <article
            key={item?.id || item?.articleUrl || item?.title}
            data-ui="literature-result-card"
            data-item-id={String(id)}
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
                      data-ui="literature-result-title-link"
                      data-item-id={String(id)}
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
                      data-ui="literature-result-translate-btn"
                      data-item-id={String(id)}
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
                          : t("literature_download_unavailable") ||
                          "鏃犲彲涓嬭浇鏂囦欢"
                      }
                      data-ui="literature-result-download-btn"
                      data-item-id={String(id)}
                    >
                      <Download size={16} />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-xs text-text-tertiary">
                    <span className="inline-flex items-center gap-1 px-0 py-0.5 rounded-md text-text-secondary">
                      {item?.sourceContext ? (
                        <span
                          className="truncate max-w-[300px]"
                          title={item.sourceContext}
                        >
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
                    ? t("literature_translation_label_zh") ||
                    "Chinese translation"
                    : t("literature_translation_label_en") ||
                    "English translation"}
                </div>
              )}
              {abstractText ||
                t("literature_no_abstract") ||
                "（该条目暂无摘要）"}
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

  const allVisibleSelected = useMemo(() => {
    if (!Array.isArray(visibleResults) || visibleResults.length === 0) return false;
    if (!Array.isArray(selectedIds) || selectedIds.length === 0) return false;
    const selectedSet = new Set(selectedIds);
    const visibleIds = visibleResults.map(getLiteratureItemId).filter(Boolean);
    if (visibleIds.length === 0) return false;
    return visibleIds.every((id) => selectedSet.has(id));
  }, [visibleResults, selectedIds]);

  const selectionToggleAction = allVisibleSelected ? "deselect-all" : "select-all";

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
    setSeedUrlsForSourceType(
      seedUrls.map((prevValue, i) => (i === index ? value : prevValue))
    );
  };

  const removeSeedUrlAt = (index) => {
    const next = seedUrls.filter((_, i) => i !== index);
    setSeedUrlsForSourceType(next.length ? next : [""]);
  };

  const addSeedUrl = () => {
    setSeedUrlsForSourceType([...seedUrls, ""]);
  };

  const handleTranslate = async (item) => {
    const id = getLiteratureItemId(item);
    const abstract =
      typeof item?.abstract === "string" ? item.abstract.trim() : "";
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
        message: t("personal_api_key_required") || "Please enter your API Key.",
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
        typeof data?.translatedText === "string"
          ? data.translatedText.trim()
          : "";
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
    sourceTypeRef.current = newSource;
    setSourceType(newSource);
    // Preserve user input when switching. Source-specific placeholders/examples are
    // already shown elsewhere; forcing defaults here wipes state unexpectedly.
  };

  const handleSearch = async () => {
    if (sanitizedSeedUrls.length === 0) {
      setStatus({
        state: "error",
        message:
          t("literature_seed_urls_required") || "请先填写至少一个入口链接。",
      });
      return;
    }

    cancelSettingsAutosave();

    try {
      await syncSettingsForFetch({
        seedSource: sourceType,
        seedUrlsToPersist: sanitizedSeedUrls,
      });
    } catch (error) {
      setStatus({
        state: "error",
        message:
          error?.message ||
          t("literature_settings_save_failed") ||
          "设置同步失败",
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
        maxResults:
          String(maxResults || "").trim() &&
            Number.isFinite(Number(String(maxResults || "").trim()))
            ? Number(String(maxResults || "").trim())
            : null,
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
        message: t("personal_api_key_required") || "Please enter your API Key.",
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
        .map((i) =>
          typeof i?.journalTitle === "string" ? i.journalTitle.trim() : ""
        )
        .filter(Boolean);
      const unique = [...new Set(journalTitles)];
      if (unique.length === 1) return unique[0];
      if (sourceType === "nature") return "Nature";
      if (sourceType === "science") return "Science";
      return "Literature";
    })();

    const prevTranslateLock = translateInFlightRef.current;
    translateInFlightRef.current = true;
    setDocxExport({
      state: "translating",
      current: 0,
      total: exportItems.length,
    });

    try {
      const lines = [];
      for (let index = 0; index < exportItems.length; index += 1) {
        const item = exportItems[index];
        const id = String(
          item?.id || item?.articleUrl || item?.title || ""
        ).trim();
        const title = normalizeDocText(
          item?.title || item?.articleUrl || `Item ${index + 1}`
        );
        const abstractEn =
          typeof item?.abstract === "string" ? item.abstract.trim() : "";

        let abstractZh = "";
        if (id && abstractEn) {
          const existing = translations[id];
          if (
            existing?.state === "done" &&
            String(existing?.targetLang || "")
              .toLowerCase()
              .startsWith("zh") &&
            typeof existing?.text === "string" &&
            existing.text.trim()
          ) {
            abstractZh = normalizeDocText(existing.text);
          } else {
            setTranslations((prev) => ({
              ...prev,
              [id]: {
                state: "loading",
                text: "",
                error: "",
                showOriginal: false,
                targetLang: "zh",
              },
            }));
            try {
              const data = await apiService.translateLiteratureAbstract({
                id,
                text: abstractEn,
                targetLang: "zh",
              });
              const translatedText =
                typeof data?.translatedText === "string"
                  ? data.translatedText.trim()
                  : "";
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
                `Translation failed for "${title}": ${error?.message || String(error)
                }`
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
        setDocxExport({
          state: "translating",
          current: index + 1,
          total: exportItems.length,
        });
      }

      setDocxExport((prev) => ({ ...prev, state: "building" }));

      const {
        Document,
        Packer,
        Paragraph,
        TextRun,
        AlignmentType,
        LineRuleType,
      } = await import("docx");

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
          })
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
                    t("literature_no_abstract") ||
                    "(No abstract available)",
                  font: fontSong,
                  size: 24,
                }),
              ],
            })
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
      const fileName = `${safeFilePart(resolvedDocTitle)}_${safeFilePart(
        startDate
      )}-${safeFilePart(endDate)}.docx`;
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

      const title = String(
        item?.title || item?.articleUrl || item?.id || doi
      ).trim();
      if (!title) continue;

      const entry = { doi, title };

      const source = typeof item?.source === "string" ? item.source.trim() : "";
      if (source) entry.source = source;

      const articleUrl =
        typeof item?.articleUrl === "string" ? item.articleUrl.trim() : "";
      if (articleUrl) entry.articleUrl = articleUrl;

      const publishedDate =
        typeof item?.publishedDate === "string"
          ? item.publishedDate.trim()
          : "";
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
    const blob = new Blob([jsonText], {
      type: "application/json;charset=utf-8",
    });
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
    <div className="w-full min-h-screen relative" ref={containerRef}>
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-medium text-text-primary mb-2">
          {t("literature_research_title") || "鏂囩尞璋冪爺"}
        </h1>
        <p className="text-text-secondary">
          {t("literature_research_subtitle") ||
            "输入需要抓取的栏目/入口链接，按日期范围筛选文章并提取摘要。"}
        </p>
      </div>

      <Card as="section">
        <div className="ui-toolbar_warp">
          <div data-ui="literature-source-toggle">
            <ToggleButton
              idBase="literature-source"
              value={sourceType}
              onChange={handleSourceChange}
              options={[
                { value: "nature", label: "Nature", icon: Leaf },
                { value: "science", label: "Science", icon: FlaskConical },
              ]}
            />
          </div>

          <div className="ui-filter_warp" aria-label="date filter warp">
            <div className="date_btn_warp" data-ui="literature-start-date">
              <label
                className="date_btn_label"
                data-ui="literature-start-date-label"
              >
                {t("literature_start_date") || "开始日期"}
              </label>
              <DatePicker
                dataUi="literature-start-date"
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
            <div className="date_btn_warp" data-ui="literature-end-date">
              <label
                className="date_btn_label"
                data-ui="literature-end-date-label"
              >
                {t("literature_end_date") || "鎴鏃ユ湡"}
              </label>
              <DatePicker
                dataUi="literature-end-date"
                value={endDate}
                onChange={setEndDate}
                placeholder={t("literature_end_date") || "鎴鏃ユ湡"}
                className="min-w-0 flex-1"
                textClassName="hidden sm:block"
                aria-label="end date"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label
                className="ui-input_label"
                htmlFor="literature-max-results"
                data-ui="literature-max-results-label"
              >
                {t("literature_max_results") || "最大返回条数"}
              </label>
              <Input
                dataUi="literature-max-results"
                type="text"
                id="literature-max-results"
                name="maxResults"
                value={String(maxResults ?? "")}
                onChange={handleMaxResultsInputChange}
                onFocus={handleSettingsInputFocus}
                onBlur={handleSettingsInputBlur}
                inputClassName="w-24 rounded-lg"
                cta="Literature research"
                ctaPosition="date filter warp"
                ctaCopy="max results"
                aria-label="max results input"
                inputMode="numeric"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                autoComplete="new-password"
                aria-autocomplete="none"
                data-form-type="other"
                data-lpignore="true"
              />
            </div>
          </div>

          <div className="ui-button_warp">
            <div className="ui-button_row">
              <button
                data-ui="literature-add-url-btn"
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
                data-ui="literature-fetch-btn"
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

            <div className="mt-3 space-y-2" data-ui="literature-seed-url-list">
              {seedUrls.map((value, index) => (
                <div
                  key={`${index}`}
                  className="flex items-center gap-2 group"
                  data-ui="literature-seed-url-row"
                  data-seed-index={index}
                >
                  <Input
                    dataUi="literature-seed-url"
                    size="md"
                    value={value}
                    onChange={(nextValue) => setSeedUrlAt(index, nextValue)}
                    onFocus={handleSettingsInputFocus}
                    onBlur={handleSettingsInputBlur}
                    inputClassName="rounded-lg"
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="off"
                    placeholder={
                      sourceType === "science"
                        ? "https://www.science.org"
                        : "https://www.nature.com"
                    }
                    leftIcon={LinkIcon}
                    className="flex-1"
                    aria-label={`${t("literature_seed_urls") || "Seed URL"} ${index + 1
                      }`}
                    data-seed-index={index}
                  />
                  <button
                    type="button"
                    onClick={() => removeSeedUrlAt(index)}
                    title={t("literature_remove_url") || "绉婚櫎"}
                    aria-label={t("literature_remove_url") || "Remove URL"}
                    data-style="ghost"
                    data-icon="with"
                    data-cta="Literature research"
                    data-cta-position="seed urls"
                    data-cta-copy="remove url"
                    data-ui="literature-seed-url-remove-btn"
                    data-seed-index={index}
                    className="click_btn click_btn--md click_btn--icon-md click_btn--fx click_btn--fx-muted click_btn--danger"
                  >
                    <span className="click_btn_content">
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
      </Card>

      <section className="mt-8">
        <div className="ui-section_head ui-section_head--gap">

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleExportDocx}
              disabled={isExportingDocx || selectedCount === 0}
              className={`click_btn click_btn--md ${
                isExportingDocx || selectedCount === 0
                  ? "click_btn--disabled"
                  : "click_btn--ghost click_btn--fx click_btn--fx-muted"
              }`}
              title={exportDocxLabel}
              aria-label={exportDocxLabel}
              data-ui="literature-export-docx-btn"
            >
              <span className="click_btn_content">
                {isExportingDocx ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileDown size={16} />
                )}
                {exportDocxLabel}
                {!isExportingDocx && selectedCount > 0
                  ? ` (${selectedCount})`
                  : ""}
              </span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              disabled={isExportingDocx || selectedCount === 0}
              className={`click_btn click_btn--md ${
                isExportingDocx || selectedCount === 0
                  ? "click_btn--disabled"
                  : "click_btn--ghost click_btn--fx click_btn--fx-muted"
              }`}
              title={t("literature_export_json") || "Export JSON"}
              aria-label={t("literature_export_json") || "Export JSON"}
              data-ui="literature-export-json-btn"
            >
              <span className="click_btn_content">
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
              className={`click_btn click_btn--md ${
                isExportingDocx ||
                status.state === "loading" ||
                isAnyTranslationInFlight
                  ? "click_btn--disabled"
                  : "click_btn--ghost click_btn--fx click_btn--fx-muted"
              }`}
              title={t("literature_clear_session") || "Clear session"}
              aria-label={t("literature_clear_session") || "Clear session"}
              data-ui="literature-clear-session-btn"
            >
              <span className="click_btn_content">
                <Trash2 size={16} />
                {t("literature_clear_session") || "Clear session"}
              </span>
            </button>
          </div>
        </div>

        <Card
          as="section"
          dataUi="literature-keyword-panel"
          variant="panel"
          className="mb-4"
        >
          <div className="ui-toolbar_warp">
            <div
              className="flex items-center gap-2"
              data-ui="literature-keyword-mode-toggle"
            >
              <ToggleButton
                options={[
                  {
                    value: "any",
                    label: t("literature_match_any") || "浠绘剰鍖归厤",
                  },
                  {
                    value: "all",
                    label: t("literature_match_all") || "鍏ㄩ儴鍖归厤",
                  },
                ]}
                value={keywordMode}
                onChange={setKeywordMode}
                className="w-fit"
                groupLabel="literature-match-mode-segment"
              />
            </div>
          </div>

          <div className="mt-3" data-ui="literature-keywords-warp">
            <textarea
              data-ui="literature-keywords-input"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="关键词匹配：two-dimensional, wafer, AI 等（用空格/换行/逗号分隔）"
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg bg-bg-page border border-border-200 focus:outline-none focus:ring-1 focus:ring-black text-sm text-text-primary placeholder:text-text-tertiary resize-y"
            />
            <div className="mt-2 text-xs text-text-tertiary">
              {(t("literature_keywords_count") || "当前关键词") +
                `：${keywords.length}`}
            </div>
          </div>
        </Card>

        <h2
          className="ui-section_title ui-section_title--spaced"
          aria-label="literature-results-title"
        >
          {t("literature_results_title") || "检索结果"}
        </h2>
        <Card
          dataUi="literature-results-container"
          className="min-h-[600px]"
          aria-label="literature-results-container"
        >
          <div className="ui-toolbar_warp">
            <div data-ui="literature-results-view-toggle">
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
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                disabled={
                  isExportingDocx ||
                  status.state === "loading" ||
                  visibleResults.length === 0
                }
                className={`click_btn click_btn--md click_btn--icon-md ${
                  isExportingDocx ||
                  status.state === "loading" ||
                  visibleResults.length === 0
                    ? "click_btn--disabled"
                    : "click_btn--ghost click_btn--fx click_btn--fx-muted"
                }`}
                title={
                  selectionToggleAction === "deselect-all"
                    ? t("literature_deselect_all_filtered") ||
                      "Deselect all (filtered)"
                    : t("literature_select_all_filtered") || "Select all (filtered)"
                }
                aria-label={
                  selectionToggleAction === "deselect-all"
                    ? t("literature_deselect_all_filtered") ||
                      "Deselect all (filtered)"
                    : t("literature_select_all_filtered") || "Select all (filtered)"
                }
                data-style={
                  isExportingDocx ||
                  status.state === "loading" ||
                  visibleResults.length === 0
                    ? "disabled"
                    : "ghost"
                }
                data-icon="with"
                data-cta="Literature research"
                data-cta-position="result"
                data-cta-copy={
                  selectionToggleAction === "deselect-all" ? "deselect all" : "select all"
                }
                data-action={selectionToggleAction}
                data-ui="literature-selection-toggle-btn"
              >
                <span className="click_btn_content">
                  {selectionToggleAction === "deselect-all" ? (
                    <ListX size={16} />
                  ) : (
                    <ListChecks size={16} />
                  )}
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
                {t("literature_no_results_hint") ||
                  "尝试调整日期范围或入口链接。"}
              </p>
            </div>
          )}

          {renderResultCards(visibleResults)}
        </Card>
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
