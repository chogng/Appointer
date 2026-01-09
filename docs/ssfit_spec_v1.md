# SS Fit Spec v1 (Bilingual / 双语)

Version: `ssfit_v1`  
Date: `2026-01-07`  
Scope: Device Analysis **detail plot** SS computation + UI/UX (no ML; deterministic).

---

## 1) Background / 背景

**EN**
- Current SS implementation is pointwise: `SS(x)=1000/|d(log10|I|)/dx|` (central difference) and then taking `SS_min`.
- This is highly sensitive to noise/outliers and tends to **underestimate** SS (looks “too good”).

**CN**
- 当前 SS 为逐点差分：`SS(x)=1000/|d(log10|I|)/dx|`（中心差分），并在表格取 `SS_min`。
- 对噪声/离群点极敏感，容易系统性 **低估** SS（看起来“过好”）。

---

## 2) Goals / 非目标

**EN Goals**
- Compute SS by fitting a near-linear region on `log10(|Id|) vs Vg` and expose traceability (`R²/span/N/range/reason`).
- Default policy: **fail rather than mislead** for Auto (no SS number if strict criteria not met).
- Provide controlled methods: `Auto` / `Manual range` / `IdWindow` / `Legacy (compare only)`.

**CN 目标**
- 在 `log10(|Id|)-Vg` 上选取近似直线区间做线性拟合得到 SS，并输出可追溯指标（`R²/span/N/区间/原因`）。
- 默认策略：Auto **宁可失败也不误导**（不满足严格门槛则不输出 SS 数值）。
- 提供可控口径：`Auto` / `手动区间` / `电流窗口` / `旧版对照`。

**Non‑Goals / 非目标**
- No ML / no “typical data” tuning.
- Do not force SS for non-transfer curves; allow explicit Fail with reasons.

---

## 3) Definitions / 口径定义

**EN**
- Let `y = log10(|Id|)` and `x = Vg` (or the current X axis).
- Fit `y = a·x + b` on `[x1, x2]`, then `SS = 1000 / |a|` (mV/dec).
- Use `|Id|` for both n/p type; only `|a|` matters.

**CN**
- 设 `y = log10(|Id|)`、`x = Vg`（或当前横轴）。
- 在 `[x1,x2]` 拟合 `y = a·x + b`，`SS = 1000 / |a|`（mV/dec）。
- n/pMOS 统一用 `|Id|`，只取 `|a|`。

---

## 4) Applicability Gate / 适用性门槛

**EN**
- SS is defined for **transfer-like** curves (x ≈ Vg). For output curves (x ≈ Vd), disable SS or show “Not applicable”.

**CN**
- SS 仅对 **转移曲线**（x≈Vg）启用；对输出曲线（x≈Vd）默认禁用或提示“不适用”。

---

## 5) SS Tab UX / SS 页签形态（默认推荐）

**EN**
- Main view: **I‑V (log|I|)** with a highlighted fit band `[x1, x2]`.
- For the **focused** curve only: draw a **dashed fit line** (semi-transparent) within `[x1, x2]`.
- Optional (collapsible) diagnostics: `SS(x)` (existing pointwise series) with vertical lines at `x1/x2` and optional horizontal `SS_fit`.
- Always show metrics row: `SS / R² / Span(dec) / N / Range[x1,x2] / Confidence`.

**CN**
- 主图：**I‑V（log|I|）**，叠加拟合高亮带 `[x1,x2]`。
- 仅对 **当前聚焦曲线**：画拟合虚线（dashed、半透明、只在区间内）。
- 可折叠诊断：`SS(x)`（保留旧逐点 SS 曲线），用竖线标 `x1/x2`，可选水平线标 `SS_fit`。
- 固定显示指标栏：`SS / R² / Span(dec) / N / 区间[x1,x2] / 置信度`。

---

## 6) Controls / 控件

