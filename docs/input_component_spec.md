# Input (UI) Component Spec v2

This doc defines `src/components/ui/Input.jsx` behavior and the recommended DOM/styling conventions.

Related:
- Stable selectors: `docs/stable_selectors_spec.md`
- Buttons (right-slot actions): `docs/button_component_spec.md`
- Textarea counterpart: `docs/textarea_ui_component_spec.md`
- Implementation: `src/components/ui/Input.jsx`

## 1. Responsibilities

- Provide a controlled text-like input (`value` + `onChange(nextValue)`).
- Own a stable DOM contract for:
  - optional label
  - left icon + right slot
  - error/hint messaging with `aria-describedby`
  - stable state markers (`data-style`, `data-state`, `data-icon`)
- Avoid id collisions by deriving an id when callers don’t pass `id`.

## 2. Props

- `label`: `ReactNode` (optional)
- `labelPlacement`: `"stack" | "inline"` (default: `"stack"`)
- `value`: controlled value; `null/undefined` becomes empty string
- `onChange(nextValue: string)`: receives the next string value
- `placeholder`: string
- `disabled`: boolean (default: `false`; forwarded as native `disabled`)
- `id`: optional stable id (recommended when automation needs it)
- `idBase`: optional prefix used when `id` is omitted (combined with `useId()`)
- `name`: forwarded to `<input name="...">`
- `type`: forwarded to `<input type="...">` (default: `"text"`)
- `autoComplete`: forwarded to `<input autoComplete="...">`
- `size`: `"sm" | "md" | "lg" | "xl"` (default: `"md"`)
- `className`: wrapper classes appended to the outer container
- `fieldClassName`: classes appended to the field container (layout tweaks)
- `inputClassName`: classes appended to the native `<input>`
- `error`: string (optional; takes priority over `hint`)
- `hint`: string (optional; only shows when no `error`)
- `leftIcon`: React component (e.g. Lucide icon), rendered at 16px
- `rightSlot`: `ReactNode` rendered inside a `div.input_right`
- `cta` / `ctaPosition` / `ctaCopy`: optional markers forwarded to the field container as `data-cta*`
- `...props`: forwarded to the native `<input>` (including `aria-*`, `spellCheck`, `inputMode`, `data-*`, etc.)

## 3. Attribute Order (JSX)

For consistency (and easier diff/review), keep this order when writing `Input`:

`id` → `idBase` → `name` → `type` → `value` → `onChange` → `disabled` → `placeholder` → `autoComplete` → `size` → `leftIcon` → `rightSlot` → `error` → `hint` → `cta*` → `className/fieldClassName/inputClassName` → `aria-*` → other props

Notes:
- Prefer providing a stable `id` when automation or deep links need it; use `idBase` only when you intentionally want the component to derive a unique id.

## 4. Output Markup (DOM Contract)

`Input` always renders the same overall structure:

- Wrapper: `<div class="input_warp" data-style="input">`
- Optional label:
  - `<label class="input_label" htmlFor="<inputId>">...</label>`
  - If `labelPlacement="inline"` and label exists, label + field are wrapped in `<div class="flex items-center gap-2">...`
- Field container:
  - `<div class="input_field input_field--<size>" data-icon="with|without" data-state="enable|error|disabled">`
  - Optional CTA markers: `data-cta` / `data-cta-position` / `data-cta-copy`
- Optional left icon:
  - `<span class="input_icon" aria-hidden="true"><Icon size={16} /></span>`
- Native input:
  - `<input class="input_native" id="<inputId>" ... />`
  - `aria-invalid` is `true` when `error` is present, otherwise `false`
  - `aria-describedby` is merged from:
    - caller-provided `aria-describedby`
    - internal `"<inputId>-error"` (when `error`) OR `"<inputId>-hint"` (when no error and `hint`)
- Optional right slot:
  - `<div class="input_right">...</div>`
- Optional status text:
  - When `error`: `<div id="<inputId>-error" class="input_error">...</div>`
  - Else when `hint`: `<div id="<inputId>-hint" class="input_hint">...</div>`

