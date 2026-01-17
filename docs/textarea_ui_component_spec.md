# Textarea（UI）组件规范 v1

本文定义 [`src/components/ui/Textarea.jsx`](../src/components/ui/Textarea.jsx) 的 **DOM 输出、状态模型、稳定锚点（`data-ui`）与 A11y 约束**。

说明：Textarea 复用 Input 体系的样式与容器结构（`ui-input_*`），因此其外层仍使用 `data-style="input"`；差异在于渲染的原生控件为 `<textarea>`。

相关规范：
- [`stable_selectors_spec.md`](./stable_selectors_spec.md)：稳定选择器与 UI 标记约定
- [`input_ui_component_spec.md`](./input_ui_component_spec.md)：Input（UI）规范（同一套容器结构/状态标记）

---

## 1. 适用范围

- 适用：多行文本输入（备注/描述/原因等），希望复用 Input 统一样式与稳定锚点输出。
- 不适用：富文本编辑器、代码编辑器等复杂输入。

---

## 2. Props（对外 API）

```ts
type TextareaProps = {
  label?: React.ReactNode;
  labelPlacement?: "stack" | "inline";
  value: string;
  onChange?: (nextValue: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  idBase?: string; // 多实例安全 id 前缀
  name?: string;
  rows?: number;

  className?: string; // wrapper
  textareaClassName?: string; // textarea native
  error?: string;
  hint?: string;

  testId?: string; // DEV-only
  dataUi?: string; // stable anchor
  cta?: string;
  ctaPosition?: string;
  ctaCopy?: string;
};
```

---

## 3. DOM 结构（规范）

Wrapper：
- `div.ui-input_warp`
  - `data-style="input"`
  - 可选：`data-ui="<dataUi>"`

Label（可选）：
- `label.ui-input_label`
  - `htmlFor="<textareaId>"`
  - 当传入 `dataUi`：输出 `data-ui="<dataUi>-label"`

Field：
- `div.ui-input_field`
  - `data-state="enable|error|disabled"`
  - `data-icon="without"`
  - 可选：`data-testid`（DEV-only）
  - 可选埋点：`data-cta` / `data-cta-position` / `data-cta-copy`

Native textarea：
- `textarea.ui-textarea_native`
  - `id="<textareaId>"`
  - `disabled={disabled}`
  - `aria-invalid={!!error}`
  - 当传入 `dataUi`：输出 `data-ui="<dataUi>-input"`

Error/Hint：
- 错误优先：`div.ui-input_error`
- 无错误时可显示：`div.ui-input_hint`

---

## 4. 行为与状态

- 受控输入：`value` 决定内容；输入变化时调用 `onChange(nextValue)`。
- 状态 `data-state`：
  - `disabled === true` → `disabled`
  - 否则 `error` 有值 → `error`
  - 否则 → `enable`
