# Tabs (UI) Component Spec v1

This doc defines `src/components/ui/Tabs.jsx` behavior and the recommended DOM/styling conventions.

Related:
- Stable selectors: `docs/stable_selectors_spec.md`
- Styles: `src/styles/global.css` (`tab_menu`, `tab_btn*`)
- Buttons: `docs/button_component_spec.md` (for action buttons; Tabs uses tab styles)
- Cards: `docs/card_component_spec.md` (Tabs are often used inside card headers)
- Implementation: `src/components/ui/Tabs.jsx`

## 1. Responsibilities

- Provide a stable, accessible `tablist/tab` control.
- Own tablist/tab DOM, IDs, ARIA wiring, and keyboard behavior.
- Optionally render tab panels when `renderPanel` is provided.

Non-goals:
- Does not decide app routing or persistence; callers own state (`value`).
- Does not enforce copy/i18n; callers should pass `t("key")` results as labels.

## 2. Props

### 2.1 `TabsOption`

- `value`: `string | number` (required; must be unique in `options`)
- `label`: `ReactNode` (required; visible label)
- `icon`: optional icon component (rendered at `16px`)
- `ariaLabel`: optional; only use when the label is not sufficient for screen readers
- `disabled`: boolean; disables interaction and keyboard activation
- `id`: optional; overrides the tab button `id`
- `panelId`: optional; overrides the panel `id` (only relevant when `renderPanel` is used)
- `cta` / `ctaPosition` / `ctaCopy`: optional markers, forwarded as `data-cta*` on the tab button
- `testId`: dev-only marker, forwarded as `data-testid` on the tab button when `import.meta.env.DEV`

### 2.2 `Tabs` props

- `options`: `TabsOption[]`
- `value`: active option value
- `onChange(nextValue)`: called on activation (click or keyboard activation)
- `groupLabel`: string, forwarded to `aria-label` on the tablist (recommended)
- `idBase`: stable instance token used to derive per-tab IDs (recommended)
- `panelIdBase`: optional override for derived panel ID prefix
- `panelIdMode`: `"scoped" | "short"` (default: `"scoped"`)
- `keyboardActivation`: `"auto" | "manual"` (default: `"auto"`)
- `hoverPreview`: boolean (default: `true`) visual-only highlight on hover
- `renderPanel(option, { index, isSelected })`: optional; if provided Tabs will render panels
- `keepMounted`: boolean (default: `false`) keep visited panels mounted (hidden) when `renderPanel` is used
- `size`: `"sm" | "md"` (default: `"md"`)
- `className`: extra classes for the tablist container
- `itemClassName`: extra classes for each tab button
- `testId`: dev-only marker, forwarded as `data-testid` on the tablist when `import.meta.env.DEV`
- `dataUi`: legacy marker, forwarded as `data-ui` (avoid adding new usages)
- `...props`: forwarded to the tablist container (`div[role="tablist"]`)

## 3. Output Markers (DOM)

Tabs renders:

- Tablist container: `div`
  - `role="tablist"`
  - `data-tabs="menu"` (stable marker)
  - class: `tab_menu` + `className`
  - `aria-label={groupLabel}` when provided
- Tab button: `button`
  - `type="button"`
  - `role="tab"`
  - `id="<tabId>"`
  - `aria-controls="<panelId>"`
  - `aria-selected="true|false"`
  - roving tabindex: active tab `tabIndex=0`, others `tabIndex=-1`
  - `data-tabs="tab"` (stable marker)
  - Optional: `data-cta*` and dev-only `data-testid`
- Panel (only when `renderPanel` is provided): `div`
  - `role="tabpanel"`
  - `id="<panelId>"`
  - `aria-labelledby="<tabId>"`
  - `hidden` when inactive
  - `data-tabs="panel"` (stable marker)

Token rules (as implemented today):
- `cta`: trims and collapses whitespace (e.g. `"foo   bar"` -> `"foo bar"`)
- `ctaPosition` / `ctaCopy`: trims and replaces whitespace with `-` (e.g. `"data import"` -> `"data-import"`)

## 4. ID Rules

IDs are derived to be stable across renders (when `idBase` is set):

- `instanceId = slugify(idBase)` when `idBase` is provided
- `tabId = option.id ?? "${instanceId}-tab-${token}"`
- `panelId`:
  - `panelIdMode="scoped"` (default): `option.panelId ?? "${panelPrefix}-${token}"`
  - `panelIdMode="short"`: `option.panelId ?? "${shortPrefix ? `${shortPrefix}-${token}` : token}"`

Where `token` is a slug derived from `option.value` (preferred), else fallback to label/index.

Rule of thumb:
- Prefer `idBase` + unique `option.value` and do not override `id/panelId` unless you must integrate with a fixed external selector set.

## 5. Keyboard Behavior

When a tab has focus:

- `ArrowLeft` / `ArrowRight`: moves focus between enabled tabs (wraps)
  - `keyboardActivation="auto"`: also activates (`onChange`) the focused tab
  - `keyboardActivation="manual"`: only moves focus
- `Home` / `End`: focus first/last enabled tab (and activates only in `auto` mode)
- `Enter` / `Space` (manual mode only): activates the focused tab

Disabled tabs:
- Do not activate via click or keyboard.
- Are skipped by keyboard focus movement.

## 6. Styling

- Tablist uses `.tab_menu`
- Tabs use `.tab_btn`, plus:
  - `.tab_btn--sm | .tab_btn--md`
  - `.tab_btn--active | .tab_btn--inactive`

Tabs are not styled as action buttons (`action-btn*`). Use `Button` for actions in toolbars/headers.

## 7. Recommended Usage Template

```jsx
<Tabs
  idBase="device-analysis-template-mode"
  groupLabel={t("da_template_mode")}
  value={templateMode}
  onChange={setTemplateMode}
  options={[
    {
      value: "select",
      label: t("da_template_mode_select"),
      cta: "Device analysis",
      ctaPosition: "template-mode",
      ctaCopy: "select",
    },
    {
      value: "save",
      label: t("da_template_mode_save"),
      cta: "Device analysis",
      ctaPosition: "template-mode",
      ctaCopy: "save",
    },
  ]}
/>
```

Notes:
- Use a stable `idBase` for test automation and analytics.
- Prefer `id` for page-level anchors; avoid new `dataUi` usages.
