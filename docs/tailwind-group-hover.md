# Tailwind `group` / `group-hover` 用法说明

## 这是什么

`group` 是 Tailwind 的“父元素标记”，用来实现：

> **当父元素处于 hover/focus 等状态时，让子元素跟着变化样式**

换句话说：**把 hover 的触发点放在“整行/整卡片（父）”，但样式变化发生在“行内某个图标/文字（子）”**。

## 什么时候用

常见场景：

- 列表每一行整行可点击：hover 时头像/标题一起高亮
- 卡片整体 hover：卡片内某个按钮/图标/标题变色
- 需要“父 hover → 子变色/动画”的一致交互反馈

## 基本写法（两步）

1) 父元素加 `group`

```jsx
<li className="group ...">...</li>
```

2) 子元素用 `group-hover:*`（或 `group-focus-within:*` 等）

```jsx
<span className="group-hover:text-accent">Title</span>
```

## 项目内示例（Dashboard 消息列表）

文件：`src/pages/Dashboard.jsx`

父级是整条可点击的 item：

- `className` 包含 `group`：`<li className="... group" />`

子级有两处跟随变色：

- Avatar：`group-hover:bg-accent/10 group-hover:text-accent`
- 用户名：`group-hover:text-accent`

这样用户把鼠标放在“整条 item”上时，头像和标题都能同步高亮，而不需要把 hover 绑定到每个子元素上。

## `cursor-pointer` 为什么常和 `group` 一起出现

如果父元素（例如列表一行）有 `onClick`，我们通常会加 `cursor-pointer`：

- 让鼠标样式明确表达“这里可点击”
- hover 反馈（`group-hover:*`）+ 光标反馈（`cursor-pointer`）形成一致的交互暗示

## 注意事项 / 常见坑

- **没有 `group`，`group-hover:*` 不会生效**：因为子元素找不到要“跟随”的父级状态。
- `group-hover:*` 是“父 hover 触发子变化”，不是“子 hover”。
- 如果子元素本身也需要独立 hover，可以同时写 `hover:*` 和 `group-hover:*`，但要注意优先级与一致性。
- 可访问性：如果是整行可点击，尽量保证键盘也能触达（例如用 `button`/`a` 语义，或至少 `role`/`tabIndex` + `onKeyDown`，视组件约束而定）。

