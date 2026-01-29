# Textarea（UI）组件规范 v1

本文定义 [`src/components/ui/Textarea.jsx`](../src/components/ui/Textarea.jsx) 的 **DOM 输出、状态模型、ID/aria 规则、CTA 标记与 A11y 约束**（推荐用 `id` + `aria-label`；`data-ui` 仅遗留兼容）。

说明：Textarea 复用 Input 体系的样式与容器结构（`input_*`），因此其外层仍使用 `data-style="input"`；差异在于渲染的原生控件为 `<textarea>`。

相关规范：
- [`stable_selectors_spec.md`](./stable_selectors_spec.md)：稳定选择器与 UI 标记约定
- [`input_component_spec.md`](./input_component_spec.md)：Input（UI）规范（同一套容器结构/状态标记）

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
  fieldClassName?: string; // field container (UI tweak, avoid page-level CSS)
  textareaClassName?: string; // textarea native
  error?: string;
  hint?: string;

  testId?: string; // DEV-only
  dataUi?: string; // legacy stable anchor (will be removed)
  cta?: string;
  ctaPosition?: string;
  ctaCopy?: string;
};
```

---

## 3. DOM 结构（规范）

Wrapper：
- `div.input_warp`
  - `data-style="input"`
  - 可选（Legacy）：`data-ui="<dataUi>"`

Label（可选）：
- `label.input_label`
  - `htmlFor="<textareaId>"`
  - 当传入 `dataUi`（Legacy）：输出 `data-ui="<dataUi>-label"`

Field：
- `div.input_field`
  - `data-icon="without"`
  - `data-state="enable|error|disabled"`
  - 可选：`data-testid`（DEV-only）
  - 可选埋点：`data-cta` / `data-cta-position` / `data-cta-copy`

Native textarea：
- `textarea.textarea_native`
  - `id="<textareaId>"`
  - `disabled={disabled}`
  - `aria-invalid={!!error}`
  - `aria-describedby`：由 `error/hint` 决定（并与调用方传入的 `aria-describedby` 合并）
  - 无 label：调用方必须提供 `aria-label` 或 `aria-labelledby`
  - 当传入 `dataUi`（Legacy）：输出 `data-ui="<dataUi>-input"`

Error/Hint：
- 错误优先：`div.input_error`
  - `id="<textareaId>-error"`
- 无错误时可显示：`div.input_hint`
  - `id="<textareaId>-hint"`

---

## 4. 行为与状态

- 受控输入：`value` 决定内容；输入变化时调用 `onChange(nextValue)`。
- 状态 `data-state`：
  - `disabled === true` → `disabled`
  - 否则 `error` 有值 → `error`
  - 否则 → `enable`

---

## 5. 稳定锚点（推荐：id + aria-label）

- 推荐：调用方提供稳定 `id`（kebab-case）与可读 `aria-label`（无 label 时必填）。
- `data-ui` 进入弃用通道：仅用于遗留兼容，不再新增，不作为自动化主锚点。

示例：
- `id="literature-keywords"` + `aria-label="keywords"`
