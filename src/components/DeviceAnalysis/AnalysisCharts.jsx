import React, { useEffect, useMemo, useRef, useState } from "react";
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
import CanvasMultiLineChart from "./CanvasMultiLineChart";
import {
  computeCentralDerivative,
  computeSubthresholdSwing,
  computeLegendDerivativeSeries,
  formatNumber,
} from "./analysisMath";
import { apiService } from "../../services/apiService";
import Dropdown from "../ui/Dropdown";
import Button from "../ui/Button";

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

const useInViewOnce = (options = {}) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      {
        root: options.root ?? null,
        rootMargin: options.rootMargin ?? "600px",
        threshold: options.threshold ?? 0.01,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, options.root, options.rootMargin, options.threshold]);

  return { ref, inView };
};

const buildPoints = (xArr, yArr) => {
  if (!xArr || !yArr) return [];
  const n = Math.min(xArr.length ?? 0, yArr.length ?? 0);
  if (n <= 0) return [];
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = { x: xArr[i], y: yArr[i] };
  }
  return out;
};

const normalizeFloat = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return num;
  return Number(num.toPrecision(12));
};

// Origin-like: choose a "nice" step (1/2/2.5/5/10 × 10^k), then snap endpoints to multiples of step.
// When preferTightRange is true, prioritize minimizing extra expansion beyond the requested domain.
const buildNiceTicks = (
  minRaw,
  maxRaw,
  desiredTickCount = 6,
  { preferTightRange = false } = {},
) => {
  const min = Number(minRaw);
  const max = Number(maxRaw);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

  let lo = Math.min(min, max);
  let hi = Math.max(min, max);

  // Avoid degenerate ranges.
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.1;
    lo -= pad * 0.5;
    hi += pad * 0.5;
  }

  const safeSpan = hi - lo;
  const target = Math.max(2, Math.floor(desiredTickCount));
  const roughStep = safeSpan / (target - 1);
  if (!Number.isFinite(roughStep) || roughStep <= 0) return null;

  const exp = Math.floor(Math.log10(Math.abs(roughStep)));
  const base = Math.pow(10, exp);
  const candidates = [1, 2, 2.5, 5, 10];
  const maxExpandRatio = preferTightRange ? 0.35 : 0.75;
  const maxTickCount = preferTightRange ? 11 : 15;

  const stepPenalty = (step) => {
    // Prefer steps that can be represented with fewer decimal places.
    const abs = Math.abs(step);
    if (!(abs > 0)) return 100;
    for (let digits = 0; digits <= 8; digits++) {
      const rounded = Number(abs.toFixed(digits));
      if (Math.abs(rounded - abs) <= Math.max(1e-12, abs * 1e-9)) return digits;
    }
    return 9;
  };

  let best = null;
  for (const mantissa of candidates) {
    const step = normalizeFloat(mantissa * base);
    if (!(step > 0)) continue;

    const snappedMin = normalizeFloat(Math.floor(lo / step) * step);
    const snappedMax = normalizeFloat(Math.ceil(hi / step) * step);
    const span = snappedMax - snappedMin;
    if (!(span > 0)) continue;

    const count = Math.round(span / step) + 1;
    const expandRatio = (span - safeSpan) / safeSpan;
    if (count > maxTickCount) continue;
    if (preferTightRange && expandRatio > maxExpandRatio) continue;

    // Primary: closeness to desired tick count; Secondary: minimal extra blank space; Tertiary: fewer decimals.
    const score =
      (preferTightRange
        ? Math.max(0, expandRatio) * 30
        : Math.abs(count - target) * 10) +
      (preferTightRange
        ? Math.abs(count - target) * 2
        : Math.max(0, expandRatio) * 2) +
      stepPenalty(step) * 0.25;

    if (!best || score < best.score) {
      best = { score, step, snappedMin, snappedMax };
    }
  }

  if (!best && preferTightRange) {
    // Fallback: relax constraints if everything got filtered out.
    return buildNiceTicks(minRaw, maxRaw, desiredTickCount, {
      preferTightRange: false,
    });
  }
  if (!best) return null;

  const out = [];
  const maxIterations = 200;
  for (let i = 0; i < maxIterations; i++) {
    const v = normalizeFloat(best.snappedMin + best.step * i);
    if (v > best.snappedMax + best.step * 0.5) break;
    out.push(v);
  }

  return out.length >= 2 ? out : null;
};

