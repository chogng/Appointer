# Card (UI) Component Spec v2

This doc defines `src/components/ui/Card.jsx` behavior and recommended markers for automation/analytics.

Related:
- Stable selectors: `docs/stable_selectors_spec.md`
- Buttons: `docs/button_component_spec.md`

## 1. Responsibilities

- Visual container only (background/border/radius/padding/shadow).
- Semantics come from callers via `as` (e.g. `section`, `article`, `div`).
- No opinion on inner layout/copy/IDs.

## 2. Props

- `as`: root element/component (default: `div`)
- `variant`: `"default" | "panel" | "glass" | "flat" | "fill"` (default: `"default"`)
- `className`: extra classes appended
- `cta` / `ctaPosition` / `ctaCopy`: optional markers (analytics)
  - emits: `data-cta`, `data-cta-position`, `data-cta-copy`
- `...props`: forwarded to the root element (including `aria-*`, events, `id`, etc.)

## 3. Attribute Order (JSX)

For consistency (and easier diff/review), follow this attribute order:

`as` → `id` → `variant` → `cta*` → `className` → `aria-*` → `title` → `onClick` → other props

Notes:
- Prefer `id` for stable anchors; avoid `data-ui`/`dataUi` (deprecated in `Card.jsx`).

## 4. Output Markers (DOM)

On the root element:

- Optional (analytics/automation): `data-cta="<cta>"` / `data-cta-position="<position>"` / `data-cta-copy="<copy>"`

Token rules (as implemented today):
- `cta`: trims and collapses whitespace (e.g. `"foo   bar"` -> `"foo bar"`).
- `ctaPosition` / `ctaCopy`: trims and replaces whitespace with `-` (e.g. `"card demo"` -> `"card-demo"`).

Avoid:
- Ad-hoc `data-*` markers on `Card` roots (e.g. `data-list="..."`) unless there is a written spec and a real consumer (tests/scripts/analytics). Prefer stable `id` and/or `data-cta*` instead.

## 5. Variants

- `default`: `card` (includes `p-6 shadow-sm`)
- `panel`: `card card--panel` (includes `p-4`)
- `flat`: `card card--flat`
- `glass`: `card card--glass` (applies `.glass`)
- `fill`: `card card--fill` (layout template: `p-0 overflow-hidden flex-1 min-h-0 flex flex-col`)

Notes:
- `fill` is meant for cards that should expand to consume remaining height in a flex/grid layout (e.g. dashboards).
- For scrollable content, prefer putting `overflow-y-auto` on an inner content container (not on the `Card` root) so the root can keep clipping (rounded corners) stable.

## 6. Recommended JSX Template (Copy/Paste)

Pick one of the two naming patterns below.

### Option A: `aria-label` (simplest)

```jsx
<Card
  as="section"
  id="button-demo-card-demo-default"
  cta="button-demo"
  ctaPosition="card-demo"
  ctaCopy="default"
  aria-label={t("card_demo_default_aria")}
>
  ...
</Card>
```

When to use:
- You want the section to have an accessible name, but you don't need a visible heading element.

Rules:
- `aria-label` should be human-readable (use `t("key")`, don't hardcode UI copy).
- If the section is already named by surrounding semantics, you can omit `aria-label`.

### Option B: `aria-labelledby` (name comes from a real element)

```jsx
<Card
  as="section"
  id="button-demo-card-demo-default"
  cta="button-demo"
  ctaPosition="card-demo"
  ctaCopy="default"
  aria-labelledby="button-demo-card-demo-default-title"
>
  <h2 id="button-demo-card-demo-default-title">
    {t("card_demo_default")}
  </h2>
  ...
</Card>
```

When to use:
- You want a visible heading, and you want the section name to stay in sync with that heading.

Rules:
- `aria-labelledby` must reference an element that exists in the DOM.
- The referenced element can be `h2/h3/div/span` — choose heading level based on page structure, not Card.

Notes:
- Prefer `variant="panel"` instead of `className="card card--panel"` to avoid duplicated classes.
- Keep `ctaPosition` / `ctaCopy` in `kebab-case` so emitted `data-cta-*` stays predictable.

## 7. Buttons Inside Cards (Alignment)

When placing action buttons inside a Card (especially icon-only actions in a header/toolbar):

- Prefer the shared `Button` component (`src/components/ui/Button.jsx`) over raw `<button>`.
- Icon-only actions: use `size="control"` and provide `aria-label`; add a stable `id` for unique CTAs.
- If you need explicit DOM markers for debugging/comparisons, pass `dataIcon="with"` / `dataIcon="without"` (renders `data-icon="with|without"`).
- Follow the attribute order convention defined in `docs/button_component_spec.md` for consistency.

## 8. Layout Template: Fill + Inner Scroll

Use when:
- The card should stretch to the bottom of the viewport area, and only the card content should scroll (not the whole page).

```jsx
<Card variant="fill" aria-labelledby="recent-messages-title">
  <div className="card_head_warp">
    <h2 id="recent-messages-title" className="section_title">
      {t("recentMessages")}
    </h2>
  </div>

  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
    {/* long list/table goes here */}
  </div>
</Card>
```

## 9. Checklist

- Semantics: pick the right `as` (`section/article/div`).
- Accessible name: `aria-labelledby` (or `aria-label`) must resolve to a human-readable name.
- Visual: use `variant` for the base look; use `className` only for additional layout/spacing.
- Markers: add `id` / `data-cta*` only when you need a stable anchor; avoid one-off `data-*` attributes.
- Copy: don't hardcode user-facing strings; use `t("key")` and update `src/context/LanguageContext.jsx` (`en`/`zh`).
