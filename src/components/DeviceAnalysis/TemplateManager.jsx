import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Settings, Trash2, ArrowUp } from "lucide-react";
import Toast from "../ui/Toast";

const TemplateManager = ({ rawData, onTemplateApplied }) => {
  const [templates, setTemplates] = useState(() => {
    const saved = localStorage.getItem("deviceAnalysisTemplates");
    return saved ? JSON.parse(saved) : [];
  });

  // Default config
  const [config, setConfig] = useState({
    name: "",
    xDataStart: "",
    xDataEnd: "",
    xPoints: "",
    yDataStart: "",
    yDataEnd: "",
    yPoints: "",
    selectedColumns: [], // Array of indices
  });

  const previewFile = rawData?.[0] ?? null;

  const [toast, setToast] = useState({
    isVisible: false,
    message: "",
    type: "success",
  });

  const showToast = useCallback((message, type = "warning") => {
    setToast({ isVisible: true, message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  }, []);

  const [selections, setSelections] = useState([]);
  const gridRef = useRef(null);
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
  const additiveSelectionRef = useRef(false);
  const rafRef = useRef(0);
  const pendingPointRef = useRef(null);

  const handleSaveTemplate = () => {
    if (!config.name.trim()) return;
    const newTemplates = [...templates, { ...config, id: Date.now() }];
    setTemplates(newTemplates);
    localStorage.setItem(
      "deviceAnalysisTemplates",
      JSON.stringify(newTemplates),
    );
    setConfig({ ...config, name: "" });
  };

  const handleDeleteTemplate = (id) => {
    const newTemplates = templates.filter((t) => t.id !== id);
    setTemplates(newTemplates);
    localStorage.setItem(
      "deviceAnalysisTemplates",
      JSON.stringify(newTemplates),
    );
  };

  const loadTemplate = (template) => {
    const { id: _id, ...rest } = template;
    setConfig((prev) => ({
      ...prev,
      ...rest,
      selectedColumns: Array.isArray(rest.selectedColumns)
        ? rest.selectedColumns
        : prev.selectedColumns,
    }));
  };

  const applyConfiguration = () => {
    const result = onTemplateApplied?.(config);
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

  const getExcelColumnLabel = (index) => {
    let label = "";
    let i = index;
    while (i >= 0) {
      label = String.fromCharCode(65 + (i % 26)) + label;
      i = Math.floor(i / 26) - 1;
    }
    return label;
  };

  const columnCount = useMemo(() => {
    if (!previewFile?.data) return 0;
    let max = 0;
    for (const row of previewFile.data) {
      if (Array.isArray(row) && row.length > max) max = row.length;
    }
    return max;
  }, [previewFile]);

  const columnIndices = useMemo(
    () => Array.from({ length: columnCount }, (_, idx) => idx),
    [columnCount],
  );

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
    additiveSelectionRef.current = false;
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
          "yDataStart",
          "yDataEnd",
        ].includes(activeElement.name)
      ) {
        event.preventDefault(); // Prevent input blur
        if (activeElement.name === "templateName") {
          const colLabel = getExcelColumnLabel(colIndex);
          const rowLabel = rowIndex + 1;
          setConfig((prev) => ({
            ...prev,
            name: `${colLabel}${rowLabel}`,
          }));
        } else if (activeElement.name === "xDataStart") {
          const colLabel = getExcelColumnLabel(colIndex);
          const rowLabel = rowIndex + 1;
          setConfig((prev) => ({
            ...prev,
            xDataStart: `${colLabel}${rowLabel}`,
          }));
        } else if (activeElement.name === "xDataEnd") {
          const colLabel = getExcelColumnLabel(colIndex);
          const rowLabel = rowIndex + 1;
          setConfig((prev) => ({
            ...prev,
            xDataEnd: `${colLabel}${rowLabel}`,
          }));
        } else if (activeElement.name === "yDataStart") {
          const colLabel = getExcelColumnLabel(colIndex);
          const rowLabel = rowIndex + 1;
          setConfig((prev) => ({
            ...prev,
            yDataStart: `${colLabel}${rowLabel}`,
          }));
        } else if (activeElement.name === "yDataEnd") {
          const colLabel = getExcelColumnLabel(colIndex);
          const rowLabel = rowIndex + 1;
          setConfig((prev) => ({
            ...prev,
            yDataEnd: `${colLabel}${rowLabel}`,
          }));
        }
        return;
      }

      event.preventDefault();

      const isAdditive = event.ctrlKey || event.metaKey;
      additiveSelectionRef.current = Boolean(isAdditive);

      if (!isAdditive) {
        setSelections([]);
      }

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
    [renderDragOverlay, previewFile],
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

      setSelections((prev) => {
        const next = additiveSelectionRef.current ? prev.slice() : [];
        next.push({
          id: `${Date.now()}_${Math.random()}`,
          range: normalized,
          rect,
        });
        return next;
      });
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
    clearSelection();
  }, [clearSelection, previewFile?.fileId]);

  const buildSelectionTsv = useCallback(() => {
    if (!previewFile?.data || selections.length === 0) return "";

    const blocks = selections
      .map((selection) => selection.range)
      .filter(Boolean)
      .map((range) => {
        const rows = [];
        for (let r = range.startRow; r <= range.endRow; r++) {
          const rowCells = Array.isArray(previewFile.data[r])
            ? previewFile.data[r]
            : [];
          const cols = [];
          for (let c = range.startCol; c <= range.endCol; c++) {
            cols.push(String(rowCells[c] ?? ""));
          }
          rows.push(cols.join("\t"));
        }
        return rows.join("\n");
      });

    return blocks.join("\n\n");
  }, [previewFile, selections]);

  const copySelection = useCallback(async () => {
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
  }, [buildSelectionTsv]);

  return (
    <div className="bg-bg-surface border border-border rounded-xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="text-accent" size={20} />
        <h2 className="text-xl font-bold text-text-primary">
          Data Extraction Template
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Template Name
            </label>
            <div className="flex items-center p-1 bg-bg-page border border-border rounded-lg shadow-sm focus-within:border-accent transition-all">
              <input
                type="text"
                name="templateName"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                placeholder="New Template"
                className="flex-1 min-w-0 pl-2 pr-2 py-1 bg-transparent border-none text-text-primary text-sm focus:outline-none focus:ring-0 placeholder:text-text-secondary"
              />
              <button
                onClick={handleSaveTemplate}
                disabled={!config.name.trim()}
                className="flex items-center justify-center gap-2 px-4 py-1.5 bg-black text-white text-sm font-medium rounded-lg hover:scale-102 active:scale-95 transition-all whitespace-nowrap disabled:opacity-50 disabled:hover:scale-100"
                title="Save Template"
              >
                <span>Save</span>
                <ArrowUp size={16} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              X Data
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
              <div>
                <input
                  type="text"
                  name="xDataStart"
                  value={config.xDataStart}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      xDataStart: e.target.value,
                    })
                  }
                  placeholder="Start Cell"
                  className="w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <input
                  type="text"
                  name="xDataEnd"
                  value={config.xDataEnd}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      xDataEnd: e.target.value,
                    })
                  }
                  placeholder="End Cell"
                  className="w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <input
                  type="number"
                  name="xPoints"
                  min="1"
                  value={config.xPoints}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      xPoints: e.target.value,
                    })
                  }
                  placeholder="Points"
                  className="w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Y Data
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
              <div>
                <input
                  type="text"
                  name="yDataStart"
                  value={config.yDataStart}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      yDataStart: e.target.value,
                    })
                  }
                  placeholder="Start Cell"
                  className="w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <input
                  type="text"
                  name="yDataEnd"
                  value={config.yDataEnd}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      yDataEnd: e.target.value,
                    })
                  }
                  placeholder="End Cell"
                  className="w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <input
                  type="number"
                  name="yPoints"
                  min="1"
                  value={config.yPoints}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      yPoints: e.target.value,
                    })
                  }
                  placeholder="Points"
                  className="w-full bg-bg-page border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
            </div>
            <div className="text-xs text-text-secondary">
              Selected Y columns:{" "}
              {config.selectedColumns.length > 0
                ? config.selectedColumns
                    .slice()
                    .sort((a, b) => a - b)
                    .map((col) => getExcelColumnLabel(col))
                    .join(", ")
                : "None (click column headers in preview to select)"}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Saved Templates
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2 bg-bg-page rounded-lg text-sm group"
                >
                  <span
                    className="text-text-primary cursor-pointer hover:text-accent truncate"
                    onClick={() => loadTemplate(t)}
                  >
                    {t.name}
                  </span>
                  <button
                    onClick={() => handleDeleteTemplate(t.id)}
                    className="text-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {templates.length === 0 && (
                <p className="text-xs text-text-secondary italic">
                  No saved templates
                </p>
              )}
            </div>
          </div>

          <button
            onClick={applyConfiguration}
            className="w-full py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors shadow-lg shadow-accent/25 mt-4"
          >
            Apply to All Files
          </button>
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-3 bg-bg-page border border-border rounded-lg p-4 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text-secondary">
              Preview: {previewFile ? previewFile.fileName : "(No file loaded)"}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">
                Drag to select cells (Ctrl/Cmd for multi-select)
              </span>
              <button
                type="button"
                onClick={copySelection}
                disabled={selections.length === 0}
                className="px-2 py-1 text-xs rounded border border-border bg-bg-surface hover:bg-bg-surface-hover text-text-secondary disabled:opacity-50"
                title="Copy selection as TSV"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={clearSelection}
                disabled={selections.length === 0}
                className="px-2 py-1 text-xs rounded border border-border bg-bg-surface hover:bg-bg-surface-hover text-text-secondary disabled:opacity-50"
                title="Clear selection"
              >
                Clear
              </button>
            </div>
          </div>

          {previewFile ? (
            <div className="overflow-auto border border-border rounded h-[500px]">
              <div
                ref={gridRef}
                className="relative w-max min-w-full align-top select-none"
              >
                <div className="absolute inset-0 pointer-events-none z-20">
                  {selections.map((selection) => (
                    <div
                      key={selection.id}
                      className="absolute bg-indigo-500/10 border border-indigo-500/40 rounded-sm"
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
                    className="absolute bg-indigo-500/10 border border-indigo-500/40 rounded-sm"
                    style={{ display: "none" }}
                  />
                </div>

                <table className="w-max min-w-full text-sm text-left relative border-collapse z-10">
                  <thead className="bg-bg-surface sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-1 border border-border bg-bg-surface w-12 text-center font-bold text-xs text-text-secondary select-none"></th>
                      {columnIndices.map((idx) => {
                        const isSelected = config.selectedColumns.includes(idx);
                        return (
                          <th
                            key={idx}
                            onClick={() => toggleColumn(idx)}
                            className={`px-2 py-1 border border-border font-mono text-xs whitespace-nowrap min-w-[100px] bg-bg-surface font-semibold text-center select-none cursor-pointer ${isSelected ? "text-accent bg-accent/10 border-accent/30" : "text-text-secondary hover:bg-bg-page/60"}`}
                            title="Click to toggle Y column"
                          >
                            <div className="flex items-center justify-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleColumn(idx)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-3 h-3 rounded border-border bg-bg-page text-accent focus:ring-accent shrink-0"
                              />
                              <span>{getExcelColumnLabel(idx)}</span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {previewFile.data.map((row, rowIndex) => {
                      const rowLabel = rowIndex + 1;
                      const rowCells = Array.isArray(row) ? row : [];

                      return (
                        <tr key={rowIndex} className="hover:bg-bg-surface">
                          <td className="p-1 border border-border font-mono text-xs text-center select-none bg-bg-surface text-text-secondary w-12">
                            {rowLabel}
                          </td>
                          {columnIndices.map((idx) => {
                            const cell = rowCells[idx] ?? "";
                            return (
                              <td
                                key={idx}
                                data-row={rowIndex}
                                data-col={idx}
                                className={`
                            px-2 py-1 border border-border whitespace-nowrap text-xs transition-colors cursor-default min-w-[100px]
                            ${config.selectedColumns.includes(idx) ? "bg-accent/5 border-accent/20 text-text-primary" : "text-text-secondary"}

                          `}
                                onMouseDown={handleCellMouseDown}
                                title={cell}
                              >
                                {cell}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="border border-border rounded h-[500px] flex items-center justify-center text-sm text-text-secondary bg-bg-surface/40">
              Upload CSV files to preview and select columns.
            </div>
          )}
        </div>
      </div>

      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={closeToast}
        type={toast.type}
        position="fixed"
      />
    </div>
  );
};

export default TemplateManager;
