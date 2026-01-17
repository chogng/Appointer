# Toast（UI）组件规范 v1

本文定义 [`src/components/ui/Toast.jsx`](../src/components/ui/Toast.jsx) 的 **行为（自动关闭/暂停）、DOM 输出、稳定锚点（`data-ui`）、A11y 约束**。

适用范围：页面内的轻量通知（success/info/warning/error），可选提供 action（如“撤销/重试”）。  
不适用：需要队列堆叠、全局 toast manager、多条并发管理的复杂通知系统（应由更上层的 Provider 管理）。

相关规范：
- [`stable_selectors_spec.md`](./stable_selectors_spec.md)：稳定选择器与 UI 标记约定

---

## 1. 目标与约束

- **稳定定位**：允许通过 `dataUi` 输出 `data-ui`，并为 action/close 提供可选子锚点。
- **A11y 基线**：根据类型输出合适的 ARIA 角色/`aria-live`，避免读屏器遗漏或误判。
- **交互一致**：支持自动关闭，并在 hover/focus 时暂停计时（防止用户操作时 toast 消失）。

---

## 2. Props（对外 API）

```ts
type ToastType = "success" | "error" | "warning" | "info";

type ToastProps = {
  message: React.ReactNode;
  type?: ToastType;
  actionText?: string | null;
  onAction?: (() => void) | null;
  onClose?: () => void;
  isVisible: boolean;

  // Positioning
  containerRef?: React.RefObject<HTMLElement>;
  position?: "absolute" | "fixed";

  // Auto-close
  duration?: number | null; // ms; null/Infinity disables auto-close

  // Stable marker (recommended)
  dataUi?: string;
};
```

---

## 3. DOM 结构（规范）

当不可见且动画结束：组件返回 `null`（不渲染）。

渲染时输出 Toast Root：

- Root 元素：`div`
- 必须属性：
  - `data-style="toast"`
  - `data-type="<type>"`
  - `data-state="open|closing"`
  - A11y：`role` 与 `aria-live`（见下节）
  - `aria-atomic="true"`
- 可选稳定锚点：
  - 当传入 `dataUi="xxx"`：输出 `data-ui="xxx"`
  - action 按钮：`data-ui="xxx-action"`
  - close 按钮：`data-ui="xxx-close"`

Root 内容建议结构：

1) icon 区  
2) message 文本区  
3) action/close 区

所有内部按钮必须 `type="button"`（避免在表单内触发表单提交）。

---

## 4. A11y 规则（强制）

根据 `type` 设置：

- `type === "error" || type === "warning"`：
  - `role="alert"`
  - `aria-live="assertive"`
- 其它（success/info）：
  - `role="status"`
  - `aria-live="polite"`

关闭按钮必须具备可读 `aria-label`（例如 “Close toast”）。

---

## 5. 自动关闭（强制）

- 当 `isVisible === true` 且 `duration` 为有限数值：
  - 启动计时器，超时调用 `onClose()`
- 暂停条件：
  - 鼠标 hover 在 Root 上
  - Root 内部元素获得焦点（focus within）
- 恢复条件：
  - 鼠标离开 Root
  - focus 离开 Root

---

## 6. 定位策略（约定）

- 当 `containerRef` 存在且 `position === "absolute"`：
  - 以容器的水平中心点计算 `left`，以 viewport fixed 方式定位（视觉上贴近容器）
- 其它情况：
  - `position === "fixed"`：固定在 viewport 底部居中
  - `position === "absolute"`：绝对定位到容器底部居中（按当前实现策略）
