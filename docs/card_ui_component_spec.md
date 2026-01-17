# Card UI 组件规范（最小版）

> 本文描述 [`src/components/ui/Card.jsx`](../src/components/ui/Card.jsx) 组件的职责边界与最小 API；稳定选择器通用规则请参考：[`stable_selectors_spec.md`](./stable_selectors_spec.md)。

## 1. 职责边界（强制）

- `Card` 是**样式容器**：负责背景/边框/圆角/阴影等“承载外观”，不负责页面语义结构。
- **页面拥有语义**：页面决定使用 `section/article/div` 等语义标签（通过 `as`），以及页面级 `data-ui` 命名。
- `Card` 只做“稳定输出”：当传入 `dataUi` 时输出 `data-ui`；不在组件内部擅自生成页面级命名。

## 2. API（冻结）

- `as`: 渲染元素类型（默认 `div`）。
- `variant`: 视觉变体（`default` / `panel` / `glass` / `flat`，默认 `default`）。
- `className`: 追加样式 class。
- `dataUi`: `string`；会 `trim()`，非空时输出为 `data-ui="..."`。
- `...props`: 其余 props 透传到根元素（包含 `aria-*`、事件、`id` 等）。
- `ref`: 透传到根元素。

说明：
- `default`：`p-6` + `shadow-sm`（适合作为页面主卡片）。
- `panel`：`p-4`（无 shadow，适合作为次级面板/分组容器）。

样式类约定：
- `default`：`class="ui-card ui-card--default ..."`
- `panel`：`class="ui-card ui-card--panel ..."`
- `flat`：`class="ui-card ui-card--flat ..."`
- `glass`：`class="glass ..."`（特殊材质效果，见 [`src/styles/global.css`](../src/styles/global.css) 的 `.glass`）

## 3. 示例（可复制）

```jsx
<Card as="section" dataUi="literature-toolbar">
  ...
</Card>
```

说明：

- `dataUi` 通常标记“卡片容器”本身；卡片内部的交互控件（按钮/输入/链接）仍应在控件上标记各自的 `data-ui`（或 `id/htmlFor`），不要依赖 Card 的样式 class 来定位。

## 4. 非目标（明确禁止）

- ❌ 不要把 Card 的 class 组合（含 Tailwind/样式类）当作选择器锚点。
- ✅ 需要稳定定位时，优先使用 `data-ui`（或语义相关的 `id/htmlFor` / `aria-*`）。
