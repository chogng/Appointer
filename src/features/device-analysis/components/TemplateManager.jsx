import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Trash2,
  ArrowUp,
  ChevronDown,
  List,
  Save,
  Plus,
  Copy,
  FileSpreadsheet,
  Square,
  Check,
} from "lucide-react";
import { apiService } from "../../../services/apiService";
import { useAuth } from "../../../hooks/useAuth";
import { useLanguage } from "../../../hooks/useLanguage";
import Toast from "../../../components/ui/Toast";
import Tabs from "../../../components/ui/Tabs";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import { formatNumber } from "./analysisMath";
import {
  validateTemplateForApply,
  validateTemplateForSave,
  validateVarPair,
} from "./templateValidation";

const formatPreviewCell = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return formatNumber(value, { digits: 4 });
  if (typeof value !== "string") return String(value);

  if (!value) return value;
  if (!value.includes("e") && !value.includes("E")) return value;

  const trimmed = value.trim();
  if (!trimmed) return value;

  const num = Number(trimmed);
  if (!Number.isFinite(num)) return value;
  return formatNumber(num, { digits: 4 });
};

const lowerBound = (arr, value) => {
  let lo = 0;
  let hi = Array.isArray(arr) ? arr.length : 0;
  const target = Number(value);
  if (!Number.isFinite(target) || hi === 0) return 0;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (Number(arr[mid]) < target) lo = mid + 1;
    else hi = mid;
  }

  return lo;
};

const noopSubscribe = () => () => {};
const getZero = () => 0;
const EMPTY_ARRAY = [];

const PreviewRow = React.memo(
  ({
    rowIndex,
    rowCellsRaw,
    hasLeftColSpacer,
    hasRightColSpacer,
    visibleColumnIndices,
    selectedColumnsSet,
    handleCellMouseDown,
  }) => {
    const rowLabel = rowIndex + 1;
    const rowCells = Array.isArray(rowCellsRaw) ? rowCellsRaw : EMPTY_ARRAY;
    const isRowLoaded = Array.isArray(rowCellsRaw);

    return (
      <tr>
        <td className="p-1 h-7 border-b border-r border-border font-mono text-xs text-center select-none bg-bg-surface text-text-secondary w-12 align-middle sticky left-0 z-10">
          {rowLabel}
        </td>
        {hasLeftColSpacer && (
          <td
            aria-hidden="true"
            className="p-0 h-7 border-b border-r border-border bg-transparent"
          />
        )}
        {visibleColumnIndices.map((idx) => {
          const cell = rowCells[idx] ?? "";
          const raw = isRowLoaded ? String(cell) : "";
          const display = isRowLoaded ? formatPreviewCell(cell) : "";
          return (
            <td
              key={idx}
              data-row={rowIndex}
              data-col={idx}
              className={`
                            px-2 py-1 h-7 border-b border-r border-border last:border-r-0 whitespace-nowrap text-xs transition-colors cursor-default overflow-hidden text-ellipsis
                            ${selectedColumnsSet.has(idx) ? "bg-accent/5 border-accent/20 text-text-primary" : "text-text-secondary"}

                          `}
              onMouseDown={handleCellMouseDown}
              title={raw}
            >
              {display}
            </td>
          );
        })}
        {hasRightColSpacer && (
          <td
            aria-hidden="true"
            className="p-0 h-7 border-b border-border bg-transparent"
          />
        )}
      </tr>
    );
  },
);

PreviewRow.displayName = "PreviewRow";

const PreviewTbody = ({
  subscribePreviewRowsVersion,
  getPreviewRowsVersion,
  previewWindow,
  previewRenderColCount,
  hasLeftColSpacer,
  hasRightColSpacer,
  visibleColumnIndices,
  selectedColumnsSet,
  getPreviewRow,
  handleCellMouseDown,
}) => {
  const previewRowsSubscribe =
    typeof subscribePreviewRowsVersion === "function"
      ? subscribePreviewRowsVersion
      : noopSubscribe;
  const previewRowsGetSnapshot =
    typeof getPreviewRowsVersion === "function" ? getPreviewRowsVersion : getZero;

  useSyncExternalStore(
    previewRowsSubscribe,
    previewRowsGetSnapshot,
    previewRowsGetSnapshot,
  );

  const rows = [];
  for (
    let rowIndex = previewWindow.startRow;
    rowIndex < previewWindow.endRow;
    rowIndex++
  ) {
    const rowCellsRaw =
      typeof getPreviewRow === "function" ? getPreviewRow(rowIndex) : null;
    rows.push(
      <PreviewRow
        key={rowIndex}
        rowIndex={rowIndex}
        rowCellsRaw={rowCellsRaw}
        hasLeftColSpacer={hasLeftColSpacer}
        hasRightColSpacer={hasRightColSpacer}
        visibleColumnIndices={visibleColumnIndices}
        selectedColumnsSet={selectedColumnsSet}
        handleCellMouseDown={handleCellMouseDown}
      />,
    );
  }

  return (
    <tbody>
      {previewWindow.topSpacerHeight > 0 && (
        <tr aria-hidden="true">
          <td
            colSpan={previewRenderColCount}
            className="p-0 border-0"
            style={{ height: previewWindow.topSpacerHeight }}
          />
        </tr>
      )}
      {rows}
      {previewWindow.bottomSpacerHeight > 0 && (
        <tr aria-hidden="true">
          <td
            colSpan={previewRenderColCount}
            className="p-0 border-0"
            style={{ height: previewWindow.bottomSpacerHeight }}
          />
        </tr>
      )}
    </tbody>
  );
};

PreviewTbody.displayName = "PreviewTbody";

