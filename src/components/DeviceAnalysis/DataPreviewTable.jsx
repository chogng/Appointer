import React, { useMemo, useState } from "react";

const DataPreviewTable = ({ processedData }) => {
  const [activeFileId, setActiveFileId] = useState(
    processedData?.[0]?.fileId ?? null,
  );

  const effectiveActiveFileId = useMemo(() => {
    if (!processedData?.length) return null;
    if (activeFileId && processedData.some((f) => f.fileId === activeFileId)) {
      return activeFileId;
    }
    return processedData[0].fileId;
  }, [activeFileId, processedData]);

  const activeFile = useMemo(
    () =>
      processedData?.find((f) => f.fileId === effectiveActiveFileId) ?? null,
    [effectiveActiveFileId, processedData],
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

  if (!processedData || processedData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-text-secondary border border-dashed border-border rounded-xl bg-bg-surface/50 h-[300px]">
        <p>No data extracted yet.</p>
        <p className="text-sm">
          Import CSVs and apply a template to see results.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-bg-surface border border-border rounded-xl flex flex-col h-[500px]">
      <div className="flex items-center gap-1 p-2 border-b border-border overflow-x-auto">
        {processedData.map((file) => (
          <button
            key={file.fileId}
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
            "No file selected"
          )}
        </div>

        <select
          value={effectiveActiveSeriesId ?? ""}
          onChange={(e) => setActiveSeriesId(e.target.value)}
          disabled={!activeFile?.series?.length}
          className="bg-bg-page border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-black max-w-[260px]"
          title="Select a series"
        >
          {activeFile?.series?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
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
              {activeSeries.data.map((point, idx) => (
                <tr key={idx} className="hover:bg-bg-page/50 transition-colors">
                  <td className="p-3 text-text-secondary font-mono text-xs border-r border-border/50">
                    {idx + 1}
                  </td>
                  <td className="p-3 text-text-primary font-mono whitespace-nowrap">
                    {point.x}
                  </td>
                  <td className="p-3 text-text-primary font-mono whitespace-nowrap">
                    {point.y}
                  </td>
                </tr>
              ))}
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
    </div>
  );
};

export default DataPreviewTable;
