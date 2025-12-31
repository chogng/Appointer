import React, { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
];

const AnalysisCharts = ({ processedData }) => {
  const [activeFileId, setActiveFileId] = useState(
    processedData?.[0]?.fileId ?? null,
  );

  useEffect(() => {
    if (!processedData?.length) {
      setActiveFileId(null);
      return;
    }
    if (
      !activeFileId ||
      !processedData.find((f) => f.fileId === activeFileId)
    ) {
      setActiveFileId(processedData[0].fileId);
    }
  }, [activeFileId, processedData]);

  const activeFile = useMemo(
    () => processedData?.find((f) => f.fileId === activeFileId) ?? null,
    [activeFileId, processedData],
  );

  const xRangeLabel = useMemo(() => {
    if (!activeFile?.x) return "";
    const start = `${activeFile.x.colLabel}${activeFile.x.startRow}`;
    const end = `${activeFile.x.colLabel}${activeFile.x.endRow}`;
    return `${start}-${end}`;
  }, [activeFile]);

  const domain = useMemo(() => {
    if (!activeFile?.series?.length) {
      return { x: [0, 1], y: [0, 1] };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const series of activeFile.series) {
      for (const point of series.data) {
        if (typeof point?.x === "number") {
          minX = Math.min(minX, point.x);
          maxX = Math.max(maxX, point.x);
        }
        if (typeof point?.y === "number") {
          minY = Math.min(minY, point.y);
          maxY = Math.max(maxY, point.y);
        }
      }
    }

    return {
      x: [Number.isFinite(minX) ? minX : 0, Number.isFinite(maxX) ? maxX : 1],
      y: [Number.isFinite(minY) ? minY : 0, Number.isFinite(maxY) ? maxY : 1],
    };
  }, [activeFile]);

  if (!processedData || processedData.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="bg-bg-surface border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-lg font-bold text-text-primary">Visualization</h2>
          <span className="text-xs text-text-secondary">
            (real X; multi-line)
          </span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-border mb-4">
          {processedData.map((file) => (
            <button
              key={file.fileId}
              onClick={() => setActiveFileId(file.fileId)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeFileId === file.fileId
                  ? "bg-accent/10 text-accent ring-1 ring-accent/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-page"
              }`}
            >
              {file.fileName}
            </button>
          ))}
        </div>

        {activeFile?.series?.length ? (
          <div className="h-[500px] flex flex-col">
            <div className="text-xs text-text-secondary mb-2">
              X: {xRangeLabel} | points/group: {activeFile.x.points} | groups:{" "}
              {activeFile.x.groups} | Y: {activeFile.y.columnLabels.join(", ")}{" "}
              | series: {activeFile.series.length}
            </div>

            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={[]}
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#333"
                    opacity={0.2}
                  />
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={domain.x}
                    stroke="currentColor"
                    className="text-text-secondary text-xs"
                    tick={{ fill: "currentColor", opacity: 0.6 }}
                  />
                  <YAxis
                    type="number"
                    domain={domain.y}
                    stroke="currentColor"
                    className="text-text-secondary text-xs"
                    tick={{ fill: "currentColor", opacity: 0.6 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e1e1e",
                      borderColor: "#333",
                      color: "#fff",
                    }}
                    itemStyle={{ color: "#ccc" }}
                  />
                  <Legend />
                  {activeFile.series.map((series, idx) => (
                    <Line
                      key={series.id}
                      data={series.data}
                      dataKey="y"
                      name={series.name}
                      stroke={COLORS[idx % COLORS.length]}
                      dot={false}
                      isAnimationActive={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-text-secondary">
            No series data for this file.
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisCharts;
