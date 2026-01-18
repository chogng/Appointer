# 稳定选择器与 UI 标记规范 v1

目标：避免出现 `#root > ...` 这种**依赖 DOM 深度与 Tailwind 组合类名**的超长选择器；让样式与测试/自动化定位都能使用**短、稳定、可维护**的锚点。

本文的核心原则：

- **语义与可访问性优先**：能用 `id/htmlFor`、`aria-*` 表达就不要用结构选择器。
- **定位锚点语义化**：优先用 `id/htmlFor` + `aria-label`（或 `aria-labelledby`）；`data-ui` 仅作为遗留兼容，逐步移除。
- **组件输出要稳定**：UI 组件应提供稳定 DOM 结构与必要的 aria 关系（参考 [`tabs_ui_component_spec.md`](./tabs_ui_component_spec.md)）。
- 组件补充规范：`Card` 参见 [`card_ui_component_spec.md`](./card_ui_component_spec.md)；`Input` 参见 [`input_ui_component_spec.md`](./input_ui_component_spec.md)；`Textarea` 参见 [`textarea_ui_component_spec.md`](./textarea_ui_component_spec.md)；`Dropdown` 参见 [`dropdown_ui_component_spec.md`](./dropdown_ui_component_spec.md)；`Popup` 参见 [`popup_ui_component_spec.md`](./popup_ui_component_spec.md)；`Modal` 参见 [`modal_ui_component_spec.md`](./modal_ui_component_spec.md)；`Toast` 参见 [`toast_ui_component_spec.md`](./toast_ui_component_spec.md)；`Switch` 参见 [`switch_ui_component_spec.md`](./switch_ui_component_spec.md)；`SegmentedControl` 参见 [`segmented_control_ui_component_spec.md`](./segmented_control_ui_component_spec.md)。

---

## 1. 选择器优先级（强制）

从上到下优先使用：

1. **`id/htmlFor`**（推荐；用于表单语义与定位；避免用 React `useId()` 生成的动态 id 做自动化选择器）
2. **`aria-label` / `aria-labelledby` / `role`**（推荐；用于无可见 label、icon-only 等场景）
3. **`data-cta*`**（可选；用于埋点与可读的自动化辅助定位）
4. **`data-ui`**（遗留兼容；不再新增，逐步替代）
5. **组件级 `ui-*` class**（仅当它是组件规范的一部分且不会频繁变动）

禁止：

- ❌ `#root > div > ...` 依赖层级的选择器
- ❌ 把 Tailwind 组合类（例如 `bg-bg-surface border ...`）当作定位锚点

---

## 2. 命名规范

### 2.1 `data-ui`（Legacy）

- 使用 `kebab-case`
- 以“功能域/页面”作为前缀，避免全局冲突
- 不再新增：新页面/新组件请用 `id` + `aria-label`；旧的 `data-ui` 仅用于兼容迁移期

示例：

- `data-ui="literature-max-results-label"`
- `data-ui="literature-max-results-input"`
- `data-ui="toolbar-filter"`

### 2.2 `id` 与 `htmlFor`

- 页面级表单字段：`id` 使用稳定字面量（便于 `label[for=...]` 与 a11y）
  - 示例：`id="literature-max-results"`
- 组件级（可复用多实例）：使用 `idBase + useId()` 派生，确保不冲突

---

## 3. 推荐模式（可复制）

### 3.1 表单 Label + Input

推荐：

- `<label htmlFor="...">...` 与 `<input id="...">` 作为主定位点
- 无可见 label 时：提供 `aria-label="..."`（建议使用稳定、可读的短语）
- 如果必须拿到“外层容器”：优先先定位 input/label，再用 `closest('[data-style="input"]')` 回溯到需要的容器，避免依赖 Tailwind/class 组合

选择器示例：

- `label[for="literature-max-results"]`
- `#literature-max-results`
- `input[aria-label="max results input"]`
- `document.querySelector('#literature-max-results')?.closest('[data-style="input"]')`

### 3.2 UI 组件（Input / Tabs）

- `ui-*` class 只负责样式
- `id/htmlFor` + `aria-label` 用于稳定定位
- `data-ui` 仅用于遗留兼容（不再新增）
- `data-testid` 只在开发环境输出（如果项目既有此策略）

---

## 4. 迁移规则

- 新增页面/新组件：必须遵守本规范。
- 发现超长 selector：优先补 `id/htmlFor` + `aria-label`，然后替换 selector。
- 旧的 `data-ui`：允许保留一段时间，但不要再为“定位方便”新增；替代完成后可移除。
- 不要为了“省事”把 Tailwind 类当选择器锚点。
