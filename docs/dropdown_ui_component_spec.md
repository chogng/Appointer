# Dropdown（UI）组件规范 v1

本文定义 `src/components/ui/Dropdown.jsx` 的 **DOM 输出、状态模型、尺寸变体、稳定选择器锚点与 A11y 约束**，用于避免页面里反复堆叠超长 Tailwind class（例如 `w-full h-[38px] flex items-center ...`）以及不稳定的测试/脚本定位。

相关规范：
- 稳定选择器与 UI 标记：`docs/stable_selectors_spec.md`

---

## 1. 适用范围

- 适用：需要“下拉选择（单选）”的场景，并希望统一样式/行为、支持键盘操作、支持分组展示。
- 不适用：原生 `<select>` 可满足且无需统一样式/交互的简单场景；复杂多选请另做组件（本组件是单选）。

---

## 2. DOM 结构（规范）

### 2.1 Root（容器）

- 元素：`div.ui-dropdown_warp`
- 必须：
  - `data-style="dropdown"`
  - `data-disabled={true|undefined}`（禁用时输出）
  - 允许透传 `className`
- 可选稳定锚点：
  - 当传入 `dataUi="xxx"` 时：输出 `data-ui="xxx"`

### 2.2 Trigger（触发器）

- 元素：`button.ui-dropdown_trigger`
- 必须：
  - `type="button"`
  - `id="<triggerId>"`
  - `aria-haspopup="menu"`
  - `aria-expanded="true|false"`
  - `aria-controls="<menuId>"`
  - `disabled={true|false}`
  - `data-state="open|closed"`
  - `data-size="sm|md"`
  - class 必须包含：
    - `.ui-dropdown_trigger`
    - `.ui-dropdown_trigger--sm | .ui-dropdown_trigger--md`
- 内部结构（稳定）：
  - 文本：`span.ui-dropdown_text ui-dropdown_text--<size>`
  - 图标：`img.ui-dropdown_icon`（旋转由 `data-state` 或内部状态控制）
- 稳定锚点（可选）：
  - `data-ui="<dataUi>-trigger"`

### 2.3 Menu（弹层菜单）

由 `src/components/ui/Popup.jsx` 渲染。

- 元素：`div`（菜单根容器）
- 必须：
  - `id="<menuId>"`
  - `role="menu"`
  - `aria-orientation="vertical"`
  - `aria-labelledby="<triggerId>"`
  - `data-state="open|closed"`
  - `data-side="bottom"`
  - `data-align="left|center|right"`
  - `tabIndex={-1}`
- 稳定锚点（可选）：
  - `data-ui="<dataUi>-menu"`

### 2.4 Menu Title（可选）

- 元素：`div.ui-dropdown_title`
- 出现条件：传入 `title`
- 约束：纯展示，不可聚焦

### 2.5 Menu Items（选项项）

- 元素：`button.ui-dropdown_item`
- 必须：
  - `type="button"`
  - `role="menuitem"`
  - `tabIndex={-1}`（菜单不做 roving tabindex；键盘导航由 Trigger 捕获并维护 highlightedIndex）
  - `data-highlighted={true|undefined}`
  - `data-selected={true|undefined}`
  - `data-value="<option.value>"`
- 稳定锚点（可选）：
  - `data-ui="<dataUi>-item"`（注意：不要把 index/value 拼进 `data-ui`，用 `data-value` 表达动态部分）

### 2.6 Group Header / Separator（可选）

当 option 带 `group` 字段时，按 group 分块渲染：
- 组容器：`div[role="group"]`
- 分隔线：`div[role="separator"][aria-orientation="horizontal"]`
- 组标题：`div.ui-dropdown_group`

---

## 3. Props（冻结）

```ts
type DropdownOption = {
  label: React.ReactNode;
  value: string | number;
  icon?: React.ComponentType<any>;
  group?: string;
};

type DropdownProps = {
  options: DropdownOption[];
  value: DropdownOption["value"];
  onChange: (nextValue: DropdownOption["value"]) => void;

  placeholder?: string;
  title?: string;
  disabled?: boolean;

  size?: "sm" | "md"; // 默认 md

  id?: string; // trigger id（用于 aria-labelledby/aria-controls）
  align?: "left" | "center" | "right";
  zIndex?: number;

  formatDisplay?: (selected: DropdownOption | null) => string | number | null | undefined;

  className?: string;        // root
  triggerClassName?: string; // 仅用于少量页面级覆盖（避免重复写基础样式）
  popupClassName?: string;   // 菜单宽度等（默认 min-w-full）

  dataUi?: string;  // 稳定锚点基名（kebab-case）
  testId?: string;  // DEV-only（若项目启用）
};
```

约束：
- `options` 中非 `{value: ...}` 的项会被忽略（不作为可选项渲染/参与键盘导航）。
- `triggerClassName` 不应重复 `.ui-dropdown_trigger*` 的基础样式（如 `w-full / bg-* / border-* / justify-between` 等），只做页面级微调。

---

## 4. 状态模型

- 受控值：`value`（source of truth）
- 内部状态：
  - `isOpen`：菜单开关
  - `highlightedIndex`：键盘/hover 高亮项（仅在 open 时有效）
- 标记输出：
  - Trigger：`data-state="open|closed"`
  - Root：`data-disabled`
  - Item：`data-selected` / `data-highlighted`

---

## 5. 交互规范（点击 + 键盘）

### 5.1 点击
- 点击 Trigger：open/close 切换
- 点击 menu item：调用 `onChange(option.value)` 并关闭菜单
- 点击弹层外部：关闭菜单（Popup 处理）

### 5.2 键盘

焦点在 Trigger 上时：
- Closed：
  - `ArrowDown` / `ArrowUp` / `Enter`：打开菜单，并把高亮设为当前选中项（若无选中则为第 1 项）
- Open：
  - `Escape`：关闭菜单
  - `ArrowDown`：循环移动高亮到下一项
  - `ArrowUp`：循环移动高亮到上一项
  - `Enter`：选择当前高亮项并关闭菜单

---

## 6. 尺寸变体（sm / md）

- `md`（默认）：用于页面主表单/筛选区
- `sm`：用于紧凑工具条/图表 header

当前项目推荐值（在 `src/styles/global.css` 的 `@layer components` 中定义）：
- `md`：`h-[38px] px-3` + `text-sm`
- `sm`：`h-8 px-2` + `text-xs`

约束：尺寸变体必须同时影响 Trigger 的高度/内边距与文本字号（不能只改高度，文字仍保持 md）。

---

## 7. 稳定选择器（推荐用法）

传入 `dataUi="device-analysis-sweep-select"` 时，推荐定位：
- root：`[data-ui="device-analysis-sweep-select"]`
- trigger：`[data-ui="device-analysis-sweep-select-trigger"]`
- menu：`[data-ui="device-analysis-sweep-select-menu"]`
- 某个 value 的 item：`[data-ui="device-analysis-sweep-select-item"][data-value="forward"]`

---

## 8. 参考用例

```jsx
import Dropdown from "@/components/ui/Dropdown";

<Dropdown
  dataUi="device-analysis-sweep-select"
  size="sm"
  value={sweep}
  onChange={setSweep}
  options={[
    { label: "Forward", value: "forward" },
    { label: "Reverse", value: "reverse" },
  ]}
/>;
```