**EN**
- `SS Method`: `Auto (Recommended)` / `Manual (Drag Range)` / `IdWindow (|Id| Low~High)` / `Legacy (Min derivative, compare only)`
- Buttons: `Reset to Auto`
- Toggles: `Show diagnostics SS(x)` (default on), `Show fit line` (default on)
- Optional: `Apply to all curves`

**CN**
- `SS 方法`：`自动（推荐）` / `手动（拖拽区间）` / `电流窗口（|Id|上下限）` / `旧版（min derivative，仅对照）`
- 按钮：`重置为自动`
- 开关：`显示诊断 SS(x)`（默认开）、`显示拟合线`（默认开）
- 可选：`应用到所有曲线`

---

## 7) Output Model / 输出数据结构（契约）

**EN/CN (shared)**
```ts
type SsConfidence = "high" | "low" | "fail";
type SsMethod = "auto" | "manual" | "idWindow" | "legacy";

type SsFitResult = {
  ok: boolean;                 // computed a numeric SS (true for high/low)
  ss?: number;                 // mV/dec (abs slope)
  x1?: number; x2?: number;    // fit range
  r2?: number;
  decadeSpan?: number;         // max(log|I|)-min(log|I|)
  n?: number;
  reason?: string;             // reason code (required for low/fail)
  detail?: Record<string, any>; // optional diagnostics / bestAttempt
};
```

---

## 8) Policy: High / Low / Fail / 三态策略（已定案）

**EN**
- `Auto`: **High or Fail only**. If strict criteria not met → Fail (do not output SS number).
- `Manual` / `IdWindow`: Fail only on hard errors; otherwise output SS but may be Low with warnings.
- `Legacy`: compare only; treated as Low (unless hard error).

**CN**
- `自动`：只允许 **High 或 Fail**。不满足严格门槛 → Fail（不输出 SS 数值）。
- `手动/电流窗口`：仅硬错误 Fail；否则输出 SS，但可能 Low 并提示风险。
- `旧版`：仅对照，默认 Low（除非硬错误）。

---

## 9) Threshold Configuration / 门槛配置（集中管理）

> Recommendation: keep thresholds as code constants (versioned), persist only user preferences.

```js
export const SS_CONF = {
  auto: {
    floorQuantile: 0.10,
    floorMarginDecTry: [1.0, 0.7],
    r2Try: [0.995, 0.99, 0.98],
    minDecadeSpanTry: [1.0, 0.7],
    minPointsTry: [12, 8],
    windowPoints: 12,
    slopeStabilityMaxTry: [0.10, 0.15],
    classify: { high: { r2: 0.995, span: 1.0, n: 12, stab: 0.10 } },
  },
  manual: {
    classify: {
      high: { r2: 0.995, span: 1.0, n: 12, stab: 0.10 },
      low:  { r2: 0.98,  span: 0.5, n: 8 },
      fail: { minN: 8, minSpan: 0.3, minR2: 0.95 },
    },
  },
  idw: {
    minWindowRatioWarn: 10,
    classify: {
      high: { r2: 0.995, span: 1.0, n: 12, stab: 0.10, minWindowRatio: 10 },
      low:  { r2: 0.98,  span: 0.5, n: 8 },
      fail: { minN: 8, minSpan: 0.3, minR2: 0.95 },
    },
  },
  legacy: { confidence: "low" },
};
```

---

## 10) Auto Strict Search / Auto 严格搜索

### 10.1 Core Metrics / 核心指标

**EN**
- `y = log10(|Id|)`
- `y_floor = median(bottom 10% of y)` (at least 10 points)
- Candidate points: `y >= y_floor + floorMarginDec`
- Window fit metrics: `R²`, `span(decades)`, `N`, `stab = MAD(|dy/dx|) / median(|dy/dx|)` (ignore nulls)

**CN**
- `y = log10(|Id|)`
- `y_floor = median(y 底部 10%)`（至少 10 点）
- 候选点：`y >= y_floor + floorMarginDec`
- 窗口指标：`R²`、`span(decades)`、`N`、`stab = MAD(|dy/dx|)/median(|dy/dx|)`（忽略空值）

