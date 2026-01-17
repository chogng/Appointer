# Button（基础按钮）规范 v1

本文定义 App 内“普通按钮”（非 ToggleButton/Tabs 的选项按钮）的 **DOM 结构、状态模型、A11y 约束、样式类约定、参考模板**。

适用范围：页面上的动作按钮，例如 “新增/搜索/导出/确认/取消” 等。

相关链接：
- [`stable_selectors_spec.md`](./stable_selectors_spec.md)：`data-*` 稳定选择器约定（测试/脚本）
- [`src/components/ui/Button.jsx`](../src/components/ui/Button.jsx)：组件实现（推荐统一入口）
- [`src/styles/global.css`](../src/styles/global.css)：`click_btn*` 样式定义（`@layer components`）

---

## 1. 目标与约束

- 结构稳定：统一 DOM/属性/类名，避免页面里到处出现超长 Tailwind 串。
- 推荐优先使用 [`src/components/ui/Button.jsx`](../src/components/ui/Button.jsx)（已封装 `click_btn*` 的结构与默认行为）。
- A11y 合理：按钮必须可聚焦、可读、禁用态正确。
- 受控禁用：由业务状态决定 `disabled` 与样式。

---

## 2. DOM 规范

### 2.1 基础结构

每个按钮必须使用：

- `<button type="button">`
- 推荐提供 `aria-label`（当按钮文案不够清晰时）；若按钮为 **icon-only（仅 icon、无可见文本）则必须提供** `aria-label`
  - `aria-label` 的取值应是“人类可读的短语”，允许包含空格；不要用 `-` 之类把它当作机器标识符。
- icon-only 按钮可选提供 `title` 作为 tooltip，但 **不能替代** `aria-label`
- 若不可点击：使用原生 `disabled`
- 推荐提供 `data-style="primary|ghost|disabled"`（稳定风格标记，便于测试/脚本）
- 推荐提供 `data-icon="with|without"`（是否包含 icon 的稳定标记）
- 推荐提供 `data-cta` / `data-cta-position` / `data-cta-copy`（埋点定位）

### 2.2 内容结构（稳定）

按钮内部使用一个内容容器，保证 icon/text 的一致结构：

- `span.click_btn_content`
  - icon（可选）
  - text（可选）

---

## 3. 状态模型

- 默认态：可点击
- Disabled：`disabled` 属性为 true，并使用 disabled 样式
- Hover/Active：仅视觉效果，不改变业务状态

---

## 4. 样式类约定（全局）

按钮样式类定义在 [`src/styles/global.css`](../src/styles/global.css) 的 `@layer components`：

- 基础：
  - `.click_btn`
  - `.click_btn--sm`
  - `.click_btn--md`
  - `.click_btn--lg`
  - `.click_btn--control`（紧凑 38px：适合 tool/control 场景）
  - `.click_btn--icon-md`（icon-only 方形按钮：38×38；需搭配 `.click_btn--md`）
  - `.click_btn--icon-md-tight`（搭配 `.click_btn--fx` 的更紧凑 36×36 icon-only）
  - `.click_btn--icon`（icon-only 方形按钮：42×42）
  - `.click_btn_content`
  - `.click_btn--fx`（提供 ring/hover 的 box-shadow 扩张动效）
  - `.click_btn--fx-muted`（非 toolbar 场景的通用浅色 ring 变量）
- 变体：
  - `.click_btn--primary`（主按钮：accent 背景）
  - `.click_btn--secondary`（次按钮：浅底 + 边框）
  - `.click_btn--ghost`（幽灵按钮：边框/透明背景）
  - `.click_btn--text`（文字按钮：无边框/透明背景）
  - `.click_btn--danger`（危险操作：默认弱提示，hover 变红）
  - `.click_btn--disabled`（禁用态）
  - `.click_btn--claude-shadow`（固定深色 Claude-like）

约束：

 - 需要 ring/hover 扩张动效时，使用 `.click_btn--fx`（并按需叠加 `.click_btn--fx-muted`）。
 - Disabled 必须同时满足：`disabled` 属性 + `.click_btn--disabled`。
 - 若需要 `group-hover:*` / `group-focus:*` 这类子元素效果，再在 JSX 中额外添加 `group` 类（Tailwind 不允许在 `@apply` 中使用 `group`）。

---

## 5. 参考模板

### 5.1 Ghost（例如新增入口链接）

```html
<button
  data-style="ghost"
  data-icon="with"
  data-cta="Literature research"
  data-cta-position="toolbar"
  data-cta-copy="add-url"
  type="button"
  class="click_btn click_btn--md click_btn--fx click_btn--ghost"
  aria-label="add url"
>
  <span class="click_btn_content">
    <!-- icon -->
    Add URL
  </span>
</button>
```

### 5.2 Primary / Disabled（例如开始抓取）

```html
<!-- enabled -->
<button
  data-style="primary"
  data-icon="with"
  data-cta="Literature research"
  data-cta-position="toolbar"
  data-cta-copy="fetch"
  type="button"
  class="click_btn click_btn--md click_btn--fx click_btn--primary"
  aria-label="fetch"
>
  <span class="click_btn_content">
    Fetch
  </span>
</button>

<!-- disabled -->
<button
  data-style="disabled"
  data-icon="with"
  data-cta="Literature research"
  data-cta-position="toolbar"
  data-cta-copy="fetch"
  type="button"
  class="click_btn click_btn--md click_btn--fx click_btn--disabled"
  disabled
  aria-label="fetch"
>
  <span class="click_btn_content">
    Fetching...
  </span>
</button>
```

### 5.3 Icon-only（例如删除/移除）

```html
<button
  type="button"
  aria-label="remove url"
  title="Remove URL"
  data-style="ghost"
  data-icon="with"
  class="click_btn click_btn--icon click_btn--fx click_btn--fx-muted click_btn--danger"
>
  <span class="click_btn_content">
    <!-- icon -->
  </span>
</button>
```
