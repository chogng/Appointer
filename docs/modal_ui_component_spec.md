# Modal（UI）组件规范 v1

本文定义 [`src/components/ui/Modal.jsx`](../src/components/ui/Modal.jsx) 的 **DOM 输出、状态模型、稳定锚点（`data-ui`）、A11y 约束与焦点行为**。

适用范围：页面内的确认/详情弹窗（Portal 到 `document.body`）。  
不适用：需要完整 focus trap、多层嵌套堆叠管理、可拖拽/可缩放等复杂对话框需求。

相关规范：
- [`stable_selectors_spec.md`](./stable_selectors_spec.md)：稳定选择器与 UI 标记约定

---

## 1. 目标与约束

- **可访问性基础完整**：`role="dialog"` + `aria-modal="true"` + `aria-labelledby`（标题）+ 关闭按钮可读。
- **焦点可预测**：打开时聚焦到弹窗内；关闭时恢复到打开前焦点（若可能）。
- **稳定锚点**：允许通过 `dataUi` 输出可维护的 `data-ui`，避免依赖深层 DOM 与 Tailwind 组合类。

---

## 2. Props（对外 API）

```ts
type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;

  // Stable marker (recommended)
  dataUi?: string;

  // A11y (optional)
  closeAriaLabel?: string; // default: "Close dialog"
};
```

---

## 3. DOM 结构（规范）

当 `isOpen === false`：组件返回 `null`（不渲染）。

当 `isOpen === true`：Portal 到 `document.body`，输出：

### 3.1 Overlay（全屏容器）

- 元素：`div`（`fixed inset-0`）
- 必须：
  - `data-style="modal"`
  - 当传入 `dataUi="xxx"`：输出 `data-ui="xxx"`

### 3.2 Backdrop（背景遮罩）

- 元素：`div`（`absolute inset-0`）
- 行为：点击触发 `onClose()`
- 可选稳定锚点：
  - `data-ui="xxx-backdrop"`

### 3.3 Dialog（内容容器）

- 元素：`div`
- 必须 A11y：
  - `role="dialog"`
  - `aria-modal="true"`
  - `aria-labelledby="<titleId>"`（当存在标题）
  - `tabIndex={-1}`（允许程序化 focus）
- 可选稳定锚点：
  - `data-ui="xxx-dialog"`
- 建议：
  - 关闭按钮 `type="button"` 且具备 `aria-label`（可配置）

### 3.4 Header / Body / Footer

- Header：标题节点应带稳定 `id="<titleId>"`
- Body：渲染 `children`
- Footer（可选）：渲染 `footer`

---

## 4. 焦点与键盘行为（强制）

- **Esc 关闭**：监听 `keydown`，当 `Escape` 时调用 `onClose()`。
- **打开时聚焦**：
  - 记录打开前 `document.activeElement`
  - 优先聚焦弹窗内第一个可聚焦元素；否则聚焦 Dialog 容器本身
- **关闭时恢复焦点**：关闭后尝试把焦点还原到打开前元素（若该元素仍存在且可 focus）。

> 说明：本组件不实现严格的 focus trap；如需要阻止 Tab 跳出弹窗，请在后续引入更完整的 Dialog/Popover 基础设施。
