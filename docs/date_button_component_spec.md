# DateButton（DatePicker 点击区域）规范 v1

本文定义 [`src/components/ui/DatePicker.jsx`](../src/components/ui/DatePicker.jsx) 内部的“日期按钮”（点击打开日历的那一块）的 **DOM 结构、状态模型、A11y 语义、样式类约定、扩展点**。

> 说明：这里的 DateButton 不是一个单独组件文件，而是 DatePicker 内部的可点击区域（视觉上是一个按钮/输入样式块）。

相关规范：
- [`stable_selectors_spec.md`](./stable_selectors_spec.md)：稳定选择器与 UI 标记（如需为按钮/弹层增加稳定锚点）

---

## 1. 适用范围

- 适用：任何 `DatePicker` 的日期选择入口（点击打开/关闭日历弹层）。
- 不适用：普通 action button（用 `click_btn*`）、筛选项按钮（用 `Tabs`）。

---

## 2. 目标与约束

- DOM 稳定：避免页面里出现超长 Tailwind 串；统一用组件级 class 控制样式。
- 状态明确：打开/关闭两态有稳定 class（open/closed），便于样式与自动化定位。
- A11y 合理：可聚焦、可触达、能被读屏器识别为可交互元素。

---

## 3. DOM 结构（规范）

DatePicker 外层容器：

- `div.relative`（由 `className` 透传控制额外布局）
  - 可选稳定锚点：当传入 `dataUi="xxx"` 时，外层输出 `data-ui="xxx"`

DateButton（可点击区域）：

- 元素类型：`div`（组件内部实现）
- 必须属性：
  - `role="button"`
  - `tabIndex={0}`
  - `data-style="date"`
  - `data-icon="with"`（DateButton 固定包含日历 icon）
  - `data-state="open|closed"`
  - `className` 必须包含：
    - `.date_btn`
    - `.date_btn--open` 或 `.date_btn--closed`（二选一）
- 推荐属性：
  - `aria-label="..."`（由使用方传入，用“人类可读短语”，允许包含空格）
- 可选稳定锚点：
  - 当传入 `dataUi="xxx"` 时，DateButton 输出 `data-ui="xxx-btn"`

内容结构（稳定）：

- 文本：`div.flex-1.text-sm.truncate ...`（显示日期或 placeholder）
- 图标：`div.date_btn_icon > <CalendarIcon />`

---

## 4. 状态模型

- `isOpen === true`：
  - DateButton 使用 `.date_btn--open`
  - `data-state="open"`
  - 弹层渲染（日历）
- `isOpen === false`：
  - DateButton 使用 `.date_btn--closed`
  - `data-state="closed"`
  - 弹层不渲染

---

## 5. 样式类约定（全局）

样式定义在 [`src/styles/global.css`](../src/styles/global.css) 的 `@layer components`：

- `.date_btn`：基础样式（尺寸、padding、圆角、背景、边框、交互等）
- `.date_btn--open`：打开态（强调边框/ring）
- `.date_btn--closed`：关闭态（默认边框；hover 不改变 border）
- `.date_btn_icon`：日历图标容器（颜色/对齐）

---

## 6. 扩展点（Props）

`DatePicker` 支持以下与 DateButton 相关的扩展：

- `className`：控制 DatePicker 外层容器布局（例如宽度、收缩行为）
- `buttonClassName`：追加到 DateButton 上，用于页面级的额外钩子/覆盖（不应替代 `.date_btn*` 的核心类）
- `textClassName`：追加到文本区域，用于控制文本显示（例如响应式隐藏）
- `cta` / `ctaPosition` / `ctaCopy`：透传为 DateButton 的 `data-cta` / `data-cta-position` / `data-cta-copy`（用于埋点）

说明：

- `textClassName` 常见用法是响应式显示控制，例如 `hidden sm:block`：默认隐藏，小屏不占位，达到 `sm` 断点后显示。

---

## 7. 参考模板

```jsx
<DatePicker
  value={startDate}
  onChange={setStartDate}
  aria-label="start date"
  className="min-w-10 shrink"
  textClassName="hidden sm:block"
/>
```
