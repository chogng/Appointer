# Input（UI）组件规范 v1

本文定义 [`src/components/ui/Input.jsx`](../src/components/ui/Input.jsx) 的 **DOM 结构、状态模型、ID/aria 规则、尺寸变体、稳定锚点与 CTA 标记**，用于：
- 避免页面里出现超长 Tailwind 串
- 支持多实例/并发渲染（ID 不冲突）
- 弱化 UI 细节，允许逐步替代视觉实现（保持 DOM/marker/A11y 合同不变）

相关规范：
- 稳定选择器与 UI 标记：[`stable_selectors_spec.md`](./stable_selectors_spec.md)
- Tabs 的 ID/aria/交互写法参考：[`tabs_ui_component_spec.md`](./tabs_ui_component_spec.md)
- 多行输入：[`textarea_ui_component_spec.md`](./textarea_ui_component_spec.md)

---

## 1. 适用范围

- 适用：普通表单输入（text/url/number/password 等），需要统一外观与稳定锚点输出的场景。
- 不适用：`textarea`（单独控件）、日期选择（`DatePicker`）、复杂输入（需要自定义结构的组合控件）。

---

## 2. 目标与约束

### 2.1 目标

- 结构稳定：固定 DOM + 必要的 `id/htmlFor` 与 `aria-*` 关系，便于样式与自动化定位。
- A11y 最小完整：`label/htmlFor` 或 `aria-label`，并用 `aria-describedby` 关联错误/提示文案。
- 多实例安全：未显式传 `id` 时，通过 `idBase + useId()` 派生 id，支持列表/并发渲染。
- UI 可替代：视觉样式允许逐步替换；稳定合同是 DOM/marker/aria（而不是具体 Tailwind 细节）。

### 2.2 约束（必须遵守）

- 受控组件：输入值由 `value` 决定；变化通过 `onChange(nextValue)` 通知外部。
- 不写 `tabIndex`：依赖浏览器原生 Tab 顺序；禁用态用原生 `disabled`（从 Tab 顺序中移除）。
- `id` + `aria-label` 是推荐锚点：调用方应尽量提供稳定 `id`（kebab-case）与可读 `aria-label`；未传 `id` 时组件会派生可用 id，但不保证对自动化稳定。
- `data-ui` 进入弃用通道：仅用于遗留兼容，不再新增，不作为自动化主锚点。
- `error` 优先于 `hint`：有错误时不显示 hint，并在 `aria-describedby` 中指向错误文案。

---

## 3. 组件结构（DOM 规范）

Input 的输出结构固定为：

- 外层容器：`div.ui-input_warp`
  - 必须属性：`data-style="input"`
  - 可选稳定锚点（Legacy）：当传入 `dataUi` 时输出 `data-ui="<dataUi>"`
- 可选 label：`label.ui-input_label`
  - `htmlFor="<inputId>"`
  - 当传入 `dataUi`（Legacy）：输出 `data-ui="<dataUi>-label"`
  - 当 `labelPlacement="inline"`：与 Field 一起包在 `div.flex.items-center.gap-2` 内（仅布局差异）
- Field 容器：`div.ui-input_field ui-input_field--<size>`
  - 必须属性：
    - `data-icon="with|without"`（是否包含 leftIcon）
    - `data-state="enable|error|disabled"`
    - 可选（DEV-only）`data-testid`
  - 可选 CTA 标记：`data-cta` / `data-cta-position` / `data-cta-copy`
- 可选 left icon：`span.ui-input_icon`（`aria-hidden="true"`）
- 原生输入：`input.ui-input_native`
  - `id="<inputId>"`、`name`、`type`、`value`、`placeholder`、`disabled`、`autoComplete`
  - `aria-invalid`：由 `error` 决定
  - `aria-describedby`：由 `error/hint` 决定（并与调用方传入的 `aria-describedby` 合并）
  - 当传入 `dataUi`（Legacy）：输出 `data-ui="<dataUi>-input"`
  - 其余 props 透传到 `<input>`（例如 `spellCheck`、`inputMode`、`aria-label`、`aria-describedby`、`data-*` 等）
- 可选 right slot：`div.ui-input_right`
- 错误/提示文案（Field 之后）：
  - 错误优先：`div.ui-input_error`
    - `id="<inputId>-error"`
  - 无错误时可显示：`div.ui-input_hint`
    - `id="<inputId>-hint"`

---

## 4. Props（冻结）

