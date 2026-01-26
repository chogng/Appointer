# Card (UI) Component Spec v2

This doc defines `src/components/ui/Card.jsx` behavior and recommended markers for automation/analytics.

Related:
- Stable selectors: `docs/stable_selectors_spec.md`

## Responsibilities

- Visual container only (background/border/radius/padding/shadow).
- Semantics come from callers via `as` (e.g. `section`, `article`, `div`).
- No opinion on inner layout/copy/IDs.

## Props

- `as`: root element/component (default: `div`)
- `variant`: `"default" | "panel" | "glass" | "flat"` (default: `"default"`)
- `className`: extra classes appended
- `cta` / `ctaPosition` / `ctaCopy`: optional markers (analytics)
  - emits: `data-cta`, `data-cta-position`, `data-cta-copy`
- `...props`: forwarded to the root element (including `aria-*`, events, `id`, etc.)

## Output Markers

On the root element:

- Optional (analytics/automation): `data-cta="<cta>"` / `data-cta-position="<position>"` / `data-cta-copy="<copy>"`

Token rules (as implemented today):
- `cta`: trims and collapses whitespace (e.g. `"foo   bar"` -> `"foo bar"`).
- `ctaPosition` / `ctaCopy`: trims and replaces whitespace with `-` (e.g. `"card demo"` -> `"card-demo"`).

## Variants

- `default`: `card` (includes `p-6 shadow-sm`)
- `panel`: `card card--panel` (includes `p-4`)
- `flat`: `card card--flat`
- `glass`: `card card--glass` (applies `.glass`)

## Recommended JSX Template (Copy/Paste)

Pick one of the two naming patterns below.

### Option A: `aria-label` (simplest)

```jsx
<Card
  as="section"
  id="button-fx-demo-card-demo-default"
  cta="button-fx-demo"
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
  id="button-fx-demo-card-demo-default"
  cta="button-fx-demo"
  ctaPosition="card-demo"
  ctaCopy="default"
  aria-labelledby="button-fx-demo-card-demo-default-title"
>
  <h2 id="button-fx-demo-card-demo-default-title">
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

## Checklist

- Semantics: pick the right `as` (`section/article/div`).
- Accessible name: `aria-labelledby` (or `aria-label`) must resolve to a human-readable name.
- Visual: use `variant` for the base look; use `className` only for additional layout/spacing.
- Markers: add `id` / `data-cta*` only when you need a stable anchor.
- Copy: don't hardcode user-facing strings; use `t("key")` and update `src/context/LanguageContext.jsx` (`en`/`zh`).

