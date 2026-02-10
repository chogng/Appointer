# Switch（UI）组件规范 v1

本文定义 [`src/components/ui/Switch.jsx`](../src/components/ui/Switch.jsx) 的 **DOM 输出、状态模型、稳定锚点（`data-ui`）、A11y 约束与扩展点**。

适用范围：开关型布尔状态（启用/禁用、开/关）切换。  
不适用：多选/单选组（用 `Tabs` / `Select` / `SegmentedControl`）。

相关规范：
- [`stable_selectors_spec.md`](./stable_selectors_spec.md)：稳定选择器与 UI 标记约定

---

## 1. 目标与约束

- **可访问性**：必须使用 `role="switch"` + `aria-checked`；并提供可读的 `aria-label`（或可见文本 label）。
- **受控组件**：状态由 `checked` 决定；交互通过 `onChange(nextChecked)` 通知外部更新。
- **稳定锚点**：允许通过 `dataUi` 输出 `data-ui`，便于测试/脚本定位。

---

## 2. Props（对外 API）

```ts
type SwitchProps = {
  checked: boolean;
  onChange?: (nextChecked: boolean) => void;
  disabled?: boolean;
  className?: string;
  activeColor?: string; // checked 时可覆盖背景/边框色

  // A11y
  ariaLabel?: string; // 建议必传（如果外部没有可见 label）

  // Stable markers (recommended)
  dataUi?: string;
  testId?: string; // DEV-only
};
```

---

## 3. DOM 结构（规范）

- 元素：`button`
- 必须属性：
  - `type="button"`
  - `role="switch"`
  - `aria-checked={checked}`
  - `disabled={disabled}`
  - `data-style="switch"`
  - `data-state="on|off"`
- 可选属性：
  - `aria-label="<ariaLabel>"`
  - `data-ui="<dataUi>"`
  - `data-testid="<testId>"`（DEV-only）

内容：
- 至少包含一个可被读屏器读取的 label（推荐 `aria-label`；也可使用 `sr-only` 文本）。

---

## 4. A11y 约束（强制）

- 若开关本身没有可见文本 label，必须提供 `ariaLabel`（避免读屏器只读出 “switch” 而不知道含义）。
- 需要有可见 focus 样式（建议使用 `focus-visible:*`）。

---

## 5. 事件与状态

- 点击触发：`onChange(!checked)`
- 禁用态：`disabled === true` 时不可切换，且应有明显的视觉弱化
