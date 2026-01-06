const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const toPoint = (x, y) => ({ x, y: isFiniteNumber(y) ? y : null });

const padDomain = (min, max) => {
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

export const computeCentralDerivative = (points) => {
  if (!Array.isArray(points) || points.length < 2) return [];

  const out = new Array(points.length);

  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const x = curr?.x;
    const y = curr?.y;

    if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
      out[i] = toPoint(x, null);
      continue;
    }

    const prev = i > 0 ? points[i - 1] : null;
    const next = i < points.length - 1 ? points[i + 1] : null;

    if (prev && next) {
      const dx = next.x - prev.x;
      if (!isFiniteNumber(dx) || dx === 0) {
        out[i] = toPoint(x, null);
        continue;
      }
      out[i] = toPoint(x, (next.y - prev.y) / dx);
      continue;
    }

    if (next) {
      const dx = next.x - x;
      if (!isFiniteNumber(dx) || dx === 0) {
        out[i] = toPoint(x, null);
        continue;
      }
      out[i] = toPoint(x, (next.y - y) / dx);
      continue;
    }

    if (prev) {
      const dx = x - prev.x;
      if (!isFiniteNumber(dx) || dx === 0) {
        out[i] = toPoint(x, null);
        continue;
      }
      out[i] = toPoint(x, (y - prev.y) / dx);
      continue;
    }

    out[i] = toPoint(x, null);
  }

  return out;
};

const interpolateMonotonicLinear = (xArrRaw, yArrRaw, xTarget) => {
  const xArr = xArrRaw ?? [];
  const yArr = yArrRaw ?? [];
  const n = Math.min(xArr.length ?? 0, yArr.length ?? 0);
  if (n <= 0) return null;

  const x0 = xArr[0];
  const xN = xArr[n - 1];
  if (!isFiniteNumber(x0) || !isFiniteNumber(xN) || !isFiniteNumber(xTarget)) {
    return null;
  }

  const increasing = x0 <= xN;
  if (increasing) {
    if (xTarget < x0 || xTarget > xN) return null;
  } else {
    if (xTarget > x0 || xTarget < xN) return null;
  }

  // Fast-path exact boundary matches.
  if (xTarget === x0) return isFiniteNumber(yArr[0]) ? yArr[0] : null;
  if (xTarget === xN) return isFiniteNumber(yArr[n - 1]) ? yArr[n - 1] : null;

  let lo = 0;
  let hi = n - 1;

  // Binary search for bounding indices.
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    const xm = xArr[mid];
    if (!isFiniteNumber(xm)) return null;

    const goRight = increasing ? xm <= xTarget : xm >= xTarget;
    if (goRight) lo = mid;
    else hi = mid;
  }

  const xLo = xArr[lo];
  const xHi = xArr[hi];
  const yLo = yArr[lo];
  const yHi = yArr[hi];
  if (
    !isFiniteNumber(xLo) ||
    !isFiniteNumber(xHi) ||
    !isFiniteNumber(yLo) ||
    !isFiniteNumber(yHi)
  ) {
    return null;
  }

  if (xTarget === xLo) return yLo;
  if (xTarget === xHi) return yHi;

  const dx = xHi - xLo;
  if (!isFiniteNumber(dx) || dx === 0) return yLo;

  const t = (xTarget - xLo) / dx;
  if (!isFiniteNumber(t)) return null;

  // t should be in [0,1], but clamp to be safe with floating errors.
  const tc = Math.max(0, Math.min(1, t));
  return yLo + tc * (yHi - yLo);
};

