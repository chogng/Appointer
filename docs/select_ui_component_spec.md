# Select (UI) Component Spec v1

This doc defines `src/components/ui/Select.jsx` behavior and the recommended DOM/a11y conventions.

Related:
- Stable selectors: `docs/stable_selectors_spec.md`
- Focus indicator rules: `docs/focus_indicator_spec.md` (Select uses the `input_field` shell focus halo)
- Popup (menu surface + outside click close): `docs/popup_ui_component_spec.md`
- Custom menus: `docs/dropdown_menu_component_spec.md` (use when you need richer/custom menu content)
- Implementation: `src/components/ui/Select.jsx`

## 1. Responsibilities

- Provide a **single-select** control (controlled `value` + `onChange(nextValue)`).
- Render an **input-like** trigger (a `button` inside an `input_field` shell) to avoid browser autofill/history suggestions.
- Own a stable DOM contract for:
  - `id` / `menuId` wiring (`aria-controls` / `aria-labelledby`)
  - keyboard behavior (ArrowUp/ArrowDown/Enter/Escape)
  - grouping (`group`) and selection/highlight markers (`data-selected` / `data-highlighted`)

Non-goals:
- No per-row custom actions (e.g. delete button per option). Use `DropdownMenu` for custom menu content.
- No portal rendering or collision detection (delegated to `Popup` in this project).

## 2. Props

```ts
type SelectOption = {
  label: React.ReactNode;
  value: string | number;
  icon?: React.ComponentType<any>;
  group?: string;
};

type SelectProps = {
  options: SelectOption[];
  value: SelectOption["value"];
  onChange: (nextValue: SelectOption["value"]) => void;

  placeholder?: string;
  title?: string;
  disabled?: boolean;

  size?: "sm" | "md" | "xl"; // default: "md"

  id?: string;     // trigger id (stable anchor; used by aria-labelledby on the menu)
  menuId?: string; // menu id (stable anchor; referenced by aria-controls on the trigger)
  align?: "left" | "center" | "right";
  zIndex?: number;

  formatDisplay?: (selected: SelectOption | null) => React.ReactNode;

  className?: string;        // root
  triggerClassName?: string; // trigger button (small tweaks only)
  popupClassName?: string;   // menu container sizing (default: "min-w-full")

  testId?: string; // DEV-only (forwarded to data-testid on the trigger)
};
```

Notes:
- `formatDisplay(selected)` is called with the resolved selected option (or `null`).
- The component does **not** support `dataUi` / `data-ui`. Use stable `id` / `menuId` instead.

## 3. Attribute Order (JSX)

For consistent diffs:

`id` → `menuId` → `value` → `onChange` → `disabled` → `placeholder` → `title` → `size` → `align/zIndex` → `formatDisplay` → `className/triggerClassName/popupClassName` → `aria-*` → other props

## 4. Output Markers (DOM)

Select renders:

- Root: `div.ui-select_warp`
  - `data-style="select"`
  - `data-disabled={true|undefined}`
- Field shell: `div.input_field` + size class
  - `data-state="enable|disabled"` (for keyboard focus halo behavior)
- Trigger: `button`
  - `type="button"`
  - `id="<triggerId>"`
  - `aria-haspopup="menu"`
  - `aria-expanded="true|false"`
  - `aria-controls="<menuId>"`
  - `disabled={true|false}`
  - `data-state="open|closed"`
  - `data-size="sm|md|xl"`
- Menu: rendered by `Popup`
  - `id="<menuId>"`
  - `role="menu"`
  - `aria-labelledby="<triggerId>"`
  - `data-style="popup"`
  - `data-state="open|closed"`
- Item: `button.ui-select_item`
  - `type="button"`
  - `role="menuitem"`
  - `tabIndex={-1}` (no roving tabindex; trigger owns keyboard navigation/highlight)
  - `data-value="<option.value>"`
  - `data-selected` / `data-highlighted` (present when true)

## 5. ID + ARIA Rules

- If `id` is provided, it is used as the trigger `id` and the menu uses it as `aria-labelledby`.
- If `menuId` is provided, it is used as the menu `id` and the trigger references it via `aria-controls`.
- If omitted, both ids are derived with `useId()` and are **not stable** across builds. Prefer explicit stable ids when automation needs anchors.

## 6. Keyboard Behavior

Focus is always on the trigger button:

- Closed:
  - `ArrowDown` / `ArrowUp` / `Enter`: open menu and set highlight to selected option (or the first option)
- Open:
  - `Escape`: close menu
  - `ArrowDown`: move highlight to the next option (wrap)
  - `ArrowUp`: move highlight to the previous option (wrap)
  - `Enter`: select the highlighted option and close menu

## 7. Sizes

Select supports:
- `sm`: toolbar-compact trigger (`h-8`, `text-xs`)
- `md` (default): standard control height (`h-[38px]`, `text-sm`)
- `xl`: tall control height (`h-[47.6px]`, `text-sm`)

Sizing styles live in `src/styles/global.css` under `.ui-select_field--*`.

## 8. Recommended Usage

```jsx
import Select from "@/components/ui/Select";

<Select
  id="view-mode-select"
  menuId="view-mode-select-menu"
  value={viewMode}
  onChange={setViewMode}
  placeholder="Select view"
  options={[
    { label: "Weeks", value: "Weeks" },
    { label: "Days", value: "Days" },
    { label: "Month", value: "Month" },
  ]}
/>;
```

## 9. Checklist

- Use stable `id/menuId` when tests/automation need anchors.
- Prefer `Select` for standard single-select dropdowns.
- Use `DropdownMenu` when the menu content must be custom (row actions, special headers, etc.).
- Do not add `data-ui` markers; use `id` + `aria-*` wiring + `data-value` on items.

