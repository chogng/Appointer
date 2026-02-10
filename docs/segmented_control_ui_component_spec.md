# SegmentedControl（UI）组件规范 v1

本文定义 [`src/components/ui/SegmentedControl.jsx`](../src/components/ui/SegmentedControl.jsx) 的 **DOM 输出、状态模型、稳定锚点（`data-ui`）、A11y 约束与键盘行为**。

适用范围：同一页面内的少量模式/范围切换（2–5 项），例如 “我的/全部”、“列表/网格”。  
不适用：页面导航（用 `Tabs`/路由），复杂筛选（用 `Select` / `DropdownMenu`）。

相关规范：
- [`stable_selectors_spec.md`](./stable_selectors_spec.md)：稳定选择器与 UI 标记约定

---

## 1. 目标与约束

- **受控组件**：选中态由 `value` 决定；交互只通过 `onChange(nextValue)` 通知外部更新。
- **稳定锚点**：`dataUi` 作为根锚点；每个 item 输出固定 `data-ui="<dataUi>-item"` + 动态 `data-value`。
- **A11y 基线**：建议按 `radiogroup/radio` 输出角色与 roving tabindex；支持方向键切换。

---

## 2. Props（对外 API）

```ts
type SegmentedOption = {
  value: string;
  label: React.ReactNode;
};

type SegmentedControlProps = {
  options: SegmentedOption[];
  value: SegmentedOption["value"];
  onChange?: (nextValue: SegmentedOption["value"]) => void;
  className?: string;

  // A11y
  groupLabel?: string; // aria-label for group container (recommended)

  // Stable markers (recommended)
  dataUi?: string;
  testId?: string; // DEV-only
};
```

---

## 3. DOM 结构（规范）

Root：
- 元素：`div`
- 推荐属性：
  - `data-style="segmented"`
  - `role="radiogroup"`（或 `role="group"`）
  - `aria-label="<groupLabel>"`
  - `data-ui="<dataUi>"`

Items：
- 元素：`button`
- 必须属性：
  - `type="button"`
  - `data-value="<option.value>"`
  - `data-selected`（仅选中项输出）
- 推荐 A11y：
  - `role="radio"`
  - `aria-checked={isSelected}`
  - roving tabindex：选中项 `tabIndex=0`，其余 `-1`
- 推荐稳定锚点：
  - `data-ui="<dataUi>-item"`

---

## 4. 键盘行为（建议）

- `ArrowLeft/ArrowRight`：循环切换并移动焦点
- `Home/End`：跳到首/尾并移动焦点

---

## 5. 视觉指示器（约定）

- 组件可渲染一个 “indicator” 元素作为选中项背景滑块：
  - indicator 不应影响布局（absolute）
  - indicator 位置由选中 button 的 `offsetLeft/offsetWidth` 计算
