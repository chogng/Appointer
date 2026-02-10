# Popup（UI）组件规范 v1

本文定义 [`src/components/ui/Popup.jsx`](../src/components/ui/Popup.jsx) 的 **DOM 输出、状态模型、稳定选择器锚点（`data-*`）、A11y 约束与扩展点**。

适用范围：作为 Select 等组件的通用弹出层容器（定位/层级/点击外部关闭/基础动画）。  
不适用：复杂 Popover（需要焦点管理/键盘导航/多方向碰撞检测）——这些应由更完整的 Popover 组件承担。

相关规范：
- [`stable_selectors_spec.md`](./stable_selectors_spec.md)：稳定选择器与 UI 标记约定
- [`select_ui_component_spec.md`](./select_ui_component_spec.md)：Select 对 Popup 的用法约束

---

## 1. 目标与约束

- **定位与层级**：支持相对触发器在底部弹出（`top-full`），并可配置对齐（left/center/right）与 `zIndex`。
- **状态明确**：open/closed 必须有稳定标记，便于样式与自动化定位。
- **职责边界清晰**：Popup 不负责“菜单项键盘交互/高亮/选择”，这些由调用方（如 Select）管理。

---

## 2. Props（对外 API）

```ts
type PopupProps = {
  isOpen: boolean;
  onClose?: () => void;
  align?: "left" | "center" | "right";
  zIndex?: number;
  className?: string;
  children: React.ReactNode | (() => React.ReactNode);
  triggerId?: string; // aria-labelledby
  menuId?: string; // id for the menu container
  closeOnClickOutside?: boolean; // default true
  containerRef?: React.RefObject<HTMLElement>; // used for outside click detection
};
```

---

## 3. DOM 结构（规范）

### 3.1 Root（定位容器）

- 元素：`div`（绝对定位）
- 职责：仅负责 “top-full + align + pointer-events” 等布局控制

### 3.2 Menu（弹层主体）

- 元素：`div`（菜单面板）
- 必须属性：
  - `id="<menuId>"`
  - `role="menu"`
  - `aria-orientation="vertical"`
  - `aria-labelledby="<triggerId>"`
  - `data-style="popup"`
  - `data-state="open|closed"`
  - `data-side="bottom"`
  - `data-align="left|center|right"`
- A11y（建议）：
  - 关闭时输出 `aria-hidden="true"`，避免读屏器在 closed 状态读取隐藏菜单内容

> 注意：菜单项（menuitem）由调用方渲染；Popup 不生成选项项结构。

---

## 4. 行为与状态模型

- `isOpen === true`：
  - 允许 pointer-events（可点击）
  - 视觉：`opacity-100 translate-y-0 scale-100`（或等价效果）
- `isOpen === false`：
  - 禁用 pointer-events（不可点击）
  - 视觉：`opacity-0 ...`（保留过渡动画）
  - A11y：`aria-hidden="true"`（建议）

---

## 5. 点击外部关闭（强制行为）

当 `isOpen === true` 且 `closeOnClickOutside !== false`：

- 监听 `document` 的 `mousedown`
- 若点击目标不在以下任一范围内，则调用 `onClose()`：
  - `containerRef.current`（推荐：包含 trigger + menu 的外层容器）
  - 否则 fallback 到 Popup 自身 `ref`

---

## 6. 使用建议（Select 场景）

- Select trigger：
  - `aria-haspopup="menu"`
  - `aria-expanded={isOpen}`
  - `aria-controls={menuId}`
- Popup menu：
  - `menuId` 与 trigger `aria-controls` 必须一致
  - `triggerId` 与 menu `aria-labelledby` 必须一致
