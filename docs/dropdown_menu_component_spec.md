# DropdownMenu (UI) Component Spec v2

This doc defines `src/components/ui/DropdownMenu.jsx` behavior and the recommended DOM/a11y conventions.

Related:
- Stable selectors: `docs/stable_selectors_spec.md`
- Modal patterns (focus/portal): `docs/modal_component_spec.md`
- Select (standard single-select): `docs/select_ui_component_spec.md`
- Implementation: `src/components/ui/DropdownMenu.jsx`

## 1. Responsibilities

- Render a lightweight menu surface anchored to an element (no portal).
- Provide consistent close behavior:
  - click outside closes
  - `Escape` closes
- Provide a stable styling baseline (default className) while allowing caller customization.

Non-goals:
- No keyboard navigation model (ArrowUp/ArrowDown highlight, Enter select) — caller-owned.
- No focus trap.
- No collision detection or auto-flipping.

## 2. Props

```ts
type DropdownMenuProps = {
  isOpen: boolean; // when false, returns null
  onClose?: () => void;

  anchorRef: React.RefObject<HTMLElement | null>; // used for outside-click detection

  id?: string; // stable id for aria-controls / tests
  role?: string; // default: "menu"
  className?: string; // appended to default surface classes
  children: React.ReactNode;

  // ...props are forwarded to the menu root element (including aria-*, data-*, tabIndex, etc.)
};
```

## 3. Attribute Order (JSX)

For consistent diffs:

`isOpen` → `onClose` → `anchorRef` → `id` → `role` → `className` → `aria-*` → other props → `children`

## 4. Output Markers (DOM)

When `isOpen === true`, DropdownMenu renders a single root element:

- Root: `div`
  - `id={id}` when provided
  - `role={role}` (default `"menu"`)
  - `className` includes a default surface baseline and appends `className`
  - all extra props are forwarded to this root

When `isOpen === false`, it returns `null` (no DOM output).

Important:
- DropdownMenu does **not** generate `aria-labelledby`, `aria-orientation`, or item roles. Callers must pass the correct `aria-*` and roles via props / children.
- Do not introduce new `data-ui` markers for this component. Prefer stable `id` when automation needs anchors.

## 5. Default Styling Contract

The default surface className (from implementation) is:

- Positioning: `absolute top-full left-0 right-0 mt-2`
- Surface: `bg-bg-surface text-text-primary border border-border-subtle rounded-xl shadow-xl z-50`
- Scrolling: `max-h-60 overflow-y-auto p-1.5`

Callers may extend via `className` (e.g. width, max-height tweaks).

## 6. Behavior

When open:
- Registers `document` listeners:
  - `mousedown`: closes if the click target is outside **both** `anchorRef.current` and the menu root
  - `keydown`: closes on `Escape`
- Cleans up listeners on close/unmount.

## 7. Usage Requirements

- The anchor container must be `position: relative` (or otherwise provide a positioning context) so the menu can use `absolute` positioning.
- The caller controls open state and wires:
  - trigger `aria-expanded`
  - trigger `aria-controls` → menu `id`
  - menu `aria-labelledby` → trigger `id` (recommended)
- Keyboard navigation inside the menu (ArrowUp/ArrowDown/Enter) is caller-owned.
  - If you want a fully-owned keyboard model, use `Select` instead of assembling it manually.

## 8. Recommended JSX Template

```jsx
const anchorRef = useRef(null);
const [isOpen, setIsOpen] = useState(false);

<div ref={anchorRef} className="relative">
  <button
    id="my-trigger"
    type="button"
    aria-haspopup="menu"
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
    aria-labelledby="my-trigger"
    aria-orientation="vertical"
  >
    <button type="button" role="menuitem">...</button>
  </DropdownMenu>
</div>
```

## 9. Checklist

- Stable anchors: use stable `id` for the menu when tests/automation need it.
- A11y: wire `aria-controls` / `aria-labelledby`; use correct `role` for items.
- Close behavior: outside click + Escape work as expected.
- i18n: menu item copy uses `t("key")` where applicable.
