# Input（UI）组件规范 v1

本文定义 [`src/components/ui/Input.jsx`](../src/components/ui/Input.jsx) 的 **DOM 结构、状态模型、尺寸变体、稳定锚点输出与 A11y 约束**，用于避免页面里出现超长 Tailwind 串与不稳定选择器。

相关规范：
- 稳定选择器与 UI 标记：[`stable_selectors_spec.md`](./stable_selectors_spec.md)
- 多行输入：[`textarea_ui_component_spec.md`](./textarea_ui_component_spec.md)

---

## 1. 适用范围

- 适用：普通表单输入（text/url/number/password 等），需要统一外观与稳定锚点输出的场景。
- 不适用：`textarea`（单独控件）、日期选择（`DatePicker`）、复杂输入（需要自定义结构的组合控件）。

---

## 2. DOM 结构（规范）

Input 的输出结构固定为：

- 外层容器：`div.ui-input_warp`
  - 必须属性：`data-style="input"`
  - 可选稳定锚点：当传入 `dataUi` 时输出 `data-ui="<dataUi>"`
- 可选 label：`label.ui-input_label`
  - `htmlFor="<inputId>"`
  - 当传入 `dataUi`：输出 `data-ui="<dataUi>-label"`
- Field 容器：`div.ui-input_field ui-input_field--<size>`
  - 必须属性：
    - `data-state="enable|error|disabled"`
    - `data-icon="with|without"`（是否包含 leftIcon）
  - 可选（DEV-only）`data-testid`
  - 可选埋点：`data-cta` / `data-cta-position` / `data-cta-copy`
- 原生输入：`input.ui-input_native`
  - `id="<inputId>"`、`name`、`type`、`value`、`placeholder`、`disabled`、`autoComplete`
  - `aria-invalid`：由 `error` 决定
  - 当传入 `dataUi`：输出 `data-ui="<dataUi>-input"`
  - 其余 props 透传到 `<input>`（例如 `spellCheck`、`inputMode`、`aria-label`、`data-*` 等）
- 可选 left icon：`span.ui-input_icon`（`aria-hidden="true"`）
- 可选 right slot：`div.ui-input_right`

---

## 3. Props（冻结）

- `label?: ReactNode`：可选 label；若不提供 label，调用方应提供 `aria-label`。
- `value: string` / `onChange(nextValue: string)`：受控输入。
- `placeholder?: string`
- `disabled?: boolean`
- `id?: string` / `idBase?: string`：未传 `id` 时用 `idBase + useId()` 生成，避免冲突。
- `name?: string`
- `type?: string`（默认 `text`）
- `autoComplete?: string`
- `size?: "sm" | "md" | "lg"`（默认 `md`）
- `className?: string`：附加到外层 `ui-input_warp`
- `inputClassName?: string`：附加到 `input.ui-input_native`
- `error?: string` / `hint?: string`
- `leftIcon?: React.ComponentType<{ size?: number }>`
- `rightSlot?: ReactNode`
- `testId?: string`：仅 DEV 环境输出到 Field 的 `data-testid`
- `dataUi?: string`：稳定锚点基名（kebab-case）
- `cta / ctaPosition / ctaCopy`：透传到 Field 容器的埋点属性

---

## 4. Size 变体（全局样式）

在 [`src/styles/global.css`](../src/styles/global.css) 的 `@layer components` 定义：

- `ui-input_field--sm`：`h-6 text-xs`
- `ui-input_field--md`：`h-[38px] text-sm`
- `ui-input_field--lg`：`h-[42px] text-sm`

---

## 5. 稳定锚点（推荐用法）

### 5.1 基础（单字段）

传入 `dataUi="literature-max-results"` 时，输出锚点：

- wrapper：`[data-ui="literature-max-results"]`
- label：`[data-ui="literature-max-results-label"]`
- input：`[data-ui="literature-max-results-input"]`

### 5.2 列表项（固定 data-ui + 动态 data-*）

列表/重复项不要把 index/id 拼进 `data-ui`，而是组合：

- input：`[data-ui="literature-seed-url-input"][data-seed-index="0"]`

---

## 6. A11y 约束

- 有 label：使用 `label + htmlFor` 关联输入。
- 无 label：调用方必须提供 `aria-label`（人类可读短语，允许空格）。
