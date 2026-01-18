# Stable Selectors / DTA (v2)

This doc complements `docs/stable_selectors_spec.md` with a **hierarchical DTA** scheme that avoids repeating the same prefix across `data-ui`, `id`, and `aria-*`.

## Goals

- Stable automation anchors without depending on DOM depth or Tailwind classes
- Reduce duplication (e.g. no more repeating `lr-source` in `data-ui` + `id` + `aria-controls`)
- Keep accessibility IDs internal (still required for `aria-controls` / `aria-labelledby`)

## Recommended Pattern (Tabs)

Use **3-level DTA** on the tablist:

- `data-dta-page="<page>"` (e.g. `lr`)
- `data-dta-slot="<slot>"` (e.g. `source`, `match-mode`, `results-view`)
- `data-dta-comp="<comp>"` (e.g. `tabs`)

And then use **role/value markers** for the actual clickable items:

- Tablist: `data-tabs="menu"`
- Tab: `data-tabs="tab"` + `data-value="<token>"`
- Panel (if rendered by `Tabs.jsx`): `data-tabs="panel"` + `data-value="<token>"`

### Example selectors

```css
/* Select the "Science" tab button in LiteratureResearch -> source tabs */
[data-dta-page="lr"][data-dta-slot="source"][data-dta-comp="tabs"] [data-tabs="tab"][data-value="science"]

/* Select the "matched" results-view tab button */
[data-dta-page="lr"][data-dta-slot="results-view"][data-dta-comp="tabs"] [data-tabs="tab"][data-value="matched"]
```

## Notes

- IDs (`id`, `aria-controls`) still exist for accessibility, but **should not be used as automation selectors**.
- `data-ui` is still useful for leaf components (inputs, buttons), but for composite widgets Tabs can be located more cleanly via DTA + `data-tabs` + `data-value`.