// Origin-like "Auto": balances (1) tick count closeness and (2) snapped endpoints, instead of enforcing a tight range.
// Heuristic notes:
// - Origin typically snaps axis endpoints to "nice" multiples of a "nice" step.
// - It also tries to keep the number of major ticks in a reasonable band (often ~5–7),
//   but will deviate if doing so would cause excessive expansion.
const buildOriginAutoTicks = (minRaw, maxRaw, desiredTickCount = 6) => {
  const min = Number(minRaw);
  const max = Number(maxRaw);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

  let lo = Math.min(min, max);
  let hi = Math.max(min, max);

  // Avoid degenerate ranges.
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.1;
    lo -= pad * 0.5;
    hi += pad * 0.5;
  }

  const safeSpan = hi - lo;
  const target = Math.max(2, Math.floor(desiredTickCount));
  const roughStep = safeSpan / (target - 1);
  if (!Number.isFinite(roughStep) || roughStep <= 0) return null;

  const exp0 = Math.floor(Math.log10(Math.abs(roughStep)));
  const expCandidates = [exp0 - 1, exp0, exp0 + 1];
  const mantissas = [1, 2, 2.5, 5, 10];

  const maxTickCount = 15;
  const maxExpandRatio = 2.0;

  const stepPenalty = (step) => {
    const abs = Math.abs(step);
    if (!(abs > 0)) return 100;
    for (let digits = 0; digits <= 8; digits++) {
      const rounded = Number(abs.toFixed(digits));
      if (Math.abs(rounded - abs) <= Math.max(1e-12, abs * 1e-9)) return digits;
    }
    return 9;
  };

  const bandPenalty = (count) => {
    // Prefer a typical "auto" band, but don't hard-reject.
    const minBand = 5;
    const maxBand = 7;
    if (count < minBand) return (minBand - count) * 3;
    if (count > maxBand) return (count - maxBand) * 3;
    return 0;
  };

  let best = null;
  for (const exp of expCandidates) {
    const base = Math.pow(10, exp);
    for (const mantissa of mantissas) {
      const step = normalizeFloat(mantissa * base);
      if (!(step > 0)) continue;

      const snappedMin = normalizeFloat(Math.floor(lo / step) * step);
      const snappedMax = normalizeFloat(Math.ceil(hi / step) * step);
      const span = snappedMax - snappedMin;
      if (!(span > 0)) continue;

      const count = Math.round(span / step) + 1;
      if (count > maxTickCount) continue;

      const expandRatio = (span - safeSpan) / safeSpan;
      if (expandRatio > maxExpandRatio) continue;

      const leftPad = lo - snappedMin;
      const rightPad = snappedMax - hi;
      const balancePenalty =
        safeSpan > 0 ? Math.abs(leftPad - rightPad) / safeSpan : 0;

      const score =
        Math.abs(count - target) * 10 +
        bandPenalty(count) * 2 +
        Math.max(0, expandRatio) * 7 +
        balancePenalty * 0.5 +
        stepPenalty(step) * 0.25;

      if (!best || score < best.score) {
        best = { score, step, snappedMin, snappedMax };
      }
    }
  }

  if (!best) return null;

  const out = [];
  const maxIterations = 200;
  for (let i = 0; i < maxIterations; i++) {
    const v = normalizeFloat(best.snappedMin + best.step * i);
    if (v > best.snappedMax + best.step * 0.5) break;
    out.push(v);
  }

  return out.length >= 2 ? out : null;
};

const inferTickDigitsFromTicks = (ticks) => {
  if (!Array.isArray(ticks) || ticks.length < 2) return 4;
  const step = Math.abs(Number(ticks[1]) - Number(ticks[0]));
  if (!Number.isFinite(step) || step <= 0) return 4;

  const abs = normalizeFloat(step);
  for (let digits = 0; digits <= 8; digits++) {
    const rounded = Number(abs.toFixed(digits));
    if (Math.abs(rounded - abs) <= Math.max(1e-12, abs * 1e-9)) return digits;
  }
  return 4;
};

const computeLabelInterval = (ticks, maxLabels = 7) => {
  const n = Array.isArray(ticks) ? ticks.length : 0;
  if (n <= maxLabels) return 0;
  // Recharts interval: number of ticks to skip between labels.
  return Math.max(0, Math.ceil(n / maxLabels) - 1);
};

const parseOptionalNumber = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
};

const padLinearDomain = (min, max) => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.05;
    return [lo - pad, hi + pad];
  }
  const span = hi - lo;
  const pad = span * 0.05;
  return [lo - pad, hi + pad];
};

const padLogDomain = (min, max) => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [1e-3, 1];
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (hi <= 0) return [1e-3, 1];
  const safeLo = lo > 0 ? lo : hi / 1000;
  if (safeLo === hi) return [safeLo / 1.25, hi * 1.25];
  return [safeLo / 1.1, hi * 1.1];
};

const computeMinMax = (seriesList) => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const series of seriesList ?? []) {
    for (const point of series?.data ?? []) {
      const x = point?.x;
      const y = point?.y;
      if (typeof x === "number" && Number.isFinite(x)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      if (typeof y === "number" && Number.isFinite(y)) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  return {
    minX: Number.isFinite(minX) ? minX : null,
    maxX: Number.isFinite(maxX) ? maxX : null,
    minY: Number.isFinite(minY) ? minY : null,
    maxY: Number.isFinite(maxY) ? maxY : null,
  };
};

const buildStepTicks = (minRaw, maxRaw, stepRaw) => {
  const min = Number(minRaw);
  const max = Number(maxRaw);
  const step = Number(stepRaw);
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step))
    return null;
  if (step <= 0) return null;

  const lo = Math.min(min, max);
  const hi = Math.max(min, max);

  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;

  const out = [];
  const maxIterations = 200;
  for (let i = 0; i < maxIterations; i++) {
    const v = start + step * i;
    if (v > end + step * 0.5) break;
    out.push(Number(v.toPrecision(12)));
  }
  return out.length >= 2 ? out : null;
};

const buildLogTicks = (minRaw, maxRaw, decadeStepRaw = 1) => {
  const min = Number(minRaw);
  const max = Number(maxRaw);
  const decadeStep = Math.max(1, Math.floor(Number(decadeStepRaw) || 1));
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (hi <= 0) return null;

  const safeLo = lo > 0 ? lo : hi / 1000;
  const expMin = Math.floor(Math.log10(safeLo));
  const expMax = Math.ceil(Math.log10(hi));

  const out = [];
  for (let e = expMin; e <= expMax; e += decadeStep) {
    out.push(Math.pow(10, e));
  }
  return out.length >= 2 ? out : null;
};

const preserveScrollPosition = (action) => {
  if (typeof window === "undefined") return action();
  const x = window.scrollX;
  const y = window.scrollY;
  action();
  // Prevent layout shifts (e.g. active badge moving) from causing page jumps.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo(x, y);
    });
  });
};

