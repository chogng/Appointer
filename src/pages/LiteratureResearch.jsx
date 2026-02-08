import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Languages, Loader2 } from "lucide-react";
import { format, subDays } from "date-fns";
import { apiService } from "../services/apiService";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../hooks/useLanguage";
import { useLiteratureResearchSession } from "../hooks/useLiteratureResearchSession";

import Toast from "../components/ui/Toast";
import JournalLinksCard from "../features/literature-research/components/JournalLinksCard";
import KeywordMatchCard from "../features/literature-research/components/KeywordMatchCard";
import ResultsCard from "../features/literature-research/components/ResultsCard";

const LITERATURE_SESSION_STATE_VERSION = 4;

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

const areBooleanArraysEqual = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((item, idx) => Boolean(item) === Boolean(b[idx]));
};

const LiteratureResearch = () => {
  const containerRef = useRef(null);
  const { user } = useAuth();
  const { t } = useLanguage();
  const literatureSession = useLiteratureResearchSession();

  const [now, setNow] = useState(() => new Date());
  const today = useMemo(() => format(now, "yyyy-MM-dd"), [now]);
  const defaultStart = useMemo(
    () => format(subDays(now, 7), "yyyy-MM-dd"),
    [now],
  );

  const startDateAutoRef = useRef(true);
  const endDateAutoRef = useRef(true);

  const [seedUrls, setSeedUrls] = useState([""]);
  const [seedUrlSelected, setSeedUrlSelected] = useState([true]);
  const [seedUrlTitles, setSeedUrlTitles] = useState([""]);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [maxResults, setMaxResults] = useState("");
  const [groupCollapseEpoch, setGroupCollapseEpoch] = useState(0);
  const [isSavingSeedSettings, setIsSavingSeedSettings] = useState(false);

  const seedUrlsRef = useRef(seedUrls);
  const seedUrlTitlesRef = useRef(seedUrlTitles);
  const seedUrlSelectedRef = useRef(seedUrlSelected);
  const maxResultsRef = useRef(maxResults);

  useEffect(() => {
    seedUrlsRef.current = seedUrls;
  }, [seedUrls]);

  useEffect(() => {
    seedUrlTitlesRef.current = seedUrlTitles;
  }, [seedUrlTitles]);

  useEffect(() => {
    seedUrlSelectedRef.current = seedUrlSelected;
  }, [seedUrlSelected]);

  useEffect(() => {
    maxResultsRef.current = maxResults;
  }, [maxResults]);

  useEffect(() => {
    setSeedUrlSelected((prev) => {
      const next = normalizeSeedUrlSelectedList(prev, seedUrls.length);
      const same =
        Array.isArray(prev) &&
        prev.length === next.length &&
        prev.every((v, i) => v === next[i]);
      if (same) return prev;
      return next.length ? next : [true];
    });
  }, [seedUrls.length]);

  useEffect(() => {
    setSeedUrlTitles((prev) => {
      const next = normalizeSeedUrlTitlesList(prev, seedUrls.length);
      const same =
        Array.isArray(prev) &&
        prev.length === next.length &&
        prev.every((v, i) => v === next[i]);
      if (same) return prev;
      return next.length ? next : [""];
    });
  }, [seedUrls.length]);

  useEffect(() => {
    let timeoutId = null;

    const scheduleNextTick = () => {
      const current = new Date();
      const nextMidnight = new Date(current);
      nextMidnight.setHours(24, 0, 5, 0);
      const delay = Math.max(1000, nextMidnight.getTime() - current.getTime());

      timeoutId = setTimeout(() => {
        setNow(new Date());
        scheduleNextTick();
      }, delay);
    };

    scheduleNextTick();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (startDateAutoRef.current) setStartDate(defaultStart);
    if (endDateAutoRef.current) setEndDate(today);
  }, [defaultStart, today]);

  const committedSettingsRef = useRef({
    seedUrlsUnified: [],
    seedUrlTitlesUnified: [],
    seedUrlSelectedUnified: [],
    maxResults: null,
  });

  const seedUrlsDirtyRef = useRef(false);
  const seedUrlTitlesDirtyRef = useRef(false);
  const seedUrlSelectedDirtyRef = useRef(false);
  const maxResultsDirtyRef = useRef(false);
  const settingsSyncQueueRef = useRef(Promise.resolve());
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

  const setSeedUrlsList = (nextSeedUrls) => {
    const resolvedNextSeedUrls =
      Array.isArray(nextSeedUrls) && nextSeedUrls.length ? nextSeedUrls : [""];

    seedUrlsDirtyRef.current = true;
    seedUrlsRef.current = resolvedNextSeedUrls;
    setSeedUrls(resolvedNextSeedUrls);
  };

  const setSeedUrlTitlesList = (nextSeedUrlTitles) => {
    const resolvedNextSeedUrlTitles =
      Array.isArray(nextSeedUrlTitles) && nextSeedUrlTitles.length
        ? nextSeedUrlTitles
        : [""];

    seedUrlTitlesDirtyRef.current = true;
    seedUrlTitlesRef.current = resolvedNextSeedUrlTitles;
    setSeedUrlTitles(resolvedNextSeedUrlTitles);
  };

  const setSeedUrlSelectedList = (nextSeedUrlSelected) => {
    const resolvedNextSeedUrlSelected =
      Array.isArray(nextSeedUrlSelected) && nextSeedUrlSelected.length
        ? nextSeedUrlSelected
        : [true];

    seedUrlSelectedDirtyRef.current = true;
    seedUrlSelectedRef.current = resolvedNextSeedUrlSelected;
    setSeedUrlSelected(resolvedNextSeedUrlSelected);
  };

  const handleMaxResultsInputChange = (nextValue) => {
    maxResultsDirtyRef.current = true;
    maxResultsRef.current = nextValue;
    setMaxResults(nextValue);
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

  const patchLiteratureSessionSnapshot = useCallback((patch) => {
    const userId = userIdRef.current;
    if (!userId) return;
    if (!literatureSession?.getSession) return;
    if (!literatureSession?.setSession) return;
    if (!patch || typeof patch !== "object") return;

    const current = literatureSession.getSession(userId);
    const base = current && typeof current === "object" ? current : {};

    literatureSession.setSession(userId, {
      ...base,
      ...patch,
      v: LITERATURE_SESSION_STATE_VERSION,
      savedAt: Date.now(),
    });
  }, [literatureSession]);

  React.useLayoutEffect(() => {
    const userId = user?.id ?? null;
    if (!userId) return;
    if (!literatureSession?.getSession) return;
    if (restoredUserIdRef.current === userId) return;
    restoredUserIdRef.current = userId;
    hasRestoredSessionRef.current = false;
    isRestoringSessionRef.current = false;

    const currentNow = new Date();
    const currentToday = format(currentNow, "yyyy-MM-dd");
    const currentDefaultStart = format(subDays(currentNow, 7), "yyyy-MM-dd");

    const parsed = literatureSession.getSession(userId);
    if (!parsed || (parsed?.v !== 3 && parsed?.v !== LITERATURE_SESSION_STATE_VERSION)) return;

    hasRestoredSessionRef.current = true;
    isRestoringSessionRef.current = true;

    const restoredSavedSeedSettings =
      parsed?.v === LITERATURE_SESSION_STATE_VERSION &&
      parsed?.savedSeedSettings &&
      typeof parsed.savedSeedSettings === "object"
        ? parsed.savedSeedSettings
        : null;

    const restoredSeedUrlsUnified = Array.isArray(restoredSavedSeedSettings?.seedUrlsUnified)
      ? normalizeSeedUrlsList(restoredSavedSeedSettings.seedUrlsUnified)
      : null;

    const restoredStartDate =
      typeof parsed?.startDate === "string" ? parsed.startDate : null;
    const restoredEndDate =
      typeof parsed?.endDate === "string" ? parsed.endDate : null;

    if (restoredSeedUrlsUnified != null) {
      const resolvedSeedUrls = restoredSeedUrlsUnified.length
        ? [...restoredSeedUrlsUnified]
        : [""];
      const resolvedSeedUrlTitles = normalizeSeedUrlTitlesList(
        restoredSavedSeedSettings?.seedUrlTitlesUnified,
        resolvedSeedUrls.length,
      ).slice();
      const resolvedSeedUrlSelected = normalizeSeedUrlSelectedList(
        restoredSavedSeedSettings?.seedUrlSelectedUnified,
        resolvedSeedUrls.length,
      ).slice();

      seedUrlsRef.current = resolvedSeedUrls;
      seedUrlTitlesRef.current = resolvedSeedUrlTitles;
      seedUrlSelectedRef.current = resolvedSeedUrlSelected;

      setSeedUrls(resolvedSeedUrls);
      setSeedUrlTitles(resolvedSeedUrlTitles);
      setSeedUrlSelected(resolvedSeedUrlSelected);

      const restoredMaxResultsValue = (() => {
        const raw = restoredSavedSeedSettings?.maxResults;
        if (raw == null) return null;
        const n = Number(raw);
        if (!Number.isFinite(n)) return null;
        return Math.max(1, Math.trunc(n));
      })();

      committedSettingsRef.current = {
        seedUrlsUnified: restoredSeedUrlsUnified,
        seedUrlTitlesUnified: normalizeSeedUrlTitlesList(
          restoredSavedSeedSettings?.seedUrlTitlesUnified,
          restoredSeedUrlsUnified.length,
        ),
        seedUrlSelectedUnified: normalizeSeedUrlSelectedList(
          restoredSavedSeedSettings?.seedUrlSelectedUnified,
          restoredSeedUrlsUnified.length,
        ),
        maxResults: restoredMaxResultsValue,
      };

      const restoredMaxResultsText =
        restoredMaxResultsValue == null ? "" : String(restoredMaxResultsValue);
      maxResultsRef.current = restoredMaxResultsText;
      setMaxResults(restoredMaxResultsText);
    }
    const savedAtRaw = Number(parsed?.savedAt);
    const savedAt = Number.isFinite(savedAtRaw) ? savedAtRaw : null;
    const savedDate = savedAt != null ? new Date(savedAt) : null;
    const savedToday = savedDate ? format(savedDate, "yyyy-MM-dd") : null;
    const savedDefaultStart = savedDate
      ? format(subDays(savedDate, 7), "yyyy-MM-dd")
      : null;

    if (
      restoredStartDate &&
      restoredEndDate &&
      savedToday &&
      savedDefaultStart &&
      restoredEndDate === savedToday &&
      restoredStartDate === savedDefaultStart
    ) {
      startDateAutoRef.current = true;
      endDateAutoRef.current = true;
      setStartDate(currentDefaultStart);
      setEndDate(currentToday);
    } else {
      if (restoredStartDate) {
        startDateAutoRef.current = restoredStartDate === currentDefaultStart;
        setStartDate(restoredStartDate);
      }

      if (restoredEndDate) {
        if (savedToday && restoredEndDate === savedToday) {
          endDateAutoRef.current = true;
          setEndDate(currentToday);
        } else {
          endDateAutoRef.current = restoredEndDate === currentToday;
          setEndDate(restoredEndDate);
        }
      }
    }

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
    const defer =
      typeof queueMicrotask === "function"
        ? queueMicrotask
        : (cb) => Promise.resolve().then(cb);

    defer(() => {
      isRestoringSessionRef.current = false;
    });
  }, [literatureSession, user?.id]);

  const classifySeedUrl = (value) => {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return "empty";
    try {
      const url = new URL(raw);
      const host = String(url.hostname || "").replace(/^www\./i, "").toLowerCase();
      if (host.endsWith("nature.com")) return "nature";
      if (host.endsWith("science.org")) return "science";
      if (host === "pubs.acs.org") return "acs";
      if (host.endsWith("onlinelibrary.wiley.com")) return "wiley";
      return "unsupported";
    } catch {
      return "unsupported";
    }
  };

  const seedUrlStats = useMemo(() => {
    let nature = 0;
    let science = 0;
    let acs = 0;
    let wiley = 0;
    const unsupportedLabels = [];

    for (let i = 0; i < seedUrls.length; i += 1) {
      const url = typeof seedUrls[i] === "string" ? seedUrls[i].trim() : "";
      if (!url) continue;
      if (seedUrlSelected[i] === false) continue;

      const kind = classifySeedUrl(url);
      if (kind === "nature") nature += 1;
      else if (kind === "science") science += 1;
      else if (kind === "acs") acs += 1;
      else if (kind === "wiley") wiley += 1;
      else if (kind === "unsupported") {
        const title = typeof seedUrlTitles[i] === "string" ? seedUrlTitles[i].trim() : "";
        unsupportedLabels.push(title || resolveSeedUrlLabel(url) || url);
      }
    }

    return {
      nature,
      science,
      acs,
      wiley,
      unsupported: unsupportedLabels.length,
      unsupportedLabels,
    };
  }, [seedUrlSelected, seedUrlTitles, seedUrls]);

  const fetchSeedUrls = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (let i = 0; i < seedUrls.length; i += 1) {
      const url = typeof seedUrls[i] === "string" ? seedUrls[i].trim() : "";
      if (!url) continue;
      if (seedUrlSelected[i] === false) continue;
      const kind = classifySeedUrl(url);
      if (kind !== "nature" && kind !== "science" && kind !== "acs" && kind !== "wiley")
        continue;
      if (seen.has(url)) continue;
      seen.add(url);
      out.push(url);
    }
    return out;
  }, [seedUrlSelected, seedUrls]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!user?.id) return;
      try {
        const currentNow = new Date();
        const currentToday = format(currentNow, "yyyy-MM-dd");
        const currentDefaultStart = format(
          subDays(currentNow, 7),
          "yyyy-MM-dd",
        );

        const data = await apiService.getLiteratureSettings();
        if (cancelled) return;

        const committedSeedUrlsUnified = Array.isArray(data?.seedUrlsUnified)
          ? normalizeSeedUrlsList(data.seedUrlsUnified)
          : (() => {
              const bySource = data?.seedUrlsBySourceType;
              if (bySource && typeof bySource === "object") {
                return [
                  ...normalizeSeedUrlsList(bySource.nature),
                  ...normalizeSeedUrlsList(bySource.science),
                ];
              }
              const legacy = Array.isArray(data?.seedUrls) ? data.seedUrls : [];
              return normalizeSeedUrlsList(legacy);
            })();

        const committedSeedUrlTitlesUnified = Array.isArray(data?.seedUrlTitlesUnified)
          ? normalizeSeedUrlTitlesList(data.seedUrlTitlesUnified, committedSeedUrlsUnified.length)
          : (() => {
              const bySource = data?.seedUrlTitlesBySourceType;
              if (bySource && typeof bySource === "object") {
                const titles = [
                  ...(Array.isArray(bySource.nature) ? bySource.nature : []),
                  ...(Array.isArray(bySource.science) ? bySource.science : []),
                ];
                return normalizeSeedUrlTitlesList(titles, committedSeedUrlsUnified.length);
              }
              return normalizeSeedUrlTitlesList(null, committedSeedUrlsUnified.length);
            })();

        const resolvedStartDate = currentDefaultStart;
        const resolvedEndDate = currentToday;

        const resolvedMaxResults =
          typeof data?.maxResults === "number" &&
            Number.isFinite(data.maxResults)
            ? data.maxResults
            : null;

        const committedSeedUrlSelectedUnified = Array.isArray(data?.seedUrlSelectedUnified)
          ? normalizeSeedUrlSelectedList(data.seedUrlSelectedUnified, committedSeedUrlsUnified.length)
          : normalizeSeedUrlSelectedList(null, committedSeedUrlsUnified.length);

        committedSettingsRef.current = {
          seedUrlsUnified: committedSeedUrlsUnified,
          seedUrlTitlesUnified: committedSeedUrlTitlesUnified,
          seedUrlSelectedUnified: committedSeedUrlSelectedUnified,
          maxResults: resolvedMaxResults,
        };

        patchLiteratureSessionSnapshot({
          savedSeedSettings: {
            updatedAt: data?.updatedAt ?? null,
            seedUrlsUnified: committedSeedUrlsUnified,
            seedUrlTitlesUnified: committedSeedUrlTitlesUnified,
            seedUrlSelectedUnified: committedSeedUrlSelectedUnified,
            maxResults: resolvedMaxResults,
          },
        });

        const shouldHydrateSeedSettings =
          !seedUrlsDirtyRef.current &&
          !seedUrlTitlesDirtyRef.current &&
          !seedUrlSelectedDirtyRef.current &&
          !maxResultsDirtyRef.current;

        if (shouldHydrateSeedSettings) {
          const nextSeedUrls = committedSeedUrlsUnified.length ? committedSeedUrlsUnified : [""];
          const resolvedSeedUrls = [...nextSeedUrls];
          const resolvedSeedUrlTitles = normalizeSeedUrlTitlesList(
            committedSeedUrlTitlesUnified,
            resolvedSeedUrls.length,
          );
          const resolvedSeedUrlSelected = normalizeSeedUrlSelectedList(
            committedSeedUrlSelectedUnified,
            resolvedSeedUrls.length,
          );

          seedUrlsRef.current = resolvedSeedUrls;
          seedUrlTitlesRef.current = resolvedSeedUrlTitles;
          seedUrlSelectedRef.current = resolvedSeedUrlSelected;

          setSeedUrls(resolvedSeedUrls);
          setSeedUrlTitles(resolvedSeedUrlTitles);
          setSeedUrlSelected(resolvedSeedUrlSelected);
          const resolvedMaxResultsText =
            resolvedMaxResults == null ? "" : String(resolvedMaxResults);
          maxResultsRef.current = resolvedMaxResultsText;
          setMaxResults(resolvedMaxResultsText);
        }

        if (!hasRestoredSessionRef.current) {
          startDateAutoRef.current = true;
          endDateAutoRef.current = true;
          setStartDate(resolvedStartDate);
          setEndDate(resolvedEndDate);
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
  }, [patchLiteratureSessionSnapshot, user?.id]);

  const handleStartDateChange = (value) => {
    const next = typeof value === "string" ? value : "";
    startDateAutoRef.current = Boolean(next) && next === defaultStart;
    setStartDate(next);
  };

  const handleEndDateChange = (value) => {
    const next = typeof value === "string" ? value : "";
    endDateAutoRef.current = Boolean(next) && next === today;
    setEndDate(next);
  };

  const enqueueSettingsSync = (job) => {
    const run = () => Promise.resolve().then(job);
    const next = settingsSyncQueueRef.current.then(run, run);
    settingsSyncQueueRef.current = next.catch(() => { });
    return next;
  };

  const syncSettingsForFetch = ({ seedUrlsToPersist, seedUrlTitlesToPersist, seedUrlSelectedToPersist }) => {
    return enqueueSettingsSync(async () => {
      const updates = {};

      const shouldSyncSeedUrls = Boolean(seedUrlsDirtyRef.current);
      const shouldSyncSeedUrlTitles = Boolean(seedUrlTitlesDirtyRef.current);
      const shouldSyncSeedUrlSelected = Boolean(seedUrlSelectedDirtyRef.current);

      if (shouldSyncSeedUrls || shouldSyncSeedUrlTitles || shouldSyncSeedUrlSelected) {
        const committedSeedUrls = committedSettingsRef.current.seedUrlsUnified || [];
        const committedSeedUrlTitles = committedSettingsRef.current.seedUrlTitlesUnified || [];
        const committedSeedUrlSelected =
          committedSettingsRef.current.seedUrlSelectedUnified || [];

        const paired = pairSeedUrlsAndTitles(seedUrlsToPersist, seedUrlTitlesToPersist);
        const nextSeedUrls = paired.seedUrls;
        const nextSeedUrlTitles = paired.seedUrlTitles;
        const nextSeedUrlSelected = (() => {
          const srcUrls = Array.isArray(seedUrlsToPersist) ? seedUrlsToPersist : [];
          const srcSelected = Array.isArray(seedUrlSelectedToPersist) ? seedUrlSelectedToPersist : [];
          const out = [];
          for (let i = 0; i < srcUrls.length; i += 1) {
            const url = typeof srcUrls[i] === "string" ? srcUrls[i].trim() : "";
            if (!url) continue;
            out.push(typeof srcSelected[i] === "boolean" ? srcSelected[i] : true);
          }
          return normalizeSeedUrlSelectedList(out, nextSeedUrls.length);
        })();

        const seedUrlsChanged = !areStringArraysEqual(nextSeedUrls, committedSeedUrls);
        const seedUrlTitlesChanged = !areStringArraysEqual(nextSeedUrlTitles, committedSeedUrlTitles);
        const seedUrlSelectedChanged = !areBooleanArraysEqual(nextSeedUrlSelected, committedSeedUrlSelected);

        if (shouldSyncSeedUrls) {
          if (seedUrlsChanged) {
            updates.seedUrlsUnified = nextSeedUrls;
          } else {
            seedUrlsDirtyRef.current = false;
          }
        }

        if (shouldSyncSeedUrlTitles || seedUrlsChanged) {
          if (seedUrlTitlesChanged) {
            updates.seedUrlTitlesUnified = nextSeedUrlTitles;
          } else if (shouldSyncSeedUrlTitles) {
            seedUrlTitlesDirtyRef.current = false;
          }
        }

        if (shouldSyncSeedUrlSelected || seedUrlsChanged) {
          if (seedUrlSelectedChanged) {
            updates.seedUrlSelectedUnified = nextSeedUrlSelected;
          } else if (shouldSyncSeedUrlSelected) {
            seedUrlSelectedDirtyRef.current = false;
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
      const nextCommittedSeedUrlsUnified = Array.isArray(data?.seedUrlsUnified)
        ? normalizeSeedUrlsList(data.seedUrlsUnified)
        : committedSettingsRef.current.seedUrlsUnified || [];
      const nextCommittedSeedUrlTitlesUnified = Array.isArray(data?.seedUrlTitlesUnified)
        ? normalizeSeedUrlTitlesList(data.seedUrlTitlesUnified, nextCommittedSeedUrlsUnified.length)
        : normalizeSeedUrlTitlesList(
            committedSettingsRef.current.seedUrlTitlesUnified,
            nextCommittedSeedUrlsUnified.length,
          );
      const nextCommittedSeedUrlSelectedUnified = Array.isArray(data?.seedUrlSelectedUnified)
        ? normalizeSeedUrlSelectedList(data.seedUrlSelectedUnified, nextCommittedSeedUrlsUnified.length)
        : normalizeSeedUrlSelectedList(
            committedSettingsRef.current.seedUrlSelectedUnified,
            nextCommittedSeedUrlsUnified.length,
          );

      committedSettingsRef.current = {
        seedUrlsUnified: nextCommittedSeedUrlsUnified,
        seedUrlTitlesUnified: nextCommittedSeedUrlTitlesUnified,
        seedUrlSelectedUnified: nextCommittedSeedUrlSelectedUnified,
        maxResults:
          data?.maxResults == null
            ? null
            : Number.isFinite(Number(data.maxResults))
              ? Number(data.maxResults)
              : null,
      };

      const committedSeedUrlsUnified = committedSettingsRef.current.seedUrlsUnified || [];
      const committedSeedUrlTitlesUnified = committedSettingsRef.current.seedUrlTitlesUnified || [];
      const committedSeedUrlSelectedUnified =
        committedSettingsRef.current.seedUrlSelectedUnified || [];

      const paired = pairSeedUrlsAndTitles(seedUrlsRef.current, seedUrlTitlesRef.current);
      const currentSeedUrlsUnified = paired.seedUrls;
      const currentSeedUrlTitlesUnified = paired.seedUrlTitles;
      const currentSeedUrlSelectedUnified = (() => {
        const srcUrls = Array.isArray(seedUrlsRef.current) ? seedUrlsRef.current : [];
        const srcSelected = Array.isArray(seedUrlSelectedRef.current) ? seedUrlSelectedRef.current : [];
        const out = [];
        for (let i = 0; i < srcUrls.length; i += 1) {
          const url = typeof srcUrls[i] === "string" ? srcUrls[i].trim() : "";
          if (!url) continue;
          out.push(typeof srcSelected[i] === "boolean" ? srcSelected[i] : true);
        }
        return normalizeSeedUrlSelectedList(out, currentSeedUrlsUnified.length);
      })();

      seedUrlsDirtyRef.current = !areStringArraysEqual(
        currentSeedUrlsUnified,
        committedSeedUrlsUnified,
      );
      seedUrlTitlesDirtyRef.current = !areStringArraysEqual(
        currentSeedUrlTitlesUnified,
        committedSeedUrlTitlesUnified,
      );
      seedUrlSelectedDirtyRef.current = !areBooleanArraysEqual(
        currentSeedUrlSelectedUnified,
        committedSeedUrlSelectedUnified,
      );

      const currentMaxResultsValue = (() => {
        const raw = String(maxResultsRef.current || "").trim();
        if (raw === "") return null;
        const n = Number(raw);
        if (!Number.isFinite(n)) return "invalid";
        return Math.max(1, Math.trunc(n));
      })();

      const committedMaxResultsValue =
        committedSettingsRef.current.maxResults == null
          ? null
          : Number(committedSettingsRef.current.maxResults);

      maxResultsDirtyRef.current =
        currentMaxResultsValue === "invalid" ||
        currentMaxResultsValue !== committedMaxResultsValue;

      patchLiteratureSessionSnapshot({
        savedSeedSettings: {
          updatedAt: data?.updatedAt ?? null,
          seedUrlsUnified: nextCommittedSeedUrlsUnified,
          seedUrlTitlesUnified: nextCommittedSeedUrlTitlesUnified,
          seedUrlSelectedUnified: nextCommittedSeedUrlSelectedUnified,
          maxResults: committedSettingsRef.current.maxResults,
        },
      });

      const isAllSynced =
        !seedUrlsDirtyRef.current &&
        !seedUrlTitlesDirtyRef.current &&
        !seedUrlSelectedDirtyRef.current &&
        !maxResultsDirtyRef.current;

      if (isMountedRef.current && isAllSynced) {
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

  const isSeedSettingsDirty = Boolean(
    seedUrlsDirtyRef.current ||
      seedUrlTitlesDirtyRef.current ||
      seedUrlSelectedDirtyRef.current ||
      maxResultsDirtyRef.current,
  );

  const handleSaveSeedSettings = async () => {
    if (isSavingSeedSettings) return;
    const dirtyNow = Boolean(
      seedUrlsDirtyRef.current ||
        seedUrlTitlesDirtyRef.current ||
        seedUrlSelectedDirtyRef.current ||
        maxResultsDirtyRef.current,
    );
    if (!dirtyNow) return;

    setIsSavingSeedSettings(true);
    try {
      await syncSettingsForFetch({
        seedUrlsToPersist: seedUrlsRef.current || [],
        seedUrlTitlesToPersist: seedUrlTitlesRef.current || [],
        seedUrlSelectedToPersist: seedUrlSelectedRef.current || [],
      });
    } catch {
      // toast handled in syncSettingsForFetch
    } finally {
      if (isMountedRef.current) setIsSavingSeedSettings(false);
    }
  };

  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId) return;
    if (isRestoringSessionRef.current) return;

    patchLiteratureSessionSnapshot({
      startDate,
      endDate,
      keywordInput,
      keywordMode,
      resultView,
      status,
      results,
      selectedIds,
      translations: pruneTranslationsForSession(translations),
    });
  }, [
    endDate,
    keywordInput,
    keywordMode,
    resultView,
      results,
      selectedIds,
      startDate,
    status,
    translations,
    patchLiteratureSessionSnapshot,
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

  const seedUrlTitleBySeedUrl = useMemo(() => {
    const out = new Map();
    for (let i = 0; i < seedUrls.length; i += 1) {
      const url = typeof seedUrls[i] === "string" ? seedUrls[i].trim() : "";
      if (!url) continue;
      const title = typeof seedUrlTitles[i] === "string" ? seedUrlTitles[i].trim() : "";
      if (!title) continue;
      out.set(url, title);
    }
    return out;
  }, [seedUrlTitles, seedUrls]);

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
              ? "border-accent bg-accent/5"
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
    setSeedUrlsList(
      seedUrls.map((prevValue, i) => (i === index ? value : prevValue))
    );
  };

  const setSeedUrlSelectedAt = (index, checked) => {
    const desiredLen = seedUrls.length;
    const nextList = normalizeSeedUrlSelectedList(seedUrlSelectedRef.current, desiredLen);
    if (index >= 0 && index < nextList.length) {
      nextList[index] = Boolean(checked);
    }
    setSeedUrlSelectedList(nextList);
  };

  const setSeedUrlTitleAt = (index, value) => {
    const desiredLen = seedUrls.length;
    const nextList = normalizeSeedUrlTitlesList(seedUrlTitles, desiredLen);
    if (index >= 0 && index < nextList.length) {
      nextList[index] = typeof value === "string" ? value : String(value ?? "");
    }
    setSeedUrlTitlesList(nextList.length ? nextList : [""]);
  };

  const removeSeedUrlAt = (index) => {
    const nextSelected = (Array.isArray(seedUrlSelectedRef.current) ? seedUrlSelectedRef.current : []).filter(
      (_, i) => i !== index,
    );
    setSeedUrlSelectedList(nextSelected.length ? nextSelected : [true]);
    const nextTitles = seedUrlTitles.filter((_, i) => i !== index);
    setSeedUrlTitlesList(nextTitles.length ? nextTitles : [""]);
    const next = seedUrls.filter((_, i) => i !== index);
    setSeedUrlsList(next.length ? next : [""]);
  };

  const addSeedUrl = () => {
    setSeedUrlSelectedList([
      ...normalizeSeedUrlSelectedList(seedUrlSelectedRef.current, seedUrls.length),
      true,
    ]);
    setSeedUrlTitlesList([...normalizeSeedUrlTitlesList(seedUrlTitles, seedUrls.length), ""]);
    setSeedUrlsList([...seedUrls, ""]);
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

    setStatus({ state: "loading", message: "" });
    setResults([]);
    setSelectedIds([]);
    setGroupCollapseEpoch((prev) => prev + 1);
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
      <header className="page_head">
        <h1 className="page_title">
          {t("literature_research_title")}
        </h1>
        <p className="page_subtitle">
          {t("literature_research_subtitle")}
        </p>
      </header>

      <div className="page_content">
        <JournalLinksCard
          startDate={startDate}
          onStartDateChange={handleStartDateChange}
          endDate={endDate}
          onEndDateChange={handleEndDateChange}
          maxResults={maxResults}
          onMaxResultsInputChange={handleMaxResultsInputChange}
          onSaveSeedSettings={handleSaveSeedSettings}
          isSeedSettingsDirty={isSeedSettingsDirty}
          isSavingSeedSettings={isSavingSeedSettings}
          onAddSeedUrl={addSeedUrl}
          onSearch={handleSearch}
          status={status}
          fetchProgress={fetchProgress}
          seedUrlStats={seedUrlStats}
          seedUrls={seedUrls}
          seedUrlTitles={seedUrlTitles}
          seedUrlSelected={seedUrlSelected}
          onToggleSeedUrlSelectedAt={setSeedUrlSelectedAt}
          onSeedUrlChangeAt={setSeedUrlAt}
          onSeedUrlTitleChangeAt={setSeedUrlTitleAt}
          onRemoveSeedUrlAt={removeSeedUrlAt}
          seedUrlTitleBySeedUrl={seedUrlTitleBySeedUrl}
          resolveSeedUrlLabel={resolveSeedUrlLabel}
        />

        <KeywordMatchCard
          keywordMode={keywordMode}
          onKeywordModeChange={setKeywordMode}
          keywordInput={keywordInput}
          onKeywordInputChange={setKeywordInput}
          keywordsCount={keywords.length}
        />

        <ResultsCard
          resultView={resultView}
          onResultViewChange={setResultView}
          sortedResults={sortedResults}
          matchedResults={matchedResults}
          unmatchedResults={unmatchedResults}
          groupedResults={groupedResults}
          selectedCount={selectedCount}
          selectionToggleAction={selectionToggleAction}
          onToggleSelectAllVisible={handleSelectAllVisible}
          isExportingDocx={isExportingDocx}
          statusState={status.state}
          visibleResultsLength={visibleResults.length}
          exportDocxLabel={exportDocxLabel}
          onExportDocx={handleExportDocx}
          onExportJson={handleExportJson}
          onClearPageSession={handleClearPageSession}
          isAnyTranslationInFlight={isAnyTranslationInFlight}
          selectedIdSet={selectedIdSet}
          getLiteratureItemId={getLiteratureItemId}
          renderResultCards={renderResultCards}
          groupCollapseEpoch={groupCollapseEpoch}
        />
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
