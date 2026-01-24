# DeviceAnalysis 页面稳定锚点规范（Page Spec）

目标：确保 [`src/pages/DeviceAnalysis.jsx`](../src/pages/DeviceAnalysis.jsx)（路由：`/device-analysis`）的关键交互区域具备**短、稳定、可维护**的定位锚点，避免任何 `#root > ...` 或 Tailwind 组合类名选择器。

> 本文是“页面级规范”，用于约束本页 DOM 的稳定锚点与结构意图；通用规则请参考：[`stable_selectors_spec.md`](./stable_selectors_spec.md)。

## 1. 总体原则

- 主定位锚点：`id/htmlFor` + `aria-label`（自动化/脚本）。
- `data-ui`：遗留兼容，逐步移除；新锚点不要再新增。
- `ui-*` / Tailwind class 只用于样式，不作为定位主入口。
- 列表项（CSV files / templates / results）允许使用稳定 `id`（少量固定入口）与动态 `data-*`（`data-file-id` / `data-template-id` 等）组合定位，避免依赖 DOM 深度。

## 2. 页面级入口（Header / Primary Actions）

**必须锚点**：
- 页面根：`#device-analysis-page`
- 导入 CSV：`#device-analysis-import-csv-btn`
- 清空/重置 session：`#device-analysis-clear-session-btn`

## 3. CSV 导入区（CsvImporter）

对应组件：[`src/features/device-analysis/components/CsvImporter.jsx`](../src/features/device-analysis/components/CsvImporter.jsx)

**必须锚点**：
- Dropzone 容器：`#device-analysis-csv-dropzone`（兼容：`[aria-label="csv-container"]`）
- 文件选择 input：`#device-analysis-csv-file-input`（用于自动化上传）
- CSV 列表项（稳定建议）：`[data-ui="csv-file-item"][data-item-key="name::size"]`
- 删除 CSV（稳定建议）：`[data-ui="csv-file-remove-btn"][data-item-key="name::size"]`

**行为约束**
- 选中文件由 `selectedFileId` 决定；列表项可额外输出 `data-selected="true"`（便于脚本断言）。

## 4. 模板配置（TemplateManager）

对应组件：
- 入口（re-export）：[`src/features/device-analysis/components/TemplateManager.jsx`](../src/features/device-analysis/components/TemplateManager.jsx)
- 实现：[`src/features/device-analysis/components/template-manager/TemplateManager.jsx`](../src/features/device-analysis/components/template-manager/TemplateManager.jsx)

### 4.1 模板模式 / 模板选择

**必须锚点**：
- 模板模块根：`#device-analysis-template-manager`
- Template mode Tabs（稳定 id 体系）：
  - Tab：`#device-analysis-template-mode-tab-select` / `#device-analysis-template-mode-tab-save`
  - Panel：`#device-analysis-template-mode-panel-select` / `#device-analysis-template-mode-panel-save`
- 模板名输入：`#device-analysis-template-name`
- 打开模板下拉：`#device-analysis-template-dropdown-btn`
- 新建模板入口：`#device-analysis-template-new-btn`
- 模板行：`[data-template-id="..."]`
- 删除模板：`button[aria-label="Delete template"][data-template-id="..."]`
- 保存模板：`#device-analysis-template-save-btn`

### 4.2 提取字段（X / Y）

**必须锚点**（X）：
- X Start Cell：`#device-analysis-x-start`
- X End Cell：`#device-analysis-x-end`
- Points（可选）：`#device-analysis-x-points`

**必须锚点**（Y）：
- 已选列展示（只读）：`#device-analysis-y-columns`
- 预览表格列头勾选（按列 index）：`th[data-col="0"][data-col-label="A"]`

### 4.3 应用 / 错误策略

**必须锚点**：
- Apply to All Files：`#device-analysis-apply-template-btn`
- Stop on first invalid file：`#device-analysis-stop-on-error-toggle`（建议 `role="checkbox"` + `aria-checked`）

## 5. 预览表格（TemplateManager Preview）

**必须锚点**：
- 预览面板：`#device-analysis-preview-panel`
- Copy selection：`#device-analysis-preview-copy-selection-btn`
- 预览滚动容器：`#device-analysis-preview-table-scroll`
- 预览表格：`#device-analysis-preview-table`
- 单元格：`td[data-row="0"][data-col="0"]`（行/列 0-based）

**行为约束**
- 单元格选择（拖拽/多选）不应依赖 DOM 深度；只允许用 `data-row` / `data-col` 定位。

## 6. 提取错误面板（Extraction errors）

**必须锚点**：
- 错误面板：`#device-analysis-extraction-errors`
- Clear：`#device-analysis-extraction-errors-clear-btn`

## 7. 分析区（Analysis & Visualization）

### 7.1 视图切换（Charts / Data Table）

**必须锚点**：
- 视图切换容器：`#device-analysis-view-toggle`
- Data Table：`#device-analysis-view-table-btn`
- Charts：`#device-analysis-view-chart-btn`

### 7.2 Data Table（DataPreviewTable）

对应组件：[`src/features/device-analysis/components/DataPreviewTable.jsx`](../src/features/device-analysis/components/DataPreviewTable.jsx)

**必须锚点**：
- 表格模块根：`#device-analysis-data-preview`
- 文件 tabs：`#device-analysis-data-preview-file-tabs`
- 文件 tab：`button[data-file-id="..."]`
- Series 下拉：`#device-analysis-data-preview-series-select`
- 表格滚动容器：`#device-analysis-data-preview-scroll`

### 7.3 Charts（AnalysisCharts）

对应组件：[`src/features/device-analysis/components/AnalysisCharts.jsx`](../src/features/device-analysis/components/AnalysisCharts.jsx)

**必须锚点**：
- Chart section：`section[aria-label="Device Analysis chart"]`
- Plot type 切换：
  - 容器：`#device-analysis-plot-type-toggle`
  - 按钮：`#device-analysis-plot-iv-btn` / `#device-analysis-plot-gm-btn` / `#device-analysis-plot-ss-btn` / `#device-analysis-plot-j-btn`
- File dropdown：`#device-analysis-file-select`（Legacy：`[data-ui="device-analysis-file-select"]`）
- Curve dropdown：`#device-analysis-curve-select`（Legacy：`[data-ui="device-analysis-curve-select"]`）
- gm mode dropdown：`#device-analysis-gm-mode-select`（Legacy：`[data-ui="device-analysis-gm-mode-select"]`）
- SS method dropdown：`#device-analysis-ss-method-select`（Legacy：`[data-ui="device-analysis-ss-method-select"]`）
- SS |Id| window：`#device-analysis-ss-id-low` / `#device-analysis-ss-id-high`
- Axis settings toggle：`#device-analysis-axis-toggle-btn`
- Area input：`#device-analysis-area-input`
- Clear Area：`#device-analysis-area-clear-btn`
- Download Origin ZIP：`#device-analysis-origin-download-zip-btn`（Legacy：`[data-ui="device-analysis-origin-download-zip-btn"]`）

## 8. 禁止清单

- 禁止使用 `#root > div > ...` 这类依赖 DOM 深度的选择器。
- 禁止把 `section.bg-bg-surface.border...` 等 Tailwind/样式 class 当作定位锚点。
- 如必须取“外层容器”，先用稳定 `id/aria-label` 找到内部锚点，再用 `closest()` 回溯。
