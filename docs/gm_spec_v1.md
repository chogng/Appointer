# gm (Transconductance / Derivative) Spec v1 (Bilingual / 双语)

Version: `gm_v1`  
Date: `2026-01-10`  
Scope: Device Analysis **detail plot** gm/derivative computation + UI labeling (deterministic; no smoothing/ML).

---

## 1) Background / 背景

**EN**
- Device Analysis provides a “gm” plot, but the code supports **two different derivatives**:
  - `dI/dX` per curve (X is the sweep axis of that curve)
  - `dI/dLegend` at fixed X (Legend is the per-curve parameter, e.g., Vg or Vd)
- Whether the plotted derivative is *physical transconductance* `gm` or *output conductance* `gds` depends on which voltage is used as X/Legend.

**CN**
- Device Analysis 里有 “gm” 图，但实现上支持 **两种不同的导数**：
  - 每条曲线内对横轴求导：`dI/dX`
  - 固定 X，对曲线间的图例参数求导：`dI/dLegend`
- 这个导数究竟对应器件物理意义上的 `gm` 还是 `gds`，取决于你把哪个电压放在 X 或 Legend 上。

---

## 2) Goals / 目标

**EN Goals**
- Provide a fast, deterministic derivative visualization for extracted I–V curves.
- Make the computation traceable: define formulas, assumptions, and edge-case behavior.
- Support two modes in UI:
  - `dI/dX (per curve)`
  - `dI/dLegend (fixed X)` (across curves in a bucket)

**CN 目标**
- 给已抽取的 I–V 曲线提供快速、确定性的导数可视化。
- 计算过程可追溯：公式/假设/边界行为明确。
- UI 支持两种模式：
  - `dI/dX（单曲线）`
  - `dI/dLegend（固定 X，跨曲线）`

**Non‑Goals / 非目标**
- No smoothing / denoising / Savitzky–Golay / regression fitting.
- No physics-aware “gm extraction” (e.g., constant‑Vd enforcement beyond what the input sweep provides).

---

## 3) Definitions / 定义

Let the measured quantity be current `I`. Curves are organized as:

- **X**: sweep axis (e.g., `Vg` or `Vd`)
- **Legend parameter** `p`: per-curve parameter (e.g., the other voltage)
- Each curve provides samples `{(x_j, I_j)}` for `j = 0..N-1`.

**Mode A: `dI/dX` (per curve)**
- Derivative along the sweep axis on the same curve.

**Mode B: `∂I/∂p |X` (`dI/dLegend`, fixed X)**
- At a given X, differentiate current across curves with different legend parameter `p`.

**Physical mapping reminder / 物理映射提示**
- Transfer sweep: `X=Vg`, `p=Vd`
  - Mode A ≈ `gm = ∂Id/∂Vg |Vd`
  - Mode B ≈ `gds = ∂Id/∂Vd |Vg`
- Output sweep: `X=Vd`, `p=Vg`
  - Mode A ≈ `gds = ∂Id/∂Vd |Vg`
  - Mode B ≈ `gm = ∂Id/∂Vg |Vd`

---

## 4) Data Flow / 数据流

**Worker (CSV processing)**
- `src/workers/deviceAnalysis.worker.js` produces:
  - `xGroups: Float64Array[]` (per sweep group)
  - `series[]`, each with:
    - `groupIndex` → choose `xArr = xGroups[groupIndex]`
    - `y: Float64Array` (current samples aligned with `xArr`)
    - `legendValue: number|null` parsed from legend labels (for Mode B)

**Chart layer**
- `src/components/DeviceAnalysis/AnalysisCharts.jsx` builds point lists per series:
  - `buildPoints(xArr, yArr) -> [{x, y}]`
  - `pointsBySeriesId: Map<seriesId, points[]>`
- gm is computed in a memoized map:
  - Mode A → `computeCentralDerivative(points)`
  - Mode B → `computeLegendDerivativeSeries(curvesInBucket)`

---

## 5) Mode A Algorithm: `dI/dX (per curve)` / 单曲线对 X 求导

**Formula (numeric derivative)**

For interior points (`1 <= i <= N-2`):
```
dI/dX(x_i) ≈ (I_{i+1} - I_{i-1}) / (x_{i+1} - x_{i-1})
```

Endpoints use one-sided differences:
```
i=0:     (I_1 - I_0) / (x_1 - x_0)
i=N-1:   (I_{N-1} - I_{N-2}) / (x_{N-1} - x_{N-2})
```

**Steps**
1. Require at least 2 points, else return empty.
2. For each index `i`:
   - If `x_i` or `I_i` is not finite → output `{x_i, y: null}`.
   - Choose neighbors (`prev`, `next`) based on availability.
   - If `dx == 0` or not finite → output `{x_i, y: null}`.
   - Else output `{x_i, y: dI/dX}`.

**Implementation**
- `src/components/DeviceAnalysis/analysisMath.js`: `computeCentralDerivative(points)`

---

## 6) Mode B Algorithm: `dI/dLegend (fixed X)` / 固定 X，跨曲线对 Legend 求导

Mode B computes `∂I/∂p |X` where `p` is `legendValue`.

### 6.1 Bucketing / 分桶（确保同类曲线相互求导）

`src/components/DeviceAnalysis/AnalysisCharts.jsx` groups curves into buckets so only comparable curves are differentiated:
- Legend mode = `yCol` → bucket by `groupIndex` (same X sweep group)
- Legend mode = `group` → bucket by `yCol` (same Y column)