const FileCard = React.memo(function FileCard({
  file,
  isActive,
  onSelectFile,
  yUnitFactor = 1,
  yUnitLabel = "A",
}) {
  const { ref, inView } = useInViewOnce();
  const seriesCount = Array.isArray(file?.series) ? file.series.length : 0;
  const sampledPoints = file?.x?.sampledPoints ?? null;
  const yAxisMin = Number(file?.domain?.y?.[0]);
  const yAxisMax = Number(file?.domain?.y?.[1]);
  const yAxisMinLabel = Number.isFinite(yAxisMin)
    ? formatNumber(yAxisMin * yUnitFactor, { digits: 3 })
    : null;
  const yAxisMaxLabel = Number.isFinite(yAxisMax)
    ? formatNumber(yAxisMax * yUnitFactor, { digits: 3 })
    : null;
  const ySuffix =
    typeof yUnitLabel === "string" && yUnitLabel ? ` ${yUnitLabel}` : "";

  return (
    <button
      type="button"
      ref={ref}
      onMouseDown={(e) => {
        // Prevent the browser from scrolling the page to "fully reveal" the focused card.
        // (This happens before onClick in some browsers.)
        e.preventDefault();
      }}
      onClick={() => onSelectFile?.(file?.fileId)}
      className={`text-left rounded-xl border transition-colors overflow-hidden ${
        isActive
          ? "border-accent/40 bg-accent/5"
          : "border-border bg-bg-surface hover:bg-bg-surface-hover"
      }`}
    >
      <div className="px-2 pt-1.5 pb-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-text-primary truncate">
              {file.fileName}
            </div>
            <div className="text-[10px] text-text-secondary mt-0.5 space-y-0.5">
              <div>
                series: {seriesCount}
                {sampledPoints ? ` · points/series: ${sampledPoints}` : ""}
              </div>
              {yAxisMinLabel && (
                <div>
                  ymin: {yAxisMinLabel}
                  {ySuffix}
                </div>
              )}
              {yAxisMaxLabel && (
                <div>
                  ymax: {yAxisMaxLabel}
                  {ySuffix}
                </div>
              )}
            </div>
          </div>
          {isActive && (
            <div className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20">
              Active
            </div>
          )}
        </div>
      </div>

      <div
        className="relative w-full bg-bg-page"
        style={{ aspectRatio: "16 / 9" }}
      >
        {inView ? (
          <CanvasMultiLineChart
            xGroups={file.xGroups}
            series={file.series}
            domain={file.domain}
            yScaleFactor={yUnitFactor}
            yUnitLabel={yUnitLabel}
            title={file.fileName}
            className="absolute inset-0"
          />
        ) : (
          <div className="absolute inset-0 animate-pulse bg-bg-page/40" />
        )}
        {(yAxisMinLabel || yAxisMaxLabel) && (
          <div className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded-md bg-black/50 text-white space-y-0.5">
            {yAxisMinLabel && (
              <div>
                ymin: {yAxisMinLabel}
                {ySuffix}
              </div>
            )}
            {yAxisMaxLabel && (
              <div>
                ymax: {yAxisMaxLabel}
                {ySuffix}
              </div>
            )}
          </div>
        )}
      </div>
    </button>
  );
});

