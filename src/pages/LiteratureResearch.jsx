import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  FileDown,
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
  RefreshCw,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { apiService } from "../services/apiService";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../hooks/useLanguage";
import { useLiteratureResearchSession } from "../hooks/useLiteratureResearchSession";

import Tabs from "../components/ui/Tabs";
import Toast from "../components/ui/Toast";
import DatePicker from "../components/ui/DatePicker";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import Card from "../components/ui/Card";

const NATURE_EXAMPLES = [
  "https://www.nature.com/nature/research-articles",
  "https://www.nature.com/news",
];

const SCIENCE_EXAMPLES = [
  "https://www.science.org/journal/sciadv",
  "https://www.science.org/",
];

const LITERATURE_SESSION_STATE_VERSION = 3;

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

const pairSeedUrlsAndTitles = (seedUrlsInput, seedUrlTitlesInput) => {
  const seedUrls = Array.isArray(seedUrlsInput) ? seedUrlsInput : [];
  const seedUrlTitles = Array.isArray(seedUrlTitlesInput) ? seedUrlTitlesInput : [];
  const outSeedUrls = [];
  const outSeedUrlTitles = [];

  for (let i = 0; i < seedUrls.length; i += 1) {
    const url = typeof seedUrls[i] === "string" ? seedUrls[i].trim() : "";
    if (!url) continue;
    outSeedUrls.push(url);
    const title = typeof seedUrlTitles[i] === "string" ? seedUrlTitles[i].trim() : "";
    outSeedUrlTitles.push(title);
  }

  return { seedUrls: outSeedUrls, seedUrlTitles: outSeedUrlTitles };
};

const resolveSeedUrlLabel = (seedUrl) => {
  const raw = typeof seedUrl === "string" ? seedUrl.trim() : "";
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const host = String(url.hostname || "").replace(/^www\./i, "");
    const path = String(url.pathname || "").replace(/\/$/, "");
    if (!host) return raw;
    if (!path || path === "/") return host;
    return `${host}${path}`;
  } catch {
    return raw;
  }
};

const resolveLiteratureGroupTitle = ({ seedUrl, items, customTitle } = {}) => {
  const manual = typeof customTitle === "string" ? customTitle.trim() : "";
  if (manual) return manual;

  const list = Array.isArray(items) ? items : [];
  const seedContexts = list
    .map((i) => (typeof i?.seedContext === "string" ? i.seedContext.trim() : ""))
    .filter(Boolean);
  const uniqueSeedContexts = [...new Set(seedContexts)];
  if (uniqueSeedContexts.length === 1) return uniqueSeedContexts[0];

  const journalTitles = list
    .map((i) => (typeof i?.journalTitle === "string" ? i.journalTitle.trim() : ""))
    .filter(Boolean);
  const uniqueJournalTitles = [...new Set(journalTitles)];
  if (uniqueJournalTitles.length === 1) return uniqueJournalTitles[0];

  const urlLabel = resolveSeedUrlLabel(seedUrl);
  return urlLabel || "Literature";
};

const normalizeSeedUrlSelectedList = (value, desiredLen) => {
  const list = Array.isArray(value) ? value : [];
  const n = Math.max(0, Math.floor(Number(desiredLen) || 0));
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = typeof list[i] === "boolean" ? list[i] : true;
  }
  return out;
};

const normalizeSeedUrlTitlesList = (value, desiredLen) => {
  const list = Array.isArray(value) ? value : [];
  const n = Math.max(0, Math.floor(Number(desiredLen) || 0));
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = typeof list[i] === "string" ? list[i] : "";
  }
  return out;
};

const areStringArraysEqual = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((item, idx) => item === b[idx]);
};

