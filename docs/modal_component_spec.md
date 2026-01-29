# Modal (UI) Component Spec v2

This doc defines `src/components/ui/Modal.jsx` behavior and the recommended DOM/a11y conventions.

Related:
- Stable selectors: `docs/stable_selectors_spec.md`
- Buttons in footer: `docs/button_component_spec.md`
- Focus styles: `docs/focus_indicator_spec.md`
- Implementation: `src/components/ui/Modal.jsx`

## 1. Responsibilities

- Provide a simple app modal rendered via `createPortal(..., document.body)`.
- Own a stable DOM contract for:
  - overlay + backdrop + dialog containers
  - optional header title (named via `aria-labelledby`)
  - optional footer slot
- Provide baseline a11y + keyboard behavior (Escape to close, focus restore).

Non-goals:
- No strict focus trap (Tab can escape).
- No stacking manager for nested/multi-modals.
- No draggable/resizable dialog behavior.

## 2. Props

- `isOpen`: boolean; when `false`, returns `null` (no render)
- `onClose()`: called on backdrop click and Escape
- `title`: `ReactNode` (optional); when present, dialog sets `aria-labelledby`
- `children`: `ReactNode`; dialog body
- `footer`: `ReactNode` (optional); rendered in the footer container
- `className`: extra classes appended to the dialog container
- `closeAriaLabel`: optional string; overrides the close button accessible name
  - default: `t("common_close")` (requires `LanguageProvider`)

i18n rules:
- Do not hardcode user-facing copy in modal content; prefer `t("key")` and update `src/context/LanguageContext.jsx` (`en`/`zh`).
- `Modal` itself defaults the close button `aria-label` to `t("common_close")`; callers can override via `closeAriaLabel`.

Legacy markers:
- `data-ui` is in the deprecation path across the app. Do not add new `dataUi` usages for Modal.
- Prefer stable `id` on key controls (footer CTAs, confirm/cancel) as the primary automation anchors.

## 3. Attribute Order (JSX)

For consistency (and easier diff/review), keep this order when writing `Modal`:

`isOpen` → `onClose` → `title` → `footer` → `className` → `closeAriaLabel` → children

Notes:
- Footer actions should follow `docs/button_component_spec.md` attribute order.
- Avoid using the generated title id (from `useId()`) as an automation anchor; it is intentionally not stable.

## 4. Output Markup (DOM Contract)

When `isOpen === true`, the component portals the following structure to `document.body`:

- Overlay (root):
  - `<div data-style="modal" class="fixed inset-0 ...">`
- Backdrop:
  - `<div class="absolute inset-0 ..." onClick={onClose}>`
- Dialog:
  - `<div role="dialog" aria-modal="true" tabIndex={-1} ...>`
  - If `title != null`: `aria-labelledby="<titleId>"`
  - Header:
    - Title element: `id="<titleId>"`
    - Close button:
      - `type="button"`
      - `aria-label={closeAriaLabel ?? t("common_close")}`
  - Body: renders `children`
  - Footer (optional): renders `footer`

## 5. Behavior (A11y + Focus)

- Escape closes: listens for `keydown` and calls `onClose()` on `Escape`.
- Focus on open:
  - stores `document.activeElement`
  - focuses the first focusable element inside the dialog; falls back to the dialog container
- Focus on close:
  - restores focus to the previously focused element when possible
- Scroll lock:
  - sets `document.body.style.overflow = "hidden"` while open
  - restores the previous body overflow value on close

## 6. Recommended JSX Template (Copy/Paste)

```jsx
<Modal
  isOpen={isOpen}
  onClose={onClose}
  title={t("dashboard_request_details")}
  footer={
    <>
      <Button
        id="dashboard-request-details-cancel"
        variant="ghost"
        onClick={onClose}
      >
        {t("cancel")}
      </Button>
      <Button
        id="dashboard-request-details-confirm"
        variant="primary"
        onClick={onConfirm}
      >
        {t("dashboard_approve")}
      </Button>
    </>
  }
>
  ...
</Modal>
```

## 7. Checklist

- Accessible name: provide `title` (preferred) so `aria-labelledby` is set.
- i18n: modal content uses `t("key")`, not hardcoded copy.
- Anchors: use stable `id` on unique footer CTAs; do not depend on `useId()` output.
- Markers: avoid `data-ui` (legacy/deprecated); do not introduce new usage.
