# Button（基础按钮）规范 v1

本文定义 App 内“普通按钮”（非 Tabs 的选项按钮）的 **DOM 结构、状态模型、A11y 约束、样式类约定、参考模板**。

适用范围：页面上的动作按钮，例如 “新增/搜索/导出/确认/取消” 等。

相关链接：
- [`stable_selectors_spec.md`](./stable_selectors_spec.md)：`data-*` 稳定选择器约定（测试/脚本）
- [`src/components/ui/Button.jsx`](../src/components/ui/Button.jsx)：组件实现（推荐统一入口）
- [`src/styles/global.css`](../src/styles/global.css)：`action-btn*` 样式定义（`@layer components`；legacy alias: `click_btn*`）

---

## 1. 目标与约束

- 结构稳定：统一 DOM/属性/类名，避免页面里到处出现超长 Tailwind 串。
- 推荐优先使用 [`src/components/ui/Button.jsx`](../src/components/ui/Button.jsx)（已封装 `action-btn*` 的结构与默认行为）。
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
- 可选提供 `data-style="primary|ghost|disabled"`（弱化：默认不再自动输出；仅在确有脚本断言需求时手动补充）
- 推荐提供 `data-icon="with|without"`（是否包含 icon 的稳定标记）
- 推荐提供 `data-cta` / `data-cta-position` / `data-cta-copy`（埋点定位）

### 2.2 内容结构（稳定）

按钮内部使用一个内容容器，保证 icon/text 的一致结构：

- `span.action-btn__content`
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
  - `.action-btn`
  - `.action-btn--sm`
  - `.action-btn--md`
  - `.action-btn--lg`
  - `.action-btn--control`（紧凑 38px：适合 tool/control 场景）
  - `.action-btn--icon-md`（icon-only 方形按钮：38×38；需搭配 `.action-btn--md`）
  - `.action-btn--icon-md-tight`（搭配 `.action-btn--fx` 的更紧凑 36×36 icon-only）
  - `.action-btn--icon`（icon-only 方形按钮：42×42）
  - `.action-btn__content`
  - `.action-btn--fx`（提供 ring/hover 的 box-shadow 扩张动效）
  - `.action-btn--fx-muted`（非 toolbar 场景的通用浅色 ring 变量）
- 变体：
  - `.action-btn--primary`（主按钮：accent 背景）
  - `.action-btn--secondary`（次按钮：浅底 + 边框）
  - `.action-btn--ghost`（幽灵按钮：边框/透明背景）
  - `.action-btn--text`（文字按钮：无边框/透明背景）
  - `.action-btn--danger`（危险操作：默认弱提示，hover 变红）
  - `.action-btn--disabled`（禁用态）
  - `.action-btn--claude-shadow`（固定深色 Claude-like）

约束：

- 需要 ring/hover 扩张动效时，使用 `.action-btn--fx`（并按需叠加 `.action-btn--fx-muted`）。
- Disabled 必须同时满足：`disabled` 属性 + `.action-btn--disabled`。
 - 若需要 `group-hover:*` / `group-focus:*` 这类子元素效果，再在 JSX 中额外添加 `group` 类（Tailwind 不允许在 `@apply` 中使用 `group`）。

---

## 5. 参考模板

### 5.1 Ghost（例如新增入口链接）

```html
<button
  data-icon="with"
  data-cta="Literature research"
  data-cta-position="toolbar"
  data-cta-copy="add-url"
  type="button"
  class="action-btn action-btn--md action-btn--fx action-btn--ghost"
  aria-label="add url"
>
  <span class="action-btn__content">
    <!-- icon -->
    Add URL
  </span>
</button>
```

### 5.2 Primary / Disabled（例如开始抓取）

```html
<!-- enabled -->
<button
  data-icon="with"
  data-cta="Literature research"
  data-cta-position="toolbar"
  data-cta-copy="fetch"
  type="button"
  class="action-btn action-btn--md action-btn--fx action-btn--primary"
  aria-label="fetch"
>
  <span class="action-btn__content">
    Fetch
  </span>
</button>

<!-- disabled -->
<button
  data-icon="with"
  data-cta="Literature research"
  data-cta-position="toolbar"
  data-cta-copy="fetch"
  type="button"
  class="action-btn action-btn--md action-btn--fx action-btn--disabled"
  disabled
  aria-label="fetch"
>
  <span class="action-btn__content">
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
  data-icon="with"
  class="action-btn action-btn--icon action-btn--fx action-btn--fx-muted action-btn--danger"
>
  <span class="action-btn__content">
    <!-- icon -->
  </span>
</button>
```
