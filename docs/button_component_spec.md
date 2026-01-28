# Button (UI) Component Spec

This doc defines `src/components/ui/Button.jsx` behavior and the recommended DOM/styling conventions.

Related:
- Stable selectors: `docs/stable_selectors_spec.md`
- Styles: `src/styles/global.css` (`action-btn*`)
- Implementation: `src/components/ui/Button.jsx`

## 1. Responsibilities

- Provide a stable `<button>` structure for app actions.
- Own visual styling via `action-btn*` classes; callers own semantics (labels, form intent, etc.).

## 2. Props

- `children`: button content (rendered inside `span.action-btn__content`)
- `type`: `"button" | "submit" | "reset"` (default: `"button"`)
- `variant`: `"primary" | "secondary" | "ghost" | "text" | "danger"` (default: `"primary"`)
- `size`: `"sm" | "md" | "lg" | "control"` (default: `"md"`)
- `fullWidth`: boolean, adds `w-full`
- `disabled`: boolean, uses native `disabled`
- `className`: extra classes appended
- `dataIcon`: debug-only marker, forwarded to `data-icon` (avoid using as a primary selector)
- `cta` / `ctaPosition` / `ctaCopy`: optional markers, forwarded as `data-cta*`
  - `cta`: page/route-level identifier (e.g. `button-ring-demo`, `literature-research`)
  - `ctaPosition`: module/region inside the page (e.g. `toolbar`, `card-demo`, `filters`, `results`)
  - `ctaCopy`: button copy (user-facing text). Spaces will be normalized to `-` by the component (e.g. `"Add URL"` -> `"Add-URL"`).
- `testId`: dev-only marker, forwarded as `data-testid` when `import.meta.env.DEV`
- `title`: forwarded via `...props` (hover tooltip; for icon-only buttons it can match `aria-label`)
- `...props`: forwarded to the `<button>` (including `id`, `aria-*`, events, etc.)

## 3. Attribute Order (JSX)

When writing icon-only `<button>` or `<Button>` instances, keep attributes in this order for consistency:

`type` → `id` → `variant/size` → `dataIcon` → `cta*` → `className` → `aria-*` → `title` → `onClick` → other

## 4. Output Markers (DOM)

The component renders:

- Root: `<button>`
  - Always includes base class: `action-btn`
  - Always includes one size class: `action-btn--sm|md|lg|control`
  - Always includes one variant class: `action-btn--primary|secondary|ghost|text|danger|disabled`
  - Default ring is built into `action-btn` styles; optional: `w-full`
  - Uses native `disabled` when `disabled={true}`
  - Defaults `type="button"` (avoid accidental submits)
- Inner content: `span.action-btn__content`

## 5. Base Styles (`action-btn`)

All buttons share the same base styling and interaction model via `.action-btn` in `src/styles/global.css`.

- Layout/typography: `inline-flex`, centered content, `rounded-lg`, `text-sm`, `font-medium`, transitions.
- Default ring variables (can be overridden by variants or inline `style`):
  - `--btn-ring-inner: bg.ghost` (inner ring color)
  - `--btn-ring-outer: border.200` (outer ring color)
  - `--btn-ring-outer-hover: border.200` (outer ring hover color)
- Default box-shadow at rest: `0 0 0 0 var(--btn-ring-inner), 0 0 0 1px var(--btn-ring-outer)`
- Size classes: `action-btn--sm|md|lg|control`
- Interaction details: see **Ring Model** and **Disabled State** below.

## 6. Ring Model (Two Rings via Box-Shadow)

Buttons use a **two-ring `box-shadow`** to create a "bigger on hover" feel without changing layout:

- **Inner ring**: uses `--btn-ring-inner` (spread `0px -> 1px` on hover)
  - Purpose: provide an inner buffer so the overall expansion reads as a single growth, not just a thicker outline.
- **Outer ring**: uses `--btn-ring-outer` / `--btn-ring-outer-hover` (spread `1px -> 2px` on hover)
  - Purpose: the visible outline ring that reads like the button's border.

If `--btn-ring-inner` is `transparent`, the inner ring expansion is visually invisible; the only visible change is the outer ring `1px -> 2px`, which can be interpreted as "the border got thicker". The element's real `border-width` does not change.

## 7. Variant Reference: `primary`

`primary` is a fully-specified style package (colors + ring variables):

- Visual:
  - text: `text-white`
  - background: `bg-bg-primary`
  - border: `border border-transparent`
- Ring variables:
  - `--btn-ring-inner: bg.primary` (inner ring color, `#222222`)
  - `--btn-ring-outer: border.300` (outer ring, `#30302E`)
  - `--btn-ring-outer-hover: border.300` (outer ring hover, `#30302E`)

## 8. Variant Reference: `ghost`

`ghost` is a sibling variant to `primary` and is intended for secondary/utility actions.

- Visual:
  - background: `bg-bg-ghost`
  - border: `border border-transparent` (ring-only; avoids double stroke)
  - text: `text-text-secondary` → `hover:text-text-primary`
- Ring variables:
- defaults (set by `.action-btn--ghost`):
    - `--btn-ring-inner: bg.ghost` (inner ring color, `#FAF9F5`)
    - `--btn-ring-outer: border.200` (outer ring, `#D1D1D1`)
    - `--btn-ring-outer-hover: border.200` (outer ring hover, `#D1D1D1`)
  - optional (toolbars): `.toolbar_group .action-btn--ghost` may override the same variables to fit the toolbar background

## 9. Variant Reference: `danger`

`danger` is a sibling variant intended for destructive/irreversible actions.

- Visual:
  - text: `text-text-tertiary` → `hover:text-text-danger`
  - background: none (transparent)
  - border: none (transparent)
- Ring variables:
  - uses the base defaults from `.action-btn` unless explicitly overridden

## 10. Disabled State

Disabled is a state (triggered by the `disabled` prop) that forces:

- DOM:
  - native `disabled` attribute is set on `<button>`
- Classes:
  - variant becomes `action-btn--disabled`
- Visual (from `.action-btn--disabled`):
  - text: `text-text-secondary`
  - background: `bg-bg-200`
  - cursor: `cursor-not-allowed`
  - border: `border border-transparent` (ring-only; avoids double stroke)
- Ring behavior (from `.action-btn:disabled` / `.action-btn--disabled`):
  - `box-shadow: none`
  - `transform: none` (no active scale)

Token rules (as implemented today):
- `cta`: trims and collapses whitespace (e.g. `"foo   bar"` -> `"foo bar"`).
- `ctaPosition` / `ctaCopy`: trims and replaces whitespace with `-` (e.g. `"card demo"` -> `"card-demo"`).

## 11. Recommended JSX Template (Copy/Paste)

```jsx
<Button
  type="button"
  id="button-ring-demo-primary"
  variant="primary"
  size="md"
  dataIcon="with"
  cta="button-ring-demo"
  ctaPosition="card-demo"
  ctaCopy={t("some_copy")}
  className="min-w-[7rem]"
  aria-label={t("some_label")}
  title={t("some_label")}
  onClick={() => console.log("button-ring-demo-primary")}
>
  {t("some_copy")}
</Button>
```

Notes:
- For icon-only buttons, `aria-label` is required.
- Only use `type="submit"` for real form submits.
- Prefer stable `id` for unique buttons; don’t rely on Tailwind class combinations as selectors.
- For ring comparisons/debugging, set `dataIcon="with"` or `dataIcon="without"` and verify it renders to DOM as `data-icon="with"` or `data-icon="without"`.