## 5. ID + `aria-*` Rules

### 5.1 `inputId`

- If `id` is provided: `inputId = id`
  - Caller must ensure page-unique.
- Else:
  - `inputId = slugify(idBase || "input") + "-" + useId()`

`slugify` rules (as implemented):
- lowercase + trim
- replace non `[a-z0-9_-]` with `-`
- trim leading/trailing `-`

### 5.2 Error/Hint ids

- `errorId = "${inputId}-error"`
- `hintId = "${inputId}-hint"`

### 5.3 `aria-describedby` merging

- Caller may pass `aria-describedby`.
- Component appends `errorId` (when `error`) or `hintId` (when `hint` and no `error`).
- Component de-dupes and returns a space-separated id list.

## 6. State Model

### 6.1 `data-state`

- `disabled === true` → `data-state="disabled"`
- else if `error` truthy → `data-state="error"`
- else → `data-state="enable"`

Note:
- Focus visuals are provided by the component shell via `:focus-within` (see `src/styles/global.css`). The app disables native form-control outlines globally, so the keyboard focus ring is intentionally drawn on `.input_field` (component-level outer ring).

### 6.2 Error vs hint priority

- `error` wins:
  - hint is hidden
  - `aria-describedby` points to `errorId`
  - `aria-invalid` is set
- If no error and `hint` exists:
  - hint shows
  - `aria-describedby` points to `hintId`

### 6.3 `data-icon`

- `leftIcon` provided → `data-icon="with"`
- else → `data-icon="without"`

## 7. Sizes

`size` maps to a single size class on the field container:

- `sm` → `input_field--sm`
- `md` → `input_field--md`
- `lg` → `input_field--lg`
- `xl` → `input_field--xl`

Sizing visuals are defined in `src/styles/global.css`. Callers should not re-implement size rules in page CSS.

## 8. CTA Markers

When provided, CTA props are emitted on the field container:

- `data-cta="<cta>"`
- `data-cta-position="<ctaPosition>"`
- `data-cta-copy="<ctaCopy>"`

Token rules are implemented by `src/utils/cta.js` (`normalizeCtaName`, `normalizeCtaToken`).

## 9. Accessibility Notes

- Prefer using a real label (`label` prop). If you render no label, you should provide `aria-label` or `aria-labelledby` via `...props`.
- Do not manually manage tab order (`tabIndex`). Use native `disabled` for disabled state (removes it from tab order).
- If `rightSlot` contains an interactive control (icon-only button, etc.), follow `docs/button_component_spec.md`:
  - provide `aria-label`
  - ensure `type="button"` for non-submit buttons
  - prefer stable `id` for unique CTAs

## 10. Recommended JSX Templates (Copy/Paste)

### Basic labeled input

```jsx
<Input
  id="settings-user-email"
  label={t("email")}
  name="email"
  type="email"
  value={email}
  onChange={setEmail}
  placeholder={t("emailPlaceholder")}
  autoComplete="email"
/>
```

### Inline label + right-slot action

```jsx
<Input
  id="dashboard-search-logs"
  label={t("search")}
  labelPlacement="inline"
  name="searchLogs"
  value={searchTerm}
  onChange={setSearchTerm}
  placeholder={t("searchLogs")}
  rightSlot={
    <Button
      type="button"
      id="dashboard-search-clear"
      variant="ghost"
      size="control"
      aria-label={t("clear")}
      onClick={() => setSearchTerm("")}
    >
      ×
    </Button>
  }
/>
```

### Error + hint (error wins)

```jsx
<Input
  id="register-username"
  label={t("username")}
  value={username}
  onChange={setUsername}
  error={usernameError}
  hint={t("usernameHint")}
/>
```

## 11. Checklist

- Controlled: always pass `value`; update via `onChange(nextValue)`.
- Stable anchors: provide `id` for inputs used by automation or deep links.
- A11y: ensure a label or `aria-label`/`aria-labelledby` exists.
- Status text: use `error`/`hint`; do not manually wire `aria-describedby`.
- Markers: use CTA markers only when you need analytics/automation correlation.
