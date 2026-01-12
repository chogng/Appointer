# 稳定选择器与 UI 标记规范 v1

目标：避免出现 `#root > ...` 这种**依赖 DOM 深度与 Tailwind 组合类名**的超长选择器；让样式与测试/自动化定位都能使用**短、稳定、可维护**的锚点。

本文的核心原则：

- **语义与可访问性优先**：能用 `id/htmlFor`、`aria-*` 表达就不要用结构选择器。
- **稳定标记专用**：用 `data-ui`（或 `data-testid`）做“定位锚点”，不要用样式 class 当定位主入口。
- **组件输出要稳定**：UI 组件应提供稳定 DOM 结构与 `data-*` 标记（参考 `docs/tabs_ui_component_spec.md`）。
- 组件补充规范：`Card` 参见 `docs/card_ui_component_spec.md`；`Input` 参见 `docs/input_ui_component_spec.md`；`Dropdown` 参见 `docs/dropdown_ui_component_spec.md`。

---

## 1. 选择器优先级（强制）

从上到下优先使用：

1. **`data-ui`**（推荐，生产可用，语义清晰）
2. **`id/htmlFor`**（表单语义，稳定可用）
3. **`aria-label` / `role`**（仅在语义合理时使用）
4. **组件级 `ui-*` class**（仅当它是组件规范的一部分且不会频繁变动）

禁止：

- ❌ `#root > div > ...` 依赖层级的选择器
- ❌ 把 Tailwind 组合类（例如 `bg-bg-surface border ...`）当作定位锚点

---

## 2. 命名规范

### 2.1 `data-ui`

- 使用 `kebab-case`
- 以“功能域/页面”作为前缀，避免全局冲突

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

- `<label htmlFor="..." data-ui="...">...` 作为定位点
- `<input id="..." data-ui="...">` 作为定位点（如需要）
- 如果必须拿到“外层容器”，优先用 `data-ui` 先定位内部锚点，再用 `closest()` 回溯到需要的容器，避免依赖 Tailwind/class 组合

选择器示例：

- `label[for="literature-max-results"]`
- `[data-ui="literature-max-results-label"]`
- `document.querySelector('[data-ui="literature-max-results"]')`
- `document.querySelector('[data-ui="literature-max-results-label"]')?.closest('[data-ui="literature-max-results"]')`

### 3.2 UI 组件（Input / Tabs / ToggleButton）

- `ui-*` class 只负责样式
- `data-ui` 用于稳定定位
- `data-testid` 只在开发环境输出（如果项目既有此策略）

---

## 4. 迁移规则

- 新增页面/新组件：必须遵守本规范。
- 发现超长 selector：优先补 `data-ui` / `id/htmlFor`，然后替换 selector。
- 不要为了“省事”把 Tailwind 类当选择器锚点。
