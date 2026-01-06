import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, Link as LinkIcon, Plus, Search, Trash2 } from "lucide-react";
import { format, subDays } from "date-fns";
import { apiService } from "../services/apiService";
import { useLanguage } from "../hooks/useLanguage";
import SegmentedControl from "../components/ui/SegmentedControl";

const EXAMPLE_SEED_URLS = [
  "https://www.nature.com/nature/research-articles",
  "https://www.nature.com/news",
  "https://www.science.org/",
  "https://www.science.org/journal/sciadv",
];

const LiteratureResearch = () => {
  const containerRef = useRef(null);
  const { t } = useLanguage();

  const today = format(new Date(), "yyyy-MM-dd");
  const defaultStart = format(subDays(new Date(), 7), "yyyy-MM-dd");

  const [seedUrls, setSeedUrls] = useState([""]);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [maxResults, setMaxResults] = useState(100);

  const [settingsReady, setSettingsReady] = useState(false);
  const lastSavedSettingsJsonRef = useRef("");
  const [settingsSync, setSettingsSync] = useState({
    state: "idle", // idle | saving | saved | error
    message: "",
  });

  const [status, setStatus] = useState({
    state: "idle", // idle | loading | error | done
    message: "",
  });
  const [results, setResults] = useState([]);

  const [keywordInput, setKeywordInput] = useState("");
  const [keywordMode, setKeywordMode] = useState("any"); // any | all
  const [resultView, setResultView] = useState("all"); // all | matched | unmatched

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

        setSeedUrls(resolvedSeedUrls);
        setStartDate(resolvedStartDate);
        setEndDate(resolvedEndDate);
        setMaxResults(resolvedMaxResults);

        lastSavedSettingsJsonRef.current = JSON.stringify({
          seedUrls: resolvedSeedUrls
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter(Boolean),
          startDate: resolvedStartDate,
          endDate: resolvedEndDate,
          maxResults: resolvedMaxResults,
        });
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
  }, [defaultStart, today]);

  useEffect(() => {
    if (!settingsReady) return;

    const payload = {
      seedUrls: sanitizedSeedUrls,
      startDate,
      endDate,
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
      } catch (error) {
        setSettingsSync({
          state: "error",
          message: error?.message || String(error),
        });
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [settingsReady, sanitizedSeedUrls, startDate, endDate, maxResults]);

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
      .split(/[\n,;，；]+/g)
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

  const fillExamples = () => {
    setSeedUrls(EXAMPLE_SEED_URLS);
  };

  const handleSearch = async () => {
    if (sanitizedSeedUrls.length === 0) {
      setStatus({
        state: "error",
        message:
          t("literature_seed_urls_required") ||
          "请先填写至少一个入口链接（仅支持 nature.com / science.org）。",
      });
      return;
    }

    setStatus({ state: "loading", message: "" });
    setResults([]);
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

  const settingsSyncText = (() => {
    if (!settingsReady) return t("literature_settings_loading") || "设置读取中...";
    if (settingsSync.state === "saving")
      return t("literature_settings_saving") || "设置同步中...";
    if (settingsSync.state === "saved")
      return t("literature_settings_saved") || "设置已同步";
    if (settingsSync.state === "error") {
      const prefix =
        t("literature_settings_save_failed") || "设置同步失败";
      return settingsSync.message ? `${prefix}：${settingsSync.message}` : prefix;
    }
    return "";
  })();

  return (
    <div
      className="max-w-[1500px] mx-auto min-h-screen relative"
      ref={containerRef}
    >
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-medium text-text-primary mb-2">
          {t("literature_research_title") || "文献调研"}
        </h1>
        <p className="text-text-secondary">
          {t("literature_research_subtitle") ||
            "输入需要抓取的栏目/入口链接，按日期范围筛选文章并提取摘要。"}
        </p>
      </div>

      <section className="bg-bg-surface/60 border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {t("literature_filters") || "抓取参数"}
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {t("literature_filters_hint") ||
                "支持 Nature / Science（Science 抓取通过 RSS + Crossref 获取摘要）。"}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fillExamples}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-200 transition-colors"
              >
                {t("literature_use_examples") || "填充示例链接"}
              </button>

              <button
                type="button"
                onClick={handleSearch}
                disabled={status.state === "loading"}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  status.state === "loading"
                    ? "bg-bg-200 text-text-secondary cursor-not-allowed"
                    : "bg-accent text-white hover:bg-accent-hover active:scale-[0.98]"
                }`}
              >
                <Search size={18} />
                {status.state === "loading"
                  ? t("literature_fetching") || "抓取中..."
                  : t("literature_fetch") || "开始抓取"}
              </button>
            </div>

            {settingsSyncText ? (
              <div
                className={`text-xs ${
                  settingsSync.state === "error"
                    ? "text-red-500"
                    : "text-text-tertiary"
                }`}
              >
                {settingsSyncText}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-text-primary">
                {t("literature_seed_urls") || "入口链接（可多个）"}
              </label>
              <button
                type="button"
                onClick={addSeedUrl}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary hover:bg-bg-200 transition-colors"
              >
                <Plus size={16} />
                {t("literature_add_url") || "添加链接"}
              </button>
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
                      placeholder="https://www.nature.com/nature/research-articles"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-bg-page border border-border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 text-sm text-text-primary placeholder:text-text-tertiary"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSeedUrlAt(index)}
                    className="p-2 rounded-xl border border-border text-text-tertiary hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/10 transition-colors"
                    title={t("literature_remove_url") || "移除"}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 text-xs text-text-tertiary leading-relaxed">
              {t("literature_seed_urls_hint") ||
                "提示：你可以直接粘贴 Science 的页面链接（如 /journal/sciadv），系统会自动映射为可抓取的 RSS。"}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-text-primary">
                  {t("literature_start_date") || "开始日期"}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-2 w-full px-3 py-2.5 rounded-xl bg-bg-page border border-border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-text-primary">
                  {t("literature_end_date") || "截止日期"}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-2 w-full px-3 py-2.5 rounded-xl bg-bg-page border border-border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 text-sm text-text-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-text-primary">
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
                className="mt-2 w-full px-3 py-2.5 rounded-xl bg-bg-page border border-border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 text-sm text-text-primary"
              />
              <div className="mt-1 text-xs text-text-tertiary">
                {t("literature_max_results_hint") || "建议 ≤ 100"}
              </div>
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
          <h2 className="text-lg font-semibold text-text-primary">
            {t("literature_results") || "结果"}
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-sm text-text-secondary">
              {sortedResults.length} {t("literature_results_count") || "条"}
            </div>
            <SegmentedControl
              options={[
                {
                  value: "all",
                  label:
                    (t("literature_view_all") || "全部") +
                    ` (${sortedResults.length})`,
                },
                {
                  value: "matched",
                  label:
                    (t("literature_view_matched") || "匹配") +
                    ` (${matchedResults.length})`,
                },
                {
                  value: "unmatched",
                  label:
                    (t("literature_view_unmatched") || "未匹配") +
                    ` (${unmatchedResults.length})`,
                },
              ]}
              value={resultView}
              onChange={setResultView}
              className="min-w-[300px]"
            />
          </div>
        </div>

        <div className="bg-bg-surface/40 border border-border rounded-2xl p-4 mb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-[260px]">
              <div className="text-sm font-semibold text-text-primary">
                {t("literature_keyword_filter") || "关键词筛选"}
              </div>
              <div className="text-xs text-text-tertiary mt-1">
                {t("literature_keyword_filter_hint") ||
                  "检索完成后在本地筛选，可切换查看“未匹配”以检查是否存在遗漏。"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <SegmentedControl
                options={[
                  { value: "any", label: t("literature_match_any") || "任意匹配" },
                  { value: "all", label: t("literature_match_all") || "全部匹配" },
                ]}
                value={keywordMode}
                onChange={setKeywordMode}
                className="min-w-[220px]"
              />
              <button
                type="button"
                onClick={() => setKeywordInput("")}
                className="px-3 py-2 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-200 transition-colors"
              >
                {t("literature_clear_keywords") || "清空关键词"}
              </button>
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
              className="w-full px-3 py-2.5 rounded-xl bg-bg-page border border-border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 text-sm text-text-primary placeholder:text-text-tertiary resize-y"
            />
            <div className="mt-2 text-xs text-text-tertiary">
              {(t("literature_keywords_count") || "当前关键词") +
                `：${keywords.length}`}
            </div>
          </div>
        </div>

        {status.state === "done" && sortedResults.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[240px] border-2 border-dashed border-border rounded-2xl text-text-secondary bg-bg-surface/30">
            <p className="text-lg font-medium">
              {t("literature_no_results") || "没有找到符合条件的文章"}
            </p>
            <p className="text-sm mt-1">
              {t("literature_no_results_hint") || "尝试调整日期范围或入口链接。"}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {visibleResults.map((item) => (
            <article
              key={item?.id || item?.articleUrl || item?.title}
              className="bg-bg-surface/60 border border-border rounded-2xl p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={item?.articleUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-text-primary font-semibold hover:text-accent transition-colors truncate"
                      title={item?.title}
                    >
                      {item?.title || item?.articleUrl}
                    </a>

                    <button
                      type="button"
                      onClick={() => handleDownload(item?.downloadUrl)}
                      disabled={!item?.downloadable || !item?.downloadUrl}
                      className={`p-2 rounded-xl border transition-colors ${
                        item?.downloadable && item?.downloadUrl
                          ? "border-border text-text-secondary hover:text-text-primary hover:bg-bg-200"
                          : "border-border text-text-tertiary opacity-40 cursor-not-allowed"
                      }`}
                      title={
                        item?.downloadable
                          ? t("literature_download") || "下载"
                          : t("literature_download_unavailable") ||
                            "无可下载文件"
                      }
                    >
                      <Download size={16} />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-xs text-text-tertiary">
                    <span className="uppercase tracking-wide">
                      {item?.source || "-"}
                    </span>
                    <span>·</span>
                    <span>{item?.publishedDate || "-"}</span>
                    {item?.doi && (
                      <>
                        <span>·</span>
                        <span className="truncate">DOI: {item.doi}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {item?.abstract ||
                  (t("literature_no_abstract") || "（该条目暂无摘要）")}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default LiteratureResearch;
