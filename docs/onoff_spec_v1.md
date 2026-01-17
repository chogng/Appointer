# On/Off Ratio (Ion/Ioff) Spec v1 (Bilingual / 双语)

Version: `onoff_v1`  
Date: `2026-01-10`  
Scope: Device Analysis **Calculated Parameters**: `|I|on`, `|I|off`, `Ion/Ioff`, and `x@Ion/x@Ioff` (deterministic; no fitting).

---

## 1) Background / 背景

**EN**
- Device Analysis shows an “Ion/Ioff” metric per series for quick comparison.
- The current implementation computes **global extrema over the whole sweep**, not values at user-defined `Vg_on/Vg_off` (or similar).

**CN**
- Device Analysis 的表格里会显示每条曲线的 “Ion/Ioff”，用于快速对比。
- 当前实现是对整条扫描曲线做 **全局极值**，并不是在用户指定的 `Vg_on/Vg_off`（或类似条件）上取值。

---

## 2) Definitions / 定义

Let a series have sampled points `{(x_i, I_i)}`.

- `|I|on` (Ion): the maximum absolute current over valid points.
- `|I|off` (Ioff): the minimum **positive** absolute current over valid points (strictly `> 0`).
- `Ion/Ioff`: `Ion / Ioff` if both exist.
- `x@Ion`: the X coordinate where `Ion` occurs.
- `x@Ioff`: the X coordinate where `Ioff` occurs.

**Why absolute value? / 为什么用绝对值？**  
To support both n-type and p-type devices with signed currents (use `|I|`).

---

## 3) Algorithm / 计算步骤

Input:
- `points[]` built from extracted arrays (same length): `{ x, y }` where `y` is current `I`.

Steps (per series):
1. Initialize:
   - `ion = -Infinity`, `xAtIon = null`
   - `ioff = Infinity`, `xAtIoff = null`
2. For each point `p`:
   - Require `x` finite and `y` finite; otherwise skip.
   - Compute `absI = |y|`.
   - If `absI > ion`: set `ion = absI`, `xAtIon = x`.
   - If `absI > 0 && absI < ioff`: set `ioff = absI`, `xAtIoff = x`.
3. Finalize:
   - `Ion = ion` if finite else `null`
   - `Ioff = ioff` if finite else `null`
   - `Ion/Ioff = (Ion / Ioff)` when `Ion != null && Ioff != null && Ioff != 0`, else `null`

Tie behavior:
- If multiple points share the same max/min value, the first encountered point keeps `x@...` (strict `>` / `<` comparisons).

---

## 4) Units & Display / 单位与展示

**EN**
- The computation runs on the **raw extracted current values** (no unit conversion).
- UI provides `Y unit` (`A/µA/nA`) as a display scaling for plots; Ion/Ioff values in the table are derived from raw values.

**CN**
- 计算使用的是 **原始抽取的电流数值**（不做单位换算）。
- UI 的 `Y unit`（`A/µA/nA`）主要用于绘图显示缩放；表格的 Ion/Ioff 基于原始值计算。

---

## 5) Edge Cases / 边界情况

- All `I` are zero:
  - `Ion = 0`, but `Ioff = null` (because `Ioff` requires `|I| > 0`), so `Ion/Ioff = null`.
- Missing/invalid values:
  - Points with non-finite `x` or `I` are ignored; if no valid points remain, outputs are `null`.
- Noise floor:
  - A single tiny non-zero point can dominate `Ioff`, producing an extremely large `Ion/Ioff`.
- Bidirectional sweeps:
  - Forward/reverse segments are not separated; extrema are taken over the combined sequence.

---

## 6) Implementation Pointers / 代码定位

- Metric computation: [`src/components/DeviceAnalysis/AnalysisCharts.jsx`](../src/components/DeviceAnalysis/AnalysisCharts.jsx)
  - `Ion/Ioff` scan over points (see “Scalar metrics” block)
  - `ionIoff` ratio computed in `metrics`
- Table rendering: [`src/components/DeviceAnalysis/AnalysisCharts.jsx`](../src/components/DeviceAnalysis/AnalysisCharts.jsx) (Calculated Parameters table)

---

## 7) Optional Future Improvements / 可选改进方向

- Add user-defined `X_on` / `X_off` (e.g., `Vg_on`, `Vg_off`) and compute `Ion/Ioff` at those X values (with interpolation).
- Provide a “robust Ioff” option (e.g., quantile-based floor) to reduce sensitivity to outliers/noise.
- Allow per-curve direction selection for bidirectional sweeps (forward-only / reverse-only).
