import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Card from "../../../components/ui/Card";
import { useLanguage } from "../../../hooks/useLanguage";
import { stableItemKey } from "../../../utils/stableKey";

const PREVIEW_ROW_OVERSCAN = 12;
const DEFAULT_PREVIEW_ROW_HEIGHT_PX = 44;

const DataPreviewTable = ({ processedData }) => {
  const { t } = useLanguage();
  const [activeFileId, setActiveFileId] = useState(
    processedData?.[0]?.fileId ?? null,
  );
  const previewScrollRef = useRef(null);
  const previewScrollTopRef = useRef(0);
  const previewScrollRafRef = useRef(0);
  const contentPaddingRef = useRef({ top: 0, bottom: 0 });
  const measureRowRef = useRef(null);
  const measuredRowHeightKeyRef = useRef(null);

  const fileById = useMemo(() => {
    const map = new Map();
    for (const file of processedData ?? []) {
      if (file?.fileId) map.set(file.fileId, file);
    }
    return map;
  }, [processedData]);

  const effectiveActiveFileId = useMemo(() => {
    if (!processedData?.length) return null;
    if (activeFileId && fileById.has(activeFileId)) return activeFileId;
    return processedData[0]?.fileId ?? null;
  }, [activeFileId, fileById, processedData]);

  const activeFile = useMemo(
    () => (effectiveActiveFileId ? fileById.get(effectiveActiveFileId) : null),
    [effectiveActiveFileId, fileById],
  );

  const xRangeLabel = useMemo(() => {
    if (!activeFile?.x) return "";
    const start = `${activeFile.x.colLabel}${activeFile.x.startRow}`;
    const end = `${activeFile.x.colLabel}${activeFile.x.endRow}`;
    return `${start}-${end}`;
  }, [activeFile]);

  const [activeSeriesId, setActiveSeriesId] = useState(null);

  const effectiveActiveSeriesId = useMemo(() => {
    if (!activeFile?.series?.length) return null;
    if (
      activeSeriesId &&
      activeFile.series.some((s) => s.id === activeSeriesId)
    ) {
      return activeSeriesId;
    }
    return activeFile.series[0].id;
  }, [activeFile, activeSeriesId]);

  const activeSeries = useMemo(
    () =>
      activeFile?.series?.find((s) => s.id === effectiveActiveSeriesId) ?? null,
    [activeFile, effectiveActiveSeriesId],
  );

  const [previewRowHeightPx, setPreviewRowHeightPx] = useState(
    DEFAULT_PREVIEW_ROW_HEIGHT_PX,
  );
  const [previewViewportHeight, setPreviewViewportHeight] = useState(0);
  const [previewStartRow, setPreviewStartRow] = useState(0);

  const updatePreviewViewport = useCallback(() => {
    const el = previewScrollRef.current;
    if (!el) return;

    const computed = window.getComputedStyle(el);
    const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computed.paddingBottom) || 0;
    contentPaddingRef.current = { top: paddingTop, bottom: paddingBottom };

    const innerHeight = (el.clientHeight || 0) - paddingTop - paddingBottom;
    setPreviewViewportHeight((prev) =>
      prev === innerHeight ? prev : Math.max(0, innerHeight),
    );
  }, []);

  const handlePreviewScroll = useCallback(() => {
    const el = previewScrollRef.current;
    if (!el) return;

    previewScrollTopRef.current = el.scrollTop || 0;
    if (previewScrollRafRef.current) return;

    previewScrollRafRef.current = requestAnimationFrame(() => {
      previewScrollRafRef.current = 0;
      const paddingTop = contentPaddingRef.current.top || 0;
      const effectiveScrollTop = Math.max(0, previewScrollTopRef.current - paddingTop);
      const rowIndex = Math.floor(effectiveScrollTop / previewRowHeightPx);
      const nextStart = Math.max(0, rowIndex - PREVIEW_ROW_OVERSCAN);
      setPreviewStartRow((prev) => (prev === nextStart ? prev : nextStart));
    });
  }, [previewRowHeightPx]);

  useEffect(() => {
    const el = previewScrollRef.current;
    if (!el) return;

    const onScroll = () => handlePreviewScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [handlePreviewScroll]);

  useEffect(() => {
    const el = previewScrollRef.current;
    if (!el) return;

    if (typeof ResizeObserver === "undefined") {
      const rafId = requestAnimationFrame(() => updatePreviewViewport());
      window.addEventListener("resize", updatePreviewViewport);
      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener("resize", updatePreviewViewport);
      };
    }

    const ro = new ResizeObserver(() => updatePreviewViewport());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updatePreviewViewport]);

  useEffect(() => {
    return () => {
      if (previewScrollRafRef.current) {
        cancelAnimationFrame(previewScrollRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const el = previewScrollRef.current;
    if (!el) return;

    previewScrollTopRef.current = 0;
    el.scrollTop = 0;

    const rafId = requestAnimationFrame(() => setPreviewStartRow(0));
    return () => cancelAnimationFrame(rafId);
  }, [effectiveActiveFileId, effectiveActiveSeriesId]);

  const rowHeightMeasureKey = `${effectiveActiveFileId ?? ""}::${effectiveActiveSeriesId ?? ""}`;
  const canMeasureRowHeight = Boolean(activeSeries?.data?.length);

  useLayoutEffect(() => {
    if (!canMeasureRowHeight) return;
    if (measuredRowHeightKeyRef.current === rowHeightMeasureKey) return;
    const el = measureRowRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const next = Math.round(rect.height);
    if (!Number.isFinite(next) || next <= 0) return;

    measuredRowHeightKeyRef.current = rowHeightMeasureKey;
    setPreviewRowHeightPx((prev) => (prev === next ? prev : next));
  }, [canMeasureRowHeight, rowHeightMeasureKey]);

  if (!processedData || processedData.length === 0) {
    return (
      <Card
        variant="panel"
        className="flex flex-col items-center justify-center p-12 text-text-secondary border border-dashed border-border bg-bg-surface/50 h-[300px]"
      >
        <p>{t("da_no_data_extracted")}</p>
        <p className="text-sm">
          {t("da_no_data_extracted_hint")}
        </p>
      </Card>
    );
  }

  return (
    <Card
      id="device-analysis-data-preview"
      className="flex flex-col h-[500px] p-0 overflow-hidden"
    >
      <div
        id="device-analysis-data-preview-file-tabs"
        className="flex items-center gap-1 p-2 border-b border-border overflow-x-auto"
      >
        {processedData.map((file) => (
          <button
            key={file.fileId}
            type="button"
            data-ui="device-analysis-preview-file-tab"
            data-item-key={stableItemKey("da-file", file.fileName)}
            aria-pressed={effectiveActiveFileId === file.fileId}
            onClick={() => setActiveFileId(file.fileId)}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
              ${effectiveActiveFileId === file.fileId
                ? "bg-accent/10 text-accent ring-1 ring-black"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-page"
              }
            `}
          >
            {file.fileName}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-bg-page/30">
        <div className="text-xs text-text-secondary">
          {activeFile?.x ? (
            <>
              X: {xRangeLabel} | points/group: {activeFile.x.points} | groups:{" "}
              {activeFile.x.groups}
            </>
          ) : (
            t("da_no_file_selected")
          )}
        </div>

        <select
          id="device-analysis-data-preview-series-select"
          aria-label={t("da_select_series")}
          value={effectiveActiveSeriesId ?? ""}
          onChange={(e) => setActiveSeriesId(e.target.value)}
          disabled={!activeFile?.series?.length}
          className="bg-bg-page border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-black max-w-[260px]"
          title={t("da_select_series")}
        >
          {activeFile?.series?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div
        ref={previewScrollRef}
        id="device-analysis-data-preview-scroll"
        className="flex-1 overflow-auto p-4 custom-scrollbar"
      >
        {activeSeries ? (
          <table className="w-full text-sm text-left border-collapse">
            <thead className="sticky top-0 bg-bg-surface box-shadow-sm z-10 transition-shadow duration-300">
              <tr>
                <th className="p-3 font-semibold text-text-secondary border-b border-border bg-bg-surface w-16">
                  #
                </th>
                <th className="p-3 font-semibold text-text-primary border-b border-border bg-bg-surface min-w-[140px]">
                  x
                </th>
                <th className="p-3 font-semibold text-text-primary border-b border-border bg-bg-surface min-w-[140px]">
                  y
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(() => {
                const data = Array.isArray(activeSeries?.data)
                  ? activeSeries.data
                  : [];
                const totalRows = data.length;
                if (!totalRows) return null;

                const visibleCount = Math.max(
                  1,
                  Math.ceil(
                    (previewViewportHeight || 300) /
                      (previewRowHeightPx || DEFAULT_PREVIEW_ROW_HEIGHT_PX),
                  ),
                );
                const startRow = Math.max(
                  0,
                  Math.min(totalRows - 1, previewStartRow),
                );
                const endRow = Math.max(
                  startRow + 1,
                  Math.min(totalRows, startRow + visibleCount + PREVIEW_ROW_OVERSCAN * 2),
                );

                const topSpacerHeight =
                  startRow * (previewRowHeightPx || DEFAULT_PREVIEW_ROW_HEIGHT_PX);
                const bottomSpacerHeight =
                  (totalRows - endRow) *
                  (previewRowHeightPx || DEFAULT_PREVIEW_ROW_HEIGHT_PX);

                const rows = [];
                for (let rowIndex = startRow; rowIndex < endRow; rowIndex++) {
                  const point = data[rowIndex] ?? { x: "", y: "" };
                  rows.push(
                    <tr
                      key={rowIndex}
                      ref={rowIndex === startRow ? measureRowRef : undefined}
                      className="hover:bg-bg-page/50 transition-colors"
                    >
                      <td className="p-3 text-text-secondary font-mono text-xs border-r border-border/50">
                        {rowIndex + 1}
                      </td>
                      <td className="p-3 text-text-primary font-mono whitespace-nowrap">
                        {point.x}
                      </td>
                      <td className="p-3 text-text-primary font-mono whitespace-nowrap">
                        {point.y}
                      </td>
                    </tr>,
                  );
                }

                return (
                  <>
                    {topSpacerHeight > 0 && (
                      <tr aria-hidden="true">
                        <td
                          colSpan={3}
                          className="p-0 border-0"
                          style={{ height: topSpacerHeight }}
                        />
                      </tr>
                    )}
                    {rows}
                    {bottomSpacerHeight > 0 && (
                      <tr aria-hidden="true">
                        <td
                          colSpan={3}
                          className="p-0 border-0"
                          style={{ height: bottomSpacerHeight }}
                        />
                      </tr>
                    )}
                  </>
                );
              })()}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-text-secondary">
            Select a series to view data
          </div>
        )}
      </div>

      <div className="p-2 border-t border-border bg-bg-page/50 text-xs text-text-secondary flex justify-between px-4">
        <span>Points: {activeSeries?.data?.length || 0}</span>
        <span>Series: {activeFile?.series?.length || 0}</span>
      </div>
    </Card>
  );
};

export default React.memo(DataPreviewTable);
