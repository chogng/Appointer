# DropdownMenu (UI) Component Spec v1

This doc defines `src/components/ui/DropdownMenu.jsx` behavior and the recommended DOM/a11y conventions.

Related:
- Stable selectors: `docs/stable_selectors_spec.md`
- Dropdown (select): `docs/dropdown_ui_component_spec.md`
- Modal (focus/portal patterns): `docs/modal_component_spec.md`
- Implementation: `src/components/ui/DropdownMenu.jsx`

## 1. Responsibilities

- Render a lightweight dropdown menu surface (a floating panel) anchored to an element.
- Provide consistent close behavior:
  - Click outside of the anchor/menu closes
  - Escape closes
- Provide a stable styling baseline (default className) while still allowing customization.

Non-goals:
- No portal rendering (menu stays in the DOM tree under the anchor container).
- No automatic positioning (top/bottom flipping) or collision detection.
- No focus trap or keyboard navigation management (ArrowUp/ArrowDown) — caller-owned.

## 2. Usage Requirements

- The anchor container must be `position: relative` so the menu can use `absolute` positioning.
- The caller controls open state (`isOpen`) and provides an `onClose()` callback.
- The caller is responsible for:
  - managing `aria-*` on the trigger element (`aria-expanded`, `aria-controls`, etc.)
  - providing correct `role` for the menu contents (menu/listbox) and the items
  - focusing behavior if needed (e.g. focusing the trigger on close)
  - keyboard navigation / roving tab index (e.g. ArrowUp/ArrowDown highlight and Enter select). If you want these behaviors, prefer `Dropdown` (see `docs/dropdown_ui_component_spec.md`).

Conventions:
- Prefer `Dropdown` for standard single-select dropdowns (no custom row actions).
- Use `DropdownMenu` when the menu content is custom (e.g. a “New …” entry, per-item Delete actions, richer layouts).
- Prefer a `button` trigger (can be styled input-like) over a readonly `<input>` to reduce browser autofill/history suggestions.
- When tests/automation need stable anchors, use stable `id`s for the trigger + menu, and link them via `aria-controls` / `aria-labelledby`.

## 3. Props

- `isOpen`: boolean; when `false`, returns `null`
- `onClose()`: function; called on outside click and `Escape`
- `anchorRef`: React ref to the anchor container (used for outside-click detection)
- `id`: optional string; stable id for automation and `aria-controls`
- `role`: string (default: `"menu"`)
- `className`: optional extra classes appended to default menu surface classes
- `children`: menu content

Selectors rule:
- Prefer stable `id` on the menu root when it needs to be targeted by tests.
- Do not introduce new `data-ui` usage for this component.

## 4. Default Styling Contract

The default menu surface style matches the existing dropdown pattern:

- `absolute top-full left-0 right-0 mt-2`
- `bg-white rounded-xl shadow-xl z-50`
- `max-h-60 overflow-y-auto p-1.5`

Callers may override or extend via `className`.

## 5. Behavior

When `isOpen === true`:

- Registers `document` listeners:
  - `mousedown`: closes if click target is outside both `anchorRef.current` and the menu root
  - `keydown`: closes on `Escape`
- Cleans up listeners on close/unmount

## 6. Recommended JSX Template

```jsx
<div ref={anchorRef} className="relative">
  <button
    type="button"
    aria-expanded={isOpen}
    aria-controls="my-menu"
    onClick={() => setIsOpen((v) => !v)}
  >
    Open
  </button>

  <DropdownMenu
    isOpen={isOpen}
    onClose={() => setIsOpen(false)}
    anchorRef={anchorRef}
    id="my-menu"
    role="menu"
  >
    ...
  </DropdownMenu>
</div>
```

## 7. Checklist

- Stable anchors: use `id` for the menu when needed by tests.
- i18n: menu item copy uses `t("key")` where applicable.
- Close behavior: outside click + Escape behave consistently across pages.