const TemplateManager = ({
  previewFile,
  previewStatus,
  getPreviewRow,
  ensurePreviewRows,
  onTemplateApplied,
  subscribePreviewRowsVersion,
  getPreviewRowsVersion,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [templates, setTemplates] = useState([]);
  const [, setInputSources] = useState({}); // { [fieldName]: 'manual' | 'picked' }

  // Default config
  const [config, setConfig] = useState({
    name: "",
    xDataStart: "",
    xDataEnd: "",
    xPoints: "",
    yDataStart: "",
    yDataEnd: "",
    yPoints: "",
    yCount: "",
    yStep: "",
    stopOnError: false,
    bottomTitle: "",
    leftTitle: "",
    legendPrefix: "",
    fileNameVgKeywords: "",
    fileNameVdKeywords: "",
    selectedColumns: [], // Array of indices
  });

  const [toast, setToast] = useState({
    isVisible: false,
    message: "",
    type: "success",
  });

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [templateMode, setTemplateMode] = useState("select"); // "select" | "save"
  const dropdownRef = useRef(null);
  const isSelectMode = templateMode === "select";

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showToast = useCallback((message, type = "warning") => {
    setToast({ isVisible: true, message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  }, []);

  const varPairValidation = validateVarPair(
    config?.bottomTitle,
    config?.legendPrefix,
    t,
  );
  const hasVarInputs =
    Boolean(String(config?.bottomTitle ?? "").trim()) ||
    Boolean(String(config?.legendPrefix ?? "").trim());
  const hasFileNameInputs =
    Boolean(String(config?.fileNameVgKeywords ?? "").trim()) ||
    Boolean(String(config?.fileNameVdKeywords ?? "").trim());
  const curveTaggingConflict = hasVarInputs && hasFileNameInputs;
  const disableVarInputs = hasFileNameInputs && !hasVarInputs;
  const disableFileNameInputs = hasVarInputs && !hasFileNameInputs;
  const lastVarPairToastRef = useRef("");

  const toastVarPairIfInvalid = useCallback(() => {
    if (varPairValidation.ok) {
      lastVarPairToastRef.current = "";
      return;
    }

    const message =
      varPairValidation.message || t("da_invalidVarPair");
    if (lastVarPairToastRef.current === message) return;
    lastVarPairToastRef.current = message;
    showToast(message, "warning");
  }, [showToast, t, varPairValidation.ok, varPairValidation.message]);

  const markFieldSource = useCallback((field, source) => {
    if (!field || (source !== "manual" && source !== "picked")) return;
    setInputSources((prev) => ({ ...(prev || {}), [field]: source }));
  }, []);

  const writeFieldFromPreview = useCallback(
    (field, value) => {
      setConfig((prev) => ({ ...prev, [field]: value }));
      markFieldSource(field, "picked");
    },
    [markFieldSource],
  );

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      if (!user?.id) {
        setTemplates([]);
        return;
      }

      try {
        const remote = await apiService.getDeviceAnalysisTemplates();
        if (cancelled) return;

        const remoteTemplates = Array.isArray(remote) ? remote : [];
        setTemplates(remoteTemplates);
      } catch (err) {
        if (!cancelled) {
          showToast(
            t("da_loadTemplatesFailed", {
              error: err?.message || t("unknownError"),
            }),
          );
        }
      }
    };

    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [showToast, t, user?.id]);

  const [selections, setSelections] = useState([]);
  const gridRef = useRef(null);
  const previewScrollRef = useRef(null);
  const previewTableRef = useRef(null);
  const dragOverlayRef = useRef(null);
  const dragRef = useRef({
    startRow: null,
    startCol: null,
    endRow: null,
    endCol: null,
    startCellEl: null,
    endCellEl: null,
  });
  const isDraggingRef = useRef(false);
  const rafRef = useRef(0);
  const pendingPointRef = useRef(null);
  const containerRef = useRef(null);
  // Intentionally no persistent "last template" storage; session is memory-only.

  const PREVIEW_ROW_HEIGHT_PX = 28; // tailwind h-7 ~= 28px
  const PREVIEW_OVERSCAN_ROWS = 12;
  const PREVIEW_ROW_INDEX_COL_PX = 48;
  const PREVIEW_COL_MIN_PX = 120;
  const PREVIEW_COL_MAX_PX = 420;
  const PREVIEW_COL_CHAR_PX = 7;
  const PREVIEW_COL_PADDING_PX = 44;
  const PREVIEW_COL_RESIZE_MIN_PX = 80;
  const PREVIEW_COL_RESIZE_MAX_PX = 800;
  const PREVIEW_COL_OVERSCAN_PX = 240;

  const previewScrollTopRef = useRef(0);
  const previewScrollLeftRef = useRef(0);
  const previewScrollRafRef = useRef(0);
  const [previewStartRow, setPreviewStartRow] = useState(0);
  const [previewScrollLeft, setPreviewScrollLeft] = useState(0);
  const [previewViewportHeight, setPreviewViewportHeight] = useState(0);
  const [previewViewportWidth, setPreviewViewportWidth] = useState(0);
  const [isColumnResizing, setIsColumnResizing] = useState(false);

  const [columnWidthOverridesByFile, setColumnWidthOverridesByFile] = useState(
    {},
  );
  const columnResizeRafRef = useRef(0);
  const pendingColumnResizeRef = useRef(null);
  const liveColumnLayoutRef = useRef({
    fileId: null,
    widths: [],
    tableWidth: 0,
  });

  const handlePreviewScroll = useCallback(
    (scrollTop, scrollLeft) => {
      previewScrollTopRef.current = scrollTop;
      previewScrollLeftRef.current = scrollLeft;
      if (previewScrollRafRef.current) return;
      previewScrollRafRef.current = requestAnimationFrame(() => {
        previewScrollRafRef.current = 0;
        const scrollRow = Math.floor(
          previewScrollTopRef.current / PREVIEW_ROW_HEIGHT_PX,
        );
        const nextStart = Math.max(0, scrollRow - PREVIEW_OVERSCAN_ROWS);
        setPreviewStartRow((prev) => (prev === nextStart ? prev : nextStart));

        const nextLeft = Math.max(0, previewScrollLeftRef.current || 0);
        setPreviewScrollLeft((prev) => (prev === nextLeft ? prev : nextLeft));
      });
    },
    [PREVIEW_OVERSCAN_ROWS, PREVIEW_ROW_HEIGHT_PX],
  );

  useEffect(() => {
    const el = previewScrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      handlePreviewScroll(el.scrollTop, el.scrollLeft);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, [handlePreviewScroll, previewFile?.fileId]);

  useEffect(() => {
    const el = previewScrollRef.current;
    if (!el) return;

    let rafId = 0;
    const commitSize = (height, width) => {
      setPreviewViewportHeight((prev) => (prev === height ? prev : height));
      setPreviewViewportWidth((prev) => (prev === width ? prev : width));
    };

    const scheduleCommit = (height, width) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        commitSize(height, width);
      });
    };

    if (typeof ResizeObserver === "undefined") {
      const updateSizeFallback = () => {
        const rect = el.getBoundingClientRect();
        scheduleCommit(Math.round(rect.height), Math.round(rect.width));
      };

      updateSizeFallback();
      window.addEventListener("resize", updateSizeFallback);
      return () => {
        window.removeEventListener("resize", updateSizeFallback);
        if (rafId) cancelAnimationFrame(rafId);
      };
    }

    const ro = new ResizeObserver((entries) => {
      const entry = Array.isArray(entries) ? entries[0] : null;
      const rect = entry?.contentRect;
      if (!rect) return;
      scheduleCommit(Math.round(rect.height), Math.round(rect.width));
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [previewFile?.fileId]);

  useEffect(() => {
    return () => {
      if (previewScrollRafRef.current) {
        cancelAnimationFrame(previewScrollRafRef.current);
      }
      if (columnResizeRafRef.current) {
        cancelAnimationFrame(columnResizeRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Preserve scroll position across file switches for easier cross-file comparison.
    // Sync internal state to the DOM's current scrollTop (browser may clamp it).
    const el = previewScrollRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      const top = el.scrollTop || 0;
      const left = el.scrollLeft || 0;
      previewScrollTopRef.current = top;
      previewScrollLeftRef.current = left;
      handlePreviewScroll(top, left);
    });
  }, [getPreviewRow, handlePreviewScroll, writeFieldFromPreview, previewFile?.columnCount]);

  const handleSaveTemplate = async () => {
    const name = config.name.trim();
    if (!name) return;

    const previewReady =
      previewStatus?.state === "ready" && Boolean(previewFile?.fileId);
    if (!previewReady) {
      showToast("Please load a file first.", "warning");
      return;
    }

    const validation = validateTemplateForSave(config, t);
    if (!validation.ok) {
      showToast(validation.message || "Invalid configuration", "warning");
      return;
    }

    try {
      const created = await apiService.createDeviceAnalysisTemplate({
        ...validation.normalized,
        name,
      });

      setTemplates((prev) => {
        const normalized = String(created?.name || "").trim();
        return [
          created,
          ...prev.filter(
            (t) =>
              t?.id !== created?.id &&
              String(t?.name || "").trim() !== normalized,
          ),
        ];
      });
      setConfig((prev) => ({ ...prev, name: "" }));
      showToast("Template saved", "success");
      setTemplateMode("select");
    } catch (err) {
      showToast(err.message || "Failed to save template", "warning");
    }
  };

  const handleDeleteTemplate = async (id) => {
    try {
      await apiService.deleteDeviceAnalysisTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      showToast(err.message || "Failed to delete template", "warning");
    }
  };

  useEffect(() => {
    const startCell = String(config.xDataStart ?? "").trim();
    const endValue = String(config.xDataEnd ?? "").trim();

    if (startCell) {
      if (!endValue) {
        setConfig((prev) => ({ ...prev, xDataEnd: "End" }));
      }
      return;
    }

    if (endValue && endValue.toLowerCase() === "end") {
      setConfig((prev) => ({ ...prev, xDataEnd: "" }));
    }
  }, [config.xDataEnd, config.xDataStart]);

  const loadTemplate = useCallback(
    (template) => {
      setInputSources({});

      const rest = {
        name: template?.name ?? "",
        xDataStart: template?.xDataStart ?? "",
        xDataEnd: template?.xDataEnd ?? "",
        xPoints: template?.xPoints ?? "",
        yDataStart: template?.yDataStart ?? "",
        yDataEnd: template?.yDataEnd ?? "",
        yPoints: template?.yPoints ?? "",
        yCount: template?.yCount ?? "",
        yStep: template?.yStep ?? "",
        stopOnError: Boolean(template?.stopOnError),
        bottomTitle: template?.bottomTitle ?? template?.vgKeyword ?? "",
        leftTitle: template?.leftTitle ?? "",
        legendPrefix: template?.legendPrefix ?? template?.vdKeyword ?? "",
        fileNameVgKeywords:
          template?.fileNameVgKeywords ?? template?.vgFileKeywords ?? "",
        fileNameVdKeywords:
          template?.fileNameVdKeywords ?? template?.vdFileKeywords ?? "",
        selectedColumns: Array.isArray(template?.selectedColumns)
          ? template.selectedColumns
          : null,
      };

      const startCell = String(rest.xDataStart ?? "").trim();
      const xDataEndRaw = String(rest.xDataEnd ?? "").trim();
      const xDataEnd = !xDataEndRaw
        ? startCell
          ? "End"
          : ""
        : xDataEndRaw.toLowerCase() === "end"
          ? "End"
          : rest.xDataEnd;
      setConfig((prev) => ({
        ...prev,
        ...rest,
        xDataEnd,
        selectedColumns: Array.isArray(rest.selectedColumns)
          ? rest.selectedColumns
          : prev.selectedColumns,
      }));
      setIsDropdownOpen(false);
    },
    [],
  );

  // No auto-load from browser storage.

  const applyConfiguration = () => {
    const validation = validateTemplateForApply(config, t);
    if (!validation.ok) {
      showToast(validation.message || "Invalid configuration", "warning");
      return;
    }

    // Keep UI state in sync (e.g. when user types "a1" we store "A1").
    if (
      validation.normalized.bottomTitle !== config.bottomTitle ||
      validation.normalized.legendPrefix !== config.legendPrefix ||
      validation.normalized.fileNameVgKeywords !== config.fileNameVgKeywords ||
      validation.normalized.fileNameVdKeywords !== config.fileNameVdKeywords
    ) {
      setConfig(validation.normalized);
    }

    const result = onTemplateApplied?.(validation.normalized);
    if (result && typeof result === "object") {
      if (result.ok === false) {
        showToast(result.message || "Invalid configuration", result.type);
        return;
      }
      if (result.ok === true && result.message) {
        showToast(result.message, result.type || "success");
      }
    }
  };

  const normalizeRange = useCallback((range) => {
    if (!range) return null;
    const startRow = Math.min(range.startRow, range.endRow);
    const endRow = Math.max(range.startRow, range.endRow);
    const startCol = Math.min(range.startCol, range.endCol);
    const endCol = Math.max(range.startCol, range.endCol);
    return { startRow, endRow, startCol, endCol };
  }, []);

  const getExcelColumnLabel = useCallback((index) => {
    let label = "";
    let i = index;
    while (i >= 0) {
      label = String.fromCharCode(65 + (i % 26)) + label;
      i = Math.floor(i / 26) - 1;
    }
    return label;
  }, []);

  const columnCount = useMemo(() => {
    if (Number.isFinite(previewFile?.columnCount))
      return previewFile.columnCount;

    const maxLens = Array.isArray(previewFile?.maxCellLengths)
      ? previewFile.maxCellLengths
      : [];
    if (maxLens.length) return maxLens.length;

    return 0;
  }, [previewFile]);

  const selectedColumnsSet = useMemo(
    () => new Set(config.selectedColumns),
    [config.selectedColumns],
  );

  const clampNumber = (value, min, max) => {
    return Math.min(max, Math.max(min, value));
  };

  const autoColumnWidthsPx = useMemo(() => {
    const maxLens = Array.isArray(previewFile?.maxCellLengths)
      ? previewFile.maxCellLengths
      : [];

    const count = Number.isFinite(previewFile?.columnCount)
      ? previewFile.columnCount
      : maxLens.length;

    const widths = new Array(count);
    for (let i = 0; i < count; i++) {
      const maxLen = Number(maxLens[i]) || 0;
      const estimated = maxLen * PREVIEW_COL_CHAR_PX + PREVIEW_COL_PADDING_PX;
      const base = maxLen > 0 ? estimated : 160;
      widths[i] = clampNumber(base, PREVIEW_COL_MIN_PX, PREVIEW_COL_MAX_PX);
    }
    return widths;
  }, [previewFile]);

  const columnWidthOverrides = useMemo(() => {
    const fileId = previewFile?.fileId;
    if (!fileId) return {};
    return columnWidthOverridesByFile[fileId] ?? {};
  }, [columnWidthOverridesByFile, previewFile?.fileId]);

  const columnWidthsPx = useMemo(() => {
    const widths = new Array(columnCount);
    for (let i = 0; i < columnCount; i++) {
      const override = Number(columnWidthOverrides?.[i]);
      if (Number.isFinite(override) && override > 0) {
        widths[i] = clampNumber(
          override,
          PREVIEW_COL_RESIZE_MIN_PX,
          PREVIEW_COL_RESIZE_MAX_PX,
        );
        continue;
      }
      widths[i] = autoColumnWidthsPx[i] ?? PREVIEW_COL_MIN_PX;
    }
    return widths;
  }, [autoColumnWidthsPx, columnCount, columnWidthOverrides]);

  const columnStartOffsetsPx = useMemo(() => {
    const offsets = new Array(columnCount + 1);
    let total = 0;
    offsets[0] = 0;
    for (let i = 0; i < columnCount; i++) {
      const w = Number(columnWidthsPx[i]) || PREVIEW_COL_MIN_PX;
      total += w;
      offsets[i + 1] = total;
    }
    return offsets;
  }, [columnCount, columnWidthsPx]);

  const totalDataWidthPx = columnStartOffsetsPx[columnCount] ?? 0;
  const previewTableWidthPx = PREVIEW_ROW_INDEX_COL_PX + totalDataWidthPx;

  const getColumnWidthPx = (colIndex) => {
    return columnWidthsPx[colIndex] ?? PREVIEW_COL_MIN_PX;
  };

  const initLiveColumnLayout = (fileId) => {
    if (!fileId) {
      liveColumnLayoutRef.current = { fileId: null, widths: [], tableWidth: 0 };
      return liveColumnLayoutRef.current;
    }

    const widths = columnWidthsPx.slice(0, columnCount);
    const tableWidth = previewTableWidthPx;

    const next = { fileId, widths, tableWidth };
    liveColumnLayoutRef.current = next;
    return next;
  };

  const previewColWindow = useMemo(() => {
    if (!columnCount) {
      return { startCol: 0, endCol: 0, leftSpacerPx: 0, rightSpacerPx: 0 };
    }

    const viewportWidth = previewViewportWidth || 0;
    const dataViewportWidth = Math.max(0, viewportWidth - PREVIEW_ROW_INDEX_COL_PX);
    const scrollLeft = Math.max(0, previewScrollLeft || 0);

    const left = Math.max(0, scrollLeft - PREVIEW_COL_OVERSCAN_PX);
    const right = Math.min(
      totalDataWidthPx,
      scrollLeft + dataViewportWidth + PREVIEW_COL_OVERSCAN_PX,
    );

    let startCol = lowerBound(columnStartOffsetsPx, left);
    if (startCol > 0) startCol -= 1;
    startCol = Math.max(0, Math.min(columnCount - 1, startCol));

    let endCol = lowerBound(columnStartOffsetsPx, right);
    endCol = Math.max(startCol + 1, Math.min(columnCount, endCol));

    return {
      startCol,
      endCol,
      leftSpacerPx: Math.max(0, Number(columnStartOffsetsPx[startCol]) || 0),
      rightSpacerPx: Math.max(
        0,
        totalDataWidthPx - (Number(columnStartOffsetsPx[endCol]) || 0),
      ),
    };
  }, [
    PREVIEW_COL_OVERSCAN_PX,
    PREVIEW_ROW_INDEX_COL_PX,
    columnCount,
    columnStartOffsetsPx,
    previewScrollLeft,
    previewViewportWidth,
    totalDataWidthPx,
  ]);

  const visibleColumnIndices = useMemo(() => {
    const start = Math.max(0, Math.floor(Number(previewColWindow.startCol) || 0));
    const end = Math.max(start, Math.floor(Number(previewColWindow.endCol) || 0));
    const len = Math.max(0, end - start);
    return Array.from({ length: len }, (_, i) => start + i);
  }, [previewColWindow.endCol, previewColWindow.startCol]);

  const applyColumnWidthToDom = (fileId, colIndex, width) => {
    if (!fileId) return;

    const live = liveColumnLayoutRef.current;
    if (live?.fileId !== fileId || live?.widths?.length !== columnCount) {
      initLiveColumnLayout(fileId);
    }

    const current = liveColumnLayoutRef.current;
    const prevWidth = Number(current?.widths?.[colIndex]);
    const clamped = clampNumber(
      width,
      PREVIEW_COL_RESIZE_MIN_PX,
      PREVIEW_COL_RESIZE_MAX_PX,
    );

    if (!Number.isFinite(prevWidth) || prevWidth <= 0) {
      current.widths[colIndex] = clamped;
    } else if (clamped !== prevWidth) {
      current.widths[colIndex] = clamped;
      current.tableWidth += clamped - prevWidth;
    }

    const tableEl = previewTableRef.current;
    if (!tableEl) return;

    tableEl.style.setProperty(`--da-preview-col-${colIndex}-w`, `${clamped}px`);

    if (Number.isFinite(current.tableWidth) && current.tableWidth > 0) {
      tableEl.style.setProperty(
        "--da-preview-table-width",
        `${current.tableWidth}px`,
      );
    }
  };

  const flushPendingColumnResize = () => {
    const pending = pendingColumnResizeRef.current;
    pendingColumnResizeRef.current = null;
    if (!pending) return null;
    applyColumnWidthToDom(pending.fileId, pending.colIndex, pending.width);
    return pending;
  };

  const scheduleColumnResizeDomUpdate = (fileId, colIndex, width) => {
    pendingColumnResizeRef.current = { fileId, colIndex, width };
    if (columnResizeRafRef.current) return;

    columnResizeRafRef.current = requestAnimationFrame(() => {
      columnResizeRafRef.current = 0;
      flushPendingColumnResize();
    });
  };

  const resetColumnWidth = (fileId, colIndex) => {
    const auto = autoColumnWidthsPx[colIndex] ?? PREVIEW_COL_MIN_PX;
    applyColumnWidthToDom(fileId, colIndex, auto);

    setColumnWidthOverridesByFile((prev) => {
      const existing = prev[fileId];
      if (!existing || !(colIndex in existing)) return prev;

      const nextForFile = { ...existing };
      delete nextForFile[colIndex];
      return { ...prev, [fileId]: nextForFile };
    });
  };

  const handleColumnResizeStart = (event, colIndex) => {
    const fileId = previewFile?.fileId;
    if (!fileId) return;

    event.preventDefault();
    event.stopPropagation();

    const resizerEl = event.currentTarget;
    const pointerId = event.pointerId;

    if (resizerEl?.setPointerCapture && Number.isFinite(pointerId)) {
      try {
        resizerEl.setPointerCapture(pointerId);
      } catch {
        // ignore
      }
    }

    setIsColumnResizing(true);

    initLiveColumnLayout(fileId);

    const startX = event.clientX;
    const startWidthRaw = Number(
      liveColumnLayoutRef.current?.widths?.[colIndex],
    );
    const startWidth = Number.isFinite(startWidthRaw)
      ? startWidthRaw
      : getColumnWidthPx(colIndex);

    const handleMove = (moveEvent) => {
      if (Number.isFinite(pointerId) && moveEvent.pointerId !== pointerId)
        return;
      const delta = moveEvent.clientX - startX;
      scheduleColumnResizeDomUpdate(fileId, colIndex, startWidth + delta);
    };

    const cleanup = () => {
      flushPendingColumnResize();

      const live = liveColumnLayoutRef.current;
      const finalWidth =
        live?.fileId === fileId ? Number(live?.widths?.[colIndex]) : null;

      if (Number.isFinite(finalWidth) && finalWidth > 0) {
        setColumnWidthOverridesByFile((prev) => {
          const existing = prev[fileId] ?? {};
          const nextForFile = { ...existing, [colIndex]: finalWidth };
          return { ...prev, [fileId]: nextForFile };
        });
      }

      pendingColumnResizeRef.current = null;
      if (columnResizeRafRef.current) {
        cancelAnimationFrame(columnResizeRafRef.current);
        columnResizeRafRef.current = 0;
      }

      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("blur", cleanup);

      setIsColumnResizing(false);

      if (resizerEl?.releasePointerCapture && Number.isFinite(pointerId)) {
        try {
          resizerEl.releasePointerCapture(pointerId);
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
    window.addEventListener("blur", cleanup);
  };

  const previewWindow = (() => {
    const totalRows = Number.isFinite(previewFile?.rowCount)
      ? previewFile.rowCount
      : 0;
    if (!totalRows) {
      return {
        totalRows: 0,
        startRow: 0,
        endRow: 0,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      };
    }

    const viewportHeight = previewViewportHeight || 500;
    const visibleCount = Math.max(
      1,
      Math.ceil(viewportHeight / PREVIEW_ROW_HEIGHT_PX),
    );
    const startRow = Math.max(0, Math.min(totalRows - 1, previewStartRow));
    const endRow = Math.max(
      startRow + 1,
      Math.min(totalRows, startRow + visibleCount + PREVIEW_OVERSCAN_ROWS * 2),
    );

    return {
      totalRows,
      startRow,
      endRow,
      topSpacerHeight: startRow * PREVIEW_ROW_HEIGHT_PX,
      bottomSpacerHeight: (totalRows - endRow) * PREVIEW_ROW_HEIGHT_PX,
    };
  })();

  const hasLeftColSpacer = previewColWindow.leftSpacerPx > 0;
  const hasRightColSpacer = previewColWindow.rightSpacerPx > 0;
  const previewRenderColCount =
    1 +
    (hasLeftColSpacer ? 1 : 0) +
    visibleColumnIndices.length +
    (hasRightColSpacer ? 1 : 0);

  useEffect(() => {
    if (!previewFile?.fileId) return;
    if (typeof ensurePreviewRows !== "function") return;

    // Keep the visible (plus overscan) window warm in cache.
    void ensurePreviewRows(
      previewFile.fileId,
      previewWindow.startRow,
      previewWindow.endRow,
    );
  }, [
    ensurePreviewRows,
    previewFile?.fileId,
    previewWindow.endRow,
    previewWindow.startRow,
  ]);

  const toggleColumn = (index) => {
    setConfig((prev) => {
      const isSelected = prev.selectedColumns.includes(index);
      if (isSelected) {
        return {
          ...prev,
          selectedColumns: prev.selectedColumns.filter((i) => i !== index),
        };
      } else {
        return { ...prev, selectedColumns: [...prev.selectedColumns, index] };
      }
    });
  };

  const hideDragOverlay = useCallback(() => {
    const overlay = dragOverlayRef.current;
    if (!overlay) return;
    overlay.style.display = "none";
    overlay.style.width = "0px";
    overlay.style.height = "0px";
    overlay.style.transform = "translate3d(0px, 0px, 0)";
  }, []);

  const getRectFromCells = useCallback((startCellEl, endCellEl) => {
    const gridEl = gridRef.current;
    if (!gridEl || !startCellEl || !endCellEl) return null;

    const gridRect = gridEl.getBoundingClientRect();
    const startRect = startCellEl.getBoundingClientRect();
    const endRect = endCellEl.getBoundingClientRect();

    const left = Math.min(startRect.left, endRect.left) - gridRect.left;
    const top = Math.min(startRect.top, endRect.top) - gridRect.top;
    const right = Math.max(startRect.right, endRect.right) - gridRect.left;
    const bottom = Math.max(startRect.bottom, endRect.bottom) - gridRect.top;

    return {
      left,
      top,
      width: right - left,
      height: bottom - top,
    };
  }, []);

  const renderDragOverlay = useCallback(
    (startCellEl, endCellEl) => {
      const overlay = dragOverlayRef.current;
      const rect = getRectFromCells(startCellEl, endCellEl);
      if (!overlay || !rect) return;

      overlay.style.display = "block";
      overlay.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
    },
    [getRectFromCells],
  );

  const clearSelection = useCallback(() => {
    setSelections([]);
    isDraggingRef.current = false;
    dragRef.current = {
      startRow: null,
      startCol: null,
      endRow: null,
      endCol: null,
      startCellEl: null,
      endCellEl: null,
    };
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    pendingPointRef.current = null;
    hideDragOverlay();
  }, [hideDragOverlay]);

  const handleCellMouseDown = useCallback(
    (event) => {
      if (event.button !== 0) return; // left mouse only
      if (event.target?.tagName === "INPUT") return; // don't interfere with checkbox clicks

      const cellEl = event.currentTarget;
      const rowIndex = Number(cellEl?.dataset?.row);
      const colIndex = Number(cellEl?.dataset?.col);
      if (Number.isNaN(rowIndex) || Number.isNaN(colIndex)) return;

      const activeElement = document.activeElement;
      if (
        activeElement &&
        activeElement &&
        [
          "templateName",
          "xDataStart",
          "xDataEnd",
          "xPoints",
          "yDataStart",
          "yDataEnd",
          "yPoints",
          "yCount",
          "yStep",
          "yStep",
          "bottomTitle",
          "leftTitle",
          "legendPrefix",
        ].includes(activeElement.name)
      ) {
        event.preventDefault(); // Prevent input blur
        if (activeElement.name === "templateName") {
          const colLabel = getExcelColumnLabel(colIndex);
          const rowLabel = rowIndex + 1;
          writeFieldFromPreview("name", `${colLabel}${rowLabel}`);
        } else if (activeElement.name === "xDataStart") {
          const colLabel = getExcelColumnLabel(colIndex);
          const rowLabel = rowIndex + 1;
          writeFieldFromPreview("xDataStart", `${colLabel}${rowLabel}`);
        } else if (activeElement.name === "xDataEnd") {
          const colLabel = getExcelColumnLabel(colIndex);
          const rowLabel = rowIndex + 1;
          writeFieldFromPreview("xDataEnd", `${colLabel}${rowLabel}`);
        } else if (activeElement.name === "xPoints") {
          const colLabel = getExcelColumnLabel(colIndex);
          const rowLabel = rowIndex + 1;
          writeFieldFromPreview("xPoints", `${colLabel}${rowLabel}`);
        } else if (activeElement.name === "yDataStart") {
          const colLabel = getExcelColumnLabel(colIndex);
          const rowLabel = rowIndex + 1;
          writeFieldFromPreview("yDataStart", `${colLabel}${rowLabel}`);
        } else if (activeElement.name === "yDataEnd") {
          const colLabel = getExcelColumnLabel(colIndex);
          const rowLabel = rowIndex + 1;
          writeFieldFromPreview("yDataEnd", `${colLabel}${rowLabel}`);
        } else if (activeElement.name === "yPoints") {
          const colLabel = getExcelColumnLabel(colIndex);
          const rowLabel = rowIndex + 1;
          writeFieldFromPreview("yPoints", `${colLabel}${rowLabel}`);
        } else if (activeElement.name === "yCount") {
          const colLabel = getExcelColumnLabel(colIndex);
          const rowLabel = rowIndex + 1;
          writeFieldFromPreview("yCount", `${colLabel}${rowLabel}`);
        } else if (activeElement.name === "yStep") {
          const colLabel = getExcelColumnLabel(colIndex);
          const rowLabel = rowIndex + 1;
          writeFieldFromPreview("yStep", `${colLabel}${rowLabel}`);
        } else if (activeElement.name === "bottomTitle") {
          const colLabel = getExcelColumnLabel(colIndex);
          const rowLabel = rowIndex + 1;
          writeFieldFromPreview("bottomTitle", `${colLabel}${rowLabel}`);
        } else if (activeElement.name === "leftTitle") {
          const colLabel = getExcelColumnLabel(colIndex);
          const rowLabel = rowIndex + 1;
          writeFieldFromPreview("leftTitle", `${colLabel}${rowLabel}`);
        } else if (activeElement.name === "legendPrefix") {
          const colLabel = getExcelColumnLabel(colIndex);
          const rowLabel = rowIndex + 1;
          writeFieldFromPreview("legendPrefix", `${colLabel}${rowLabel}`);
        }
        return;
      }

      event.preventDefault();

      // Always replace the previous selection (no additive selection).
      setSelections([]);

      isDraggingRef.current = true;
      dragRef.current = {
        startRow: rowIndex,
        startCol: colIndex,
        endRow: rowIndex,
        endCol: colIndex,
        startCellEl: cellEl,
        endCellEl: cellEl,
      };

      renderDragOverlay(cellEl, cellEl);
    },
    [getExcelColumnLabel, renderDragOverlay, writeFieldFromPreview],
  );

  useEffect(() => {
    const updateDragFromPoint = (clientX, clientY) => {
      if (!isDraggingRef.current) return;
      const gridEl = gridRef.current;
      if (!gridEl) return;

      const element = document.elementFromPoint(clientX, clientY);
      const cellEl = element?.closest?.("td[data-row][data-col]");
      if (!cellEl || !gridEl.contains(cellEl)) return;

      const rowIndex = Number(cellEl.dataset.row);
      const colIndex = Number(cellEl.dataset.col);
      if (Number.isNaN(rowIndex) || Number.isNaN(colIndex)) return;

      const current = dragRef.current;
      if (current.endRow === rowIndex && current.endCol === colIndex) return;

      dragRef.current = {
        ...current,
        endRow: rowIndex,
        endCol: colIndex,
        endCellEl: cellEl,
      };
      renderDragOverlay(current.startCellEl, cellEl);
    };

    const handleMouseMove = (event) => {
      if (!isDraggingRef.current) return;

      pendingPointRef.current = { x: event.clientX, y: event.clientY };
      if (rafRef.current) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const point = pendingPointRef.current;
        pendingPointRef.current = null;
        if (!point) return;
        updateDragFromPoint(point.x, point.y);
      });
    };

    const finalizeDragSelection = () => {
      if (!isDraggingRef.current) return;

      isDraggingRef.current = false;
      pendingPointRef.current = null;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }

      const current = dragRef.current;
      const normalized = normalizeRange({
        startRow: current.startRow,
        startCol: current.startCol,
        endRow: current.endRow,
        endCol: current.endCol,
      });

      const rect = getRectFromCells(current.startCellEl, current.endCellEl);

      dragRef.current = {
        startRow: null,
        startCol: null,
        endRow: null,
        endCol: null,
        startCellEl: null,
        endCellEl: null,
      };

      hideDragOverlay();

      if (!normalized || !rect) return;

      setSelections([
        {
          id: `${Date.now()}_${Math.random()}`,
          range: normalized,
          rect,
        },
      ]);
    };

    const handleMouseUp = () => finalizeDragSelection();

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("blur", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("blur", handleMouseUp);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [getRectFromCells, hideDragOverlay, normalizeRange, renderDragOverlay]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      clearSelection();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [clearSelection, previewFile?.fileId]);

  const buildSelectionTsv = useCallback(() => {
    if (!previewFile?.fileId || selections.length === 0) return "";
    if (typeof getPreviewRow !== "function") return "";

    const blocks = selections
      .map((selection) => selection.range)
      .filter(Boolean)
      .map((range) => {
        const rows = [];
        for (let r = range.startRow; r <= range.endRow; r++) {
          const rowCellsRaw = getPreviewRow(r);
          const rowCells = Array.isArray(rowCellsRaw) ? rowCellsRaw : [];
          const cols = [];
          for (let c = range.startCol; c <= range.endCol; c++) {
            cols.push(String(rowCells[c] ?? ""));
          }
          rows.push(cols.join("\t"));
        }
        return rows.join("\n");
      });

    return blocks.join("\n\n");
  }, [getPreviewRow, previewFile?.fileId, selections]);

  const copySelection = useCallback(async () => {
    if (!previewFile?.fileId) return;
    if (typeof ensurePreviewRows === "function") {
      const ranges = selections.map((s) => s.range).filter(Boolean);
      await Promise.all(
        ranges.map((range) =>
          ensurePreviewRows(
            previewFile.fileId,
            range.startRow,
            range.endRow + 1,
          ),
        ),
      );
    }

    const text = buildSelectionTsv();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
  }, [buildSelectionTsv, ensurePreviewRows, previewFile, selections]);

  return (
    <section aria-label={t("da_data_extraction_template")}>
      <h2 className="section_title">{t("da_data_extraction_template")}</h2>

      <Card
        ref={containerRef}
        id="device-analysis-template-manager"
        className="p-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div>
              <div className="flex items-center justify-start gap-3 mb-2">
                <Tabs
                  value={templateMode}
                  onChange={(val) => {
                    setTemplateMode(val);
                    if (val === "save") setIsDropdownOpen(false);
                  }}
                  idBase="device-analysis-template-mode"
                  groupLabel={t("da_template_mode")}
                  options={[
                    {
                      value: "select",
                      label: t("da_template_mode_select"),
                      icon: List,
                      cta: "Device Analysis",
                      ctaPosition: "template-mode",
                      ctaCopy: "select",
                    },
                    {
                      value: "save",
                      label: t("da_template_mode_save"),
                      icon: Save,
                      cta: "Device Analysis",
                      ctaPosition: "template-mode",
                      ctaCopy: "save",
                    },
                  ]}
                />
              </div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                General Template
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0" ref={dropdownRef}>
                  <div className="flex items-center p-1 bg-bg-page border border-border rounded-lg shadow-sm transition-all relative z-10">
                    <input
                      type="text"
                      name="templateName"
                      autoComplete="off"
                      spellCheck={false}
                      value={config.name}
                      onChange={(e) => {
                        const next = e.target.value;
                        setConfig((prev) => ({ ...prev, name: next }));
                        markFieldSource("name", "manual");
                        if (templateMode === "select" && !isDropdownOpen) {
                          setIsDropdownOpen(true);
                        }
                      }}
                      onFocus={() => {
                        if (templateMode === "select") setIsDropdownOpen(true);
                      }}
                      placeholder={t("da_template_name")}
                      className={`flex-1 min-w-0 pl-2 py-1.5 bg-transparent border-none text-text-primary text-sm focus:outline-none focus:ring-0 placeholder:text-text-secondary no-focus-outline ${templateMode === "select" ? "pr-8" : "pr-2"}`}
                    />

                    {templateMode === "select" && (
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-accent transition-colors"
                      >
                        <ChevronDown
                          size={16}
                          className={`transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                    )}

                    {templateMode === "save" && (
                      <Button
                        type="button"
                        onClick={handleSaveTemplate}
                        disabled={!config.name.trim()}
                        variant="primary"
                        size="md"
                        fx
                        className="ml-2"
                        title={t("da_save_template")}
                      >
                        {t("da_template_mode_save")}
                        <ArrowUp size={16} />
                      </Button>
                    )}
                  </div>

                  {templateMode === "select" && isDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto p-1.5">
                      <div
                        className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-bg-page cursor-pointer group transition-colors mb-1 text-accent"
                        onClick={() => {
                          setTemplateMode("save");
                          setIsDropdownOpen(false);
                          setInputSources({});
                          setConfig({
                            name: "",
                            xDataStart: "",
                            xDataEnd: "",
                            xPoints: "",
                            yDataStart: "",
                            yDataEnd: "",
                            yPoints: "",
                            yCount: "",
                            yStep: "",
                            stopOnError: false,
                            bottomTitle: "",
                            leftTitle: "",
                            legendPrefix: "",
                            selectedColumns: [],
                          });
                        }}
                      >
                        <span className="flex-1 text-sm font-medium">{t("da_new_template")}</span>
                        <div className="p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus size={14} />
                        </div>
                      </div>
                      {templates.length > 0 ? (
                        templates.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-bg-page cursor-pointer group transition-colors mb-0.5 last:mb-0"
                            onClick={() => loadTemplate(t)}
                          >
                            <span className="flex-1 text-sm text-gray-700 font-medium truncate">
                              {t.name}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTemplate(t.id);
                              }}
                              className="p-1 text-text-primary hover:text-red-500 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity"
                              title="Delete template"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-500 italic text-center">
                          No saved templates
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {templateMode === "save" && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  X data
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
                  <div>
                    <input
                      type="text"
                      name="xDataStart"
                      autoComplete="off"
                      spellCheck={false}
                      value={config.xDataStart}
                      disabled={isSelectMode}
                      onChange={(e) => {
                        const next = e.target.value;
                        setConfig((prev) => ({ ...prev, xDataStart: next }));
                        markFieldSource("xDataStart", "manual");
                      }}
                      placeholder="Start"
                      className="w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary shadow-sm hover:border-gray-300 focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-black transition-all disabled:opacity-50 disabled:cursor-not-allowed no-focus-outline"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      name="xDataEnd"
                      autoComplete="off"
                      spellCheck={false}
                      value={config.xDataEnd}
                      disabled={isSelectMode}
                      onChange={(e) => {
                        const next = e.target.value;
                        setConfig((prev) => ({ ...prev, xDataEnd: next }));
                        markFieldSource("xDataEnd", "manual");
                      }}
                      onBlur={(e) => {
                        const value = String(e.target.value ?? "").trim();
                        if (!value) {
                          const startCell = String(
                            config.xDataStart ?? "",
                          ).trim();
                          setConfig((prev) => ({
                            ...prev,
                            xDataEnd: startCell ? "End" : "",
                          }));
                          return;
                        }
                        if (value.toLowerCase() === "end" && value !== "End") {
                          setConfig((prev) => ({ ...prev, xDataEnd: "End" }));
                        }
                      }}
                      placeholder="End"
                      className="w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary shadow-sm hover:border-gray-300 focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-black transition-all disabled:opacity-50 disabled:cursor-not-allowed no-focus-outline"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      name="xPoints"
                      autoComplete="off"
                      spellCheck={false}
                      value={config.xPoints}
                      disabled={isSelectMode}
                      onChange={(e) => {
                        const next = e.target.value;
                        setConfig((prev) => ({ ...prev, xPoints: next }));
                        markFieldSource("xPoints", "manual");
                      }}
                      placeholder="Points"
                      className="no-spinner w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary shadow-sm hover:border-gray-300 focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-black transition-all disabled:opacity-50 disabled:cursor-not-allowed no-focus-outline"
                    />
                  </div>
                </div>
              </div>
            )}

            {templateMode === "save" && (
              <div className="mt-2">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Var1
                    </label>
                    <input
                      type="text"
                      value={config.bottomTitle || ""}
                      name="bottomTitle"
                      autoComplete="off"
                      disabled={disableVarInputs}
                      onChange={(e) => {
                        const next = e.target.value;
                        setConfig((prev) => ({ ...prev, bottomTitle: next }));
                        markFieldSource("bottomTitle", "manual");
                      }}
                      onBlur={toastVarPairIfInvalid}
                      placeholder="Curve type"
                      className="w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary shadow-sm hover:border-gray-300 focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-black transition-all disabled:opacity-50 disabled:cursor-not-allowed no-focus-outline"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Var2
                    </label>
                    <input
                      type="text"
                      value={config.legendPrefix || ""}
                      name="legendPrefix"
                      autoComplete="off"
                      disabled={disableVarInputs}
                      onChange={(e) => {
                        const next = e.target.value;
                        setConfig((prev) => ({ ...prev, legendPrefix: next }));
                        markFieldSource("legendPrefix", "manual");
                      }}
                      onBlur={toastVarPairIfInvalid}
                      placeholder="Legend"
                      className="w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary shadow-sm hover:border-gray-300 focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-black transition-all disabled:opacity-50 disabled:cursor-not-allowed no-focus-outline"
                    />

                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Var3
                    </label>
                    <input
                      type="text"
                      value={config.leftTitle || ""}
                      name="leftTitle"
                      autoComplete="off"
                      onChange={(e) => {
                        const next = e.target.value;
                        setConfig((prev) => ({ ...prev, leftTitle: next }));
                        markFieldSource("leftTitle", "manual");
                      }}
                      placeholder="Left Title"
                      className="w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary shadow-sm hover:border-gray-300 focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-black transition-all no-focus-outline"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Match file name
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <input
                        type="text"
                        value={config.fileNameVgKeywords || ""}
                        name="fileNameVgKeywords"
                        autoComplete="off"
                        disabled={disableFileNameInputs}
                        onChange={(e) => {
                          const next = e.target.value;
                          setConfig((prev) => ({
                            ...prev,
                            fileNameVgKeywords: next,
                          }));
                          markFieldSource("fileNameVgKeywords", "manual");
                        }}
                        placeholder="Transfer"
                        className="w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary shadow-sm hover:border-gray-300 focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-black transition-all disabled:opacity-50 disabled:cursor-not-allowed no-focus-outline"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={config.fileNameVdKeywords || ""}
                        name="fileNameVdKeywords"
                        autoComplete="off"
                        disabled={disableFileNameInputs}
                        onChange={(e) => {
                          const next = e.target.value;
                          setConfig((prev) => ({
                            ...prev,
                            fileNameVdKeywords: next,
                          }));
                          markFieldSource("fileNameVdKeywords", "manual");
                        }}
                        placeholder="Output"
                        className="w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary shadow-sm hover:border-gray-300 focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-black transition-all disabled:opacity-50 disabled:cursor-not-allowed no-focus-outline"
                      />
                    </div>
                  </div>
                  {curveTaggingConflict && (
                    <p className="text-xs text-red-600 mt-1">
                      Var1/Var2 and file-name keywords cannot be used together.
                      Please clear one.
                    </p>
                  )}
                </div>
              </div>
            )}

            {templateMode === "save" && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Y data
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={
                        config.selectedColumns.length > 0
                          ? config.selectedColumns
                            .slice()
                            .sort((a, b) => a - b)
                            .map((col) => getExcelColumnLabel(col))
                            .join(", ")
                          : ""
                      }
                      placeholder="Check columns"
                      className="w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary shadow-sm focus:outline-none disabled:opacity-70 disabled:bg-gray-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      name="yPoints"
                      value={config.xPoints || config.yPoints}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={isSelectMode || !!config.xPoints}
                      onChange={(e) => {
                        const next = e.target.value;
                        setConfig((prev) => ({ ...prev, yPoints: next }));
                        markFieldSource("yPoints", "manual");
                      }}
                      placeholder="Points"
                      className="no-spinner w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary shadow-sm hover:border-gray-300 focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-black transition-all disabled:opacity-50 disabled:cursor-not-allowed no-focus-outline"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      name="yDataStart"
                      autoComplete="off"
                      spellCheck={false}
                      value={config.yDataStart}
                      disabled={isSelectMode}
                      onChange={(e) => {
                        const next = e.target.value;
                        setConfig((prev) => ({ ...prev, yDataStart: next }));
                        markFieldSource("yDataStart", "manual");
                      }}
                      placeholder="Start"
                      className="w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary shadow-sm hover:border-gray-300 focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-black transition-all disabled:opacity-50 disabled:cursor-not-allowed no-focus-outline"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      name="yCount"
                      value={config.yCount}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={isSelectMode}
                      onChange={(e) => {
                        const next = e.target.value;
                        setConfig((prev) => ({ ...prev, yCount: next }));
                        markFieldSource("yCount", "manual");
                      }}
                      placeholder="Count"
                      className="no-spinner w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary shadow-sm hover:border-gray-300 focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-black transition-all disabled:opacity-50 disabled:cursor-not-allowed no-focus-outline"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      name="yStep"
                      value={config.yStep}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={isSelectMode}
                      onChange={(e) => {
                        const next = e.target.value;
                        setConfig((prev) => ({ ...prev, yStep: next }));
                        markFieldSource("yStep", "manual");
                      }}
                      placeholder="Step"
                      className="no-spinner w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary shadow-sm hover:border-gray-300 focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-black transition-all disabled:opacity-50 disabled:cursor-not-allowed no-focus-outline"
                    />
                  </div>
                </div>
              </div>
            )}

            {templateMode !== "save" && (
              <button
                type="button"
                onClick={applyConfiguration}
                className="action-btn action-btn--md action-btn--fx action-btn--primary w-full mt-4"
              >
                <span className="action-btn__content">{t("da_apply_to_all_files")}</span>
              </button>
            )}

            {templateMode === "select" && (
              <div
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    stopOnError: !prev.stopOnError,
                  }))
                }
                className="mt-3 flex items-center gap-2 text-sm text-text-secondary select-none cursor-pointer group w-fit"
              >
                {config.stopOnError ? (
                  <div className="w-[18px] h-[18px] rounded bg-terracotta border-2 border-terracotta flex items-center justify-center transition-all">
                    <Check size={14} className="text-white" strokeWidth={3} />
                  </div>
                ) : (
                  <div className="w-[18px] h-[18px] rounded border-2 border-gray-300 group-hover:border-terracotta/50 transition-colors bg-white" />
                )}
                <span>{t("da_stop_on_first_invalid_file")}</span>
              </div>
            )}


          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-3 bg-bg-page border border-border rounded-lg p-4 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-secondary">
                Preview:{" "}
                {previewFile ? previewFile.fileName : "(No file loaded)"}
              </span>
              {previewStatus?.state === "loading" ? (
                <span className="text-xs text-text-secondary">
                  {previewStatus.message || "Loading preview..."}
                </span>
              ) : previewStatus?.state === "error" ? (
                <span className="text-xs text-red-500">
                  {previewStatus.message || "Preview failed to load"}
                </span>
              ) : null}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copySelection}
                  disabled={selections.length === 0}
                  className="p-1.5 rounded-md border border-border bg-bg-surface hover:bg-bg-page text-text-secondary hover:text-black disabled:opacity-50 transition-colors"
                  title="Copy selection as TSV"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>

            {previewStatus?.state === "loading" ? (
              <div className="flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50 h-[500px]">
                <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                  <FileSpreadsheet
                    width={32}
                    height={32}
                    className="text-gray-300"
                  />
                </div>
                <p className="text-sm font-medium text-text-secondary mb-1">
                  {previewStatus.message || t("da_preview_loading")}
                </p>
                <p className="text-xs text-text-tertiary">
                  {t("da_preview_loading_hint")}
                </p>
              </div>
            ) : previewStatus?.state === "error" ? (
              <div className="flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50 h-[500px]">
                <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                  <FileSpreadsheet
                    width={32}
                    height={32}
                    className="text-gray-300"
                  />
                </div>
                <p className="text-sm font-medium text-text-secondary mb-1">
                  {previewStatus.message || t("da_preview_error")}
                </p>
                <p className="text-xs text-text-tertiary">
                  {t("da_preview_error_hint")}
                </p>
              </div>
            ) : previewFile ? (
              <div
                ref={previewScrollRef}
                className={`overflow-auto border border-border rounded h-[500px] custom-scrollbar ${isColumnResizing ? "cursor-col-resize select-none" : ""}`}
              >
                <div
                  ref={gridRef}
                  className="relative min-w-full align-top select-none"
                >
                  <div className="absolute inset-0 pointer-events-none z-20">
                    {selections.map((selection) => (
                      <div
                        key={selection.id}
                        className="absolute border border-accent bg-accent/5 z-10"
                        style={{
                          left: selection.rect.left,
                          top: selection.rect.top,
                          width: selection.rect.width,
                          height: selection.rect.height,
                        }}
                      />
                    ))}
                    <div
                      ref={dragOverlayRef}
                      className="absolute border border-accent bg-accent/5 z-20"
                      style={{ display: "none" }}
                    />
                  </div>

                  <table
                    ref={previewTableRef}
                    className="text-sm text-left relative border-separate border-spacing-0 z-10 table-fixed"
                    style={{
                      width: `var(--da-preview-table-width, ${previewTableWidthPx}px)`,
                      tableLayout: "fixed",
                    }}
                  >
                    <colgroup>
                      <col style={{ width: PREVIEW_ROW_INDEX_COL_PX }} />
                      {hasLeftColSpacer && (
                        <col style={{ width: previewColWindow.leftSpacerPx }} />
                      )}
                      {visibleColumnIndices.map((idx) => (
                        <col
                          key={idx}
                          style={{
                            width: `var(--da-preview-col-${idx}-w, ${columnWidthsPx[idx] ?? PREVIEW_COL_MIN_PX}px)`,
                          }}
                        />
                      ))}
                      {hasRightColSpacer && (
                        <col style={{ width: previewColWindow.rightSpacerPx }} />
                      )}
                    </colgroup>
                    <thead className="bg-bg-surface sticky top-0 z-30 shadow-sm">
                      <tr>
                        <th className="p-1 border-b border-r border-border bg-bg-surface w-12 text-center font-bold text-xs text-text-secondary select-none sticky left-0 top-0 z-40"></th>
                        {hasLeftColSpacer && (
                          <th
                            aria-hidden="true"
                            className="p-0 border-b border-r border-border bg-bg-surface"
                          />
                        )}
                        {visibleColumnIndices.map((idx) => {
                          const isSelected = selectedColumnsSet.has(idx);
                          return (
                            <th
                              key={idx}
                              onClick={() => toggleColumn(idx)}
                              className={`px-2 py-1 border-b border-border border-r last:border-r-0 font-mono text-xs whitespace-nowrap bg-bg-surface font-semibold text-center select-none cursor-pointer relative pr-3 overflow-hidden ${isSelected ? "text-accent bg-accent/10 border-accent/30" : "text-text-secondary hover:bg-bg-page/60"}`}
                              title="Click to toggle Y column"
                            >
                              <div
                                className="flex items-center justify-center gap-2 cursor-pointer group"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleColumn(idx);
                                }}
                              >
                                <div className="relative flex items-center justify-center w-4 h-4">
                                  {isSelected ? (
                                    <div className="w-3.5 h-3.5 rounded bg-terracotta border border-terracotta flex items-center justify-center transition-all">
                                      <Check
                                        size={10}
                                        className="text-white"
                                        strokeWidth={4}
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-3.5 h-3.5 rounded border border-gray-300 group-hover:border-terracotta/50 transition-colors bg-white" />
                                  )}
                                </div>
                                <span>{getExcelColumnLabel(idx)}</span>
                              </div>
                              <div
                                role="separator"
                                aria-orientation="vertical"
                                title="Drag to resize • Double-click to reset"
                                onPointerDown={(e) =>
                                  handleColumnResizeStart(e, idx)
                                }
                                onClick={(e) => e.stopPropagation()}
                                onDoubleClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!previewFile?.fileId) return;
                                  resetColumnWidth(previewFile.fileId, idx);
                                }}
                                className="absolute top-0 right-0 h-full w-3 cursor-col-resize select-none hover:bg-accent/20 touch-none"
                              />
                            </th>
                          );
                        })}
                        {hasRightColSpacer && (
                          <th
                            aria-hidden="true"
                            className="p-0 border-b border-border bg-bg-surface"
                          />
                        )}
                      </tr>
                    </thead>
                    <PreviewTbody
                      subscribePreviewRowsVersion={subscribePreviewRowsVersion}
                      getPreviewRowsVersion={getPreviewRowsVersion}
                      previewWindow={previewWindow}
                      previewRenderColCount={previewRenderColCount}
                      hasLeftColSpacer={hasLeftColSpacer}
                      hasRightColSpacer={hasRightColSpacer}
                      visibleColumnIndices={visibleColumnIndices}
                      selectedColumnsSet={selectedColumnsSet}
                      getPreviewRow={getPreviewRow}
                      handleCellMouseDown={handleCellMouseDown}
                    />
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50 h-[500px]">
                <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                  <FileSpreadsheet
                    width={32}
                    height={32}
                    className="text-gray-300"
                  />
                </div>
                <p className="text-sm font-medium text-text-secondary mb-1">
                  No file loaded
                </p>
                <p className="text-xs text-text-tertiary">
                  Select a file from the list to preview data
                </p>
              </div>
            )}
          </div>
        </div>

        <Toast
          message={toast.message}
          isVisible={toast.isVisible}
          onClose={closeToast}
          type={toast.type}
          containerRef={containerRef}
          position="absolute"
        />
      </Card>
    </section>
  );
};

export default React.memo(TemplateManager);
