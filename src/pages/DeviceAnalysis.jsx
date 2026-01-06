import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BarChart2,
  Download,
  Table as TableIcon,
  Upload,
} from "lucide-react";
import Papa from "papaparse";
import JSZip from "jszip";
import CsvImporter from "../components/DeviceAnalysis/CsvImporter";
import TemplateManager from "../components/DeviceAnalysis/TemplateManager";
import DataPreviewTable from "../components/DeviceAnalysis/DataPreviewTable";
import AnalysisCharts from "../components/DeviceAnalysis/AnalysisCharts";

const DeviceAnalysis = () => {
  const importerRef = useRef(null);
  const [rawData, setRawData] = useState([]);
  const [selectedPreviewFileId, setSelectedPreviewFileId] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewStatus, setPreviewStatus] = useState({
    state: "idle", // 'idle' | 'loading' | 'ready' | 'error'
    message: "",
  });
  const [previewLoadedRowCount, setPreviewLoadedRowCount] = useState(0);
  const [processedData, setProcessedData] = useState([]);
  const [extractionErrors, setExtractionErrors] = useState([]);
  const [_processingStatus, setProcessingStatus] = useState({
    state: "idle", // 'idle' | 'processing' | 'done' | 'error'
    processed: 0,
    total: 0,
  });
  const [viewMode, setViewMode] = useState("chart"); // 'table' or 'chart'

  const previewWorkerRef = useRef(null);
  const previewRequestIdRef = useRef(0);
  const previewRowsRequestIdRef = useRef(0);
  const previewRowsRequestsRef = useRef(new Map());

  const previewRowsCacheRef = useRef(new Map());
  const previewLoadedChunksRef = useRef(new Set());
  const previewCacheFileIdRef = useRef(null);

  const PREVIEW_ROW_CHUNK_SIZE = 200;

  const processingWorkerRef = useRef(null);
  const processingJobIdRef = useRef(0);
  const processingQueueRef = useRef([]);
  const processingStopOnErrorRef = useRef(false);

  const _getExcelColumnLabel = (index) => {
    let label = "";
    let i = index;
    while (i >= 0) {
      label = String.fromCharCode(65 + (i % 26)) + label;
      i = Math.floor(i / 26) - 1;
    }
    return label;
  };

  const parseCellRef = (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return null;

    const match = trimmed.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;

    const colLabel = match[1];
    const rowNumber = Number(match[2]);
    if (!Number.isInteger(rowNumber) || rowNumber < 1) return null;

    let colIndex = 0;
    for (let i = 0; i < colLabel.length; i++) {
      colIndex = colIndex * 26 + (colLabel.charCodeAt(i) - 64);
    }
    colIndex -= 1;

    return { rowIndex: rowNumber - 1, colIndex };
  };

  const _parseNumberStrict = (raw) => {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const num = Number(trimmed);
      return Number.isFinite(num) ? num : null;
    }
    return null;
  };

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/deviceAnalysis.worker.js", import.meta.url),
      { type: "module" },
    );

    previewWorkerRef.current = worker;

    worker.onmessage = (event) => {
      const { type, payload } = event.data ?? {};
      if (type === "previewResult") {
        if (payload?.requestId !== previewRequestIdRef.current) return;

        previewRowsCacheRef.current = new Map();
        previewLoadedChunksRef.current = new Set();
        previewCacheFileIdRef.current = payload.fileId ?? null;
        setPreviewLoadedRowCount(0);

        setPreviewFile({
          fileId: payload.fileId,
          fileName: payload.fileName,
          rowCount: payload.rowCount,
          columnCount: payload.columnCount,
          maxCellLengths: payload.maxCellLengths,
        });
        setPreviewStatus({ state: "ready", message: "" });
        return;
      }

      if (type === "previewRowsResult") {
        const requestId = payload?.requestId ?? null;
        const pending = previewRowsRequestsRef.current.get(requestId);
        if (!pending) return;
        previewRowsRequestsRef.current.delete(requestId);

        const { resolve, reject } = pending;
        try {
          const fileId = payload?.fileId ?? null;
          const startRow = Number(payload?.startRow) || 0;
          const rows = Array.isArray(payload?.rows) ? payload.rows : [];

          if (fileId && previewCacheFileIdRef.current !== fileId) {
            // Ignore stale rows for an old preview file.
            resolve([]);
            return;
          }

          const cache = previewRowsCacheRef.current;
          for (let i = 0; i < rows.length; i++) {
            cache.set(startRow + i, rows[i]);
          }
          setPreviewLoadedRowCount(cache.size);
          resolve(rows);
        } catch (err) {
          reject(err);
        }
        return;
      }

      if (type === "workerError") {
        if (
          payload?.requestId !== previewRequestIdRef.current &&
          !previewRowsRequestsRef.current.has(payload?.requestId)
        ) {
          return;
        }

        if (previewRowsRequestsRef.current.has(payload?.requestId)) {
          const pending = previewRowsRequestsRef.current.get(
            payload?.requestId,
          );
          previewRowsRequestsRef.current.delete(payload?.requestId);
          pending?.reject?.(
            new Error(payload?.message || "Unknown worker error"),
          );
          return;
        }

        console.error("Preview worker error:", payload?.message);
        setPreviewStatus({
          state: "error",
          message: payload?.message ?? "Preview worker error",
        });
      }
    };

    return () => {
      worker.terminate();
      previewWorkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (processingWorkerRef.current) {
        processingWorkerRef.current.terminate();
        processingWorkerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!rawData.length) {
      setPreviewFile(null);
      setPreviewStatus({ state: "idle", message: "" });
      setSelectedPreviewFileId(null);
      return;
    }

    const effectiveFileId =
      selectedPreviewFileId &&
        rawData.some((f) => f.fileId === selectedPreviewFileId)
        ? selectedPreviewFileId
        : (rawData[0]?.fileId ?? null);

    const target = rawData.find((f) => f.fileId === effectiveFileId) ?? null;
    if (!target?.file || !target?.fileId) return;
    if (previewFile?.fileId === target.fileId) return;

    const worker = previewWorkerRef.current;
    if (!worker) return;

    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;

    setPreviewStatus({ state: "loading", message: "Parsing CSV preview…" });

    worker.postMessage({
      type: "preview",
      payload: {
        requestId,
        fileId: target.fileId,
        file: target.file,
        // 0 = no limit (cache all rows in worker)
        maxPreviewRows: 0,
      },
    });
  }, [previewFile?.fileId, rawData, selectedPreviewFileId]);

  const getPreviewRow = useCallback((rowIndex) => {
    const idx = Number(rowIndex);
    if (!Number.isInteger(idx) || idx < 0) return null;
    return previewRowsCacheRef.current.get(idx) ?? null;
  }, []);

  const requestPreviewRowsRange = useCallback((fileId, startRow, endRow) => {
    const worker = previewWorkerRef.current;
    if (!worker || !fileId) return Promise.resolve([]);

    const requestId = previewRowsRequestIdRef.current + 1;
    previewRowsRequestIdRef.current = requestId;

    const start = Math.max(0, Math.floor(Number(startRow) || 0));
    const end = Math.max(start, Math.floor(Number(endRow) || start));

    return new Promise((resolve, reject) => {
      previewRowsRequestsRef.current.set(requestId, { resolve, reject });
      worker.postMessage({
        type: "previewRows",
        payload: {
          requestId,
          fileId,
          startRow: start,
          endRow: end,
        },
      });
    });
  }, []);

  const ensurePreviewRows = useCallback(
    async (fileId, startRow, endRow) => {
      if (!previewFile?.rowCount || !Number.isFinite(previewFile.rowCount))
        return;
      if (!fileId) return;

      const totalRows = Math.max(0, Math.floor(previewFile.rowCount));
      const start = Math.max(0, Math.min(totalRows, Math.floor(startRow || 0)));
      const end = Math.max(start, Math.min(totalRows, Math.floor(endRow || 0)));
      if (start >= end) return;

      // Prefetch one extra chunk in both directions for smoother scrolling.
      const paddedStart = Math.max(0, start - PREVIEW_ROW_CHUNK_SIZE);
      const paddedEnd = Math.min(totalRows, end + PREVIEW_ROW_CHUNK_SIZE);

      const firstChunkStart =
        Math.floor(paddedStart / PREVIEW_ROW_CHUNK_SIZE) *
        PREVIEW_ROW_CHUNK_SIZE;
      const lastChunkStart =
        Math.floor((paddedEnd - 1) / PREVIEW_ROW_CHUNK_SIZE) *
        PREVIEW_ROW_CHUNK_SIZE;

      const promises = [];
      for (
        let chunkStart = firstChunkStart;
        chunkStart <= lastChunkStart;
        chunkStart += PREVIEW_ROW_CHUNK_SIZE
      ) {
        if (previewLoadedChunksRef.current.has(chunkStart)) continue;
        previewLoadedChunksRef.current.add(chunkStart);

        const chunkEnd = Math.min(
          totalRows,
          chunkStart + PREVIEW_ROW_CHUNK_SIZE,
        );
        const promise = requestPreviewRowsRange(
          fileId,
          chunkStart,
          chunkEnd,
        ).catch((err) => {
          previewLoadedChunksRef.current.delete(chunkStart);
          throw err;
        });
        promises.push(promise);
      }

      if (!promises.length) return;
      await Promise.all(promises);
    },
    [PREVIEW_ROW_CHUNK_SIZE, previewFile, requestPreviewRowsRange],
  );

  // Handler when CSV is imported
  const handleDataImported = (fileInfo) => {
    setRawData((prev) => [...prev, fileInfo]);
    if (fileInfo?.fileId) setSelectedPreviewFileId(fileInfo.fileId);
  };

  const handleDataRemoved = (fileId) => {
    const removedFileName =
      rawData.find((f) => f.fileId === fileId)?.fileName ?? null;

    if (selectedPreviewFileId === fileId) {
      const remaining = rawData.filter((f) => f.fileId !== fileId);
      setSelectedPreviewFileId(remaining[0]?.fileId ?? null);
    }

    setRawData((prev) => prev.filter((f) => f.fileId !== fileId));
    if (removedFileName) {
      setExtractionErrors((prev) =>
        prev.filter((e) => e.fileName !== removedFileName),
      );
    }
    if (previewFile?.fileId === fileId) {
      setPreviewFile(null);
      setPreviewStatus({ state: "idle", message: "" });
    }

    const worker = previewWorkerRef.current;
    if (worker) {
      worker.postMessage({
        type: "previewDispose",
        payload: { fileId },
      });
    }
  };

  const handlePreviewFileSelected = useCallback(
    (fileId) => {
      const next = typeof fileId === "string" ? fileId : null;
      if (!next) return;
      if (!rawData.some((f) => f.fileId === next)) return;
      setSelectedPreviewFileId(next);
    },
    [rawData],
  );

  // Handler when template is applied
  const handleTemplateApplied = (config) => {
    if (!rawData || rawData.length === 0) {
      return {
        ok: false,
        type: "warning",
        message: "Please import at least one CSV file first.",
      };
    }

    const warnings = [];
    const stopOnError = Boolean(config?.stopOnError);

    const xStart = parseCellRef(config?.xDataStart || "");
    if (!xStart) {
      return {
        ok: false,
        type: "warning",
        message: "Please set X Data start cell (e.g. A2).",
      };
    }

    const xEndRaw = String(config?.xDataEnd ?? "").trim();
    const useEndKeyword = !xEndRaw || xEndRaw.toLowerCase() === "end";

    if (!previewFile || !Number.isFinite(previewFile.rowCount)) {
      return {
        ok: false,
        type: "warning",
        message:
          "Preview is still loading. Please wait a moment and try again.",
      };
    }

    const previewRowCount = Math.max(0, Math.floor(previewFile.rowCount));

    const xEnd = useEndKeyword ? null : parseCellRef(xEndRaw);

    if (!useEndKeyword && !xEnd) {
      return {
        ok: false,
        type: "warning",
        message:
          "Please set X Data end cell (e.g. A1408) or use 'End' to read until the last preview row.",
      };
    }

    if (!useEndKeyword && xStart.colIndex !== xEnd.colIndex) {
      return {
        ok: false,
        type: "warning",
        message: "X Data start/end must be in the same column.",
      };
    }

    const xCol = xStart.colIndex;
    const endRow = useEndKeyword
      ? "end"
      : Math.max(xStart.rowIndex, xEnd.rowIndex);
    const startRow = useEndKeyword
      ? xStart.rowIndex
      : Math.min(xStart.rowIndex, xEnd.rowIndex);

    const total = useEndKeyword
      ? Math.max(0, previewRowCount - startRow)
      : endRow - startRow + 1;
    if (total <= 0) {
      return { ok: false, type: "warning", message: "Invalid X row range." };
    }

    const pointsRaw = String(config?.xPoints ?? "").trim();

    let groupSize = null;
    let groups = null;
    let groupSizeCell = null;
    let groupSizePreview = null;

    if (pointsRaw) {
      const pointsCell = parseCellRef(pointsRaw);
      if (pointsCell) {
        groupSizeCell = pointsCell;

        // Best-effort validation using the currently previewed file (may vary per file).
        const previewRow = getPreviewRow(pointsCell.rowIndex);
        if (previewRow) {
          const raw = previewRow?.[pointsCell.colIndex];
          const parsed = _parseNumberStrict(raw);
          const asInt =
            parsed !== null && Number.isInteger(parsed) ? parsed : null;

          if (asInt === null || asInt <= 0) {
            return {
              ok: false,
              type: "warning",
              message: `Points cell ${String(pointsRaw).toUpperCase()} must contain a positive integer.`,
            };
          }
          if (asInt > total) {
            return {
              ok: false,
              type: "warning",
              message: `Points from ${String(pointsRaw).toUpperCase()} (${asInt}) cannot be larger than the X range length (${total}).`,
            };
          }
          if (total % asInt !== 0) {
            return {
              ok: false,
              type: "warning",
              message: `X range has ${total} points, which is not divisible by points=${asInt} (from ${String(pointsRaw).toUpperCase()}).`,
            };
          }

          groupSizePreview = asInt;
        }
      } else {
        const points = Number(pointsRaw);
        if (!Number.isInteger(points) || points <= 0) {
          return {
            ok: false,
            type: "warning",
            message: "X Points must be a positive integer (or a cell like B2).",
          };
        }
        if (points > total) {
          return {
            ok: false,
            type: "warning",
            message: `X Points (${points}) cannot be larger than the X range length (${total}).`,
          };
        }
        groupSize = points;
      }
    }

    if (!groupSizeCell) {
      groupSize = groupSize ?? total;
      if (total % groupSize !== 0) {
        return {
          ok: false,
          type: "warning",
          message: `X range has ${total} points, which is not divisible by points=${groupSize}.`,
        };
      }
      groups = total / groupSize;
    }

    const yColsFromToggle = Array.isArray(config?.selectedColumns)
      ? config.selectedColumns
      : [];

    let yCols = yColsFromToggle;

    if (yCols.length === 0 && (config?.yDataStart || config?.yDataEnd)) {
      const yStart = parseCellRef(config?.yDataStart || "");
      const yEnd = parseCellRef(config?.yDataEnd || "");
      if (!yStart || !yEnd) {
        return {
          ok: false,
          type: "warning",
          message:
            "Y Data start/end must be valid cells (e.g. B2 and D2) or select columns in the preview header.",
        };
      }
      const yStartCol = Math.min(yStart.colIndex, yEnd.colIndex);
      const yEndCol = Math.max(yStart.colIndex, yEnd.colIndex);
      yCols = Array.from(
        { length: yEndCol - yStartCol + 1 },
        (_, i) => yStartCol + i,
      );
    }

    const uniqueYCols = Array.from(new Set(yCols)).sort((a, b) => a - b);

    if (uniqueYCols.length === 0) {
      return {
        ok: false,
        type: "warning",
        message:
          "Please select at least one Y column (click column headers in the preview).",
      };
    }
    if (uniqueYCols.includes(xCol)) {
      return {
        ok: false,
        type: "warning",
        message: "Y columns cannot include the X column.",
      };
    }

    const extractionConfig = {
      xCol,
      startRow,
      endRow,
      yCols: uniqueYCols,
    };

    // Optional: use Y Data start/count/step for plot legend labels.
    // When present, each "point" extracted from Y Data maps to a curve legend.
    const yLegendStartRaw = String(config?.yDataStart ?? "").trim();
    const yLegendCountRaw = String(config?.yCount ?? "").trim();
    const yLegendStepRaw = String(config?.yStep ?? "").trim();

    if (yLegendStartRaw && (yLegendCountRaw || yLegendStepRaw)) {
      const yLegendStartCell = parseCellRef(yLegendStartRaw);
      if (!yLegendStartCell) {
        warnings.push(
          "Y Data Start must be a valid cell (e.g. D1) when using Count/Step for legends.",
        );
      } else {
        extractionConfig.yLegendStartCell = yLegendStartCell;

        const parsePositiveIntOrCell = (raw, label) => {
          if (!raw) return null;
          const asCell = parseCellRef(raw);
          if (asCell) return { type: "cell", value: asCell };

          const asNumber = Number(raw);
          if (!Number.isInteger(asNumber) || asNumber <= 0) {
            warnings.push(
              `${label} must be a positive integer (or a cell like B2).`,
            );
            return null;
          }
          return { type: "number", value: asNumber };
        };

        const parsePositiveNumberOrCell = (raw, label) => {
          if (!raw) return null;
          const asCell = parseCellRef(raw);
          if (asCell) return { type: "cell", value: asCell };

          const asNumber = Number(raw);
          if (!Number.isFinite(asNumber) || asNumber <= 0) {
            warnings.push(
              `${label} must be a positive number (or a cell like B2).`,
            );
            return null;
          }
          return { type: "number", value: asNumber };
        };

        const countParsed = parsePositiveIntOrCell(
          yLegendCountRaw,
          "Y Data Count",
        );
        if (countParsed?.type === "cell") {
          extractionConfig.yLegendCountCell = countParsed.value;
        } else if (countParsed?.type === "number") {
          extractionConfig.yLegendCount = countParsed.value;
        }

        const stepParsed = parsePositiveNumberOrCell(
          yLegendStepRaw,
          "Y Data Step",
        );
        if (stepParsed?.type === "cell") {
          extractionConfig.yLegendStepCell = stepParsed.value;
        } else if (stepParsed?.type === "number") {
          extractionConfig.yLegendStep = stepParsed.value;
        }

        // Best-effort validation using the currently previewed file (may vary per file).
        if (extractionConfig.yLegendCountCell) {
          const previewRow = getPreviewRow(extractionConfig.yLegendCountCell.rowIndex);
          if (previewRow) {
            const raw = previewRow?.[extractionConfig.yLegendCountCell.colIndex];
            const parsed = _parseNumberStrict(raw);
            const asInt =
              parsed !== null && Number.isInteger(parsed) ? parsed : null;
            if (asInt === null || asInt <= 0) {
              warnings.push(
                `Y Data Count cell ${yLegendCountRaw.toUpperCase()} must contain a positive integer.`,
              );
            }
          }
        }
        if (extractionConfig.yLegendStepCell) {
          const previewRow = getPreviewRow(extractionConfig.yLegendStepCell.rowIndex);
          if (previewRow) {
            const raw = previewRow?.[extractionConfig.yLegendStepCell.colIndex];
            const parsed = _parseNumberStrict(raw);
            if (parsed === null || parsed <= 0) {
              warnings.push(
                `Y Data Step cell ${yLegendStepRaw.toUpperCase()} must contain a positive number.`,
              );
            }
          }
        }
      }
    }

    if (groupSizeCell) {
      extractionConfig.groupSizeCell = groupSizeCell;
    } else {
      extractionConfig.groupSize = groupSize;
      extractionConfig.groups = groups;
    }

    setProcessedData([]);
    setExtractionErrors([]);
    processingStopOnErrorRef.current = stopOnError;

    processingJobIdRef.current += 1;
    const jobId = processingJobIdRef.current;

    if (processingWorkerRef.current) {
      processingWorkerRef.current.terminate();
      processingWorkerRef.current = null;
    }

    const worker = new Worker(
      new URL("../workers/deviceAnalysis.worker.js", import.meta.url),
      { type: "module" },
    );
    processingWorkerRef.current = worker;

    const queue = rawData
      .filter((f) => f?.file)
      .map((f) => ({ fileId: f.fileId, fileName: f.fileName, file: f.file }));

    processingQueueRef.current = queue;
    setProcessingStatus({
      state: "processing",
      processed: 0,
      total: queue.length,
    });

    const processNext = () => {
      const next = processingQueueRef.current.shift();
      if (!next) {
        setProcessingStatus((prev) => ({ ...prev, state: "done" }));
        worker.terminate();
        if (processingWorkerRef.current === worker) {
          processingWorkerRef.current = null;
        }
        return;
      }

      worker.postMessage({
        type: "processFile",
        payload: {
          jobId,
          fileId: next.fileId,
          fileName: next.fileName,
          file: next.file,
          config: extractionConfig,
          maxPoints: 600,
        },
      });
    };

    worker.onmessage = (event) => {
      const { type, payload } = event.data ?? {};

      if (type === "processResult") {
        if (payload?.jobId !== jobId) return;
        setProcessedData((prev) => [...prev, payload.processed]);
        setProcessingStatus((prev) => ({
          ...prev,
          processed: prev.processed + 1,
        }));
        processNext();
        return;
      }

      if (type === "workerError") {
        if (payload?.jobId !== jobId) return;
        const errFileName = payload?.fileName ?? "Unknown file";
        const errMessage = payload?.message ?? "Unknown error";
        setExtractionErrors((prev) => [
          ...prev,
          { fileName: errFileName, message: errMessage },
        ]);
        setProcessingStatus((prev) => ({
          ...prev,
          processed: prev.processed + 1,
        }));

        if (processingStopOnErrorRef.current) {
          setProcessingStatus((prev) => ({ ...prev, state: "error" }));
          worker.terminate();
          if (processingWorkerRef.current === worker) {
            processingWorkerRef.current = null;
          }
          return;
        }

        processNext();
      }
    };

    processNext();

    const groupSizeText = groupSizeCell
      ? `points from ${String(pointsRaw).toUpperCase()}`
      : `points=${groupSize}`;
    const groupsText =
      groupSizeCell &&
        Number.isInteger(groupSizePreview) &&
        groupSizePreview > 0
        ? `, ${total / groupSizePreview} group(s)`
        : !groupSizeCell
          ? `, ${groups} group(s)`
          : "";

    const warningText = warnings.length
      ? `\n\nWarnings:\n- ${warnings.join("\n- ")}`
      : "";

    return {
      ok: true,
      type: warnings.length ? "warning" : "success",
      message: `Started extracting ${queue.length} file(s) (${groupSizeText}${groupsText}). Charts will appear progressively.${warningText}`,
    };
  };

  const handleExport = async () => {
    if (processedData.length === 0) return;

    const sanitizeFilename = (name) =>
      String(name || "export")
        .replace(/[/\\?%*:|"<>]/g, "_")
        .replace(/\s+/g, " ")
        .trim();

    const triggerDownloadBlob = (filename, blob) => {
      const url = URL.createObjectURL(blob);
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", url);
      downloadAnchorNode.setAttribute("download", filename);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      URL.revokeObjectURL(url);
    };

    const ensureUniqueFileName = () => {
      const usedNames = new Map();
      return (rawName) => {
        const name = String(rawName || "export.csv");
        const count = usedNames.get(name) ?? 0;
        usedNames.set(name, count + 1);
        if (count === 0) return name;

        const dotIndex = name.lastIndexOf(".");
        const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
        const ext = dotIndex > 0 ? name.slice(dotIndex) : "";
        return `${base} (${count + 1})${ext}`;
      };
    };

    const buildCsvExports = () => {
      const makeUniqueName = ensureUniqueFileName();
      const exports = [];

      for (const file of processedData) {
        const originalFileName = file?.fileName ?? "device_analysis";
        const xGroups = Array.isArray(file?.xGroups) ? file.xGroups : [];
        const seriesList = Array.isArray(file?.series) ? file.series : [];

        const seriesByYCol = new Map();
        for (const s of seriesList) {
          const yCol = Number(s?.yCol);
          if (!Number.isInteger(yCol)) continue;
          const list = seriesByYCol.get(yCol) ?? [];
          list.push(s);
          if (!seriesByYCol.has(yCol)) seriesByYCol.set(yCol, list);
        }

        for (const [yCol, list] of seriesByYCol.entries()) {
          const groups = list
            .slice()
            .sort((a, b) => Number(a?.groupIndex) - Number(b?.groupIndex))
            .map((s) => {
              const groupIndex = Number(s?.groupIndex);
              const xArr = xGroups[groupIndex];
              const yArr = s?.y;
              if (!xArr || !yArr) return null;
              return { groupIndex, xArr, yArr };
            })
            .filter(Boolean);

          if (!groups.length) continue;

          const headers = [];
          for (let gi = 0; gi < groups.length; gi++) {
            headers.push(`x${gi + 1}`, `y${gi + 1}`);
          }

          const rowCount = Math.max(
            ...groups.map((g) =>
              Math.min(g.xArr.length ?? 0, g.yArr.length ?? 0),
            ),
          );
          const rows = new Array(rowCount);

          for (let i = 0; i < rowCount; i++) {
            const row = [];
            for (const g of groups) {
              row.push(g.xArr[i] ?? "", g.yArr[i] ?? "");
            }
            rows[i] = row;
          }

          const csvText = Papa.unparse({ fields: headers, data: rows });

          const base = sanitizeFilename(originalFileName).replace(/\.csv$/i, "");
          const yLabel = _getExcelColumnLabel(yCol);
          const filename =
            seriesByYCol.size > 1 ? `${base}_${yLabel}.csv` : `${base}.csv`;

          exports.push({
            filename: makeUniqueName(filename),
            csvText,
            xyPairCount: groups.length,
          });
        }
      }

      return exports;
    };

    const exports = buildCsvExports();

    if (exports.length === 0) return;

    const zip = new JSZip();
    for (const item of exports) {
      zip.file(item.filename, "\uFEFF" + item.csvText);
    }

    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    triggerDownloadBlob("device_analysis_export.zip", zipBlob);
  };

  const handleExportOrigin = async () => {
    if (processedData.length === 0) return;

    const sanitizeFilename = (name) =>
      String(name || "export")
        .replace(/[/\\?%*:|"<>]/g, "_")
        .replace(/\s+/g, " ")
        .trim();

    const triggerDownloadBlob = (filename, blob) => {
      const url = URL.createObjectURL(blob);
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", url);
      downloadAnchorNode.setAttribute("download", filename);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      URL.revokeObjectURL(url);
    };

    const ensureUniqueFileName = () => {
      const usedNames = new Map();
      return (rawName) => {
        const name = String(rawName || "export.csv");
        const count = usedNames.get(name) ?? 0;
        usedNames.set(name, count + 1);
        if (count === 0) return name;

        const dotIndex = name.lastIndexOf(".");
        const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
        const ext = dotIndex > 0 ? name.slice(dotIndex) : "";
        return `${base} (${count + 1})${ext}`;
      };
    };

    const makeUniqueName = ensureUniqueFileName();
    const exports = [];

    for (const file of processedData) {
      const originalFileName = file?.fileName ?? "device_analysis";
      const xGroups = Array.isArray(file?.xGroups) ? file.xGroups : [];
      const seriesList = Array.isArray(file?.series) ? file.series : [];

      const seriesByYCol = new Map();
      for (const s of seriesList) {
        const yCol = Number(s?.yCol);
        if (!Number.isInteger(yCol)) continue;
        const list = seriesByYCol.get(yCol) ?? [];
        list.push(s);
        if (!seriesByYCol.has(yCol)) seriesByYCol.set(yCol, list);
      }

      for (const [yCol, list] of seriesByYCol.entries()) {
        const groups = list
          .slice()
          .sort((a, b) => Number(a?.groupIndex) - Number(b?.groupIndex))
          .map((s) => {
            const groupIndex = Number(s?.groupIndex);
            const xArr = xGroups[groupIndex];
            const yArr = s?.y;
            if (!xArr || !yArr) return null;
            return { groupIndex, xArr, yArr };
          })
          .filter(Boolean);

        if (!groups.length) continue;

        const headers = [];
        for (let gi = 0; gi < groups.length; gi++) {
          headers.push(`x${gi + 1}`, `y${gi + 1}`);
        }

        const rowCount = Math.max(
          ...groups.map((g) =>
            Math.min(g.xArr.length ?? 0, g.yArr.length ?? 0),
          ),
        );
        const rows = new Array(rowCount);

        for (let i = 0; i < rowCount; i++) {
          const row = [];
          for (const g of groups) {
            row.push(g.xArr[i] ?? "", g.yArr[i] ?? "");
          }
          rows[i] = row;
        }

        const csvText = Papa.unparse({ fields: headers, data: rows });

        const base = sanitizeFilename(originalFileName).replace(/\.csv$/i, "");
        const yLabel = _getExcelColumnLabel(yCol);
        const filename =
          seriesByYCol.size > 1 ? `${base}_${yLabel}.csv` : `${base}.csv`;

        exports.push({
          filename: makeUniqueName(filename),
          csvText,
          xyPairCount: groups.length,
        });
      }
    }

    if (exports.length === 0) return;

    const makePairsExpr = (xyPairCount) => {
      const pairs = [];
      const count = Math.max(1, Number(xyPairCount) || 1);
      for (let i = 0; i < count; i++) {
        pairs.push(`(${i * 2 + 1},${i * 2 + 2})`);
      }
      return `(${pairs.join(",")})`; // e.g. ((1,2),(3,4))
    };

    const buildOgsScript = (csvFileName, xyPairCount) => {
      const pairsExpr = makePairsExpr(xyPairCount);
      const safeCsv = String(csvFileName || "data.csv").replace(/"/g, "");

      return `[Main]
// Auto plot exported Device Analysis CSV in Origin
// Usage:
//   1) Put CSV and this OGS in the same folder, set Origin current folder to it, then run:
//        run.section("${safeCsv.replace(/\\.csv$/i, ".ogs")}", Main)
//   2) Or pass CSV full path as %1:
//        run.section("${safeCsv.replace(/\\.csv$/i, ".ogs")}", Main, "C:\\\\path\\\\${safeCsv}")

string csv$ = "%1";
if(csv$ == "")
{
    csv$ = "${safeCsv}";
}

// If CSV not found (exist returns -1), prompt user to select a CSV file.
if(exist(csv$) < 0)
{
    dlgfile group:=*.csv;
    csv$ = fname$;
}

newbook;
impCSV fname:=csv$;

// Plot XY XY pairs: (1,2) (3,4) ...
plotxy iy:=${pairsExpr} plot:=202;
type -b "Plotted %(csv$)";
`;
    };

    const readme = `Device Analysis -> Origin package

Files:
- *.csv: exported data (x1,y1,x2,y2,...)
- *.ogs: Origin LabTalk script to import CSV and plot automatically

How to use (recommended):
1) Unzip this package to a folder.
2) Open Origin.
3) (Optional) Set Origin current folder to the unzip folder (Command Window: cd "path")
4) Run the script (Script Window):
   run.section("your_file.ogs", Main)
   - If the CSV file is not found, Origin will prompt you to select it.

Note:
- Plot is created with plotxy plot:=202 (grouped line+symbol) using XY XY pairs.
`;

    const zip = new JSZip();
    zip.file("README_ORIGIN.txt", readme);
    for (const item of exports) {
      zip.file(item.filename, "\uFEFF" + item.csvText);
      const ogsName = String(item.filename).replace(/\.csv$/i, ".ogs");
      zip.file(ogsName, buildOgsScript(item.filename, item.xyPairCount));
    }

    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    triggerDownloadBlob("device_analysis_origin.zip", zipBlob);
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">
            Device Analysis
          </h1>
          <p className="text-text-secondary mt-1">
            Import, extract, and visualize device data
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={processedData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border text-text-primary rounded-lg hover:bg-bg-surface-hover disabled:opacity-50 transition-colors"
          >
            <Download size={18} />
            <span>Export ZIP</span>
          </button>
          <button
            onClick={handleExportOrigin}
            disabled={processedData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border text-text-primary rounded-lg hover:bg-bg-surface-hover disabled:opacity-50 transition-colors"
          >
            <Download size={18} />
            <span>Export for Origin</span>
          </button>
        </div>
      </header>

      {/* Main Content: Vertical Stack for better width usage */}
      <div className="flex flex-col gap-8 pb-12">
        {/* 1. Import Section */}
        <section>
          <div className="flex items-center gap-4 mb-4">
            <button
              type="button"
              onClick={() => importerRef.current?.openFileDialog()}
              className="flex items-center gap-2 px-4 py-2 bg-accent/10 hover:bg-accent/15 text-accent font-medium text-sm rounded-lg border border-accent/10 shadow-sm hover:shadow transition-all active:scale-[0.98]"
            >
              <Upload size={18} />
              <span>Import CSV</span>
            </button>
            <span className="text-sm text-text-secondary font-medium">
              Loaded {rawData.length} CSV files
            </span>
          </div>
          <CsvImporter
            ref={importerRef}
            onDataImported={handleDataImported}
            onDataRemoved={handleDataRemoved}
            onFileSelected={handlePreviewFileSelected}
            selectedFileId={selectedPreviewFileId}
          />
        </section>

        {/* 2. Template Configuration - Full Width */}
        <section>
          <TemplateManager
            previewFile={previewFile}
            previewStatus={previewStatus}
            previewLoadedRowCount={previewLoadedRowCount}
            getPreviewRow={getPreviewRow}
            ensurePreviewRows={ensurePreviewRows}
            onTemplateApplied={handleTemplateApplied}
          />
        </section>

        {extractionErrors.length > 0 && (
          <section>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-red-500">
                  <AlertCircle size={18} />
                  <h3 className="text-sm font-semibold">
                    Extraction errors ({extractionErrors.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setExtractionErrors([])}
                  className="text-xs px-2 py-1 rounded border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  Clear
                </button>
              </div>

              <div className="mt-3 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                <ul className="space-y-2 text-sm text-text-secondary">
                  {extractionErrors.map((err, idx) => (
                    <li key={`${err.fileName}-${idx}`}>
                      <span className="font-semibold text-text-primary">
                        {err.fileName}:
                      </span>{" "}
                      <span className="whitespace-pre-wrap">{err.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* 3. Visualization/Analysis - Full Width */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text-primary">
              Analysis & Visualization
            </h2>

            {/* View Toggles */}
            <div className="bg-bg-surface border border-border rounded-lg p-1 inline-flex">
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === "table" ? "bg-accent text-white shadow" : "text-text-secondary hover:text-text-primary"}`}
              >
                <TableIcon size={18} /> Data Table
              </button>
              <button
                onClick={() => setViewMode("chart")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === "chart" ? "bg-accent text-white shadow" : "text-text-secondary hover:text-text-primary"}`}
              >
                <BarChart2 size={18} /> Charts
              </button>
            </div>
          </div>

          {processedData.length > 0 ? (
            viewMode === "table" ? (
              <DataPreviewTable processedData={processedData} />
            ) : (
              <AnalysisCharts processedData={processedData} />
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] border-2 border-dashed border-border rounded-xl text-text-secondary bg-bg-surface/30">
              <BarChart2 size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">No Processed Data</p>
              <p className="text-sm">
                Apply a template above to generate results.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default DeviceAnalysis;
