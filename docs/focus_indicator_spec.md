# Focus Indicator Spec (Keyboard Only)

This doc explains how Appointer renders a consistent keyboard focus indicator (the “outer ring”) on UI shells like `Input`.

## 1. Goal

- Show a clear focus indicator for **keyboard navigation**.
- Avoid showing heavy focus chrome for **pointer** (mouse/touch) interactions.
- Keep the indicator visually “outside” the component without filling a background band.
- Prefer cheap-to-animate properties (opacity/color), avoid expensive focus repaints.

## 2. Input Modality (`html[data-nav]`)

The app tracks the last input modality and stores it on `<html>`:

- `html[data-nav="keyboard"]` when the user presses **Tab**
- `html[data-nav="pointer"]` when the user uses **pointerdown**

Implementation: `src/main.jsx`

This lets CSS gate focus indicators to keyboard usage:

- Only render the outer focus indicator under `html[data-nav="keyboard"]`

## 3. Buttons (action-btn)

Buttons use the same "outer ring" pattern as `Input`, implemented via a pseudo-element on `.action-btn`.

- Default state: the halo exists but is invisible (`opacity: 0`)
- Keyboard focus state: `html[data-nav="keyboard"] .action-btn:focus-visible::after` shows the halo
- Pointer interactions (mouse/touch): no halo, because `html[data-nav="pointer"]` will be active

## 4. Date Picker Trigger (date_btn)

The DatePicker trigger uses the same outer halo pattern on `.date_btn` and is also gated to keyboard navigation:

- `html[data-nav="keyboard"] .date_btn:focus-visible::after`

## 5. Why Not Browser Default Outline

The project disables native outlines globally for form controls:

- `input, select, textarea { outline: none; }` in `src/styles/global.css`

So we must provide a custom, visible keyboard focus indicator at the component shell level (e.g. `.input_field:focus-within`).

## 4. Why Not `ring-offset-*` Here

Tailwind `ring-offset-*` creates a “gap” by painting an offset area. If the offset uses a non-transparent color, it looks like the component background expanded.

If you want “bigger radius but not thicker line”, `ring-offset` can visually look thicker than expected because the colored ring + offset can read as a single large shape.

## 5. Recommended Pattern: Shell `::after` Focus Halo

We draw the focus indicator using a pseudo-element on the shell:

- The shell (`.input_field`) becomes `position: relative`
- `::after` draws an outer border that is **inset negatively** (outside the box)
- Default state is **invisible** (`opacity: 0`)
- Focus state makes it visible (`opacity: 1`) and sets the border color

This needs an “initial” rule so transitions can interpolate from a known state.

Reference implementation: `src/styles/global.css` (Input focus section)

### Tunables

- Outer radius / distance: `inset: -Npx`
- Line thickness: `border: 2px solid ...`
- Visibility: focus `opacity` (e.g. `1` or `0.8`)
- Corner radius: match the shell radius, e.g. `calc(rounded + Npx)`

## 6. Performance Note

Prefer animating:

- `opacity`
- `border-color`

Avoid animating:

- `outline-offset` (can be repaint-heavy, especially with `transition-all`)
- layout-affecting properties
