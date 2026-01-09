# Button（基础按钮）规范 v1

本文定义 App 内“普通按钮”（非 ToggleButton/Tabs 的选项按钮）的 **DOM 结构、状态模型、A11y 约束、样式类约定、参考模板**。

适用范围：页面上的动作按钮，例如 “新增/搜索/导出/确认/取消” 等。

---

## 1. 目标与约束

- 结构稳定：统一 DOM/属性/类名，避免页面里到处出现超长 Tailwind 串。
- A11y 合理：按钮必须可聚焦、可读、禁用态正确。
- 受控禁用：由业务状态决定 `disabled` 与样式。

---

## 2. DOM 规范

### 2.1 基础结构

每个按钮必须使用：

- `<button type="button">`
- 推荐提供 `aria-label`（当按钮文案不够清晰时）
  - `aria-label` 的取值应是“人类可读的短语”，允许包含空格；不要用 `-` 之类把它当作机器标识符。
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

按钮样式类定义在 `src/styles/global.css` 的 `@layer components`：

- 基础：
  - `.click_btn`
  - `.click_btn--md`
  - `.click_btn_content`
  - `.click_btn--fx`（提供 before 背景与缩放动效的基础）
- 变体：
  - `.click_btn--primary`（主按钮：accent 背景）
  - `.click_btn--ghost`（幽灵按钮：边框/透明背景）
  - `.click_btn--disabled`（禁用态）

约束：

 - 变体必须与 `.click_btn--fx` 同时使用（否则 `before:*` 相关样式不生效）。
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
