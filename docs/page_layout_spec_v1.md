# Page Layout Spec v1

This spec defines the recommended page-level layout primitives for Appointer pages, including head, content stacking, and section titles.

## Goals

- Make page layouts consistent across pages
- Avoid repeating Tailwind utility chains in every page
- Keep spacing rules predictable (`gap` for blocks, minimal ad-hoc `mb-*`)

## Page Skeleton

Recommended structure:

```jsx
return (
  <div className="w-full min-h-screen relative">
    <div className="page_head">
      <h1 className="page_title">...</h1>
      <p className="page_subtitle">...</p>
    </div>

    <div className="page_content">
      <section aria-label="...">
        <h2 className="section_title">...</h2>
        <Card as="section" cta="..." ctaPosition="..." ctaCopy="card">
          ...
        </Card>
      </section>

      <section aria-label="...">
        <h2 className="section_title">...</h2>
        <Card cta="..." ctaPosition="..." ctaCopy="card">
          ...
        </Card>
      </section>
    </div>
  </div>
);
```

## Head

Use these classes:

- `page_head`: wraps title + subtitle
- `page_title`: page H1 typography
- `page_subtitle`: supporting description text

Current spacing:
- `page_head` uses `mb-6`

Notes:

- Keep `h1` semantic for the page title.
- Subtitle is a `p` element; do not merge it into `page_title`.

## Content

Use `page_content` as the single wrapper for the main page sections.

- Layout: `flex flex-col`
- Spacing: controlled via `gap-*` (currently `gap-6`)

Rationale:

- `gap` is easier to maintain than repeating `mb-*` on each section.
- Avoid margin-collapsing edge cases between stacked blocks.

## Sections

Each section should be:

- Wrapped by a semantic `<section>` with an `aria-label` (short, human readable)
- Have a visible title: `<h2 className="section_title">...`
- Put the actual content inside a `Card` (visual container)

### Section title positioning

`section_title` defines:

- Left padding: `pl-2` (aligned inset relative to cards/content)
- Bottom spacing: `mb-4` (distance to the following card/content)

## Anchors

For automation/analytics:

- Prefer **semantic anchors**: `id` + `aria-label` (or `aria-labelledby`) on the `<section>` and key controls (see `docs/stable_selectors_spec.md`).
- CTA markers (`data-cta`, `data-cta-position`, `data-cta-copy`) are optional helpers for analytics (and can help narrow selectors when needed).
- `data-ui` is legacy; avoid adding new `data-ui` anchors.
