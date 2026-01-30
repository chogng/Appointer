# Avatar (UI) Component Spec

This doc defines `src/components/ui/Avatar.jsx` behavior and recommended usage patterns.

Related:
- Styles: `src/styles/global.css` (global utility conventions)
- Tailwind parent-state patterns: `docs/tailwind-group-hover.md`
- CTA markers: `src/utils/cta.js` (normalization rules)

## 1. Responsibilities

- Provide a consistent, circular avatar container for:
  - user images (`src`)
  - fallback initial (`fallback`)
  - an icon placeholder (`icon`)
- Own the core sizing + shape + clipping; callers can extend via `className` / `imageClassName`.

## 2. Props

- `src`: image URL (optional). If present, renders an inner `<img>`.
- `fallback`: string used for:
  - image `alt` text (when `src` is present)
  - first-letter placeholder (when `src` and `icon` are absent)
- `icon`: a React component (e.g. Lucide icon) used as a placeholder when no `src`
- `size`: `"sm" | "md" | "lg" | "xl"` (default: `"md"`)
- `variant`: `"default" | "empty"` (default: `"default"`)
- `className`: extra classes appended to the root container
- `imageClassName`: extra classes appended to the inner `<img>`
- `iconClassName`: extra classes appended to the `<Icon>` (icon mode only)
- `cta` / `ctaPosition` / `ctaCopy`: optional markers (analytics)
  - emits: `data-cta`, `data-cta-position`, `data-cta-copy`
- `...props`: forwarded to the root `<div>` (including `id`, `aria-*`, events, etc.)

## 3. Priority Order (What Renders)

1. If `src` is provided: render `<img ... />`
2. Else if `icon` is provided: render `<Icon ... />`
3. Else: render fallback initial: `fallback?.slice(0, 1).toUpperCase()`

## 4. Output Markup (DOM)

- Root: `<div>` (always)
  - Contains shape/layout/base color and size classes
  - Optional (analytics/automation): `data-cta` / `data-cta-position` / `data-cta-copy`
  - Emits `data-mode="image|icon|fallback"` (render mode marker)
- Image mode: `<img>` inside the root
- Icon mode: `<Icon>` inside the root
- Fallback text mode: `<span>` inside the root

Token rules (as implemented today):
- `cta`: trims and collapses whitespace (e.g. `"foo   bar"` -> `"foo bar"`).
- `ctaPosition` / `ctaCopy`: trims and replaces whitespace with `-` (e.g. `"card demo"` -> `"card-demo"`).

`data-mode` values:
- `image`: `src` provided, renders `<img>`
- `icon`: no `src`, `icon` provided, renders `<Icon>`
- `fallback`: neither `src` nor `icon`, renders first-letter fallback

Style rule:
- `icon` and `fallback` share the same container styling (`avatar` + size classes).
- `image` applies `avatar--image` (container is neutral; `<img>` fills the circle).

## 5. Base Classes and Sizes

Root base classes (owned by the component):

- `avatar`

Size map (owned by the component):

- `sm`: `avatar--sm`
- `md`: `avatar--md`
- `lg`: `avatar--lg`
- `xl`: `avatar--xl`

Variant map (owned by the component):

- `default`: (no extra class)
- `empty`: `avatar--empty` (muted placeholder surface)

Mode modifiers (owned by the component):

- `avatar--image`: applied when `src` is provided

## 6. Icon Sizing Rule (Why 60%)

When rendering `icon`, the component applies:

- `w-[60%] h-[60%]`

Reason:
- In a circular container, percentage sizing keeps a consistent “internal padding” feel across sizes (`sm`/`md`/`lg`/`xl`).
- It avoids icons touching the edge of the circle and keeps visual weight consistent across different icon glyphs.

Note:
- This rule is specifically for icons used *as avatar placeholders* (not for general UI icons inside buttons, etc.).

## 7. Hover/Focus Patterns (`group-hover`)

`Avatar` includes `group-hover:bg-accent/10 group-hover:text-accent` in its base styles.
If the parent does not have `.group`, nothing happens.

Example (parent row hover drives avatar color):

```jsx
<li className="group cursor-pointer">
  <Avatar
    icon={Package}
  />
</li>
```

## 8. Accessibility Notes

- Image mode: `alt={fallback || "Avatar"}` is used today.
  - Recommended: pass a meaningful `fallback` (e.g. user name) so the image has a useful accessible name.
- If the avatar is clickable, prefer wrapping it in a semantic `<button>`/`<a>` rather than relying on `onClick` on the root `<div>`.

## 9. Recommended JSX Templates (Copy/Paste)

### Image avatar

```jsx
<Avatar
  src={user.avatarUrl}
  fallback={user.name}
  size="md"
  cta="Dashboard"
  ctaPosition="activity-notifications"
  ctaCopy="user-avatar"
  className="ring-1 ring-border-subtle/40"
/>
```

### Icon placeholder avatar

```jsx
<Avatar
  icon={Package}
  fallback={t("systemUser")}
  size="md"
  cta="Dashboard"
  ctaPosition="pending-approvals-inbox"
  ctaCopy="message-avatar"
  className="text-text-secondary"
/>
```
