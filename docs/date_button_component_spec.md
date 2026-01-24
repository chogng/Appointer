# DateButton / DatePicker Click Target Spec (v2)

This doc defines the clickable "DateButton" area inside
`src/components/ui/DatePicker.jsx` (the trigger that opens/closes the calendar).

Related:
- `docs/stable_selectors_spec.md`
- `docs/stable_selectors_spec_v2.md`

## Scope

- Applies to the DatePicker trigger only (not generic action buttons).

## DOM Contract

DatePicker root wrapper:
- Element: `div.relative`
- Optional legacy marker: if `dataUi="xxx"` is provided, emits `data-ui="xxx"` on the wrapper.

DateButton trigger (the clickable area):
- Element: `button` (native, `type="button"`)
- Required attributes/classes:
  - `data-style="date"`
  - `data-icon="with"`
  - `data-state="open|closed"`
  - classes include:
    - `.date_btn`
    - `.date_btn--open` or `.date_btn--closed`
- Recommended a11y:
  - `aria-label="..."` should be provided by the caller (human readable)
- Optional legacy stable anchor:
  - if `dataUi="xxx"` is provided, emits `data-ui="xxx-btn"` on the trigger

Internal content structure (stable intent, not for selectors):
- Text: `div.date_btn_text` (renders the selected date or placeholder)
- Icon: `div.date_btn_icon` (calendar icon; `aria-hidden="true"`)

## State Model

- `isOpen === true`
  - `.date_btn--open`
  - `data-state="open"`
  - calendar popup rendered
- `isOpen === false`
  - `.date_btn--closed`
  - `data-state="closed"`
  - calendar popup not rendered

## Styling

Core styles are defined in `src/styles/global.css` (`@layer components`):
- `.date_btn`, `.date_btn--open`, `.date_btn--closed`, `.date_btn_icon`

## Example (caller)

```jsx
<DatePicker
  id="literature-start-date"
  value={startDate}
  onChange={setStartDate}
  aria-label="start date"
  className="min-w-0"
  textClassName="hidden sm:block"
/>
```