const LiteratureResearch = () => {
  const containerRef = useRef(null);
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const literatureSession = useLiteratureResearchSession();

  // `t()` returns the key itself when a translation is missing. Avoid leaking keys into UI/a11y.
  const tl = useMemo(() => {
    const lang = language === "en" ? "en" : "zh";
    return (key, fallbackZh, fallbackEn) => {
      const translated = t?.(key);
      if (typeof translated === "string" && translated.trim() && translated !== key) {
        return translated;
      }
      return lang === "zh" ? fallbackZh : fallbackEn;
    };
  }, [t, language]);

  const today = format(new Date(), "yyyy-MM-dd");
  const defaultStart = format(subDays(new Date(), 7), "yyyy-MM-dd");

  const [seedUrlsBySourceType, setSeedUrlsBySourceType] = useState({
    nature: [""],
    science: [""],
  });

  const [seedUrlSelectedBySourceType, setSeedUrlSelectedBySourceType] = useState({
    nature: [true],
    science: [true],
  });

  const [seedUrlTitlesBySourceType, setSeedUrlTitlesBySourceType] = useState({
    nature: [""],
    science: [""],
  });

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [maxResults, setMaxResults] = useState("");

  const [sourceType, setSourceType] = useState("nature"); // "nature" | "science"

  const seedUrls = seedUrlsBySourceType[sourceType] || [""];
  const seedUrlSelected = seedUrlSelectedBySourceType[sourceType] || [];
  const seedUrlTitles = seedUrlTitlesBySourceType[sourceType] || [];

  const seedUrlsBySourceTypeRef = useRef(seedUrlsBySourceType);
  const seedUrlTitlesBySourceTypeRef = useRef(seedUrlTitlesBySourceType);
  const sourceTypeRef = useRef(sourceType);
  const maxResultsRef = useRef(maxResults);

  useEffect(() => {
    seedUrlsBySourceTypeRef.current = seedUrlsBySourceType;
  }, [seedUrlsBySourceType]);

  useEffect(() => {
    seedUrlTitlesBySourceTypeRef.current = seedUrlTitlesBySourceType;
  }, [seedUrlTitlesBySourceType]);

  useEffect(() => {
    setSeedUrlSelectedBySourceType((prev) => {
      const prevNature = prev?.nature;
      const prevScience = prev?.science;
      const nextNature = normalizeSeedUrlSelectedList(
        prevNature,
        seedUrlsBySourceType?.nature?.length ?? 0,
      );
      const nextScience = normalizeSeedUrlSelectedList(
        prevScience,
        seedUrlsBySourceType?.science?.length ?? 0,
      );

      const natureSame =
        Array.isArray(prevNature) &&
        prevNature.length === nextNature.length &&
        prevNature.every((v, i) => v === nextNature[i]);
      const scienceSame =
        Array.isArray(prevScience) &&
        prevScience.length === nextScience.length &&
        prevScience.every((v, i) => v === nextScience[i]);

      if (natureSame && scienceSame) return prev;

      return {
        ...prev,
        nature: nextNature.length ? nextNature : [true],
        science: nextScience.length ? nextScience : [true],
      };
    });
  }, [seedUrlsBySourceType]);

  useEffect(() => {
    setSeedUrlTitlesBySourceType((prev) => {
      const prevNature = prev?.nature;
      const prevScience = prev?.science;
      const nextNature = normalizeSeedUrlTitlesList(
        prevNature,
        seedUrlsBySourceType?.nature?.length ?? 0,
      );
      const nextScience = normalizeSeedUrlTitlesList(
        prevScience,
        seedUrlsBySourceType?.science?.length ?? 0,
      );

      const natureSame =
        Array.isArray(prevNature) &&
        prevNature.length === nextNature.length &&
        prevNature.every((v, i) => v === nextNature[i]);
      const scienceSame =
        Array.isArray(prevScience) &&
        prevScience.length === nextScience.length &&
        prevScience.every((v, i) => v === nextScience[i]);

      if (natureSame && scienceSame) return prev;

      return {
        ...prev,
        nature: nextNature.length ? nextNature : [""],
        science: nextScience.length ? nextScience : [""],
      };
    });
  }, [seedUrlsBySourceType]);

  useEffect(() => {
    sourceTypeRef.current = sourceType;
  }, [sourceType]);

  useEffect(() => {
    maxResultsRef.current = maxResults;
  }, [maxResults]);

  const committedSettingsRef = useRef({
    seedUrlsBySourceType: { nature: [], science: [] },
    seedUrlTitlesBySourceType: { nature: [], science: [] },
    maxResults: null,
  });

  const seedUrlsDirtyBySourceRef = useRef({
    nature: false,
    science: false,
  });
  const seedUrlTitlesDirtyBySourceRef = useRef({
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

  const setSeedUrlTitlesForSourceType = (nextSeedUrlTitles) => {
    const resolvedNextSeedUrlTitles =
      Array.isArray(nextSeedUrlTitles) && nextSeedUrlTitles.length
        ? nextSeedUrlTitles
        : [""];

    seedUrlTitlesDirtyBySourceRef.current[sourceType] = true;
    lastEditedSeedSourceRef.current = sourceType;

    seedUrlTitlesBySourceTypeRef.current = {
      ...seedUrlTitlesBySourceTypeRef.current,
      [sourceType]: resolvedNextSeedUrlTitles,
    };
    setSeedUrlTitlesBySourceType((prev) => ({
      ...prev,
      [sourceType]: resolvedNextSeedUrlTitles,
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
  const [fetchProgress, setFetchProgress] = useState({
    state: "idle", // idle | running
    completed: 0,
    total: 0,
    activeSeedUrl: "",
    errors: [],
  });

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
    return "DOCX";
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
    setFetchProgress({
      state: "idle",
      completed: 0,
      total: 0,
      activeSeedUrl: "",
      errors: [],
    });
    setSelectedIds([]);
    setKeywordInput("");
    setKeywordMode("any");
    setResultView("all");
    setDocxExport({ state: "idle", current: 0, total: 0 });
    setTranslations({});

    setToast({
      isVisible: true,
      message: t("literature_session_cleared"),
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

    const restoredSeedUrlSelectedBySourceType =
      parsed?.seedUrlSelectedBySourceType &&
        typeof parsed.seedUrlSelectedBySourceType === "object"
        ? {
          nature: Array.isArray(parsed.seedUrlSelectedBySourceType.nature)
            ? parsed.seedUrlSelectedBySourceType.nature
            : [],
          science: Array.isArray(parsed.seedUrlSelectedBySourceType.science)
            ? parsed.seedUrlSelectedBySourceType.science
            : [],
        }
        : null;

    const restoredSeedUrlTitlesBySourceType =
      parsed?.seedUrlTitlesBySourceType &&
        typeof parsed.seedUrlTitlesBySourceType === "object"
        ? {
          nature: Array.isArray(parsed.seedUrlTitlesBySourceType.nature)
            ? parsed.seedUrlTitlesBySourceType.nature
            : [],
          science: Array.isArray(parsed.seedUrlTitlesBySourceType.science)
            ? parsed.seedUrlTitlesBySourceType.science
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
      const nextSeedUrlsBySourceType = {
        nature: restoredSeedUrlsBySourceType.nature.length
          ? restoredSeedUrlsBySourceType.nature
          : [""],
        science: restoredSeedUrlsBySourceType.science.length
          ? restoredSeedUrlsBySourceType.science
          : [""],
      };

      setSeedUrlsBySourceType((prev) => ({
        ...prev,
        ...nextSeedUrlsBySourceType,
      }));

      setSeedUrlTitlesBySourceType((prev) => ({
        ...prev,
        nature: normalizeSeedUrlTitlesList(
          restoredSeedUrlTitlesBySourceType?.nature,
          nextSeedUrlsBySourceType.nature.length,
        ),
        science: normalizeSeedUrlTitlesList(
          restoredSeedUrlTitlesBySourceType?.science,
          nextSeedUrlsBySourceType.science.length,
        ),
      }));

      if (restoredSeedUrlSelectedBySourceType) {
        setSeedUrlSelectedBySourceType((prev) => ({
          ...prev,
          nature: normalizeSeedUrlSelectedList(
            restoredSeedUrlSelectedBySourceType.nature,
            nextSeedUrlsBySourceType.nature.length,
          ),
          science: normalizeSeedUrlSelectedList(
            restoredSeedUrlSelectedBySourceType.science,
            nextSeedUrlsBySourceType.science.length,
          ),
        }));
      }
    } else if (restoredSeedUrls && restoredSeedUrls.length > 0) {
      const restoredSource =
        parsed?.sourceType === "science" ? "science" : "nature";
      const nextSeedUrls = restoredSeedUrls.length ? restoredSeedUrls : [""];

      setSeedUrlsBySourceType((prev) => ({
        ...prev,
        [restoredSource]: nextSeedUrls,
      }));

      setSeedUrlTitlesBySourceType((prev) => ({
        ...prev,
        [restoredSource]: normalizeSeedUrlTitlesList(null, nextSeedUrls.length),
      }));

      setSeedUrlSelectedBySourceType((prev) => ({
        ...prev,
        [restoredSource]: normalizeSeedUrlSelectedList(null, nextSeedUrls.length),
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

  const fetchSeedUrlsBySourceType = useMemo(() => {
    const out = { nature: [], science: [] };
    for (const source of ["nature", "science"]) {
      const urls = seedUrlsBySourceType?.[source] || [];
      const selected = seedUrlSelectedBySourceType?.[source] || [];
      for (let i = 0; i < urls.length; i++) {
        const url = typeof urls[i] === "string" ? urls[i].trim() : "";
        if (!url) continue;
        if (selected[i] === false) continue;
        out[source].push(url);
      }
    }
    return out;
  }, [seedUrlSelectedBySourceType, seedUrlsBySourceType]);

  const fetchSeedUrls = useMemo(() => {
    const list = [
      ...(fetchSeedUrlsBySourceType.nature || []),
      ...(fetchSeedUrlsBySourceType.science || []),
    ];
    const seen = new Set();
    const out = [];
    for (const url of list) {
      const key = String(url || "").trim();
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
    return out;
  }, [fetchSeedUrlsBySourceType]);

  const fetchSeedUrlCounts = useMemo(
    () => ({
      nature: fetchSeedUrlsBySourceType.nature.length,
      science: fetchSeedUrlsBySourceType.science.length,
    }),
    [fetchSeedUrlsBySourceType]
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

        const committedSeedUrlTitlesBySourceType =
          data?.seedUrlTitlesBySourceType &&
            typeof data.seedUrlTitlesBySourceType === "object"
            ? {
              nature: normalizeSeedUrlTitlesList(
                data.seedUrlTitlesBySourceType.nature,
                committedSeedUrlsBySourceType.nature.length,
              ),
              science: normalizeSeedUrlTitlesList(
                data.seedUrlTitlesBySourceType.science,
                committedSeedUrlsBySourceType.science.length,
              ),
            }
            : {
              nature: normalizeSeedUrlTitlesList(
                null,
                committedSeedUrlsBySourceType.nature.length,
              ),
              science: normalizeSeedUrlTitlesList(
                null,
                committedSeedUrlsBySourceType.science.length,
              ),
            };

        const resolvedSeedUrlsBySourceType = {
          nature: committedSeedUrlsBySourceType.nature.length
            ? committedSeedUrlsBySourceType.nature
            : [""],
          science: committedSeedUrlsBySourceType.science.length
            ? committedSeedUrlsBySourceType.science
            : [""],
        };

        const resolvedSeedUrlTitlesBySourceType = {
          nature: normalizeSeedUrlTitlesList(
            committedSeedUrlTitlesBySourceType.nature,
            resolvedSeedUrlsBySourceType.nature.length,
          ),
          science: normalizeSeedUrlTitlesList(
            committedSeedUrlTitlesBySourceType.science,
            resolvedSeedUrlsBySourceType.science.length,
          ),
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
          seedUrlTitlesBySourceType: committedSeedUrlTitlesBySourceType,
          maxResults: resolvedMaxResults,
        };

        if (!hasRestoredSessionRef.current) {
          setSeedUrlsBySourceType((prev) => ({
            ...prev,
            nature: resolvedSeedUrlsBySourceType.nature,
            science: resolvedSeedUrlsBySourceType.science,
          }));
          setSeedUrlTitlesBySourceType((prev) => ({
            ...prev,
            nature: resolvedSeedUrlTitlesBySourceType.nature,
            science: resolvedSeedUrlTitlesBySourceType.science,
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
    const hasSeedTitleDirty =
      seedSource && Boolean(seedUrlTitlesDirtyBySourceRef.current?.[seedSource]);
    const hasMaxDirty = Boolean(maxResultsDirtyRef.current);
    if (!hasSeedDirty && !hasSeedTitleDirty && !hasMaxDirty) return;

    if (settingsFocusCountRef.current > 0) return;
    settingsAutosaveTimerRef.current = setTimeout(() => {
      const latestSeedSource = lastEditedSeedSourceRef.current;
      const shouldSyncSeedData =
        latestSeedSource &&
        (seedUrlsDirtyBySourceRef.current?.[latestSeedSource] ||
          seedUrlTitlesDirtyBySourceRef.current?.[latestSeedSource]);
      const seedUrlsToPersist = shouldSyncSeedData
        ? seedUrlsBySourceTypeRef.current?.[latestSeedSource] || []
        : [];
      const seedUrlTitlesToPersist = shouldSyncSeedData
        ? seedUrlTitlesBySourceTypeRef.current?.[latestSeedSource] || []
        : [];

      syncSettingsForFetch({
        seedSource: latestSeedSource,
        seedUrlsToPersist,
        seedUrlTitlesToPersist,
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

  const syncSettingsForFetch = ({ seedSource, seedUrlsToPersist, seedUrlTitlesToPersist }) => {
    return enqueueSettingsSync(async () => {
      const updates = {};

      const shouldSyncSeedUrls =
        seedSource && Boolean(seedUrlsDirtyBySourceRef.current?.[seedSource]);
      const shouldSyncSeedUrlTitles =
        seedSource &&
        Boolean(seedUrlTitlesDirtyBySourceRef.current?.[seedSource]);

      if (seedSource && (shouldSyncSeedUrls || shouldSyncSeedUrlTitles)) {
        const committedSeedUrls =
          committedSettingsRef.current.seedUrlsBySourceType?.[seedSource] || [];
        const committedSeedUrlTitles =
          committedSettingsRef.current.seedUrlTitlesBySourceType?.[seedSource] || [];

        const paired = pairSeedUrlsAndTitles(seedUrlsToPersist, seedUrlTitlesToPersist);
        const nextSeedUrls = paired.seedUrls;
        const nextSeedUrlTitles = paired.seedUrlTitles;

        const seedUrlsChanged = !areStringArraysEqual(nextSeedUrls, committedSeedUrls);
        const seedUrlTitlesChanged = !areStringArraysEqual(
          nextSeedUrlTitles,
          committedSeedUrlTitles,
        );

        if (shouldSyncSeedUrls) {
          if (seedUrlsChanged) {
            updates.seedUrls = nextSeedUrls;
            updates.seedSource = seedSource;
          } else {
            seedUrlsDirtyBySourceRef.current[seedSource] = false;
          }
        }

        // Keep titles aligned with persisted seedUrls; also allow title-only updates.
        if (shouldSyncSeedUrlTitles || seedUrlsChanged) {
          if (seedUrlTitlesChanged) {
            updates.seedUrlTitles = nextSeedUrlTitles;
            updates.seedSource = seedSource;
          } else if (shouldSyncSeedUrlTitles) {
            seedUrlTitlesDirtyBySourceRef.current[seedSource] = false;
          }
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
                  t("literature_max_results_invalid")
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

      const nextCommittedSeedUrlTitlesBySourceType =
        data?.seedUrlTitlesBySourceType &&
          typeof data.seedUrlTitlesBySourceType === "object"
          ? {
            nature: normalizeSeedUrlTitlesList(
              data.seedUrlTitlesBySourceType.nature,
              nextCommittedSeedUrlsBySourceType.nature.length,
            ),
            science: normalizeSeedUrlTitlesList(
              data.seedUrlTitlesBySourceType.science,
              nextCommittedSeedUrlsBySourceType.science.length,
            ),
          }
          : committedSettingsRef.current.seedUrlTitlesBySourceType || {
            nature: [],
            science: [],
          };
      committedSettingsRef.current = {
        seedUrlsBySourceType: nextCommittedSeedUrlsBySourceType,
        seedUrlTitlesBySourceType: nextCommittedSeedUrlTitlesBySourceType,
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
      if (
        seedSource &&
        Object.prototype.hasOwnProperty.call(updates, "seedUrlTitles")
      ) {
        seedUrlTitlesDirtyBySourceRef.current[seedSource] = false;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "maxResults")) {
        maxResultsDirtyRef.current = false;
      }

      if (isMountedRef.current) {
        setToast({
          isVisible: true,
          message: t("literature_settings_saved"),
          type: "success",
        });
      }
    }).catch((error) => {
      if (isMountedRef.current) {
        setToast({
          isVisible: true,
          message:
            (t("literature_settings_save_failed")) +
            (error?.message ? ` (${error.message})` : ""),
          type: "error",
        });
      }
      throw error;
    });
  };

  const syncAllDirtySettingsForFetch = async () => {
    const dirtySources = ["nature", "science"].filter(
      (source) =>
        seedUrlsDirtyBySourceRef.current?.[source] ||
        seedUrlTitlesDirtyBySourceRef.current?.[source]
    );

    // Even if no seed-url changes, still sync maxResults if needed.
    if (dirtySources.length === 0) {
      await syncSettingsForFetch({
        seedSource: null,
        seedUrlsToPersist: [],
        seedUrlTitlesToPersist: [],
      });
      return;
    }

    for (const source of dirtySources) {
      await syncSettingsForFetch({
        seedSource: source,
        seedUrlsToPersist: seedUrlsBySourceTypeRef.current?.[source] || [],
        seedUrlTitlesToPersist:
          seedUrlTitlesBySourceTypeRef.current?.[source] || [],
      });
    }
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
      const committedSeedUrlTitlesBySourceType = committedSettingsRef.current
        .seedUrlTitlesBySourceType || {
        nature: [],
        science: [],
      };

      const pairedNature = pairSeedUrlsAndTitles(
        seedUrlsBySourceTypeRef.current?.nature,
        seedUrlTitlesBySourceTypeRef.current?.nature,
      );
      const pairedScience = pairSeedUrlsAndTitles(
        seedUrlsBySourceTypeRef.current?.science,
        seedUrlTitlesBySourceTypeRef.current?.science,
      );

      const nextSeedUrlsBySourceType = {
        nature: pairedNature.seedUrls,
        science: pairedScience.seedUrls,
      };
      const nextSeedUrlTitlesBySourceType = {
        nature: pairedNature.seedUrlTitles,
        science: pairedScience.seedUrlTitles,
      };

      const dirtySources = ["nature", "science"].filter(
        (source) =>
          seedUrlsDirtyBySourceRef.current?.[source] ||
          seedUrlTitlesDirtyBySourceRef.current?.[source]
      );

      const seedUrlsShouldUpdate = dirtySources.some((source) => {
        const committedList = committedSeedUrlsBySourceType[source] || [];
        const nextList = nextSeedUrlsBySourceType[source] || [];
        if (areStringArraysEqual(nextList, committedList)) {
          seedUrlsDirtyBySourceRef.current[source] = false;
          return false;
        }
        return Boolean(seedUrlsDirtyBySourceRef.current?.[source]);
      });

      if (seedUrlsShouldUpdate) {
        updates.seedUrlsBySourceType = nextSeedUrlsBySourceType;
      }

      const seedUrlTitlesShouldUpdate = dirtySources.some((source) => {
        const committedList = committedSeedUrlTitlesBySourceType[source] || [];
        const nextList = nextSeedUrlTitlesBySourceType[source] || [];
        if (areStringArraysEqual(nextList, committedList)) {
          seedUrlTitlesDirtyBySourceRef.current[source] = false;
          return false;
        }
        return Boolean(
          seedUrlTitlesDirtyBySourceRef.current?.[source] ||
          seedUrlsDirtyBySourceRef.current?.[source],
        );
      });

      if (seedUrlTitlesShouldUpdate || seedUrlsShouldUpdate) {
        updates.seedUrlTitlesBySourceType = nextSeedUrlTitlesBySourceType;
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

          const nextCommittedSeedUrlTitlesBySourceType =
            data?.seedUrlTitlesBySourceType &&
              typeof data.seedUrlTitlesBySourceType === "object"
              ? {
                nature: normalizeSeedUrlTitlesList(
                  data.seedUrlTitlesBySourceType.nature,
                  nextCommittedSeedUrlsBySourceType.nature.length,
                ),
                science: normalizeSeedUrlTitlesList(
                  data.seedUrlTitlesBySourceType.science,
                  nextCommittedSeedUrlsBySourceType.science.length,
                ),
              }
              : committedSettingsRef.current.seedUrlTitlesBySourceType || {
                nature: [],
                science: [],
              };
          committedSettingsRef.current = {
            seedUrlsBySourceType: nextCommittedSeedUrlsBySourceType,
            seedUrlTitlesBySourceType: nextCommittedSeedUrlTitlesBySourceType,
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
          if (
            Object.prototype.hasOwnProperty.call(
              updates,
              "seedUrlTitlesBySourceType"
            ) ||
            Object.prototype.hasOwnProperty.call(
              updates,
              "seedUrlsBySourceType"
            )
          ) {
            for (const source of ["nature", "science"]) {
              seedUrlTitlesDirtyBySourceRef.current[source] = false;
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
      seedUrlSelectedBySourceType,
      seedUrlTitlesBySourceType,
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
    seedUrlTitlesBySourceType,
    sourceType,
    startDate,
    status,
    translations,
    literatureSession,
    seedUrlSelectedBySourceType,
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

  const seedUrlTitleBySeedUrl = useMemo(() => {
    const out = new Map();
    for (const source of ["nature", "science"]) {
      const urls = seedUrlsBySourceType?.[source] || [];
      const titles = seedUrlTitlesBySourceType?.[source] || [];
      for (let i = 0; i < urls.length; i += 1) {
        const url = typeof urls[i] === "string" ? urls[i].trim() : "";
        if (!url) continue;
        const title = typeof titles[i] === "string" ? titles[i].trim() : "";
        if (!title) continue;
        out.set(url, title);
      }
    }
    return out;
  }, [seedUrlsBySourceType, seedUrlTitlesBySourceType]);

  const groupedResults = useMemo(() => {
    const list = Array.isArray(sortedResults) ? sortedResults : [];
    if (list.length === 0) return [];

    const map = new Map();
    for (const item of list) {
      const seedUrl = typeof item?.seedUrl === "string" ? item.seedUrl.trim() : "";
      const key = seedUrl || "__unknown__";
      const entry = map.get(key) || {
        key,
        seedUrl: seedUrl || null,
        allItems: [],
      };
      entry.allItems.push(item);
      map.set(key, entry);
    }

    const ordered = [];
    const used = new Set();

    for (const seedUrl of fetchSeedUrls) {
      const entry = map.get(seedUrl);
      if (!entry) continue;
      ordered.push(entry);
      used.add(seedUrl);
    }

    for (const [key, entry] of map.entries()) {
      if (used.has(key)) continue;
      ordered.push(entry);
    }

    return ordered.map((entry) => {
      const matchedItems = [];
      const unmatchedItems = [];
      for (const item of entry.allItems) {
        if (isItemMatched(item)) matchedItems.push(item);
        else unmatchedItems.push(item);
      }

      const visibleItems =
        resultView === "matched"
          ? matchedItems
          : resultView === "unmatched"
            ? unmatchedItems
            : entry.allItems;

      return {
        ...entry,
        title: resolveLiteratureGroupTitle({
          seedUrl: entry.seedUrl,
          items: entry.allItems,
          customTitle: entry.seedUrl ? seedUrlTitleBySeedUrl.get(entry.seedUrl) : "",
        }),
        matchedItems,
        unmatchedItems,
        visibleItems,
      };
    });
  }, [sortedResults, fetchSeedUrls, isItemMatched, resultView, seedUrlTitleBySeedUrl]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const renderResultCards = (results) => (
    <div className="space-y-4">
      {results.map((item) => {
        const id = getLiteratureItemId(item);
        const translation = id ? translations[id] : null;
        const isTranslated = translation?.state === "done";
        const isTranslating = translation?.state === "loading";
        const showOriginal = Boolean(translation?.showOriginal);
        const hasAbstract =
          typeof item?.abstract === "string" && item.abstract.trim();
        const canTranslate =
          Boolean(hasAbstract) &&
          !isTranslating &&
          (isTranslated || (hasTranslationApiKey && !isAnyTranslationInFlight));

        const abstractText =
          isTranslated && !showOriginal ? translation.text : item?.abstract;

        const isSelected = Boolean(id) && selectedIdSet.has(id);

        let translateTitle = t("literature_translate");
        if (!hasAbstract) {
          translateTitle = t("literature_no_abstract");
        } else if (isTranslated) {
          translateTitle = showOriginal
            ? t("literature_show_translation")
            : t("literature_show_original");
        } else if (isAnyTranslationInFlight) {
          translateTitle =
            t("literature_translate_wait");
        } else if (!hasTranslationApiKey) {
          translateTitle =
            t("personal_api_key_required");
        }

        return (
          <article
            key={item?.id || item?.articleUrl || item?.title}
            data-ui="literature-result-card"
            data-item-id={String(id)}
            onClick={(e) => {
              const selection = window.getSelection?.();
              const hasSelection = Boolean(
                selection &&
                !selection.isCollapsed &&
                String(selection.toString?.() || "").trim(),
              );

              if (hasSelection) {
                const anchorNode = selection.anchorNode;
                const focusNode = selection.focusNode;
                if (
                  anchorNode &&
                  focusNode &&
                  e.currentTarget.contains(anchorNode) &&
                  e.currentTarget.contains(focusNode)
                ) {
                  return;
                }
              }

              toggleSelectedId(id);
            }}
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
                          ? t("literature_download")
                          : t("literature_download_unavailable")
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

              {abstractText || t("literature_no_abstract")}
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

  const setSeedUrlAt = (index, value) => {
    setSeedUrlsForSourceType(
      seedUrls.map((prevValue, i) => (i === index ? value : prevValue))
    );
  };

  const setSeedUrlSelectedAt = (index, checked) => {
    setSeedUrlSelectedBySourceType((prev) => {
      const prevList = Array.isArray(prev?.[sourceType]) ? prev[sourceType] : [];
      const desiredLen = seedUrls.length;
      const nextList = normalizeSeedUrlSelectedList(prevList, desiredLen);
      if (index >= 0 && index < nextList.length) {
        nextList[index] = Boolean(checked);
      }
      return { ...prev, [sourceType]: nextList.length ? nextList : [true] };
    });
  };

  const setSeedUrlTitleAt = (index, value) => {
    const desiredLen = seedUrls.length;
    const nextList = normalizeSeedUrlTitlesList(seedUrlTitles, desiredLen);
    if (index >= 0 && index < nextList.length) {
      nextList[index] = typeof value === "string" ? value : String(value ?? "");
    }
    setSeedUrlTitlesForSourceType(nextList.length ? nextList : [""]);
  };

  const removeSeedUrlAt = (index) => {
    setSeedUrlSelectedBySourceType((prev) => {
      const prevList = Array.isArray(prev?.[sourceType]) ? prev[sourceType] : [];
      const nextList = prevList.filter((_, i) => i !== index);
      return { ...prev, [sourceType]: nextList.length ? nextList : [true] };
    });
    setSeedUrlTitlesBySourceType((prev) => {
      const prevList = Array.isArray(prev?.[sourceType]) ? prev[sourceType] : [];
      const nextList = prevList.filter((_, i) => i !== index);
      return { ...prev, [sourceType]: nextList.length ? nextList : [""] };
    });
    const next = seedUrls.filter((_, i) => i !== index);
    setSeedUrlsForSourceType(next.length ? next : [""]);
  };

  const addSeedUrl = () => {
    setSeedUrlSelectedBySourceType((prev) => {
      const prevList = Array.isArray(prev?.[sourceType]) ? prev[sourceType] : [];
      return { ...prev, [sourceType]: [...prevList, true] };
    });
    setSeedUrlTitlesBySourceType((prev) => {
      const prevList = Array.isArray(prev?.[sourceType]) ? prev[sourceType] : [];
      return { ...prev, [sourceType]: [...prevList, ""] };
    });
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
        message: t("personal_api_key_required"),
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
          (t("literature_translate_failed")) +
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
    if (fetchSeedUrls.length === 0) {
      setStatus({
        state: "error",
        message:
          t("literature_seed_urls_required"),
      });
      setFetchProgress({
        state: "idle",
        completed: 0,
        total: 0,
        activeSeedUrl: "",
        errors: [],
      });
      return;
    }

    cancelSettingsAutosave();

    try {
      await syncAllDirtySettingsForFetch();
    } catch (error) {
      setStatus({
        state: "error",
        message:
          error?.message ||
          t("literature_settings_save_failed"),
      });
      return;
    }

    setStatus({ state: "loading", message: "" });
    setResults([]);
    setSelectedIds([]);
    setFetchProgress({
      state: "running",
      completed: 0,
      total: fetchSeedUrls.length,
      activeSeedUrl: fetchSeedUrls[0] || "",
      errors: [],
    });

    const maxResultsTrimmed = String(maxResults || "").trim();
    const maxResultsNumber =
      maxResultsTrimmed && Number.isFinite(Number(maxResultsTrimmed))
        ? Number(maxResultsTrimmed)
        : null;
    const maxResultsCap =
      maxResultsNumber == null ? 100 : Math.max(1, Math.trunc(maxResultsNumber));

    const merged = [];
    const seen = new Set();
    const seedErrors = [];

    try {
      for (let index = 0; index < fetchSeedUrls.length; index += 1) {
        const seedUrl = fetchSeedUrls[index];
        const remaining = Math.max(0, maxResultsCap - merged.length);
        if (remaining <= 0) break;

        setFetchProgress((prev) => ({
          ...prev,
          state: "running",
          completed: index,
          total: fetchSeedUrls.length,
          activeSeedUrl: seedUrl,
        }));

        try {
          const payload = {
            seedUrls: [seedUrl],
            startDate,
            endDate,
            maxResults: remaining,
          };
          const data = await apiService.searchLiterature(payload);
          const list = Array.isArray(data) ? data : [];
          for (const item of list) {
            const id = getLiteratureItemId(item);
            if (!id) continue;
            if (seen.has(id)) continue;
            seen.add(id);
            merged.push(item);
            if (merged.length >= maxResultsCap) break;
          }
        } catch (error) {
          seedErrors.push({
            seedUrl,
            message: error?.message || String(error),
          });
          setFetchProgress((prev) => ({
            ...prev,
            errors: [...seedErrors],
          }));
        } finally {
          setFetchProgress((prev) => ({
            ...prev,
            completed: Math.min(index + 1, fetchSeedUrls.length),
          }));
        }
      }

      setResults(merged);
      setResultView("all");

      if (merged.length > 0) {
        setStatus({ state: "done", message: "" });
      } else if (seedErrors.length > 0) {
        setStatus({
          state: "error",
          message: seedErrors[0]?.message || "Fetch failed.",
        });
      } else {
        setStatus({ state: "done", message: "" });
      }
    } catch (err) {
      setStatus({
        state: "error",
        message: err?.message || String(err),
      });
    } finally {
      setFetchProgress((prev) => ({
        ...prev,
        state: "idle",
        activeSeedUrl: "",
        errors: [...seedErrors],
      }));
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

  const handleExportDocx = async ({ seedKey } = {}) => {
    if (isExportingDocx) return;

    const resolvedSeedKey = typeof seedKey === "string" ? seedKey.trim() : "";
    const allSelectedItems = Array.isArray(selectedItems) ? selectedItems : [];
    const exportItems = resolvedSeedKey
      ? allSelectedItems.filter((item) => {
        const itemSeedUrl =
          typeof item?.seedUrl === "string" ? item.seedUrl.trim() : "";
        if (resolvedSeedKey === "__unknown__") return !itemSeedUrl;
        return itemSeedUrl === resolvedSeedKey;
      })
      : allSelectedItems;
    if (exportItems.length === 0) return;

    if (!hasTranslationApiKey) {
      setToast({
        isVisible: true,
        message: t("personal_api_key_required"),
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
      const seedUrlHint =
        resolvedSeedKey && resolvedSeedKey !== "__unknown__"
          ? resolvedSeedKey
          : (() => {
            if (resolvedSeedKey === "__unknown__") return null;
            const seedUrls = exportItems
              .map((i) =>
                typeof i?.seedUrl === "string" ? i.seedUrl.trim() : ""
              )
              .filter(Boolean);
            const uniqueSeedUrls = [...new Set(seedUrls)];
            return uniqueSeedUrls.length === 1 ? uniqueSeedUrls[0] : null;
          })();

      const customTitle = seedUrlHint ? seedUrlTitleBySeedUrl.get(seedUrlHint) || "" : "";

      const groupTitle = resolveLiteratureGroupTitle({
        seedUrl: seedUrlHint,
        items: exportItems,
        customTitle,
      });

      if (groupTitle && groupTitle !== "Literature") return groupTitle;

      const journalTitles = exportItems
        .map((i) =>
          typeof i?.journalTitle === "string" ? i.journalTitle.trim() : ""
        )
        .filter(Boolean);
      const unique = [...new Set(journalTitles)];
      if (unique.length === 1) return unique[0];

      const sources = exportItems
        .map((i) =>
          typeof i?.source === "string" ? i.source.trim().toLowerCase() : ""
        )
        .filter(Boolean);
      const uniqueSources = [...new Set(sources)];
      if (uniqueSources.length === 1) {
        if (uniqueSources[0] === "nature") return "Nature";
        if (uniqueSources[0] === "science") return "Science";
      }

      return groupTitle || "Literature";
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
                    t("literature_no_abstract"),
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
        message: t("literature_export_docx_success"),
        type: "success",
      });
    } catch (error) {
      setToast({
        isVisible: true,
        message:
          (t("literature_export_docx_failed")) +
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
          (t("literature_export_json_missing_doi")) +
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
      message: t("literature_export_json_success"),
      type: "success",
    });
  };

  return (
    <div className="w-full min-h-screen relative" ref={containerRef}>
      <div className="page_head">
        <h1 className="page_title">
          {t("literature_research_title")}
        </h1>
        <p className="page_subtitle">
          {t("literature_research_subtitle")}
        </p>
      </div>

      <div className="page_content">
        <section aria-label={tl("journal_links", "期刊链接", "Journal links")}>
          <h2 className="section_title">
            {tl("journal_links", "期刊链接", "Journal links")}
          </h2>
          <Card
            as="section"
            dta={{ page: "lr", slot: "journal-panel", comp: "card" }}
            aria-label={tl("journal_links", "期刊链接", "Journal links")}
          >
        <div className="toolbar_group">
          <Tabs
            dta={{ page: "lr", slot: "journal", comp: "tabs" }}
            value={sourceType}
            onChange={handleSourceChange}
            groupLabel="Journal view"
            options={[
              { value: "nature", label: "Nature", icon: Leaf },
              { value: "science", label: "Science", icon: FlaskConical },
            ]}
          />

          <div className="ui-filter_warp" aria-label="date filter warp">
            <div className="date_btn_warp flex-none" data-ui="literature-start-date">
              <label
                className="date_btn_label"
                data-ui="literature-start-date-label"
              >
                {t("literature_start_date")}
              </label>
              <DatePicker
                dataUi="literature-start-date"
                value={startDate}
                onChange={setStartDate}
                placeholder={t("literature_start_date")}
                cta="Literature research"
                ctaPosition="date filter warp"
                ctaCopy="start date"
                className="min-w-0"
                textClassName="hidden sm:block"
                aria-label="start date"
              />
            </div>
            <div className="date_btn_warp flex-none" data-ui="literature-end-date">
              <label
                className="date_btn_label"
                data-ui="literature-end-date-label"
              >
                {t("literature_end_date")}
              </label>
              <DatePicker
                dataUi="literature-end-date"
                value={endDate}
                onChange={setEndDate}
                placeholder={t("literature_end_date")}
                className="min-w-0"
                textClassName="hidden sm:block"
                aria-label="end date"
              />
            </div>

            <Input
              dataUi="literature-max-results"
              label={t("literature_max_results")}
              labelPlacement="inline"
              className="shrink-0"
              type="text"
              id="literature-max-results"
              name="maxResults"
              value={String(maxResults ?? "")}
              onChange={handleMaxResultsInputChange}
              onFocus={handleSettingsInputFocus}
              onBlur={handleSettingsInputBlur}
              inputClassName="w-24"
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
                  {t("literature_add_url")}
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
                    ? t("literature_fetching")
                    : t("literature_fetch")}
                </span>
              </button>
            </div>
          </div>


        </div>

        <div className="mt-6">
          <div className="">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-text-primary">
                {t("literature_seed_urls")}
              </label>
              <span
                className="text-xs text-text-secondary whitespace-nowrap"
                data-ui="literature-seed-url-fetch-count"
              >
                (Nature {fetchSeedUrlCounts.nature} / Science{" "}
                {fetchSeedUrlCounts.science})
              </span>
            </div>

            <div className="mt-3 space-y-2" data-ui="literature-seed-url-list">
              {seedUrls.map((value, index) => (
                <div
                  key={`${index}`}
                  className="flex items-center gap-2 group"
                  data-ui="literature-seed-url-row"
                  data-seed-index={index}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSeedUrlSelectedAt(index, seedUrlSelected[index] === false)
                    }
                    className="click_btn click_btn--md click_btn--icon-md-tight click_btn--fx click_btn--ghost click_btn--fx-muted bg-bg-page"
                    title={
                      seedUrlSelected[index] !== false
                        ? "Include (Enabled)"
                        : "Exclude (Disabled)"
                    }
                    aria-label={`Include seed url ${index + 1}`}
                    aria-pressed={seedUrlSelected[index] !== false}
                    data-ui="literature-seed-url-select"
                    data-seed-index={index}
                  >
                    <span className="click_btn_content">
                      <Check
                        size={16}
                        className="ui-seed-url-check"
                      />
                    </span>
                  </button>
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
                    aria-label={`${t("literature_seed_urls")} ${index + 1
                      }`}
                    data-seed-index={index}
                  />
                  <Input
                    dataUi="literature-seed-url-title"
                    size="md"
                    value={seedUrlTitles[index] ?? ""}
                    onChange={(nextValue) => setSeedUrlTitleAt(index, nextValue)}
                    onFocus={handleSettingsInputFocus}
                    onBlur={handleSettingsInputBlur}
                    inputClassName="rounded-lg"
                    placeholder={
                      t("literature_seed_title_placeholder")
                    }
                    className="w-44 shrink-0"
                    aria-label={`Seed title ${index + 1}`}
                    data-seed-index={index}
                  />
                  <button
                    type="button"
                    onClick={() => removeSeedUrlAt(index)}
                    title={t("literature_remove_url")}
                    aria-label={t("literature_remove_url")}
                    data-style="ghost"
                    data-icon="with"
                    data-cta="Literature research"
                    data-cta-position="seed urls"
                    data-cta-copy="remove url"
                    data-ui="literature-seed-url-remove-btn"
                    data-seed-index={index}
                    className="click_btn click_btn--md click_btn--icon-md-tight click_btn--fx click_btn--fx-muted click_btn--danger"
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
        <div className="mt-3" data-ui="literature-fetch-progress-warp">
          <div data-ui="literature-fetch-progress">
            <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-terracotta to-orange-400 transition-[width] duration-500 ease-out shadow-[0_0_8px_rgba(217,119,87,0.4)]"
                style={{
                  width: `${fetchProgress.total > 0
                    ? Math.round(
                      (fetchProgress.completed / fetchProgress.total) * 100
                    )
                    : 0
                    }%`,
                }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3 text-[11px] font-medium text-text-secondary select-none">
              <span className="shrink-0 flex items-center gap-2">
                <span className={status.state === "loading" ? "text-terracotta" : "opacity-80"}>
                  {status.state === "loading"
                    ? (t("literature_fetching"))
                    : (t("literature_status_ready"))
                  }
                </span>
                {status.state === "loading" && (
                  <span className="bg-terracotta/10 text-terracotta px-1.5 py-0.5 rounded text-[10px] font-mono">
                    {Math.min(fetchProgress.completed + 1, fetchProgress.total)}/{fetchProgress.total}
                  </span>
                )}
              </span>
              <span
                className="truncate opacity-60 font-mono text-[10px]"
                title={fetchProgress.activeSeedUrl}
                data-ui="literature-fetch-progress-active-url"
              >
                {(() => {
                  const url = fetchProgress.activeSeedUrl;
                  if (!url) return "";
                  const custom = seedUrlTitleBySeedUrl.get(url);
                  return custom || resolveSeedUrlLabel(url);
                })()}
              </span>
            </div>
          </div>

          {fetchProgress.errors.length > 0 && (
            <div
              className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500"
              data-ui="literature-fetch-progress-errors"
            >
              <div className="font-semibold">
                {"部分入口抓取失败："}
              </div>
              <div className="mt-2 space-y-2">
                {fetchProgress.errors.slice(0, 3).map((err) => (
                  <div
                    key={err.seedUrl}
                    className="flex flex-col gap-0.5"
                    data-ui="literature-fetch-progress-error-row"
                  >
                    <span className="block truncate" title={err.seedUrl}>
                      {seedUrlTitleBySeedUrl.get(err.seedUrl) ||
                        resolveSeedUrlLabel(err.seedUrl) ||
                        err.seedUrl}
                    </span>
                    <span
                      className="block text-red-500/80 truncate"
                      title={err.message}
                    >
                      {err.message}
                    </span>
                  </div>
                ))}
                {fetchProgress.errors.length > 3 && (
                  <div className="text-red-500/80">
                    还有 {fetchProgress.errors.length - 3} 个入口失败
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {status.state === "error" && (
          <div className="mt-5 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-500">
            {status.message}
          </div>
        )}
      </Card>
        </section>

        <section
          aria-label={tl("keyword_match", "关键词匹配", "Keyword match")}
        >
          <h2 className="section_title">
            {tl("keyword_match", "关键词匹配", "Keyword match")}
          </h2>
          <Card
            as="section"
            dta={{ page: "lr", slot: "keyword-panel", comp: "card" }}
            aria-label={tl("keywords", "关键词", "Keywords")}
          >
          <div className="toolbar_group">
            <Tabs
              dta={{ page: "lr", slot: "keyword", comp: "tabs" }}
              options={[
                {
                  value: "any",
                  label: t("literature_match_any"),
                },
                {
                  value: "all",
                  label: t("literature_match_all"),
                },
              ]}
              value={keywordMode}
              onChange={setKeywordMode}
              groupLabel="Match view"
            />
          </div>

          <div className="mt-3" data-ui="literature-keywords-warp">
            <Textarea
              dataUi="literature-keywords"
              value={keywordInput}
              onChange={setKeywordInput}
              placeholder={
                t("literature_keywords_placeholder")
              }
              rows={2}
              hint={
                (t("literature_keywords_count")) +
                `：${keywords.length}`
              }
            />
          </div>
          </Card>
        </section>

        <section aria-label={tl("research_result", "检索结果", "Research result")}>
          <h2 className="section_title">
            {t("literature_results_title")}
          </h2>
          <Card
            dta={{ page: "lr", slot: "result-panel", comp: "card" }}
            className="min-h-[600px]"
            aria-label="Results"
          >
          <div className="toolbar_group">
            <Tabs
              dta={{ page: "lr", slot: "result", comp: "tabs" }}
              options={[
                {
                  value: "all",
                  label:
                    (t("literature_view_all")) +
                    ` (${sortedResults.length})`,
                  cta: "Literature research",
                  ctaPosition: "result",
                  ctaCopy: "all",
                },
                {
                  value: "matched",
                  label:
                    (t("literature_view_matched")) +
                    ` (${matchedResults.length})`,
                  cta: "Literature research",
                  ctaPosition: "result",
                  ctaCopy: "matched",
                },
                {
                  value: "unmatched",
                  label:
                    (t("literature_view_unmatched")) +
                    ` (${unmatchedResults.length})`,
                  cta: "Literature research",
                  ctaPosition: "result",
                  ctaCopy: "unmatched",
                },
              ]}
              value={resultView}
              onChange={setResultView}
              groupLabel="Results view"
            />
            <div className="flex items-center gap-2">
              <div
                className="text-xs text-text-tertiary px-2"
                data-ui="literature-selected-count-label"
              >
                <span>{t("literature_selected_count")}：</span>
                <span className="">{selectedCount}</span>
              </div>

              <button
                type="button"
                onClick={handleSelectAllVisible}
                disabled={
                  isExportingDocx ||
                  status.state === "loading" ||
                  visibleResults.length === 0
                }
                className={`click_btn click_btn--md click_btn--icon-md ${isExportingDocx ||
                  status.state === "loading" ||
                  visibleResults.length === 0
                  ? "click_btn--disabled"
                  : "click_btn--ghost click_btn--fx click_btn--fx-muted"
                  }`}
                title={
                  selectionToggleAction === "deselect-all"
                    ? t("literature_deselect_all_filtered")
                    : t("literature_select_all_filtered")
                }
                aria-label={
                  selectionToggleAction === "deselect-all"
                    ? t("literature_deselect_all_filtered")
                    : t("literature_select_all_filtered")
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

              <button
                type="button"
                onClick={handleExportDocx}
                disabled={isExportingDocx || selectedCount === 0}
                className={`click_btn click_btn--md click_btn--fx ${isExportingDocx || selectedCount === 0
                  ? "click_btn--disabled"
                  : "click_btn--primary"
                  }`}
                title={exportDocxLabel}
                aria-label={exportDocxLabel}
                data-style={isExportingDocx || selectedCount === 0 ? "disabled" : "primary"}
                data-icon="with"
                data-cta="Literature research"
                data-cta-position="result"
                data-cta-copy="export docx"
                data-ui="literature-export-docx-btn"
              >
                <span className="click_btn_content">
                  {isExportingDocx ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <FileDown size={16} />
                  )}
                  {exportDocxLabel}
                </span>
              </button>

              <button
                type="button"
                onClick={handleExportJson}
                disabled={isExportingDocx || selectedCount === 0}
                className={`click_btn click_btn--md click_btn--fx ${isExportingDocx || selectedCount === 0
                  ? "click_btn--disabled"
                  : "click_btn--primary"
                  }`}
                title={t("literature_export_json")}
                aria-label={t("literature_export_json")}
                data-style={isExportingDocx || selectedCount === 0 ? "disabled" : "primary"}
                data-icon="with"
                data-cta="Literature research"
                data-cta-position="result"
                data-cta-copy="export json"
                data-ui="literature-export-json-btn"
              >
                <span className="click_btn_content">
                  <FileDown size={16} />
                  {"JSON"}
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
                className={`click_btn click_btn--md click_btn--icon-md ${isExportingDocx ||
                  status.state === "loading" ||
                  isAnyTranslationInFlight
                  ? "click_btn--disabled"
                  : "click_btn--ghost click_btn--fx click_btn--fx-muted"
                  }`}
                title={t("literature_clear_session")}
                aria-label={t("literature_clear_session")}
                data-ui="literature-clear-session-btn"
              >
                <span className="click_btn_content">
                  <RefreshCw size={16} className="transition-transform duration-500 hover:rotate-180" />
                </span>
              </button>
            </div>
          </div>
          {status.state === "done" && sortedResults.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-text-secondary">
              <p className="text-lg font-medium">
                {t("literature_no_results")}
              </p>
              <p className="text-sm mt-1">
                {t("literature_no_results_hint")}
              </p>
            </div>
          )}

          {groupedResults
            .filter(
              (group) =>
                Array.isArray(group?.visibleItems) && group.visibleItems.length > 0,
            )
            .map((group) => {
              let groupSelectedCount = 0;
              for (const item of group.allItems || []) {
                const id = getLiteratureItemId(item);
                if (id && selectedIdSet.has(id)) groupSelectedCount += 1;
              }

              const groupExportDisabled =
                isExportingDocx || groupSelectedCount === 0;

              return (
                <Card
                  key={group.key}
                  className="mt-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div
                        className="text-sm font-semibold text-text-primary truncate"
                        title={group.title}
                        data-ui="literature-results-group-title"
                      >
                        {group.title}
                      </div>
                      <div
                        className="mt-1 text-xs text-text-secondary truncate"
                        title={group.seedUrl || ""}
                        data-ui="literature-results-group-seed-url"
                      >
                        {group.seedUrl || "-"}
                      </div>
                      <div
                        className="mt-1 text-xs text-text-secondary"
                        data-ui="literature-results-group-count"
                      >
                        {group.visibleItems.length}/{group.allItems.length} •{" "}
                        {groupSelectedCount} selected
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleExportDocx({ seedKey: group.key })}
                      disabled={groupExportDisabled}
                      className={`click_btn click_btn--md click_btn--fx ${groupExportDisabled ? "click_btn--disabled" : "click_btn--primary"
                        }`}
                      title={exportDocxLabel}
                      aria-label={exportDocxLabel}
                      data-style={groupExportDisabled ? "disabled" : "primary"}
                      data-icon="with"
                      data-cta="Literature research"
                      data-cta-position="result group"
                      data-cta-copy="export docx group"
                      data-ui="literature-group-export-docx-btn"
                    >
                      <span className="click_btn_content">
                        {isExportingDocx ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <FileDown size={16} />
                        )}
                        {exportDocxLabel}
                      </span>
                    </button>
                  </div>

                  <div className="mt-4">{renderResultCards(group.visibleItems)}</div>
                </Card>
              );
            })}
          </Card>
        </section>
      </div>

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
