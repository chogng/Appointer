# ToggleButton 组件规范 v1

本文定义 [`src/components/ui/ToggleButton.jsx`](../src/components/ui/ToggleButton.jsx) 的 **DOM 结构、状态模型、键盘交互、ID 规则、样式约定、A11y 语义变体（radio/tabs）**。

相关规范：
- [`stable_selectors_spec.md`](./stable_selectors_spec.md)：稳定选择器与 UI 标记（`data-ui`/`data-*`）
- [`tabs_ui_component_spec.md`](./tabs_ui_component_spec.md)：Tabs 语义与 `aria-controls`（当 `a11yVariant="tabs"` 时）

---

## 1. 适用范围

- 适用：同一视图内的「单选切换」控件（筛选维度切换、视图模式切换等）。
- 不适用：页面导航（用 `nav`/链接）、多级菜单、Accordion。

---

## 2. 目标与约束

### 2.1 目标

- 结构稳定：任何地方使用 ToggleButton，都保持一致的 DOM/属性/类名，便于统一样式与测试定位。
- 多实例安全：同页多个 ToggleButton 不会产生 `id` 冲突。
- A11y 完整：支持 roving tabindex + Arrow/Home/End 键盘行为。
- 语义可选：默认 radiogroup/radio；必要时可切换为 tablist/tab（仅语义替换）。

### 2.2 约束（必须遵守）

- 受控组件：选中态由 `value` 决定；交互只通过 `onChange(nextValue)` 通知外部更新。
- hover 仅影响“视觉高亮”，不改变 `value`。
- 键盘必须实现：
  - `ArrowLeft/ArrowRight` 循环切换并移动焦点
  - `Home/End` 跳到首/尾并移动焦点

---

## 3. 组件结构（DOM 规范）

### 3.1 Props 定义

```ts
type ToggleButtonOption = {
  value: string | number;
  label: React.ReactNode;
  icon?: React.ComponentType<{ size?: number }>;
  ariaLabel?: string; // 仅在 label 不是可见文本或需要补充说明时使用；否则避免重复朗读
  testId?: string;
  id?: string;
  cta?: string; // -> data-cta
  ctaPosition?: string; // -> data-cta-position
  ctaCopy?: string; // -> data-cta-copy
};

type ToggleButtonProps = {
  options: ToggleButtonOption[];
  value: ToggleButtonOption["value"];
  onChange: (nextValue: ToggleButtonOption["value"]) => void;
  className?: string; // 容器额外类名
  itemClassName?: string; // 按钮额外类名
  a11yVariant?: "radio" | "tabs";
  groupLabel?: string; // aria-label for group container
  idBase?: string; // 多实例/稳定 ID 前缀
  size?: "sm" | "md";
};
```

### 3.2 容器结构

容器为一个 `div`：

- 必须：
  - `role="radiogroup"`（默认：`a11yVariant="radio"`）
  - 或 `role="tablist"`（`a11yVariant="tabs"`）
  - `aria-label={groupLabel}`（建议必填，作为组名；应为“人类可读的短语”，允许包含空格）
  - `data-toggle="menu"`（稳定定位标记，便于测试/脚本）
- 样式类（全局 `@layer components`，见 [`src/styles/global.css`](../src/styles/global.css)）：
  - `.toggle_menu`（推荐）
  - `.ui-toggle__menu`（兼容别名）

### 3.3 按钮元素

每个选项渲染一个 `<button type="button">`：

- 必须：
  - `type="button"`
  - `id="<buttonId>"`
  - roving tabindex：激活项 `tabIndex=0`，其余 `tabIndex=-1`
  - `onClick` 调用 `onChange(option.value)`
- 可选：
  - `aria-label`：仅当显式传入 `option.ariaLabel` 时输出（避免 label 为可见文本时重复朗读；取值应为“人类可读的短语”，允许包含空格）
  - 测试：开发环境可输出 `data-testid={option.testId}`
  - 埋点：`data-cta` / `data-cta-position` / `data-cta-copy`
- A11y 语义：
  - radio 变体：`role="radio"` + `aria-checked="true|false"`
  - tabs 变体：`role="tab"` + `aria-selected="true|false"` + `data-tabs="tab"`
- 稳定定位标记：
  - 按钮固定输出 `data-icon="with|without"`（根据是否传入 `option.icon`）
- 内部结构（稳定）：
  - 可选 icon：`<span class="toggle_btn_icon">...</span>`
  - 文案：`<span class="toggle_btn_text">...</span>`
- 样式类（见 [`src/styles/global.css`](../src/styles/global.css)）：
  - `.toggle_btn`（基础 + 默认 padding）
  - `.toggle_btn--sm | .toggle_btn--md`
  - `.toggle_btn--active | .toggle_btn--inactive`

