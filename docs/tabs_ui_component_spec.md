# Tabs（UI）组件规范 v1

本文定义 `src/components/ui/Tabs.jsx` 的 **DOM 结构、状态模型、键盘交互、ID/aria-controls 规则、样式约定**。

关键决策：

- 视觉样式：与 ToggleButton 一致（同为 pill buttons 风格）
- A11y 语义：固定为 `tablist/tab`
- 不内置 TabPanel 管理：面板由使用方自行渲染与显隐控制（但必须与 `aria-controls` 对应）

---

## 1. 适用范围

- 适用：内容区域切换（详情页多块内容、统计视图切换等），需要“Tabs”语义。
- 不适用：纯筛选/模式切换（用 `ToggleButton` 默认 `radiogroup/radio`）。

---

## 2. 目标与约束

### 2.1 目标

- 结构稳定：统一 DOM/属性/类名，便于样式与测试定位。
- A11y 最小完整：roving tabindex + Arrow/Home/End。
- 多实例安全：同页多个 Tabs 不冲突。
- 低耦合：Tabs 只负责 tablist/tab；面板由使用方管理。

### 2.2 约束（必须遵守）

- 受控组件：激活态由 `value` 决定；交互通过 `onChange(nextValue)` 通知外部更新。
- 组件会为每个 tab 输出：
  - `id="tab-${instanceId}-${key}"`
  - `aria-controls="panel-${instanceId}-${key}"`
- 使用方必须渲染对应的面板元素（至少空容器）：
  - `id="panel-${instanceId}-${key}"`
  - `role="tabpanel"`
  - `aria-labelledby="tab-${instanceId}-${key}"`
  - 非激活面板应设置 `hidden`

---

## 3. 组件结构（DOM 规范）

### 3.1 Props 定义

```ts
type TabsOption = {
  value: string | number;
  label: React.ReactNode;
  icon?: React.ComponentType<{ size?: number }>;
  ariaLabel?: string; // 仅在 label 不是可见文本或需要补充说明时使用；否则避免重复朗读
  testId?: string;
  id?: string; // 可覆盖 tabId
  cta?: string; // -> data-cta
  ctaPosition?: string; // -> data-cta-position
  ctaCopy?: string; // -> data-cta-copy
};

type TabsProps = {
  options: TabsOption[];
  value: TabsOption["value"];
  onChange: (nextValue: TabsOption["value"]) => void;
  className?: string;
  itemClassName?: string;
  groupLabel?: string; // aria-label for tablist
  idBase?: string; // instanceId 前缀（多实例/稳定）
  size?: "sm" | "md";
};
```

### 3.2 容器结构（tablist）

容器为一个 `div`：

- 必须：
  - `role="tablist"`
  - `aria-label={groupLabel}`（建议必填；应为“人类可读的短语”，允许包含空格）
  - `data-tabs="menu"`（稳定定位标记）
- 样式类（全局 `@layer components`，见 `src/styles/global.css`）：
  - `.ui-tabs__menu`

### 3.3 Tab 按钮（tab）

每个选项渲染一个 `<button type="button">`：

- 必须：
  - `role="tab"`
  - `id="<tabId>"`
  - `aria-controls="<panelId>"`
  - `aria-selected="true|false"`
  - roving tabindex：激活项 `tabIndex=0`，其余 `tabIndex=-1`
  - `data-tabs="tab"`（稳定定位标记）
- 可选：
  - `aria-label`：仅当显式传入 `option.ariaLabel` 时输出（取值应为“人类可读的短语”，允许包含空格）
  - 测试：开发环境可输出 `data-testid={option.testId}`
  - 埋点：`data-cta` / `data-cta-position` / `data-cta-copy`
- 稳定风格标记：
  - `data-icon="with|without"`（根据是否传入 `option.icon`）
- 内部结构（稳定）：
  - 可选 icon：`<span class="ui-tabs__btn-icon">...</span>`
  - 文案：`<span class="ui-tabs__btn-text">...</span>`
- 样式类（见 `src/styles/global.css`）：
  - `.ui-tabs__btn`（基础 + 默认 padding）
  - `.ui-tabs__btn--sm | .ui-tabs__btn--md`
  - `.ui-tabs__btn--active | .ui-tabs__btn--inactive`

---

## 4. ID 规则（支持多实例）

### 4.1 instanceId（idBase）

- 若传入 `idBase`：`instanceId = idBase`
- 否则：内部使用 React `useId()`（形如 `tabs-${reactId}`）

### 4.2 key 规则

`key` 来自 `option.value`（优先）或 `option.label` 派生并安全化：

- 转小写
- 非 `[a-z0-9_-]` 替换为 `-`
- 去除首尾多余 `-`

### 4.3 tabId / panelId

- `tabId`：
  - 若 `option.id` 存在：使用 `option.id`
  - 否则：`tab-${instanceId}-${key}`
- `panelId`：固定 `panel-${instanceId}-${key}`

---

## 5. 状态模型

- `value`：当前激活 tab 的 `option.value`
- `onChange(nextValue)`：切换激活 tab
- 激活态同步：
  - `aria-selected=true/false`
  - `tabIndex=0/-1`
  - active/inactive 样式

---

## 6. 交互规范（点击 + 键盘）

### 6.1 点击

- 点击任意 tab：调用 `onChange(option.value)`

### 6.2 键盘

前提：焦点在某个 tab 上

- `ArrowLeft`：切到上一个（循环），调用 `onChange`，并把焦点移动到新 tab
- `ArrowRight`：切到下一个（循环），调用 `onChange`，并把焦点移动到新 tab
- `Home`：切到第一个，调用 `onChange`，焦点移动到第一个
- `End`：切到最后一个，调用 `onChange`，焦点移动到最后一个

约束：必须 `e.preventDefault()`。

---

## 7. 尺寸变体（sm/md）

- `size="sm"`：使用 `.ui-tabs__btn--sm`
- `size="md"`：使用 `.ui-tabs__btn--md`（默认）

---

## 8. 与 ToggleButton 的区分指导

- 需要 tabs 语义（内容区域切换）：用 `Tabs.jsx`（tablist/tab + aria-controls + tabpanel）
- 只是单选切换（筛选/模式）：用 `ToggleButton.jsx` 的默认 `radiogroup/radio`

---

## 9. 参考模板

```html
<div role="tablist" aria-label="Device tabs" data-tabs="menu" class="ui-tabs__menu">
  <button
    data-icon="without"
    data-tabs="tab"
    type="button"
    role="tab"
    id="tab-device-overview"
    aria-controls="panel-device-overview"
    aria-selected="true"
    tabindex="0"
    class="ui-tabs__btn ui-tabs__btn--md ui-tabs__btn--active"
  >
    <span class="ui-tabs__btn-text">Overview</span>
  </button>

  <button
    data-icon="without"
    data-tabs="tab"
    type="button"
    role="tab"
    id="tab-device-usage"
    aria-controls="panel-device-usage"
    aria-selected="false"
    tabindex="-1"
    class="ui-tabs__btn ui-tabs__btn--md ui-tabs__btn--inactive"
  >
    <span class="ui-tabs__btn-text">Usage</span>
  </button>
</div>

<section id="panel-device-overview" role="tabpanel" aria-labelledby="tab-device-overview">
  ...
</section>
<section id="panel-device-usage" role="tabpanel" aria-labelledby="tab-device-usage" hidden>
  ...
</section>
```