### 10.2 Profile Expansion Order / 放宽顺序（确定性）

**EN/CN**
- Deterministic outer→inner loops; stop at first profile with any valid window:
  1) `floorMarginDec` → 2) `minSpan` → 3) `minPoints` → 4) `r2Min` → 5) `stabMax`
- Suggested sequences match `SS_CONF.auto.*Try`.

### 10.3 Window Length Strategy / 窗口长度策略
- Try `k1 = min(windowPoints, segLen)` then `k2 = minPoints` (if different).

### 10.4 Score + Tie‑Break / 评分与判同（保证稳定）
```txt
score = R² + 0.25*min(span, 3) - 0.50*stab
tie-break: score → span → rmse → N → smaller x1
```

### 10.5 Greedy Expand / 区间扩展
- Expand within the same segment; try left then right, accepting only if profile constraints still hold.

---

## 11) Auto Fail + Suggested Range / Auto 失败 + 建议区间（Low）

**EN**
- If Auto strict fails, run a looser **Suggestion** search (across all relaxed profiles) under a hard floor:
  - `R²>=0.98`, `span>=0.7`, `N>=8`, `stab<=0.15`, `floorMarginDec>=0.7`
- Return “Suggested range” (marked Low/Suggested) as the initial range when switching to Manual.
- Auto still remains Fail (no SS number in Auto mode).

**CN**
- Auto 严格失败后，跑更宽松的 **建议区间搜索**（全量候选里择优），但设底线：
  - `R²>=0.98`、`span>=0.7`、`N>=8`、`stab<=0.15`、`floorMarginDec>=0.7`
- 输出“建议区间（Low/Suggested）”仅用于切换到 Manual 的初始化。
- Auto 模式仍 Fail（不输出 SS 数值）。

---

## 12) Manual Interaction Spec / 手动交互规范

**EN**
- Drag left/right handles; drag band to translate; `Shift+drag` to rubber-band select; `Esc` cancels.
- Default snap to nearest data-x of the focused curve (avoid empty ranges). Optional `Alt` to disable snap.
- Refit with 50–100ms debounce while dragging.

**CN**
- 拖拽左右手柄；拖拽 band 平移；`Shift+拖拽` 框选；`Esc` 取消。
- 默认吸附到当前曲线最近 x 点；可选 `Alt` 关闭吸附。
- 拖拽中 50–100ms debounce 重算拟合。

---

## 13) IdWindow Spec / 电流窗口规范（|Id| Low~High）

**EN**
- Inputs must be finite and `>0`; swap if low>high.
- If `iHigh/iLow < 10` (less than 1 decade): compute but force Low + warning (`idw.window_too_narrow`).
- If data does not cover window (`dataMax<iLow` or `dataMin>iHigh`): Fail (`idw.out_of_data_range`).
- Unit display may follow Y unit, but store/export in `A`.

**CN**
- 输入需 `>0` 且有限；low>high 自动交换。
- 若 `iHigh/iLow < 10`（不足 1 decade）：仍计算但强制 Low + warning（`idw.window_too_narrow`）。
- 若数据不覆盖窗口（`dataMax<iLow` 或 `dataMin>iHigh`）：Fail（`idw.out_of_data_range`）。
- 显示单位可跟随 yUnit，但内部存/导出统一用 `A`。

---

## 14) Reason Codes + UX Copy / 原因码与中文提示

> Fail must show “why + next action” (switch to Manual / adjust IdWindow / check curve type).

### 14.1 Reason Code List / 原因码清单
```txt
common.not_enough_points
common.invalid_points
common.degenerate_x
common.sweep_split_no_valid

auto.no_points_above_floor
auto.no_window_meets_threshold
auto.no_window_meets_strict

manual.too_few_points
manual.span_too_small
manual.fit_quality_low

idw.invalid_input
idw.out_of_data_range
idw.too_few_points
idw.window_too_narrow
```