---

## 4. ID 规则（支持多实例）

### 4.1 idBase（推荐）

- 默认：内部使用 React `useId()` 生成实例前缀（形如 `toggle-${reactId}`），满足组件内部无冲突即可。
- 仅在你需要“跨渲染稳定/可预测”的 DOM 标识（例如严格的 E2E 选择器、必须可读的 DOM 约定）时，再传入 `idBase` 来覆盖默认前缀。

### 4.2 option.id 与默认 ID

- 若 `option.id` 存在：直接使用该值作为按钮 `id`。
- 否则：默认 `id = "${idBase}-${key}"`，其中 `key` 来自 `option.value`（优先）或 `option.label` 派生并安全化：
  - 转小写
  - 非 `[a-z0-9_-]` 替换为 `-`
  - 去除首尾多余 `-`

约束：

- 同一实例内 `id` 不得重复。
- 同页多实例 `idBase` 不得重复（或使用默认前缀）。

---

## 5. 状态模型

- 受控选中态（source of truth）：`value`
- hover 预览态：内部 `hoverMode`，只影响“视觉 active”，不改变 `aria-checked/aria-selected` 的真实选中（真实选中由 `value` 决定）

---

## 6. 交互规范（点击 + 键盘）

### 6.1 点击

- 点击任意按钮：调用 `onChange(option.value)`

### 6.2 键盘（roving tabindex）

前提：焦点在某个按钮上

- `ArrowLeft`：切到上一个（循环），调用 `onChange`，并把焦点移动到新按钮
- `ArrowRight`：切到下一个（循环），调用 `onChange`，并把焦点移动到新按钮
- `Home`：切到第一个，调用 `onChange`，焦点移动到第一个
- `End`：切到最后一个，调用 `onChange`，焦点移动到最后一个

约束：必须 `e.preventDefault()`，避免页面滚动等默认行为。

---

## 7. 尺寸变体（sm/md）

- `size="sm"`：使用 `.toggle_btn--sm`
- `size="md"`：使用 `.toggle_btn--md`（默认）

---

## 8. A11y 变体（radio vs tabs）

### 8.1 radio（默认）

- 容器：`role="radiogroup"`
- 项：`role="radio"` + `aria-checked`

适用：筛选/模式切换（不需要 `tabpanel` 结构）。

### 8.2 tabs（仅语义替换）

- 容器：`role="tablist"`
- 项：`role="tab"` + `aria-selected` + `data-tabs="tab"`

适用：确实需要让读屏器以“Tabs”方式宣布，但你仍想复用 ToggleButton 的样式/交互。

注意：

- ToggleButton 的 tabs 变体不生成 `aria-controls`，也不管理 `tabpanel`。
- 若需要严格的 ARIA Tabs（含 `aria-controls` 规则），使用 [`src/components/ui/Tabs.jsx`](../src/components/ui/Tabs.jsx)。

---

## 9. 参考模板

### 9.1 radio（默认）

```html
<div role="radiogroup" aria-label="Results view" class="toggle_menu" data-toggle="menu">
  <button
    type="button"
    role="radio"
    aria-checked="true"
    tabindex="0"
    id="toggle-xxx-all"
    class="toggle_btn toggle_btn--md toggle_btn--active"
    data-icon="without"
    data-cta="Literature research"
    data-cta-position="result"
    data-cta-copy="all"
  >
    <span class="toggle_btn_text">All (0)</span>
  </button>
  <button
    type="button"
    role="radio"
    aria-checked="false"
    tabindex="-1"
    id="toggle-xxx-matched"
    class="toggle_btn toggle_btn--md toggle_btn--inactive"
    data-icon="without"
    data-cta="Literature research"
    data-cta-position="result"
    data-cta-copy="matched"
  >
    <span class="toggle_btn_text">Matched (0)</span>
  </button>
</div>
```

### 9.2 tabs（仅语义替换）

```html
<div role="tablist" aria-label="Device tabs" class="toggle_menu" data-toggle="menu">
  <button
    type="button"
    role="tab"
    aria-selected="true"
    tabindex="0"
    id="toggle-xxx-overview"
    data-tabs="tab"
    class="toggle_btn toggle_btn--md toggle_btn--active"
    data-icon="without"
  >
    <span class="toggle_btn_text">Overview</span>
  </button>
  <button
    type="button"
    role="tab"
    aria-selected="false"
    tabindex="-1"
    id="toggle-xxx-usage"
    data-tabs="tab"
    class="toggle_btn toggle_btn--md toggle_btn--inactive"
    data-icon="without"
  >
    <span class="toggle_btn_text">Usage</span>
  </button>
</div>
```
