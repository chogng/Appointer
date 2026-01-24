# Stable Selectors / CTA (v2)

This doc complements `docs/stable_selectors_spec.md` with **CTA markers** (`data-cta*`) that can be used as stable automation anchors without depending on DOM depth or Tailwind classes.

## Goals

- Stable automation anchors without depending on DOM depth or Tailwind classes
- Reduce duplication (avoid repeating the same prefix across `data-ui` + `id` + `aria-controls`)
- Keep accessibility semantics correct (native elements, proper `aria-*`)

## Selector Priority (v2)

- **Unique elements (preferred):** stable `id` (keep `aria-label` for a11y, but don't use it as the primary automation selector).
- **Repeated/list elements:** use `data-ui="<role>"` + a stable dynamic identifier such as `data-item-id="..."` / `data-seed-index="..."`.
- **Analytics / CTA:** `data-cta*` is primarily for tracking. It can be used as a selector when it is intentionally stable (e.g. Tabs options), but avoid relying on it for general UI anchoring.

## Recommended Pattern (Tabs)

Use **role/value markers** for the actual clickable items, plus optional CTA markers on the tab buttons:

- Tablist: `data-tabs="menu"`
- Tab: `data-tabs="tab"` + `data-cta*` (optional; recommended: include `data-cta-copy="<token>"` as the per-option token)
- Panel (if rendered by `Tabs.jsx`): `data-tabs="panel"`

### Example selectors

```css
/* Select the "Science" tab button in LiteratureResearch -> source tabs */
[data-tabs="menu"] [data-tabs="tab"][data-cta="Literature research"][data-cta-position="source"][data-cta-copy="science"]

/* Select the "matched" results-view tab button */
[data-tabs="menu"] [data-tabs="tab"][data-cta="Literature research"][data-cta-position="results-view"][data-cta-copy="matched"]
```

## Notes

- Selector priority: follow `docs/stable_selectors_spec.md`, plus the "unique id vs repeated data-ui" rules above.
- For Tabs specifically: prefer `data-tabs` + `data-cta*` (use `data-cta-copy` as the per-option token).
- Avoid using `aria-controls`/`aria-labelledby` IDs as automation selectors unless they are explicitly made stable (e.g. via `idBase`) and documented as such.
