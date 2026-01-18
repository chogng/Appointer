# Card (UI) Component Spec v2

This doc defines `src/components/ui/Card.jsx` behavior and the recommended stable markers for automation/analytics.

Related:
- Stable selectors: `docs/stable_selectors_spec_v2.md`

## Responsibilities

- Card is a **visual container** (background/border/radius/padding/shadow).
- Page-level semantics are owned by callers via `as` (e.g. `section`, `article`, `div`).

## Props

- `as`: root element/component (default: `div`)
- `variant`: `"default" | "panel" | "glass" | "flat"` (default: `"default"`)
- `className`: extra classes appended
- `dataUi`: when non-empty, emits `data-ui="..."`
- `dta`: optional hierarchical marker `{ page?: string; slot?: string; comp?: string }`
  - emits: `data-dta`, `data-dta-page`, `data-dta-slot`, `data-dta-comp`
- `...props`: forwarded to the root element (including `aria-*`, events, `id`, etc.)

## Output Markers

On the root element:

- `data-card="card"`
- `data-ui="<dataUi>"` (optional)
- `data-dta="<page>.<slot>.<comp>"` and `data-dta-*` (optional)

## Variants

- `default`: `card` (includes `p-6 shadow-sm`)
- `panel`: `card card--panel` (includes `p-4`)
- `flat`: `card card--flat`
- `glass`: `card card--glass` (applies `.glass`)

## Examples

```jsx
<Card as="section" dta={{ page: "lr", slot: "keyword", comp: "card" }}>
  ...
</Card>
```

Recommended selector:

```css
[data-dta-page="lr"][data-dta-slot="keyword"][data-dta-comp="card"]
```
