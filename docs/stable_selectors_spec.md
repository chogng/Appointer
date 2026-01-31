# Stable Selectors Spec

目标：给测试/自动化/排查提供**短、稳定、可维护**的定位锚点；避免依赖 DOM 深度或 Tailwind class 组合。

相关：
- `docs/card_component_spec.md`
- `docs/input_component_spec.md`
- `docs/textarea_ui_component_spec.md`
- `docs/button_component_spec.md`
- `docs/tabs_component_spec.md`

## 1. 选择器优先级（建议）

1) **稳定 `id` / `htmlFor`**
- 页面级、关键区块：给根元素一个稳定 `id`（不要用 `useId()` 生成的动态 id 做自动化锚点）
- 表单：优先 `label[for]` + `#inputId`

2) **可访问性（A11y）**
- 用 `aria-label` / `aria-labelledby` / 原生语义保证可访问性
- 不建议把 `aria-*` 当作主定位锚点（除非团队明确约定它稳定）

3) **组件结构标记（仅限组件规范内）**
- Tabs：使用 `data-tabs="menu|tab|panel"` 定位结构角色
- 除 Tabs 外，不新增通用的 `data-*` 结构标记（例如 `data-card` / `data-ui` 这类）除非写进对应组件 spec

4) **业务标识（用于重复/列表项）**
- 对可重复项，优先输出一个稳定业务字段：例如 `data-item-id="..."` / `data-seed-index="..."` / `data-row-id="..."`
- 不依赖 DOM 深度来区分第几个 item（例如 `:nth-child()`）

5) **CTA markers：`data-cta*`（可选）**
- 主要用途：埋点/分析
- 当且仅当团队明确这些 token 稳定时，可作为辅助定位锚点

## 2. 禁止项（强制）

- 禁止依赖 DOM 深度：`#root > div > ...`
- 禁止把 Tailwind 组合类当 selector 锚点：例如 `bg-bg-surface border ...`

## 3. 命名约定

- `id`：`kebab-case`，建议带路由/页面前缀避免冲突（例如 `device-analysis-preview-copy-selection`）
- `data-cta-position` / `data-cta-copy`：`kebab-case`

## 4. 推荐模式

### 4.1 表单：Label + Input

推荐：
- `<label htmlFor="x">...</label>` + `<input id="x" ... />`

常用 selector：
- `label[for="x"]`
- `#x`
- 必要时：`document.querySelector('#x')?.closest('[data-style="input"]')`

### 4.2 Tabs：`data-tabs` + 可选 `data-cta*`

推荐输出/定位锚点（见 `docs/tabs_component_spec.md`）：
- Tablist：`data-tabs="menu"`
- Tab：`data-tabs="tab"`（可选附带 `data-cta*`）
- Panel：`data-tabs="panel"`

示例 selector（当 CTA token 设计为稳定时）：

```css
[data-tabs="menu"] [data-tabs="tab"][data-cta="Literature research"][data-cta-position="source"][data-cta-copy="science"]
```

### 4.3 重复/列表项：稳定业务标识

推荐：
- 给列表容器一个稳定 `id`
- 给每个 item 输出稳定业务字段（例如 `data-item-id`）

示例 selector：

```css
#results-list [data-item-id="doi:10.1234/abcd"]
```

## 5. 迁移规则（建议）

- 新增页面：优先补齐稳定 `id` 与必要的 `aria-*`（命名/可访问性）
- 发现超长 selector：优先加稳定锚点，再替换 selector

## 6. CTA & data-* 规范（补充）

目标：减少 `data-*` 噪音，同时保证自动化/分析需要的标记足够稳定、可维护。

### 6.1 CTA token 命名（推荐）

- `data-cta`：用**稳定的动作/功能**命名，不要用 UI 文案/可翻译内容（否则 i18n 改动会打断 token）
- `data-cta-position`：标记区域位置，例如 `header` / `toolbar` / `card` / `list-item` / `dialog` / `footer`
- `data-cta-copy`：仅用于 A/B 或文案版本识别，推荐 `v1` / `v2` / `short` / `long` / `cn` / `en`，不要写原文
- 风格：统一 `kebab-case`；尽量短；避免拼 UI 原文

### 6.2 data-* 数量控制（推荐）

- 优先：稳定 `id`（页面级/关键区块）+ `label[for]`（表单）
- `data-cta*`：仅在需要埋点/分析时添加；如果已有稳定 `id` 且不需要分析，可不加
- 业务 data-*：仅用于可重复 item（列表/表格），例如 `data-item-id` / `data-row-id` / `data-seed-index`
- 不推荐结构 data-*：`data-row` / `data-col` / `data-slot` 等，除非已写入对应组件 spec 且明确为稳定结构的一部分