```ts
type InputProps = {
  label?: React.ReactNode;
  labelPlacement?: "stack" | "inline";

  value: string;
  onChange?: (nextValue: string) => void;
  placeholder?: string;
  disabled?: boolean;

  id?: string;
  idBase?: string; // 多实例安全 id 前缀
  name?: string;
  type?: string; // default "text"
  autoComplete?: string;

  size?: "sm" | "md" | "lg"; // default "md"
  className?: string; // wrapper
  fieldClassName?: string; // field container (UI tweak, avoid page-level CSS)
  inputClassName?: string; // native input

  error?: string;
  hint?: string;
  leftIcon?: React.ComponentType<{ size?: number }>;
  rightSlot?: React.ReactNode;

  testId?: string; // DEV-only: data-testid on Field
  dataUi?: string; // legacy stable anchor (kebab-case, will be removed)

  cta?: string; // -> data-cta on Field
  ctaPosition?: string; // -> data-cta-position on Field
  ctaCopy?: string; // -> data-cta-copy on Field
} & React.InputHTMLAttributes<HTMLInputElement>;
```

---

## 5. ID / aria 规则（支持多实例/并发）

### 5.1 inputId

- 若调用方传入 `id`：`inputId = id`（调用方必须保证全页唯一）。
- 否则：`inputId = slugify(idBase || "input") + "-" + useId()`（组件内部确保多实例不冲突）。

`slugify` 规则参考 Tabs：
- 转小写
- 非 `[a-z0-9_-]` 替换为 `-`
- 去除首尾多余 `-`

### 5.2 errorId / hintId

- `errorId = "${inputId}-error"`
- `hintId = "${inputId}-hint"`

### 5.3 aria-describedby 合并策略

- 调用方可继续传入自己的 `aria-describedby="..."`。
- 组件会在其基础上追加 `errorId`（有 error）或 `hintId`（无 error 且有 hint），并去重。

---

## 6. 状态模型

- `value`：当前输入值（受控）。
- `onChange(nextValue)`：输入变化时通知外部。
- `data-state`：
  - `disabled === true` → `disabled`
  - 否则 `error` 有值 → `error`
  - 否则 → `enable`
- 错误/提示：
  - `error` 存在：渲染 `.ui-input_error`，并设置 `aria-invalid=true`
  - `error` 不存在且 `hint` 存在：渲染 `.ui-input_hint`

---

## 7. 交互规范（点击 + 键盘/Tab）

- 点击 label：聚焦到 input（依赖 `htmlFor`）。
- 键盘 Tab：使用原生 Tab 顺序；组件不做 roving tabindex 等自定义逻辑。
- 禁用态：使用原生 `disabled`，不可聚焦、不可输入。
- rightSlot：若包含可点击元素（例如 icon-only button），其 A11y 要求参考 [`button_component_spec.md`](./button_component_spec.md)。

---

## 8. 尺寸变体（sm/md/lg）

样式定义在 [`src/styles/global.css`](../src/styles/global.css) 的 `@layer components`（细节可逐步替代；调用方只依赖 `size` 与稳定 DOM/marker）：

- `ui-input_field--sm`：`h-6 text-xs`
- `ui-input_field--md`：`h-[38px] text-sm`
- `ui-input_field--lg`：`h-[42px] text-sm`

---

## 9. 稳定锚点（推荐：id + aria-label）

（推荐：`id` + `aria-label`；`data-ui` 仅遗留兼容）

### 9.1 基础（单字段）

推荐：
- `id="literature-max-results"`
- 有可见 label：依赖 `label[for]`
- 无 label：提供 `aria-label="max results input"`

选择器示例：
- `#literature-max-results`
- `label[for="literature-max-results"]`
- `input[aria-label="max results input"]`

### 9.2 列表项（稳定 id + 动态 index）

列表/重复项建议直接给 input 分配可读的稳定 id（允许带 index），并配合 `aria-label`：

- seed url input：`id="literature-seed-url-0"` + `aria-label="seed url 1"`
- seed title input：`id="literature-seed-url-title-0"` + `aria-label="seed title 1"`

### 9.3 Legacy：data-ui（逐步移除）

仍支持传入 `dataUi="literature-max-results"` 并输出：
- wrapper：`[data-ui="literature-max-results"]`
- label：`[data-ui="literature-max-results-label"]`
- input：`[data-ui="literature-max-results-input"]`

但新代码不要依赖它作为自动化主锚点。

---

## 10. CTA / Automation Markers (v2)

Input 在 Field 容器输出 CTA 标记（用于埋点/自动化辅助定位）：

- Field：`data-cta="<cta>"` / `data-cta-position="<position>"` / `data-cta-copy="<copy>"`

推荐选择器示例：

```css
[data-cta="Literature research"][data-cta-position="toolbar"][data-cta-copy="max results"]
```

---

## 11. A11y 约束

- 有 label：使用 `label + htmlFor` 关联输入。
- 无 label：调用方必须提供 `aria-label` 或 `aria-labelledby`（人类可读短语，允许空格）。
- 错误/提示文案：通过 `aria-describedby` 关联到 input，且与调用方自定义 `aria-describedby` 合并。
