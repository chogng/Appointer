# Button (UI) Component Spec

This doc defines `src/components/ui/Button.jsx` behavior and the recommended DOM/styling conventions.

Related:
- Stable selectors: `docs/stable_selectors_spec.md`
- Styles: `src/styles/global.css` (`action-btn*`)
- Implementation: `src/components/ui/Button.jsx`

## Responsibilities

- Provide a stable `<button>` structure for app actions.
- Own visual styling via `action-btn*` classes; callers own semantics (labels, form intent, etc.).

## Props

- `children`: button content (rendered inside `span.action-btn__content`)
- `type`: `"button" | "submit" | "reset"` (default: `"button"`)
- `variant`: `"primary" | "secondary" | "ghost" | "text" | "danger" | "dark"` (default: `"primary"`)
  - aliases: `"outline" -> "ghost"`, `"premium" -> "primary"`
- `size`: `"sm" | "md" | "lg" | "control"` (default: `"md"`)
- `fullWidth`: boolean, adds `w-full`
- `disabled`: boolean, uses native `disabled`
- `fx`: boolean, adds `.action-btn--fx` when enabled
- `fxMuted`: boolean, adds `.action-btn--fx-muted` when enabled (non-primary/non-danger)
- `withScale`: legacy alias for `fx`
- `className`: extra classes appended
- `dataIcon`: optional marker, forwarded to `data-icon`
- `dataStyle`: optional marker, forwarded to `data-style`
- `cta` / `ctaPosition` / `ctaCopy`: optional markers, forwarded as `data-cta*`
  - `cta`: page/route-level identifier (e.g. `button-fx-demo`, `literature-research`)
  - `ctaPosition`: module/region inside the page (e.g. `toolbar`, `card-demo`, `filters`, `results`)
  - `ctaCopy`: button copy (user-facing text). Spaces will be normalized to `-` by the component (e.g. `"Add URL"` -> `"Add-URL"`).
- `testId`: dev-only marker, forwarded as `data-testid` when `import.meta.env.DEV`
- `dataUi`: optional marker, forwarded as `data-ui` when non-empty (avoid using as a primary selector)
- `...props`: forwarded to the `<button>` (including `id`, `aria-*`, events, etc.)

## Output (DOM)

The component renders:

- Root: `<button>`
  - Always includes base class: `action-btn`
  - Always includes one size class: `action-btn--sm|md|lg|control`
  - Always includes one variant class: `action-btn--primary|secondary|ghost|text|danger|disabled|claude-shadow`
  - Optional: `action-btn--fx`, `action-btn--fx-muted`, `w-full`
  - Uses native `disabled` when `disabled={true}`
  - Defaults `type="button"` (avoid accidental submits)
- Inner content: `span.action-btn__content`

Token rules (as implemented today):
- `cta`: trims and collapses whitespace (e.g. `"foo   bar"` -> `"foo bar"`).
- `ctaPosition` / `ctaCopy`: trims and replaces whitespace with `-` (e.g. `"card demo"` -> `"card-demo"`).

## Recommended JSX Template (Copy/Paste)

```jsx
<Button
  id="button-fx-demo-primary"
  variant="primary"
  size="md"
  fx
  cta="button-fx-demo"
  ctaPosition="card-demo"
  ctaCopy={t("some_copy")}
  aria-label={t("some_label")}
>
  {t("some_copy")}
</Button>
```

Notes:
- For icon-only buttons, `aria-label` is required.
- Only use `type="submit"` for real form submits.
- Prefer stable `id` for unique buttons; don’t rely on Tailwind class combinations as selectors.
