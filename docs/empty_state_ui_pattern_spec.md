# Empty State UI Pattern Spec v1

This doc defines the recommended **empty / placeholder state** pattern used across Appointer pages, including a stable styling baseline and semantic text roles.

Related:
- Styles: `src/styles/global.css` (`empty_state_*`)
- Avatar: `docs/avatar_component_spec.md`
- i18n: UI copy should use `t("key")` (do not hardcode user-facing strings)

## 1. When to use

Use this pattern when you need a centered placeholder surface inside a card/panel, such as:
- empty data states
- loading placeholders (non-spinner)
- error placeholders (lightweight)

## 2. CSS Contract

Global classes (owned by `src/styles/global.css`):

- `empty_state_panel`
  - Centered layout + dashed border + surface background
  - Includes spacing (`gap-2`) and padding (`p-8`)
- `empty_state_center`
  - Centered layout without a border (useful inside existing cards/lists)
- `empty_state_title`
  - Primary line (short status / title)
- `empty_state_hint`
  - Secondary line (guidance / hint)

Callers may add **layout-only** classes on top (e.g. `flex-1 min-h-0`) but should not restyle the baseline unless there is a page spec.

## 3. Recommended DOM Template

```jsx
<div className="empty_state_panel flex-1 min-h-0">
  <Avatar icon={FileSpreadsheet} size="lg" variant="empty" />
  <p className="empty_state_title">{t("some_title_key")}</p>
  <p className="empty_state_hint">{t("some_hint_key")}</p>
</div>
```

Notes:
- The icon + text should be visually centered as a group.
- Keep copy short; prefer a title + hint pair.
