import React, { useState, useRef } from "react";
import { Download, BarChart2, Table as TableIcon, Upload } from "lucide-react";
import CsvImporter from "../components/DeviceAnalysis/CsvImporter";
import TemplateManager from "../components/DeviceAnalysis/TemplateManager";
import DataPreviewTable from "../components/DeviceAnalysis/DataPreviewTable";
import AnalysisCharts from "../components/DeviceAnalysis/AnalysisCharts";

const DeviceAnalysis = () => {
  const importerRef = useRef(null);
  const [rawData, setRawData] = useState([]);
  const [processedData, setProcessedData] = useState([]);
  const [viewMode, setViewMode] = useState("chart"); // 'table' or 'chart'

  const getExcelColumnLabel = (index) => {
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

  const parseNumberStrict = (raw) => {
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

  // Handler when CSV is imported
  const handleDataImported = (fileInfo) => {
    setRawData((prev) => [...prev, fileInfo]);
  };

  const handleDataRemoved = (fileName) => {
    setRawData((prev) => prev.filter((f) => f.fileName !== fileName));
  };

  // Handler when template is applied
  const handleTemplateApplied = (config) => {
    if (!rawData || rawData.length === 0) {
      return {
        ok: false,
        type: "warning",
        message: "Please import at least one CSV file first.",
      };
    }

    const xStart = parseCellRef(config?.xDataStart || "");
    const xEnd = parseCellRef(config?.xDataEnd || "");
    if (!xStart || !xEnd) {
      return {
        ok: false,
        type: "warning",
        message: "Please set X Data start/end cells (e.g. A2 and A1408).",
      };
    }
    if (xStart.colIndex !== xEnd.colIndex) {
      return {
        ok: false,
        type: "warning",
        message: "X Data start/end must be in the same column.",
      };
    }

    const xCol = xStart.colIndex;
    const startRow = Math.min(xStart.rowIndex, xEnd.rowIndex);
    const endRow = Math.max(xStart.rowIndex, xEnd.rowIndex);
    const total = endRow - startRow + 1;
    if (total <= 0) {
      return { ok: false, type: "warning", message: "Invalid X row range." };
    }

    const pointsRaw = String(config?.xPoints ?? "").trim();
    const points = pointsRaw ? Number(pointsRaw) : null;
    if (points !== null) {
      if (!Number.isInteger(points) || points <= 0) {
        return {
          ok: false,
          type: "warning",
          message: "X Points must be a positive integer.",
        };
      }
      if (points > total) {
        return {
          ok: false,
          type: "warning",
          message: `X Points (${points}) cannot be larger than the X range length (${total}).`,
        };
      }
    }

    const groupSize = points ?? total;
    if (total % groupSize !== 0) {
      return {
        ok: false,
        type: "warning",
        message: `X range has ${total} points, which is not divisible by points=${groupSize}.`,
      };
    }
    const groups = total / groupSize;

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

    const processed = [];

    for (const file of rawData) {
      if (!Array.isArray(file?.data)) {
        return {
          ok: false,
          type: "error",
          message: `${file?.fileName || "Unknown file"}: invalid CSV data.`,
        };
      }

      if (endRow >= file.data.length) {
        return {
          ok: false,
          type: "error",
          message: `${file.fileName}: X end row (${endRow + 1}) exceeds total rows (${file.data.length}).`,
        };
      }

      const series = [];
      for (let g = 0; g < groups; g++) {
        const groupStartRow = startRow + g * groupSize;
        for (const yCol of uniqueYCols) {
          const data = [];
          for (let i = 0; i < groupSize; i++) {
            const rowIndex = groupStartRow + i;
            const row = file.data[rowIndex];
            const xRaw = Array.isArray(row) ? row[xCol] : undefined;
            const yRaw = Array.isArray(row) ? row[yCol] : undefined;

            const xVal = parseNumberStrict(xRaw);
            if (xVal === null) {
              const cellRef = `${getExcelColumnLabel(xCol)}${rowIndex + 1}`;
              return {
                ok: false,
                type: "error",
                message: `${file.fileName}: Invalid X at ${cellRef} (${JSON.stringify(
                  xRaw ?? "",
                )}).`,
              };
            }

            const yVal = parseNumberStrict(yRaw);
            if (yVal === null) {
              const cellRef = `${getExcelColumnLabel(yCol)}${rowIndex + 1}`;
              return {
                ok: false,
                type: "error",
                message: `${file.fileName}: Invalid Y at ${cellRef} (${JSON.stringify(
                  yRaw ?? "",
                )}).`,
              };
            }

            data.push({ x: xVal, y: yVal });
          }

          const yLabel = getExcelColumnLabel(yCol);
          series.push({
            id: `${file.fileId}_${yCol}_${g}`,
            name: `${yLabel} #${g + 1}`,
            data,
            yCol,
            group: g + 1,
          });
        }
      }

      processed.push({
        fileId: file.fileId,
        fileName: file.fileName,
        x: {
          col: xCol,
          colLabel: getExcelColumnLabel(xCol),
          startRow: startRow + 1,
          endRow: endRow + 1,
          points: groupSize,
          groups,
        },
        y: {
          columns: uniqueYCols,
          columnLabels: uniqueYCols.map(getExcelColumnLabel),
        },
        series,
      });
    }

    setProcessedData(processed);
    return {
      ok: true,
      type: "success",
      message: `Extracted ${processed.length} file(s), ${groups} group(s).`,
    };
  };

  const handleExport = () => {
    if (processedData.length === 0) return;

    // Simple JSON export for now, or CSV zip?
    // Let's do a single JSON export of all processed data
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(processedData, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "device_analysis_export.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
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
            <span>Export Data</span>
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
          />
        </section>

        {/* 2. Template Configuration - Full Width */}
        <section>
          <TemplateManager
            rawData={rawData}
            onTemplateApplied={handleTemplateApplied}
          />
        </section>

        {/* 3. Visualization/Analysis - Full Width */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text-primary">
              3. Analysis & Visualization
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
            <div className="bg-bg-page rounded-xl">
              {viewMode === "table" ? (
                <DataPreviewTable processedData={processedData} />
              ) : (
                <AnalysisCharts processedData={processedData} />
              )}
            </div>
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