Each bucket is a list of:
```
{ id, x: xArr, y: yArr, param: legendValue }
```

Preconditions:
- At least 2 curves in the bucket with finite numeric `param`.

### 6.2 Across-curve finite difference / 跨曲线差分

Curves are sorted by `param` (ascending). For a curve at index `i`, pick the nearest:
- `prevIdx`: closest curve with `param != param_i` on the left
- `nextIdx`: closest curve with `param != param_i` on the right

Then for each sample `x_j` on the current curve:
- Interpolate neighbor curves to the same `x_j`
- Compute derivative by central/one-sided difference across `param`

Central (preferred):
```
denom = p_next - p_prev
∂I/∂p|x ≈ (I_next(x) - I_prev(x)) / denom
```

One-sided:
```
hasNext: (I_next(x) - I_curr(x)) / (p_next - p_curr)
hasPrev: (I_curr(x) - I_prev(x)) / (p_curr - p_prev)
```

### 6.3 Interpolation / 插值

Neighbor curve current is evaluated at `xTarget` via monotonic linear interpolation:
- Assumes the neighbor curve’s `x` is monotonic (increasing or decreasing).
- Returns `null` if `xTarget` is outside the curve’s X range or if data is invalid.

Implementation:
- `src/components/DeviceAnalysis/analysisMath.js`: `interpolateMonotonicLinear(xArr, yArr, xTarget)`
- `src/components/DeviceAnalysis/analysisMath.js`: `computeLegendDerivativeSeries(curves)`

---

## 7) Units, Scaling, and Sign / 单位、缩放与符号

**EN**
- Stored current `I` is in **A** (base unit). UI scales display via `yUnit`:
  - `A` → factor `1`
  - `µA` → factor `1e6`
  - `nA` → factor `1e9`
- Mode A output unit: `A / (X unit)` (usually `A/V` if X is volts).
- Mode B output unit: `A / (legend unit)`.
- UI y-axis label (gm/derivative):
  - If the derivative variable is `Vg`/`Vd` → `${currentUnit}/V`
  - Otherwise fallback to `${currentUnit}/X` (Mode A) or `${currentUnit}/Legend` (Mode B) to avoid incorrect `/V`.
- Derivative is computed on **signed** current (not `|I|`). A separate metric uses `max |gm|` for convenience.
- Derivative is computed on **downsampled** points produced by the worker (`maxPoints`, default 600). Sharp peaks can be underestimated.

**CN**
- 电流 `I` 在内部以 **A** 为基准单位；UI 根据 `yUnit` 做显示缩放：
  - `A` → `1`
  - `µA` → `1e6`
  - `nA` → `1e9`
- Mode A 的单位：`A / (X 单位)`（若 X 是电压，则为 `A/V`）。
- Mode B 的单位：`A / (legend 单位)`。
- UI 的 gm/导数纵轴单位显示：
  - 若求导变量为 `Vg`/`Vd` → `${currentUnit}/V`
  - 否则回退为 `${currentUnit}/X`（Mode A）或 `${currentUnit}/Legend`（Mode B），避免错误地写成 `/V`。
- 导数按 **有符号电流** 计算（不是 `|I|`）；表格里另有 `max |gm|` 便于比较。
- 导数基于 worker 输出的**下采样**点计算（`maxPoints`，默认 600），尖锐峰值可能会被低估。

---

## 8) Edge Cases / 边界情况

- **Repeated X (dx=0)**: derivative at that index becomes `null`.
- **Non-finite values**: any point with non-finite `x` or `I` produces `{x, y:null}`.
- **Non-monotonic X in Mode B**: interpolation may fail (returns `null`) or yield misleading results; Mode B is intended for monotonic sweeps.
- **Duplicate legend values**: Mode B skips identical `param` neighbors by searching for the nearest *distinct* `param`.
- **X range mismatch across curves**: if neighbor curves don’t cover `xTarget`, interpolation returns `null` → derivative `null` at that x.

---

## 9) Implementation Pointers / 代码定位

- `src/components/DeviceAnalysis/AnalysisCharts.jsx`
  - `gmMode` selector + plot label
  - `gmBySeriesId` computation (Mode A/Mode B switch)
  - `gmLegendStatus` (precondition checks for Mode B)
- `src/components/DeviceAnalysis/analysisMath.js`
  - `computeCentralDerivative(points)` (Mode A)
  - `computeLegendDerivativeSeries(curves)` + `interpolateMonotonicLinear(...)` (Mode B)
- `src/workers/deviceAnalysis.worker.js`
  - Downsampling to `xGroups` / `series.y`
  - Parsing `legendValue` from legend labels

---

## 10) Suggested Sanity Tests / 建议的自检用例

You can validate correctness with simple synthetic data:

1. **Linear per-curve**
   - `I(x)=a·x+b` → Mode A should be constant `a`.
2. **Quadratic**
   - `I(x)=x²` → Mode A should approximate `2x`.
3. **Legend derivative**
   - `I(x,p)=p·x` → Mode B should return approximately `x`.

---

## 11) Future Improvements (Optional) / 未来可选优化

- Add optional smoothing or local linear regression for noisy data.
- Improve unit labeling for Mode B to reflect legend parameter unit (not always `/V`).
- Improve unit labeling to reflect the actual parameter unit (beyond the current `V` vs `X/Legend` fallback).
- Handle non-monotonic sweeps in Mode B by resampling on a shared sorted X grid.
