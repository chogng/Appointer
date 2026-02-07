import React from "react";
import { FileDown, Loader2, ListChecks, ListX, RefreshCw } from "lucide-react";
import { useLanguage } from "../../../hooks/useLanguage";
import Tabs from "../../../components/ui/Tabs";
import Card from "../../../components/ui/Card";

const ResultsCard = ({
  resultView,
  onResultViewChange,
  sortedResults,
  matchedResults,
  unmatchedResults,
  groupedResults,
  selectedCount,
  selectionToggleAction,
  onToggleSelectAllVisible,
  isExportingDocx,
  statusState,
  visibleResultsLength,
  exportDocxLabel,
  onExportDocx,
  onExportJson,
  onClearPageSession,
  isAnyTranslationInFlight,
  renderResultCards,
}) => {
  const { t } = useLanguage();

  return (
    <section aria-label={t("literature_results_title")}>
      <h2 className="section_title">{t("literature_results_title")}</h2>
      <Card
        cta="Literature research"
        ctaPosition="result-panel"
        ctaCopy="card"
        className="min-h-[600px]"
        aria-label={t("literature_results_title")}
      >
        <div className="toolbar_group">
          <Tabs
            options={[
              {
                value: "all",
                label: `${t("literature_view_all")} (${sortedResults.length})`,
                cta: "Literature research",
                ctaPosition: "result",
                ctaCopy: "all",
              },
              {
                value: "matched",
                label: `${t("literature_view_matched")} (${matchedResults.length})`,
                cta: "Literature research",
                ctaPosition: "result",
                ctaCopy: "matched",
              },
              {
                value: "unmatched",
                label: `${t("literature_view_unmatched")} (${unmatchedResults.length})`,
                cta: "Literature research",
                ctaPosition: "result",
                ctaCopy: "unmatched",
              },
            ]}
            value={resultView}
            onChange={onResultViewChange}
            idBase="literature-results-view"
            groupLabel="Results view"
          />

          <div className="flex items-center gap-2">
            <div className="text-xs text-text-tertiary px-2">
              <span>{t("literature_selected_count")}：</span>
              <span className="">{selectedCount}</span>
            </div>

            <button
              type="button"
              id="literature-selection-toggle"
              data-icon="with"
              data-cta="Literature research"
              data-cta-position="result"
              data-cta-copy={selectionToggleAction === "deselect-all" ? "deselect all" : "select all"}
              className={`action-btn action-btn--control ${
                isExportingDocx || statusState === "loading" || visibleResultsLength === 0
                  ? "action-btn--disabled"
                  : "action-btn--ghost"
              }`}
              aria-label={
                selectionToggleAction === "deselect-all"
                  ? t("literature_deselect_all_filtered")
                  : t("literature_select_all_filtered")
              }
              title={
                selectionToggleAction === "deselect-all"
                  ? t("literature_deselect_all_filtered")
                  : t("literature_select_all_filtered")
              }
              onClick={onToggleSelectAllVisible}
              disabled={isExportingDocx || statusState === "loading" || visibleResultsLength === 0}
              data-action={selectionToggleAction}
            >
              <span className="action-btn__content">
                {selectionToggleAction === "deselect-all" ? (
                  <ListX size={16} />
                ) : (
                  <ListChecks size={16} />
                )}
              </span>
            </button>

            <button
              type="button"
              id="literature-export-docx"
              data-icon="with"
              data-cta="Literature research"
              data-cta-position="result"
              data-cta-copy="export docx"
              className={`action-btn action-btn--md ${
                isExportingDocx || selectedCount === 0 ? "action-btn--disabled" : "action-btn--primary"
              }`}
              aria-label={exportDocxLabel}
              title={exportDocxLabel}
              onClick={onExportDocx}
              disabled={isExportingDocx || selectedCount === 0}
            >
              <span className="action-btn__content">
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
              id="literature-export-json"
              data-icon="with"
              data-cta="Literature research"
              data-cta-position="result"
              data-cta-copy="export json"
              className={`action-btn action-btn--md ${
                isExportingDocx || selectedCount === 0 ? "action-btn--disabled" : "action-btn--primary"
              }`}
              aria-label={t("literature_export_json")}
              title={t("literature_export_json")}
              onClick={onExportJson}
              disabled={isExportingDocx || selectedCount === 0}
            >
              <span className="action-btn__content">
                <FileDown size={16} />
                {"JSON"}
              </span>
            </button>

            <button
              type="button"
              id="literature-clear-session"
              className={`action-btn action-btn--control ${
                isExportingDocx || statusState === "loading" || isAnyTranslationInFlight
                  ? "action-btn--disabled"
                  : "action-btn--ghost"
              }`}
              aria-label={t("literature_clear_session")}
              title={t("literature_clear_session")}
              onClick={onClearPageSession}
              disabled={isExportingDocx || statusState === "loading" || isAnyTranslationInFlight}
            >
              <span className="action-btn__content">
                <RefreshCw size={16} className="transition-transform duration-500 hover:rotate-180" />
              </span>
            </button>
          </div>
        </div>

        {statusState === "done" && sortedResults.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-text-secondary">
            <p className="text-lg font-medium">{t("literature_no_results")}</p>
            <p className="text-sm mt-1">{t("literature_no_results_hint")}</p>
          </div>
        )}

        {groupedResults
          .filter((group) => Array.isArray(group?.visibleItems) && group.visibleItems.length > 0)
          .map((group) => {
            return (
              <Card key={group.key} className="mt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div
                      className="text-sm font-semibold text-text-primary truncate"
                      title={group.title}
                      data-ui="literature-results-group-title"
                      data-group-key={group.key}
                    >
                      {group.title}
                    </div>
                  </div>
                </div>

                <div className="mt-4">{renderResultCards(group.visibleItems)}</div>
              </Card>
            );
          })}
      </Card>
    </section>
  );
};

export default ResultsCard;