export const computeLegendDerivativeSeries = (curves) => {
  if (!Array.isArray(curves) || curves.length < 2) return new Map();

  const normalized = curves
    .map((c) => ({
      id: c?.id ?? null,
      x: c?.x ?? null,
      y: c?.y ?? null,
      param: c?.param ?? null,
    }))
    .filter(
      (c) =>
        typeof c.id === "string" &&
        Array.isArray(c.x) === false &&
        Array.isArray(c.y) === false &&
        isFiniteNumber(c.param) &&
        (c.x?.length ?? 0) > 0 &&
        (c.y?.length ?? 0) > 0,
    );

  if (normalized.length < 2) return new Map();

  normalized.sort((a, b) => a.param - b.param);
  const n = normalized.length;

  const findPrevDistinct = (i) => {
    const p0 = normalized[i]?.param;
    for (let p = i - 1; p >= 0; p--) {
      const pv = normalized[p]?.param;
      if (isFiniteNumber(pv) && pv !== p0) return p;
    }
    return -1;
  };

  const findNextDistinct = (i) => {
    const p0 = normalized[i]?.param;
    for (let k = i + 1; k < n; k++) {
      const pv = normalized[k]?.param;
      if (isFiniteNumber(pv) && pv !== p0) return k;
    }
    return -1;
  };

  const outById = new Map();

  for (let i = 0; i < n; i++) {
    const curr = normalized[i];
    const prevIdx = findPrevDistinct(i);
    const nextIdx = findNextDistinct(i);
    const hasPrev = prevIdx >= 0;
    const hasNext = nextIdx >= 0;

    const currX = curr.x;
    const currY = curr.y;
    const out = new Array(currX.length);

    for (let j = 0; j < currX.length; j++) {
      const x = currX[j];
      const yCurr = currY[j];

      if (!isFiniteNumber(x) || !isFiniteNumber(yCurr)) {
        out[j] = toPoint(x, null);
        continue;
      }

      if (hasPrev && hasNext) {
        const prev = normalized[prevIdx];
        const next = normalized[nextIdx];
        const denom = next.param - prev.param;
        if (!isFiniteNumber(denom) || denom === 0) {
          out[j] = toPoint(x, null);
          continue;
        }

        const yPrev = interpolateMonotonicLinear(prev.x, prev.y, x);
        const yNext = interpolateMonotonicLinear(next.x, next.y, x);
        if (!isFiniteNumber(yPrev) || !isFiniteNumber(yNext)) {
          out[j] = toPoint(x, null);
          continue;
        }

        out[j] = toPoint(x, (yNext - yPrev) / denom);
        continue;
      }

      if (hasNext) {
        const next = normalized[nextIdx];
        const denom = next.param - curr.param;
        if (!isFiniteNumber(denom) || denom === 0) {
          out[j] = toPoint(x, null);
          continue;
        }

        const yNext = interpolateMonotonicLinear(next.x, next.y, x);
        if (!isFiniteNumber(yNext)) {
          out[j] = toPoint(x, null);
          continue;
        }

        out[j] = toPoint(x, (yNext - yCurr) / denom);
        continue;
      }

      if (hasPrev) {
        const prev = normalized[prevIdx];
        const denom = curr.param - prev.param;
        if (!isFiniteNumber(denom) || denom === 0) {
          out[j] = toPoint(x, null);
          continue;
        }

        const yPrev = interpolateMonotonicLinear(prev.x, prev.y, x);
        if (!isFiniteNumber(yPrev)) {
          out[j] = toPoint(x, null);
          continue;
        }

        out[j] = toPoint(x, (yCurr - yPrev) / denom);
        continue;
      }

      out[j] = toPoint(x, null);
    }

    outById.set(curr.id, out);
  }

  return outById;
};

export const computeSubthresholdSwing = (points) => {
  if (!Array.isArray(points) || points.length < 3) return [];

  const log10AbsY = points.map((p) => {
    const y = p?.y;
    if (!isFiniteNumber(y)) return null;
    const abs = Math.abs(y);
    if (abs <= 0) return null;
    return Math.log10(abs);
  });

  const out = new Array(points.length);

  for (let i = 0; i < points.length; i++) {
    const x = points[i]?.x;
    if (!isFiniteNumber(x)) {
      out[i] = toPoint(x, null);
      continue;
    }

    const prev = i > 0 ? points[i - 1] : null;
    const next = i < points.length - 1 ? points[i + 1] : null;

    if (!prev || !next) {
      out[i] = toPoint(x, null);
      continue;
    }

    const prevLog = log10AbsY[i - 1];
    const nextLog = log10AbsY[i + 1];
    if (!isFiniteNumber(prevLog) || !isFiniteNumber(nextLog)) {
      out[i] = toPoint(x, null);
      continue;
    }

    const dx = next.x - prev.x;
    if (!isFiniteNumber(dx) || dx === 0) {
      out[i] = toPoint(x, null);
      continue;
    }

    const slope = (nextLog - prevLog) / dx; // dec / V
    if (!isFiniteNumber(slope) || slope === 0) {
      out[i] = toPoint(x, null);
      continue;
    }

    const ss = (1000 / Math.abs(slope)) * 1; // mV / dec
    out[i] = toPoint(x, ss);
  }

  return out;
};

export const computeDomain = (seriesList) => {
  if (!Array.isArray(seriesList) || seriesList.length === 0) {
    return { x: [0, 1], y: [0, 1] };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const series of seriesList) {
    for (const point of series?.data ?? []) {
      if (isFiniteNumber(point?.x)) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
      }
      if (isFiniteNumber(point?.y)) {
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }
    }
  }

  const [x0, x1] = padDomain(
    Number.isFinite(minX) ? minX : 0,
    Number.isFinite(maxX) ? maxX : 1,
  );
  const [y0, y1] = padDomain(
    Number.isFinite(minY) ? minY : 0,
    Number.isFinite(maxY) ? maxY : 1,
  );

  return { x: [x0, x1], y: [y0, y1] };
};

export const formatNumber = (value, { digits = 4 } = {}) => {
  if (!isFiniteNumber(value)) return "—";

  const abs = Math.abs(value);
  if (abs === 0) return "0";

  const trimZeros = (s) =>
    s.includes(".") ? s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : s;

  if (abs >= 1e4) {
    return value.toExponential(3);
  }

  if (abs < 1) {
    const magnitude = Math.floor(Math.log10(abs));
    const decimals = Math.min(20, Math.max(0, -magnitude + (digits + 2)));
    return trimZeros(value.toFixed(decimals));
  }

  return trimZeros(value.toFixed(digits));
};
