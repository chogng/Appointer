# LiteratureResearch 页面稳定锚点规范（Page Spec）

目标：确保 [`src/pages/LiteratureResearch.jsx`](../src/pages/LiteratureResearch.jsx) 的关键交互区域具备**短、稳定、可维护**的定位锚点，避免任何 `#root > ...` 或 Tailwind 组合类名选择器。

> 本文是“页面级规范”，用于约束本页 DOM 的稳定锚点与结构意图；通用规则请参考：[`stable_selectors_spec.md`](./stable_selectors_spec.md)。

## 1. 总体原则

- `data-ui` 用于稳定定位（自动化/脚本/必要的样式 scope）。
- `ui-*` / Tailwind class 只用于样式，不作为定位主入口。
- 列表项（results/seed urls）使用“固定 `data-ui` + 动态 `data-*` 属性（index/item-id）”的组合策略，避免把动态 id 直接拼进 `data-ui`。

## 2. 顶部过滤卡片（Toolbar + Filters）

页面顶部存在一张背景卡片（`section.bg-bg-surface...`），承载来源切换、日期范围、max results、add/fetch。

**必须锚点**（已落地）：
- 来源切换容器：`[data-ui="literature-source-toggle"]`
- 开始日期：
  - 容器：`[data-ui="literature-start-date"]`
  - label：`[data-ui="literature-start-date-label"]`
  - 按钮：`[data-ui="literature-start-date-btn"]`
- 结束日期：
  - 容器：`[data-ui="literature-end-date"]`
  - label：`[data-ui="literature-end-date-label"]`
  - 按钮：`[data-ui="literature-end-date-btn"]`
- 最大返回条数：
  - label：`[data-ui="literature-max-results-label"]` 或 `label[for="literature-max-results"]`
  - Input wrapper：`[data-ui="literature-max-results"]`
  - input：`[data-ui="literature-max-results-input"]`
- Toolbar buttons：
  - 添加链接：`[data-ui="literature-add-url-btn"]`
  - 开始抓取：`[data-ui="literature-fetch-btn"]`

## 3. Seed URLs 区域

**组合锚点**（已落地）：
- 标题旁抓取计数：`[data-ui="literature-seed-url-fetch-count"]`（展示 `Nature A / Science B`，仅统计“勾选且非空”的链接）
- 列表容器：`[data-ui="literature-seed-url-list"]`
- 行容器：`[data-ui="literature-seed-url-row"][data-seed-index="0"]`
- 勾选框：`[data-ui="literature-seed-url-select"][data-seed-index="0"]`
- 输入框：`[data-ui="literature-seed-url-input"][data-seed-index="0"]`
- 删除按钮：`[data-ui="literature-seed-url-remove-btn"][data-seed-index="0"]`

**行为规则（抓取范围）**
- Nature/Science 面板仅用于“显示/编辑”各自的 Seed URLs，不参与决定抓取范围。
- 点击“开始抓取”时，会合并 `Nature + Science` 两边 **勾选且非空** 的入口链接后发起抓取。

## 4. Keyword Matching / Export / Clear

**必须锚点**（已落地）：
- Keyword panel：`[data-ui="literature-keyword-panel"]`
- 导出 docx：`[data-ui="literature-export-docx-btn"]`
- 导出 json：`[data-ui="literature-export-json-btn"]`
- 清空 session：`[data-ui="literature-clear-session-btn"]`
- 匹配模式 ToggleButton wrapper：`[data-ui="literature-keyword-mode-toggle"]`
- 关键词输入容器：`[data-ui="literature-keywords-warp"]`
- 关键词输入：`[data-ui="literature-keywords-input"]`

## 5. Results 区域（视图切换 / 批量 / 卡片动作）

**必须锚点**（已落地）：
- 结果容器：`[data-ui="literature-results-container"]`
- 视图切换 ToggleButton wrapper：`[data-ui="literature-results-view-toggle"]`
- 批量全选/取消：`[data-ui="literature-selection-toggle-btn"]`（当前动作：`[data-action="select-all|deselect-all"]`）

**结果卡片组合锚点**（已落地）：
- 卡片：`[data-ui="literature-result-card"][data-item-id="..."]`
- 标题链接：`[data-ui="literature-result-title-link"][data-item-id="..."]`
- 翻译按钮：`[data-ui="literature-result-translate-btn"][data-item-id="..."]`
- 下载按钮：`[data-ui="literature-result-download-btn"][data-item-id="..."]`

## 6. 禁止清单

- 禁止使用 `#root > div > ...` 这类依赖 DOM 深度的选择器。
- 禁止把 `section.bg-bg-surface.border...` 等 Tailwind/样式 class 当作定位锚点。
- 如必须取“外层容器”，先用稳定 `data-ui` 找到内部锚点，再用 `closest()` 回溯。

---

## 7. Settings 同步规则（Nature/Science）

> 目标：切换 Nature/Science 不再触发无意义的配置同步，但仍能在抓取前/离开页面前确保配置已落库。

### 7.1 同步范围（仅 2 个）

- 入口链接（Seed URLs）：仅当 input 有“增/删/改”才视为 dirty。
- 最大返回条数（Max Results）：仅当值变化才视为 dirty。

### 7.2 Seed URLs 存储模型（避免相互覆盖）

- Seed URLs 按来源分开存：`seedUrlsBySourceType.nature` / `seedUrlsBySourceType.science`。
- 同步请求支持 `seedSource`：仅更新指定 source 的入口链接列表，不影响另一个面板。
- Seed URLs 会 `trim()`，空行会被忽略后再保存。

### 7.3 何时触发同步（3 个场景）

- 点击“开始抓取”前：会先同步 dirty 的 Seed URLs / Max Results；同步失败则阻止抓取，并 toast 提示失败原因。
- 设置输入框全部失焦后：如有 dirty，1500ms debounce 自动同步；成功/失败都会 toast。
- 路由切换/离开页面（unmount）：best-effort 同步所有 dirty（不 toast）。

### 7.4 什么不触发同步

- 仅切换 Nature/Science（且未对入口链接进行增删改）不触发同步。
- 点击其他非设置类组件（日期按钮/关键词/结果区等）不触发同步。

---

## 8. Input UX 约定（LiteratureResearch）

### 8.1 关闭拼写检查/自动修正

- 入口链接 input 与最大返回 input 默认关闭：`spellCheck` / `autoCorrect` / `autoCapitalize`（避免 URL 被当作自然语言纠错）。

### 8.2 Focus outline 仅对 Tab（键盘导航）显示

- 点击（mouse/pointer）不显示 focus outline；Tab 导航才显示（与 `.date_btn` 行为一致）。
- 机制：[`src/main.jsx`](../src/main.jsx) 维护 `html[data-nav="keyboard|pointer"]`；[`src/styles/global.css`](../src/styles/global.css) 在 `data-nav="keyboard"` 时为 Input/Seed URL 输入框补回 focus outline。

### 8.3 Hover 边框规则

- 入口链接/最大返回 input hover 不改变 border；focus outline 仍仅在 Tab 导航时出现。