### 14.2 Suggested CN Messages / 中文提示建议
- `auto.no_points_above_floor`: `有效数据离噪声底太近或动态范围不足，无法可靠拟合（建议手动选区或使用电流窗口）`
- `auto.no_window_meets_threshold`: `未找到满足线性度门槛的近似直线区间（建议切换到手动选区）`
- `auto.no_window_meets_strict`: `严格口径失败（已提供建议区间，可切换到手动微调）`
- `idw.out_of_data_range`: `数据未覆盖该电流窗口（请调整窗口或检查测量范围）`
- `idw.window_too_narrow`: `电流窗口不足 1 decade，SS 可能不稳定（建议扩大窗口）`

---

## 15) Classification Rules / 分类决策（High / Low / Fail）

**Auto**
- High iff: `R²>=0.995 && span>=1.0 && N>=12 && stab<=0.10`
- Else: Fail (Auto has no Low)

**Manual**
- Fail if: `N<8` or `span<0.3` (optionally `R²<0.95`)
- High if: `R²>=0.995 && span>=1.0 && N>=12 && stab<=0.10`
- Else: Low (with `manual.fit_quality_low`)

**IdWindow**
- Fail if: invalid input, out of data range, `N<8` or `span<0.3` (optionally `R²<0.95`)
- Force Low if: `iHigh/iLow < 10` (`idw.window_too_narrow`)
- High if: meets `R²/span/N/stab` high thresholds and window ratio >=10
- Else: Low

**Legacy**
- Low by default; Fail only on hard errors.

---

## 16) Table + Export / 表格与导出

**EN**
- Table SS cell shows current-method SS (only when High/Low). Tooltip must include `method/confidence/r2/span/n/x1/x2/reason`.
- Export: add `device_analysis_metrics.csv` including:
  - `ss, ss_ok, ss_confidence, ss_reason, ss_method, ss_x1, ss_x2, ss_r2, ss_span_dec, ss_n`
  - optional: `ss_iLow, ss_iHigh` for IdWindow
  - include `ss_conf_version=ssfit_v1` in metadata (header comment or separate JSON)

**CN**
- 表格 SS 显示当前 method 的 SS（High/Low 才显示数值），tooltip 必须包含 `method/confidence/r2/span/n/x1/x2/reason`。
- 导出：新增 `device_analysis_metrics.csv`，包含 `ss_*` 全字段；可写入 `ss_conf_version=ssfit_v1` 便于口径追溯。

---

## 17) Persistence / 持久化建议

**EN**
- Persist only user preferences:
  - `ssMethodDefault`, `ssDiagnosticsEnabled`, `ssIdWindow{iLow,iHigh}`
- Do not persist per-curve manual ranges across sessions (session-only).

**CN**
- 仅持久化用户偏好：
  - `ssMethodDefault`、`ssDiagnosticsEnabled`、`ssIdWindow{iLow,iHigh}`
- 每条曲线手动 `[x1,x2]` 不跨会话保存（只会话内）。

---

## 18) Performance / 性能建议

**EN/CN**
- Compute SS lazily on SS tab: focused curve first + visible table rows; batch the rest during idle time.
- Debounce manual refit during dragging.

---

## 19) Acceptance Checklist / 验收清单

**EN**
- Normal transfer curve: Auto High; range matches intuition; fit line overlays correctly.
- Noisy/outlier curve: Auto may Fail; never outputs “too-good” SS; Suggested range enables manual adjustment.
- Insufficient dynamic range: Fail with clear reason and next action.
- Bidirectional sweep: stable forward/reverse handling (no mixed-shape artifacts).
- Export contains full `ss_*` trace fields; Fail rows have empty `ss`.

**CN**
- 正常转移曲线：Auto High；选区符合直觉；拟合线叠加正确。
- 噪声/离群：Auto 可 Fail；不会输出“假好 SS”；建议区间可作为手动起点。
- 动态范围不足：明确 Fail + 原因 + 下一步建议。
- 双向扫：forward/reverse 处理稳定，不混形。
- 导出包含完整 `ss_*`；Fail 的 `ss` 为空。

