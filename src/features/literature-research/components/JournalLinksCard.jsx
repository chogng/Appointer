import React from "react";
import {
  Check,
  Link as LinkIcon,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useLanguage } from "../../../hooks/useLanguage";
import DatePicker from "../../../components/ui/DatePicker";
import Input from "../../../components/ui/Input";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";

const JournalLinksCard = ({
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  maxResults,
  onMaxResultsInputChange,
  onSettingsInputFocus,
  onSettingsInputBlur,
  onAddSeedUrl,
  onSearch,
  status,
  fetchProgress,
  seedUrlStats,
  seedUrls,
  seedUrlTitles,
  seedUrlSelected,
  onToggleSeedUrlSelectedAt,
  onSeedUrlChangeAt,
  onSeedUrlTitleChangeAt,
  onRemoveSeedUrlAt,
  seedUrlTitleBySeedUrl,
  resolveSeedUrlLabel,
}) => {
  const { t } = useLanguage();
  const unsupportedLabels = Array.isArray(seedUrlStats?.unsupportedLabels)
    ? seedUrlStats.unsupportedLabels
    : [];
  const unsupportedText = unsupportedLabels.join(" / ");
  const seedCountsText = [
    `${t("literature_source_nature")} ${seedUrlStats?.nature ?? 0}`,
    `${t("literature_source_science")} ${seedUrlStats?.science ?? 0}`,
    `${t("literature_source_acs")} ${seedUrlStats?.acs ?? 0}`,
    `${t("literature_source_wiley")} ${seedUrlStats?.wiley ?? 0}`,
    seedUrlStats?.unsupported
      ? `${t("literature_source_unsupported")} ${seedUrlStats.unsupported}`
      : null,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <section
      data-cta="Literature research"
      data-cta-position="journal-links"
      data-cta-copy="journal-links-section"
      aria-labelledby="literature-journal-links-title"
    >
      <h2 id="literature-journal-links-title" className="section_title">
        {t("journal_links")}
      </h2>
      <Card
        as="section"
        cta="Literature research"
        ctaPosition="journal-links"
        ctaCopy="journal-links-card"
        aria-label={t("journal_links")}
      >
        <div className="activity_card_head_warp p-0 mb-4">
          <div className="activity_card_headleft" aria-label="date filter wrap">
            <div className="date_btn_warp flex-none">
              <label className="date_btn_label">
                {t("literature_start_date")}
              </label>
              <DatePicker
                id="literature-start-date"
                value={startDate}
                onChange={onStartDateChange}
                placeholder={t("literature_start_date")}
                className="min-w-0"
                textClassName="hidden sm:block"
                aria-label="start date"
              />
            </div>

            <div className="date_btn_warp flex-none">
              <label className="date_btn_label">
                {t("literature_end_date")}
              </label>
              <DatePicker
                id="literature-end-date"
                value={endDate}
                onChange={onEndDateChange}
                placeholder={t("literature_end_date")}
                className="min-w-0"
                textClassName="hidden sm:block"
                aria-label="end date"
              />
            </div>

            <Input
              label={t("literature_max_results")}
              labelPlacement="inline"
              className="shrink-0"
              type="text"
              id="literature-max-results"
              name="maxResults"
              value={String(maxResults ?? "")}
              onChange={onMaxResultsInputChange}
              onFocus={onSettingsInputFocus}
              onBlur={onSettingsInputBlur}
              inputClassName="w-24"
              cta="Literature research"
              ctaPosition="date filter wrap"
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

          <div className="activity_card_headright">
            <div className="ui-button_row">
              <button
                type="button"
                id="literature-add-url"
                data-icon="with"
                data-cta="Literature research"
                data-cta-position="toolbar"
                data-cta-copy="add url"
                className="action-btn action-btn--md action-btn--ghost"
                aria-label="add url"
                onClick={onAddSeedUrl}
              >
                <span className="action-btn__content">
                  <Plus size={16} />
                  {t("literature_add_url")}
                </span>
              </button>

              <button
                type="button"
                id="literature-fetch"
                data-icon="with"
                data-cta="Literature research"
                data-cta-position="toolbar"
                data-cta-copy="fetch"
                className={`action-btn action-btn--md ${
                  status.state === "loading" ? "action-btn--disabled" : "action-btn--primary"
                }`}
                aria-label="fetch"
                onClick={onSearch}
                disabled={status.state === "loading"}
              >
                <span className="action-btn__content">
                  <Search size={16} />
                  {status.state === "loading" ? t("literature_fetching") : t("literature_fetch")}
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
              <span className="text-xs text-text-secondary whitespace-nowrap">
                ({seedCountsText})
              </span>
            </div>
            {seedUrlStats?.unsupported ? (
              <div className="mt-1 text-xs text-text-secondary truncate" title={unsupportedText}>
                {t("literature_source_unsupported")}: {unsupportedText || "-"}
              </div>
            ) : null}

            <div className="mt-3 space-y-2" id="literature-seed-url-list">
              {seedUrls.map((value, index) => (
                <div
                  key={`${index}`}
                  className="flex items-center gap-2 group"
                  data-seed-index={index}
                >
                  <button
                    type="button"
                    id={`literature-seed-url-select-${index}`}
                    data-cta="Literature research"
                    data-cta-position="seed-urls"
                    data-cta-copy="toggle include"
                    onClick={() =>
                      onToggleSeedUrlSelectedAt(index, seedUrlSelected[index] === false)
                    }
                    className="action-btn action-btn--control action-btn--ghost bg-bg-page"
                    aria-label={`Include seed url ${index + 1}`}
                    aria-pressed={seedUrlSelected[index] !== false}
                    title={seedUrlSelected[index] !== false ? "Include (Enabled)" : "Exclude (Disabled)"}
                    data-seed-index={index}
                  >
                    <span className="action-btn__content">
                      <Check size={16} className="ui-seed-url-check" />
                    </span>
                  </button>

                  <Input
                    id={`literature-seed-url-${index}`}
                    size="md"
                    value={value}
                    onChange={(nextValue) => onSeedUrlChangeAt(index, nextValue)}
                    onFocus={onSettingsInputFocus}
                    onBlur={onSettingsInputBlur}
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="off"
                    placeholder={t("literature_seed_url_placeholder")}
                    leftIcon={LinkIcon}
                    className="flex-1"
                    aria-label={`Seed url ${index + 1}`}
                    cta="Literature research"
                    ctaPosition="seed-urls"
                    ctaCopy={`seed-url-${index}`}
                    data-seed-index={index}
                  />

                  <Input
                    id={`literature-seed-url-title-${index}`}
                    name={`literature-seed-url-title-${index}`}
                    size="md"
                    value={seedUrlTitles[index] ?? ""}
                    onChange={(nextValue) => onSeedUrlTitleChangeAt(index, nextValue)}
                    onFocus={onSettingsInputFocus}
                    onBlur={onSettingsInputBlur}
                    placeholder={t("literature_seed_title_placeholder")}
                    className="w-44 shrink-0"
                    aria-label={`Seed title ${index + 1}`}
                    cta="Literature research"
                    ctaPosition="seed-urls"
                    ctaCopy={`seed-title-${index}`}
                    data-ui="literature-seed-url-title-input"
                    data-seed-url={value}
                    data-seed-index={index}
                  />

                  <Button
                    id={`literature-seed-url-remove-${index}`}
                    type="button"
                    onClick={() => onRemoveSeedUrlAt(index)}
                    title={t("literature_remove_url")}
                    aria-label={t("literature_remove_url")}
                    variant="danger"
                    size="control"
                    dataIcon="with"
                    cta="Literature research"
                    ctaPosition="seed-urls"
                    ctaCopy="remove url"
                    data-seed-index={index}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3" id="literature-fetch-progress">
          <div>
            <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-terracotta to-orange-400 transition-[width] duration-500 ease-out shadow-[0_0_8px_rgba(217,119,87,0.4)]"
                style={{
                  width: `${fetchProgress.total > 0
                    ? Math.round((fetchProgress.completed / fetchProgress.total) * 100)
                    : 0}%`,
                }}
              />
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-3 text-[11px] font-medium text-text-secondary select-none">
              <span className="shrink-0 flex items-center gap-2">
                <span className={status.state === "loading" ? "text-accent-terracotta" : "opacity-80"}>
                  {status.state === "loading"
                    ? t("literature_fetching")
                    : t("literature_status_ready")}
                </span>
                {status.state === "loading" && (
                  <span className="bg-accent-terracotta/10 text-accent-terracotta px-1.5 py-0.5 rounded text-[10px] font-mono">
                    {Math.min(fetchProgress.completed + 1, fetchProgress.total)}/{fetchProgress.total}
                  </span>
                )}
              </span>

              <span
                className="truncate opacity-60 font-mono text-[10px]"
                title={fetchProgress.activeSeedUrl}
                id="literature-fetch-progress-active-url"
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
              id="literature-fetch-progress-errors"
            >
              <div className="font-semibold">{"部分入口抓取失败："}</div>
              <div className="mt-2 space-y-2">
                {fetchProgress.errors.slice(0, 3).map((err) => (
                  <div
                    key={err.seedUrl}
                    className="flex flex-col gap-0.5"
                  >
                    <span className="block truncate" title={err.seedUrl}>
                      {seedUrlTitleBySeedUrl.get(err.seedUrl) ||
                        resolveSeedUrlLabel(err.seedUrl) ||
                        err.seedUrl}
                    </span>
                    <span className="block text-red-500/80 truncate" title={err.message}>
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
  );
};

export default JournalLinksCard;
