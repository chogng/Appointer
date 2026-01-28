# Claude Code 页面字体审计（参考）

来源页面：`https://claude.com/product/claude-code`  
采集方式：浏览器 DevTools 读取 `getComputedStyle(...)` 与 `@font-face` 规则（抽样）。  
注意：字体与字号会随响应式断点、用户缩放、系统字体回退、A/B 实验等因素变化；本文记录的是一次采样结果，用于“参考风格/量级”，不保证与任意时刻完全一致。

## 1) Font families（字体族）

页面主要使用 3 组字体族（含回退）：

- **Sans（正文/UI）**：`"Anthropic Sans", Arial, sans-serif`   
- **Serif（标题/大字）**：`"Anthropic Serif", Georgia, sans-serif`  Source Serif 4
- **Mono（代码/终端）**：`"Jetbrains Mono", Arial, sans-serif`

另外还定义了：

- **字符覆盖/回退（可能用于部分字形）**：`"Noto Sans"`

## 2) @font-face（字体文件与权重）

从样式表中读取到的 `@font-face`（去重后的采样，部分字段）：

- `Anthropic Sans`
  - `font-style: normal`, `font-weight: 300 800`（变量字体，Roman）
  - `font-style: italic`, `font-weight: 300 800`（变量字体，Italic）
- `Anthropic Serif`
  - `font-style: normal`, `font-weight: 300 800`（变量字体，Roman）
  - `font-style: italic`, `font-weight: 300 800`（变量字体，Italic）
- `Jetbrains Mono`
  - `font-style: normal`, `font-weight: 400`
- `Noto Sans`
  - `font-style: normal`, `font-weight: 400`
  - `font-style: normal`, `font-weight: 500`
  - `font-style: normal`, `font-weight: 600`

`@font-face` 规则来源（采样时看到的样式表）：

- `https://cdn.prod.website-files.com/.../css/claude-brand.shared.1dddabc52.min.css`

## 3) 全局基线（base typography）

采样到的 `html/body` 计算样式：

- `html`
  - `font-size: 16px`（UA 默认）
- `body`
  - `font-family: "Anthropic Sans", Arial, sans-serif`
  - `font-size: 20px`
  - `line-height: 32px`
  - `font-weight: 400`
  - `-webkit-font-smoothing: antialiased`

## 4) 字号梯度（typographic scale，抽样）

以下为页面内常见的“字号/行高/字体/字重”组合（按字号从大到小，示例来自 `main` 内的 `h1/h2/h3/p/a/button/pre/code` 等元素抽样）：

### 4.1 Display / Heading（Serif）

- **72px / 79.2px**：`Anthropic Serif`, `500`
  - 示例：Hero/大标题类文本
- **52px / 62.4px**：`Anthropic Serif`, `500`
  - 示例：二级大标题（部分区块）
- **44px / 52.8px**：`Anthropic Serif`, `500`
  - 示例：区块标题（如 testimonials / value props）
- **32px / 35.2px**：`Anthropic Serif`, `500`
  - 示例：卡片标题（如 pricing plan 标题）
- **25px / 30px**：`Anthropic Serif`, `500`
  - 示例：小标题（如 “Terminal / VS Code and JetBrains IDEs” 等）
- **19px / 22.8px**：`Anthropic Serif`, `500`
  - 示例：更小的标题/卡片内强调项

### 4.2 Body / UI（Sans）

- **23px / 34.5px**：`Anthropic Sans`, `400`
  - 示例：引导段落（lead）
- **20px / 32px**：`Anthropic Sans`, `400`
  - 示例：正文、导航、列表项等
- **17px / 27.2px**：`Anthropic Sans`, `400`
  - 示例：长段正文/说明文（某些区块）
- **17px / 17px**：`Anthropic Sans`, `400`
  - 示例：CTA/按钮（部分组件）
- **15px / 24px**：`Anthropic Sans`, `400`
  - 示例：说明文本、tab 文本、链接等
- **12px / 19.2px**：`Anthropic Sans`, `400`
  - 示例：价格说明/脚注类小字
- **12px / 12px**：`Anthropic Sans`, `400`
  - 示例：更紧凑的小字链接（少量出现）

### 4.3 Code / Terminal（Mono）

- **15px**：`Jetbrains Mono`, `400`
  - 常见于 `pre/code` 终端片段
  - 采样中出现的行高包含 `15px` 与 `12.75px` 等（可能由组件样式或缩放/布局导致）
- **18.75px / 28.125px**：`Jetbrains Mono`, `400`
  - 采样中出现在某些模拟终端内容段落

## 5) 额外 font 相关属性（抽样）

大多数文本的以下属性接近默认：

- `font-style: normal`（除明确 italic）
- `font-stretch: 100%`
- `letter-spacing: normal`
- `font-kerning: auto`
- `font-feature-settings: normal`
- `font-variation-settings: normal`（变量字体由浏览器内部处理，CSS 可能仍显示 normal）

## 6) 复现步骤（你自己再抓一次）

1. 打开页面：`https://claude.com/product/claude-code`
2. DevTools → Console：
   - 选中元素 → `getComputedStyle($0).fontFamily / fontSize / lineHeight / fontWeight`
3. DevTools → Sources / Network：
   - 搜索 `@font-face` 或查看加载的 `.woff2` 资源