const OverviewGrid = React.memo(function OverviewGrid({
  processedData,
  processingStatus,
  activeFileId,
  onSelectFile,
  yUnitFactor,
  yUnitLabel,
}) {
  if (!processedData?.length) return null;

  return (
    <div className="bg-bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-text-primary">
            Overview ({processedData.length})
          </h2>
        </div>

        {processingStatus?.state === "processing" && (
          <div className="text-xs text-text-secondary">
            Processing {processingStatus.processed}/{processingStatus.total}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
        {processedData.map((file) => (
          <FileCard
            key={file.fileId}
            file={file}
            isActive={file.fileId === activeFileId}
            onSelectFile={onSelectFile}
            yUnitFactor={yUnitFactor}
            yUnitLabel={yUnitLabel}
          />
        ))}
      </div>
    </div>
  );
});

const AnalysisCharts = ({ processedData, processingStatus }) => {
  const [activeFileId, setActiveFileId] = useState(
    processedData?.[0]?.fileId ?? null,
  );
  const [plotType, setPlotType] = useState("iv"); // 'iv' | 'gm' | 'ss' | 'j'
  const [yUnit, setYUnit] = useState("A"); // 'A' | 'uA' | 'nA'
  const userChangedYUnitRef = useRef(false);
  const [gmMode, setGmMode] = useState("x"); // 'x' | 'legend'
  const [areaInput, setAreaInput] = useState("");
  const [showAxisControls, setShowAxisControls] = useState(false);
  const [axis, setAxis] = useState({
    xMin: "",
    xMax: "",
    xTicks: "auto", // 'auto' | 'nice' | 'step'
    xTickCount: 6,
    xStep: "",
    yMin: "",
    yMax: "",
    yScale: "linear", // 'linear' | 'log' | 'logAbs'
    yTicks: "nice", // 'auto' | 'nice' | 'step' | 'decades'
    yTickCount: 6,
    yStep: "",
    yDecadeStep: 1,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const settings = await apiService.getDeviceAnalysisSettings();
        const unit = settings?.yUnit;
        if (cancelled) return;
        if (userChangedYUnitRef.current) return;
        if (unit === "A" || unit === "uA" || unit === "nA") {
          setYUnit(unit);
        }
      } catch {
        // ignore settings load failures
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const currentUnitMeta = useMemo(() => {
    const unit = String(yUnit || "A");
    if (unit === "uA") return { value: "uA", label: "µA", factor: 1e6 };
    if (unit === "nA") return { value: "nA", label: "nA", factor: 1e9 };
    return { value: "A", label: "A", factor: 1 };
  }, [yUnit]);

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

  const area = useMemo(() => {
    if (areaInput === null || areaInput === undefined) return null;
    const raw = String(areaInput).trim();
    if (!raw) return null;
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0) return null;
    return num;
  }, [areaInput]);

  const effectivePlotType = useMemo(() => {
    if (plotType === "j" && !area) return "iv";
    return plotType;
  }, [area, plotType]);

  const plotYFactor = useMemo(
    () => (effectivePlotType === "ss" ? 1 : currentUnitMeta.factor),
    [currentUnitMeta.factor, effectivePlotType],
  );

  const plotYUnitLabel = useMemo(() => {
    if (effectivePlotType === "ss") return "mV/dec";
    if (effectivePlotType === "gm") return `${currentUnitMeta.label}/V`;
    if (effectivePlotType === "j") return `${currentUnitMeta.label}/Area`;
    return currentUnitMeta.label;
  }, [currentUnitMeta.label, effectivePlotType]);

  const pointsBySeriesId = useMemo(() => {
    if (!activeFile?.series?.length) return new Map();
    const map = new Map();
    for (const s of activeFile.series) {
      const xArr = activeFile?.xGroups?.[s.groupIndex];
      map.set(s.id, buildPoints(xArr, s.y));
    }
    return map;
  }, [activeFile]);

  const gmBySeriesId = useMemo(() => {
    const map = new Map();
    if (!activeFile?.series?.length) return map;

    if (gmMode === "x") {
      for (const series of activeFile.series) {
        const points = pointsBySeriesId.get(series.id) ?? [];
        map.set(series.id, computeCentralDerivative(points));
      }
      return map;
    }

    const legendMode = activeFile?.legend?.mode ?? null;
    if (legendMode !== "yCol" && legendMode !== "group") return map;

    const buckets = new Map();
    for (const series of activeFile.series) {
      const param = series?.legendValue;
      if (typeof param !== "number" || !Number.isFinite(param)) continue;

      const xArr = activeFile?.xGroups?.[series.groupIndex];
      const yArr = series?.y;
      if (!xArr || !yArr) continue;

      const bucketKey =
        legendMode === "yCol" ? `g:${series.groupIndex}` : `y:${series.yCol}`;
      const list = buckets.get(bucketKey) ?? [];
      list.push({ id: series.id, x: xArr, y: yArr, param });
      buckets.set(bucketKey, list);
    }

    for (const list of buckets.values()) {
      const derived = computeLegendDerivativeSeries(list);
      for (const [id, data] of derived.entries()) {
        map.set(id, data);
      }
    }

    return map;
  }, [activeFile, gmMode, pointsBySeriesId]);

  const gmLegendStatus = useMemo(() => {
    if (gmMode !== "legend") return { ok: true, message: "" };

    const legendMode = activeFile?.legend?.mode ?? null;
    if (legendMode !== "yCol" && legendMode !== "group") {
      return {
        ok: false,
        message:
          "Legend derivative needs numeric legend labels (configure Y Data Start/Count/Step).",
      };
    }

    const counts = new Map();
    for (const series of activeFile?.series ?? []) {
      const param = series?.legendValue;
      if (typeof param !== "number" || !Number.isFinite(param)) continue;
      const bucketKey =
        legendMode === "yCol" ? `g:${series.groupIndex}` : `y:${series.yCol}`;
      counts.set(bucketKey, (counts.get(bucketKey) ?? 0) + 1);
    }
    const maxCurves = Math.max(0, ...Array.from(counts.values()));
    if (maxCurves < 2) {
      return {
        ok: false,
        message:
          "Legend derivative needs at least 2 curves with numeric legend values.",
      };
    }

    return { ok: true, message: "" };
  }, [activeFile, gmMode]);

  const analysisBySeriesId = useMemo(() => {
    if (!activeFile?.series?.length) return new Map();

    const map = new Map();

    for (const series of activeFile.series) {
      const points = pointsBySeriesId.get(series.id) ?? [];

      const gm = gmBySeriesId.get(series.id) ?? [];
      const ss = computeSubthresholdSwing(points);
      const j = area
        ? points.map((p) => ({
            x: p?.x ?? null,
            y:
              typeof p?.y === "number" && Number.isFinite(p.y)
                ? Math.abs(p.y) / area
                : null,
          }))
        : null;

      // Scalar metrics (computed from |I| to support p/n-type)
      let ion = -Infinity;
      let xAtIon = null;
      let ioff = Infinity;
      let xAtIoff = null;

      for (const p of points) {
        const x = p?.x;
        const y = p?.y;
        if (typeof x !== "number" || !Number.isFinite(x)) continue;
        if (typeof y !== "number" || !Number.isFinite(y)) continue;

        const absI = Math.abs(y);
        if (absI > ion) {
          ion = absI;
          xAtIon = x;
        }
        if (absI > 0 && absI < ioff) {
          ioff = absI;
          xAtIoff = x;
        }
      }

      const ionFinite = Number.isFinite(ion) ? ion : null;
      const ioffFinite = Number.isFinite(ioff) ? ioff : null;

      let gmMaxAbs = -Infinity;
      let xAtGmMaxAbs = null;
      for (const p of gm) {
        const x = p?.x;
        const y = p?.y;
        if (typeof x !== "number" || !Number.isFinite(x)) continue;
        if (typeof y !== "number" || !Number.isFinite(y)) continue;
        const absGm = Math.abs(y);
        if (absGm > gmMaxAbs) {
          gmMaxAbs = absGm;
          xAtGmMaxAbs = x;
        }
      }

      const gmMaxAbsFinite = Number.isFinite(gmMaxAbs) ? gmMaxAbs : null;

      let ssMin = Infinity;
      let xAtSsMin = null;
      for (const p of ss) {
        const x = p?.x;
        const y = p?.y;
        if (typeof x !== "number" || !Number.isFinite(x)) continue;
        if (typeof y !== "number" || !Number.isFinite(y)) continue;
        if (y > 0 && y < ssMin) {
          ssMin = y;
          xAtSsMin = x;
        }
      }
      const ssMinFinite = Number.isFinite(ssMin) ? ssMin : null;

      map.set(series.id, {
        gm,
        ss,
        j,
        metrics: {
          ion: ionFinite,
          xAtIon,
          ioff: ioffFinite,
          xAtIoff,
          ionIoff:
            ionFinite !== null && ioffFinite !== null && ioffFinite !== 0
              ? ionFinite / ioffFinite
              : null,
          gmMaxAbs: gmMaxAbsFinite,
          xAtGmMaxAbs,
          ssMin: ssMinFinite,
          xAtSsMin,
          jon: area && ionFinite !== null ? ionFinite / area : null,
          joff: area && ioffFinite !== null ? ioffFinite / area : null,
        },
      });
    }

    return map;
  }, [activeFile, area, gmBySeriesId, pointsBySeriesId]);

  const plotSeries = useMemo(() => {
    if (!activeFile?.series?.length) return [];

    return activeFile.series.map((series) => {
      const baseData = pointsBySeriesId.get(series.id) ?? [];
      const analysis = analysisBySeriesId.get(series.id);
      if (effectivePlotType === "gm") {
        return { ...series, data: analysis?.gm ?? [] };
      }
      if (effectivePlotType === "ss") {
        return { ...series, data: analysis?.ss ?? [] };
      }
      if (effectivePlotType === "j") {
        return { ...series, data: analysis?.j ?? [] };
      }
      return { ...series, data: baseData }; // 'iv'
    });
  }, [activeFile, analysisBySeriesId, effectivePlotType, pointsBySeriesId]);

  const yScaleMode = String(axis?.yScale ?? "linear");

  const displayPlotSeries = useMemo(() => {
    const mode = yScaleMode;
    if (mode === "linear") return plotSeries;

    const toY = (raw) => {
      if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
      if (mode === "logAbs") {
        const v = Math.abs(raw);
        return v > 0 ? v : null;
      }
      // 'log' expects positive values only
      return raw > 0 ? raw : null;
    };

    return plotSeries.map((s) => ({
      ...s,
      data: (s?.data ?? []).map((p) => ({ x: p?.x ?? null, y: toY(p?.y) })),
    }));
  }, [plotSeries, yScaleMode]);

  const autoMinMax = useMemo(
    () => computeMinMax(displayPlotSeries),
    [displayPlotSeries],
  );

  const autoMinY = autoMinMax?.minY ?? null;
  const autoMaxY = autoMinMax?.maxY ?? null;

  const effectiveYScale = useMemo(() => {
    if (yScaleMode === "linear") return "linear";
    if (autoMinY === null || autoMaxY === null) return "linear";
    if (autoMaxY <= 0) return "linear";
    return yScaleMode; // 'log' | 'logAbs'
  }, [autoMaxY, autoMinY, yScaleMode]);

  const yScaleWarning = useMemo(() => {
    if (yScaleMode === "linear") return "";
    if (effectiveYScale !== yScaleMode) {
      return "Log scale requires positive values (use Log(|y|) if your data crosses 0).";
    }
    return "";
  }, [effectiveYScale, yScaleMode]);

  const xDomain = useMemo(() => {
    const auto =
      autoMinMax.minX === null || autoMinMax.maxX === null
        ? [0, 1]
        : padLinearDomain(autoMinMax.minX, autoMinMax.maxX);

    const minUser = parseOptionalNumber(axis?.xMin);
    const maxUser = parseOptionalNumber(axis?.xMax);
    const min = minUser ?? auto[0];
    const max = maxUser ?? auto[1];
    return padLinearDomain(min, max);
  }, [autoMinMax.maxX, autoMinMax.minX, axis?.xMax, axis?.xMin]);

  const yDomain = useMemo(() => {
    const auto =
      autoMinMax.minY === null || autoMinMax.maxY === null
        ? effectiveYScale === "linear"
          ? [0, 1]
          : [1e-3, 1]
        : effectiveYScale === "linear"
          ? padLinearDomain(autoMinMax.minY, autoMinMax.maxY)
          : padLogDomain(autoMinMax.minY, autoMinMax.maxY);

    const minUserRaw = parseOptionalNumber(axis?.yMin);
    const maxUserRaw = parseOptionalNumber(axis?.yMax);
    const minUser = minUserRaw !== null ? minUserRaw / plotYFactor : null;
    const maxUser = maxUserRaw !== null ? maxUserRaw / plotYFactor : null;

    let min = minUser ?? auto[0];
    let max = maxUser ?? auto[1];

    if (effectiveYScale !== "linear") {
      if (min <= 0) min = auto[0];
      if (max <= 0) max = auto[1];
      if (min <= 0 || max <= 0) return auto;
      return padLogDomain(min, max);
    }

    return padLinearDomain(min, max);
  }, [
    autoMinMax.maxY,
    autoMinMax.minY,
    axis?.yMax,
    axis?.yMin,
    effectiveYScale,
    plotYFactor,
  ]);

  const xTicks = useMemo(() => {
    const mode = String(axis?.xTicks ?? "auto");
    if (mode === "auto") {
      return buildOriginAutoTicks(xDomain[0], xDomain[1], 6);
    }
    if (mode === "step") {
      const step = parseOptionalNumber(axis?.xStep);
      return step ? buildStepTicks(xDomain[0], xDomain[1], step) : null;
    }
    const count = Math.max(2, Math.floor(Number(axis?.xTickCount) || 6));
    return buildNiceTicks(xDomain[0], xDomain[1], count, {
      preferTightRange: false,
    });
  }, [axis?.xStep, axis?.xTickCount, axis?.xTicks, xDomain]);

  const yTicks = useMemo(() => {
    const mode = String(axis?.yTicks ?? "nice");
    if (mode === "auto") {
      if (effectiveYScale !== "linear") {
        const min = Number(yDomain?.[0]);
        const max = Number(yDomain?.[1]);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
        const lo = Math.min(min, max);
        const hi = Math.max(min, max);
        if (!(hi > 0)) return null;
        const safeLo = lo > 0 ? lo : hi / 1000;
        const expMin = Math.floor(Math.log10(safeLo));
        const expMax = Math.ceil(Math.log10(hi));
        const decades = Math.max(1, expMax - expMin);
        const decadeStep = Math.max(1, Math.ceil(decades / 6));
        return buildLogTicks(yDomain[0], yDomain[1], decadeStep);
      }
      return buildOriginAutoTicks(yDomain[0], yDomain[1], 6);
    }

    if (effectiveYScale !== "linear") {
      if (mode !== "decades") return null;
      return buildLogTicks(yDomain[0], yDomain[1], axis?.yDecadeStep);
    }

    if (mode === "step") {
      const stepRaw = parseOptionalNumber(axis?.yStep);
      const step = stepRaw !== null ? stepRaw / plotYFactor : null;
      return step ? buildStepTicks(yDomain[0], yDomain[1], step) : null;
    }
    const count = Math.max(2, Math.floor(Number(axis?.yTickCount) || 6));
    return buildNiceTicks(yDomain[0], yDomain[1], count, {
      preferTightRange: false,
    });
  }, [
    axis?.yDecadeStep,
    axis?.yStep,
    axis?.yTickCount,
    axis?.yTicks,
    effectiveYScale,
    plotYFactor,
    yDomain,
  ]);

  const xTickDigits = useMemo(() => inferTickDigitsFromTicks(xTicks), [xTicks]);
  const yTickDigits = useMemo(() => {
    if (effectiveYScale !== "linear") return 4;
    const scaledTicks = Array.isArray(yTicks)
      ? yTicks.map((v) => v * plotYFactor)
      : null;
    return inferTickDigitsFromTicks(scaledTicks);
  }, [effectiveYScale, plotYFactor, yTicks]);

  const xLabelInterval = useMemo(
    () => computeLabelInterval(xTicks, 7),
    [xTicks],
  );
  const yLabelInterval = useMemo(
    () => (effectiveYScale === "linear" ? computeLabelInterval(yTicks, 7) : 0),
    [effectiveYScale, yTicks],
  );

  const plotLabel = useMemo(() => {
    if (effectivePlotType === "gm") {
      return gmMode === "legend"
        ? "Transconductance (gm = dI/dLegend @ fixed X)"
        : "Derivative (dI/dX per curve)";
    }
    if (effectivePlotType === "ss") return "Subthreshold Swing (mV/dec)";
    if (effectivePlotType === "j") return "Current Density (J = |I| / Area)";
    return "Detail Plot";
  }, [effectivePlotType, gmMode]);

  const metricsRows = useMemo(() => {
    if (!activeFile?.series?.length) return [];
    return activeFile.series.map((series) => {
      const analysis = analysisBySeriesId.get(series.id);
      return {
        id: series.id,
        name: series.name,
        group: Number(series.groupIndex ?? 0) + 1,
        yCol: series.yCol,
        ...analysis?.metrics,
      };
    });
  }, [activeFile, analysisBySeriesId]);

  const handleSelectFile = React.useCallback(
    (fileId) => {
      if (!fileId) return;
      preserveScrollPosition(() => setActiveFileId(fileId));
    },
    [setActiveFileId],
  );

  if (!processedData || processedData.length === 0) return null;

  return (
    <div className="space-y-4">
      <OverviewGrid
        processedData={processedData}
        processingStatus={processingStatus}
        activeFileId={effectiveActiveFileId}
        onSelectFile={handleSelectFile}
        yUnitFactor={currentUnitMeta.factor}
        yUnitLabel={currentUnitMeta.label}
      />

      <div className="bg-bg-surface border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-lg font-bold text-text-primary">{plotLabel}</h2>
          <span className="text-xs text-text-secondary">
            (active file only)
          </span>
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="bg-bg-page border border-border rounded-lg p-1 inline-flex">
              <button
                type="button"
                onClick={() => setPlotType("iv")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  effectivePlotType === "iv"
                    ? "bg-accent text-white shadow"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                I-V
              </button>
              <button
                type="button"
                onClick={() => setPlotType("gm")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  effectivePlotType === "gm"
                    ? "bg-accent text-white shadow"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                gm
              </button>
              <button
                type="button"
                onClick={() => setPlotType("ss")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  effectivePlotType === "ss"
                    ? "bg-accent text-white shadow"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                SS
              </button>
              <button
                type="button"
                onClick={() => setPlotType("j")}
                disabled={!area}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  effectivePlotType === "j"
                    ? "bg-accent text-white shadow"
                    : "text-text-secondary hover:text-text-primary"
                } ${!area ? "opacity-50 cursor-not-allowed" : ""}`}
                title={!area ? "Set a positive Area to enable J plot" : ""}
              >
                J
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span className="whitespace-nowrap">
                Area (for J = |I|/Area):
              </span>
              <input
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                placeholder="e.g. 1e-4"
                className="bg-bg-page border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent w-[100px]"
              />
              <Button
                variant="text"
                size="sm"
                onClick={() => setAreaInput("")}
                className="px-2 py-0.5 h-7 text-xs border border-border/50 hover:bg-bg-subtle"
                title="Clear Area"
              >
                Clear
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-text-secondary whitespace-nowrap">
                  Y unit:
                </span>
                {effectivePlotType === "ss" ? (
                  <span className="text-xs text-text-primary font-mono whitespace-nowrap">
                    mV/dec
                  </span>
                ) : (
                  <Dropdown
                    value={yUnit}
                    onChange={(next) => {
                      const nextUnit =
                        next === "A" || next === "uA" || next === "nA"
                          ? next
                          : "A";

                      userChangedYUnitRef.current = true;
                      setYUnit(nextUnit);
                      apiService
                        .updateDeviceAnalysisSettings({ yUnit: nextUnit })
                        .catch(() => {});
                    }}
                    options={[
                      { value: "A", label: "A" },
                      { value: "uA", label: "µA" },
                      { value: "nA", label: "nA" },
                    ]}
                    className="w-[70px]"
                    triggerClassName="h-8 px-2 text-xs bg-bg-page border-border w-full py-0 justify-between"
                  />
                )}
              </div>

              {effectivePlotType === "gm" ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-text-secondary whitespace-nowrap">
                    gm:
                  </span>
                  <Dropdown
                    value={gmMode}
                    onChange={(next) =>
                      setGmMode(next === "legend" ? "legend" : "x")
                    }
                    options={[
                      { value: "x", label: "dI/dX (per curve)" },
                      { value: "legend", label: "dI/dLegend (fixed X)" },
                    ]}
                    className="w-[170px]"
                    triggerClassName="h-8 px-2 text-xs bg-bg-page border-border w-full py-0 justify-between"
                  />
                </div>
              ) : null}

              <Dropdown
                value={effectiveActiveFileId ?? ""}
                onChange={(val) => handleSelectFile(val)}
                options={processedData.map((f) => ({
                  value: f.fileId,
                  label: f.fileName,
                }))}
                className="w-[240px]"
                triggerClassName="h-8 px-2 text-xs bg-bg-page border-border w-full py-0 justify-between text-text-primary"
                placeholder="Select File"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAxisControls((v) => !v)}
                className="h-8 px-3 text-xs border-border bg-bg-page hover:bg-bg-surface-hover"
                title="Axis settings"
              >
                Axis
              </Button>
            </div>
          </div>

          {showAxisControls && (
            <div className="bg-bg-page border border-border rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-xs font-semibold text-text-primary">
                  Axis Settings
                </div>
                <Button
                  variant="text"
                  size="sm"
                  onClick={() =>
                    setAxis((prev) => ({
                      ...prev,
                      xMin: "",
                      xMax: "",
                      xTicks: "auto",
                      xTickCount: 6,
                      xStep: "",
                      yMin: "",
                      yMax: "",
                      yScale: "linear",
                      yTicks: "nice",
                      yTickCount: 6,
                      yStep: "",
                      yDecadeStep: 1,
                    }))
                  }
                  className="h-6 px-2 text-xs text-text-secondary hover:text-text-primary"
                >
                  Reset
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-text-secondary">
                    X Axis
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={axis.xMin}
                      onChange={(e) =>
                        setAxis((prev) => ({ ...prev, xMin: e.target.value }))
                      }
                      placeholder="min (auto)"
                      className="bg-bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                    />
                    <input
                      value={axis.xMax}
                      onChange={(e) =>
                        setAxis((prev) => ({ ...prev, xMax: e.target.value }))
                      }
                      placeholder="max (auto)"
                      className="bg-bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 items-center">
                    <select
                      value={axis.xTicks}
                      onChange={(e) =>
                        setAxis((prev) => ({ ...prev, xTicks: e.target.value }))
                      }
                      className="bg-bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                      title="Tick mode"
                    >
                      <option value="auto">ticks: auto</option>
                      <option value="nice">ticks: nice</option>
                      <option value="step">ticks: step</option>
                    </select>
                    <input
                      value={axis.xTickCount}
                      onChange={(e) =>
                        setAxis((prev) => ({
                          ...prev,
                          xTickCount: e.target.value,
                        }))
                      }
                      disabled={axis.xTicks !== "nice"}
                      placeholder="count"
                      className="bg-bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
                      title="Nice tick count"
                    />
                    <input
                      value={axis.xStep}
                      onChange={(e) =>
                        setAxis((prev) => ({ ...prev, xStep: e.target.value }))
                      }
                      disabled={axis.xTicks !== "step"}
                      placeholder="step"
                      className="bg-bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
                      title="Step tick increment"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-text-secondary">
                    Y Axis
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={axis.yMin}
                      onChange={(e) =>
                        setAxis((prev) => ({ ...prev, yMin: e.target.value }))
                      }
                      placeholder={`min (auto) (${plotYUnitLabel})`}
                      className="bg-bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                    />
                    <input
                      value={axis.yMax}
                      onChange={(e) =>
                        setAxis((prev) => ({ ...prev, yMax: e.target.value }))
                      }
                      placeholder={`max (auto) (${plotYUnitLabel})`}
                      className="bg-bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 items-center">
                    <select
                      value={axis.yScale}
                      onChange={(e) =>
                        setAxis((prev) => {
                          const nextScale = e.target.value;
                          const nextTicks =
                            nextScale === "linear" ? "nice" : "decades";
                          return {
                            ...prev,
                            yScale: nextScale,
                            yTicks: nextTicks,
                          };
                        })
                      }
                      className="bg-bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                      title="Scale"
                    >
                      <option value="linear">scale: linear</option>
                      <option value="log">scale: log</option>
                      <option value="logAbs">scale: log(|y|)</option>
                    </select>
                    <select
                      value={axis.yTicks}
                      onChange={(e) =>
                        setAxis((prev) => ({ ...prev, yTicks: e.target.value }))
                      }
                      className="bg-bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                      title="Tick mode"
                    >
                      <option value="auto">ticks: auto</option>
                      <option
                        value="nice"
                        disabled={effectiveYScale !== "linear"}
                      >
                        ticks: nice
                      </option>
                      <option
                        value="step"
                        disabled={effectiveYScale !== "linear"}
                      >
                        ticks: step
                      </option>
                      <option
                        value="decades"
                        disabled={effectiveYScale === "linear"}
                      >
                        ticks: decades
                      </option>
                    </select>
                    {effectiveYScale === "linear" ? (
                      axis.yTicks === "step" ? (
                        <input
                          value={axis.yStep}
                          onChange={(e) =>
                            setAxis((prev) => ({
                              ...prev,
                              yStep: e.target.value,
                            }))
                          }
                          placeholder={`step (${plotYUnitLabel})`}
                          className="bg-bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                          title="Major tick increment"
                        />
                      ) : (
                        <input
                          value={axis.yTickCount}
                          onChange={(e) =>
                            setAxis((prev) => ({
                              ...prev,
                              yTickCount: e.target.value,
                            }))
                          }
                          disabled={axis.yTicks !== "nice"}
                          placeholder="count"
                          className="bg-bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
                          title="Nice tick count"
                        />
                      )
                    ) : (
                      <input
                        value={axis.yDecadeStep}
                        onChange={(e) =>
                          setAxis((prev) => ({
                            ...prev,
                            yDecadeStep: e.target.value,
                          }))
                        }
                        disabled={axis.yTicks !== "decades"}
                        placeholder="decade step"
                        className="bg-bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
                        title="Major tick increment (decades)"
                      />
                    )}
                  </div>

                  {yScaleWarning ? (
                    <div className="text-[11px] text-yellow-500">
                      {yScaleWarning}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>

        {activeFile?.series?.length ? (
          <div className="h-[500px] flex flex-col">
            <div className="text-xs text-text-secondary mb-2">
              X: {xRangeLabel} | points/group: {activeFile.x.points} | groups:{" "}
              {activeFile.x.groups} | series: {activeFile.series.length} | y
              unit: {plotYUnitLabel}
            </div>

            {effectivePlotType === "gm" &&
            gmMode === "legend" &&
            !gmLegendStatus.ok ? (
              <div className="text-[11px] text-red-500 mb-2">
                {gmLegendStatus.message}
              </div>
            ) : null}

            <div className="flex-1 min-h-0">
              <ResponsiveContainer
                width="100%"
                height="100%"
                className="!outline-none"
              >
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
                    domain={
                      xTicks ? [xTicks[0], xTicks[xTicks.length - 1]] : xDomain
                    }
                    ticks={xTicks ?? undefined}
                    interval={xLabelInterval}
                    tickFormatter={(v) =>
                      formatNumber(v, { digits: xTickDigits })
                    }
                    stroke="currentColor"
                    className="text-text-secondary text-xs"
                    tick={{ fill: "currentColor", opacity: 0.6 }}
                    allowDataOverflow
                  />
                  <YAxis
                    type="number"
                    scale={effectiveYScale === "linear" ? "linear" : "log"}
                    domain={
                      yTicks ? [yTicks[0], yTicks[yTicks.length - 1]] : yDomain
                    }
                    ticks={yTicks ?? undefined}
                    interval={yLabelInterval}
                    tickFormatter={(v) =>
                      formatNumber(v * plotYFactor, { digits: yTickDigits })
                    }
                    stroke="currentColor"
                    className="text-text-secondary text-xs"
                    tick={{ fill: "currentColor", opacity: 0.6 }}
                    allowDataOverflow
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e1e1e",
                      borderColor: "#333",
                      color: "#fff",
                    }}
                    itemStyle={{ color: "#ccc" }}
                    labelFormatter={(label) =>
                      `x=${formatNumber(label, { digits: xTickDigits })}`
                    }
                    formatter={(value, name) => {
                      const num =
                        typeof value === "number"
                          ? value
                          : value === null || value === undefined
                            ? NaN
                            : Number(value);
                      return [
                        `${formatNumber(num * plotYFactor, { digits: yTickDigits })} ${plotYUnitLabel}`,
                        name,
                      ];
                    }}
                  />
                  <Legend verticalAlign="top" align="right" />
                  {displayPlotSeries.map((series, idx) => (
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

      {activeFile?.series?.length ? (
        <div className="bg-bg-surface border border-border rounded-xl p-4 overflow-x-auto">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-text-primary">
              Calculated Parameters
            </h3>
            <div className="text-xs text-text-secondary whitespace-nowrap">
              gm: max |{gmMode === "legend" ? "dI/dLegend" : "dI/dX"}| · SS: min
              (mV/dec) · J uses |I|/Area
            </div>
          </div>

          <table className="min-w-[980px] w-full text-sm text-left border-collapse">
            <thead className="sticky top-0 bg-bg-surface z-10">
              <tr className="border-b border-border">
                <th className="p-2 text-xs font-semibold text-text-secondary">
                  Series
                </th>
                <th className="p-2 text-xs font-semibold text-text-secondary">
                  |I|on
                </th>
                <th className="p-2 text-xs font-semibold text-text-secondary">
                  x@Ion
                </th>
                <th className="p-2 text-xs font-semibold text-text-secondary">
                  |I|off
                </th>
                <th className="p-2 text-xs font-semibold text-text-secondary">
                  x@Ioff
                </th>
                <th className="p-2 text-xs font-semibold text-text-secondary">
                  Ion/Ioff
                </th>
                <th className="p-2 text-xs font-semibold text-text-secondary">
                  gm_max(|)
                </th>
                <th className="p-2 text-xs font-semibold text-text-secondary">
                  x@gm_max
                </th>
                <th className="p-2 text-xs font-semibold text-text-secondary">
                  SS_min
                </th>
                <th className="p-2 text-xs font-semibold text-text-secondary">
                  x@SS_min
                </th>
                <th className="p-2 text-xs font-semibold text-text-secondary">
                  Jon (if Area)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {metricsRows.map((row) => (
                <tr key={row.id} className="hover:bg-bg-page/30">
                  <td className="p-2 text-text-primary font-medium whitespace-nowrap">
                    {row.name}
                  </td>
                  <td className="p-2 font-mono text-xs text-text-primary whitespace-nowrap">
                    {formatNumber(row.ion)}
                  </td>
                  <td className="p-2 font-mono text-xs text-text-secondary whitespace-nowrap">
                    {formatNumber(row.xAtIon)}
                  </td>
                  <td className="p-2 font-mono text-xs text-text-primary whitespace-nowrap">
                    {formatNumber(row.ioff)}
                  </td>
                  <td className="p-2 font-mono text-xs text-text-secondary whitespace-nowrap">
                    {formatNumber(row.xAtIoff)}
                  </td>
                  <td className="p-2 font-mono text-xs text-text-primary whitespace-nowrap">
                    {formatNumber(row.ionIoff, { digits: 3 })}
                  </td>
                  <td className="p-2 font-mono text-xs text-text-primary whitespace-nowrap">
                    {formatNumber(row.gmMaxAbs)}
                  </td>
                  <td className="p-2 font-mono text-xs text-text-secondary whitespace-nowrap">
                    {formatNumber(row.xAtGmMaxAbs)}
                  </td>
                  <td className="p-2 font-mono text-xs text-text-primary whitespace-nowrap">
                    {formatNumber(row.ssMin, { digits: 2 })}
                  </td>
                  <td className="p-2 font-mono text-xs text-text-secondary whitespace-nowrap">
                    {formatNumber(row.xAtSsMin)}
                  </td>
                  <td className="p-2 font-mono text-xs text-text-primary whitespace-nowrap">
                    {formatNumber(row.jon)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};

export default AnalysisCharts;
