# Typography Spec (Font Families + Type Scale)

This doc defines the **project-wide typography system**: font families, a constrained type scale, and usage rules.

Related:
- Audit reference (external): `docs/claude-code-font-audit.md` (structure reference only)
- Global styles: `src/styles/global.css`
- Tokens: `src/styles/variables.css`
- Tailwind theme: `tailwind.config.js`

## 1. Goals / Responsibilities

- Make typography consistent across pages/components.
- Reduce one-off `text-[Npx]` usage.
- Provide a small, stable set of **named sizes** that cover the UI.
- Ensure headings/body/UI labels have predictable size/line-height/weight defaults.

Non-goals:
- Not trying to match Claude’s exact numbers; we only borrow the *documentation pattern*.

## 2. Font Families (Project Standard)

Use Tailwind families (already defined in `tailwind.config.js`):

- **Sans (default UI/body)**: `font-sans` → `Inter, Arial, sans-serif`
- **Serif (display/headings)**: `font-serif` / `font-display` → `ui-serif, Georgia, serif`
- **Mono (code/ids)**: `font-mono` (if added later; currently not configured)

Rule:
- Default body copy uses `font-sans`.
- Headings that are intended to “feel editorial” can use `font-serif`/`font-display`.

## 3. Type Scale (Approved Sizes)

Use the following “levels” as the **preferred** scale. Each level implies both `font-size` and `line-height`.

### 3.1 Display / Headings (typically serif)

| Level | Tailwind | Typical use |
|---|---|---|
| Display | `text-3xl` | Page titles / hero titles |
| H2 | `text-2xl` | Section titles |
| H3 | `text-xl` | Card titles / sub-sections |
| H4 | `text-lg` | Minor headings |

Default weights:
- Display/H2: `font-medium`
- H3/H4: `font-medium` (avoid `font-semibold` for this project)

### 3.2 Body / UI (sans)

| Level | Tailwind | Typical use |
|---|---|---|
| Body | `text-base` | Main copy / paragraphs |
| Body-sm | `text-sm` | Secondary copy / helper text |
| Caption | `text-xs` | Tertiary copy / metadata |

Default weights:
- Body: `font-normal`
- Labels: `font-medium`
- Micro labels (caps): `font-medium` + `tracking-wider` (sparingly)

### 3.3 Exceptions (When custom sizes are allowed)

Allowed only for:
- Data-dense tables where `text-xs` is still too large
- Badges/pills that must match existing visual rhythm
- Specialized charts/visualizations

If you use `text-[Npx]`, add a TODO to migrate to a named level, or propose adding a new level to this doc.

## 4. Implementation Guidance (How to “lock” the scale)

Recommended approach (incremental):

1) **Document first** (this file): agree on levels + usage.
2) **Map to Tailwind**:
   - Prefer using existing Tailwind sizes (`text-xs/sm/base/lg/xl/2xl/3xl`) to avoid config churn.
   - If we need custom sizes (e.g. `11px`), define named utilities in `tailwind.config.js` under `theme.extend.fontSize`.
3) **Refactor hotspots**:
   - Replace repeated `text-[10px]`, `text-[11px]` with named tokens (e.g. `text-ui-xxs`) once we define them.
4) **Add semantic helpers where it pays off**:
   - Example: `.page_title`, `.section_title` in `src/styles/global.css` already do this; extend this pattern rather than inventing many new ad-hoc classes.

## 5. Recommended Patterns

### 5.1 Page title

Prefer using `.page_title` (already exists):

```jsx
<h1 className="page_title">{t("someTitle")}</h1>
```

### 5.2 Section title

Prefer using `.section_title`:

```jsx
<h2 className="section_title">{t("someSection")}</h2>
```

### 5.3 Dense table header (allowed micro-size)

If you must go smaller than `text-xs`, define a named level (don’t keep raw `text-[11px]` everywhere).

## 6. Checklist (PR Review)

- No new `text-[Npx]` unless justified (see §3.3).
- Headings follow the level table (Display/H2/H3/H4).
- Body copy uses `text-base`/`text-sm`/`text-xs`.
- Use existing semantic helpers (`.page_title`, `.section_title`) when applicable.
- Don’t hardcode user-facing copy; use `t("key")` and update `src/context/LanguageContext.jsx`.

---

## Appendix A. Numeric Scale Table (Default Tailwind)

Assumptions:
- `1rem = 16px`
- Values match Tailwind defaults unless we override `theme.extend.fontSize` in `tailwind.config.js`.

| Level   | Tailwind    | font-size           | line-height       |
|---------|-------------|-------------------:|-------------------:|
| Display | `text-3xl` | `1.875rem` / `30px` | `2.25rem` / `36px` |
| H2      | `text-2xl` | `1.5rem` / `24px` | `2rem` / `32px` |
| H3 |      `text-xl` | `1.25rem` / `20px` | `1.75rem` / `28px` |
| H4 |      `text-lg` | `1.125rem` / `18px` | `1.75rem` / `28px` |
| Body |    `text-base` | `1rem` / `16px` | `1.5rem` / `24px` |
| Body-sm | `text-sm` | `0.875rem` / `14px` | `1.25rem` / `20px` |
| Caption | `text-xs` | `0.75rem` / `12px` | `1rem` / `16px` |
