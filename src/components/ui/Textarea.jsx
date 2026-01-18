import { forwardRef, useId } from "react";

const cx = (...parts) => parts.filter(Boolean).join(" ");

const slugify = (input) =>
  String(input ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const mergeSpaceSeparatedIds = (...parts) => {
  const ids = [];
  for (const part of parts) {
    if (typeof part !== "string") continue;
    for (const token of part.split(/\s+/g)) {
      const id = token.trim();
      if (!id) continue;
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids.length ? ids.join(" ") : undefined;
};

/**
 * Textarea (UI)
 * - Controlled: value + onChange(nextValue)
 * - Stable markers: data-style/data-state
 * - Optional DEV-only data-testid (align with Input/Tabs)
 */
const Textarea = forwardRef(
  (
    {
      label,
      labelPlacement = "stack", // "stack" | "inline"
      value,
      onChange,
      placeholder,
      disabled = false,
      id,
      idBase,
      name,
      rows = 3,
      className = "",
      fieldClassName = "",
      textareaClassName = "",
      error,
      hint,
      testId,
      dataUi,
      cta,
      ctaPosition,
      ctaCopy,
      ...props
    },
    ref
  ) => {
    const { "aria-describedby": describedByFromProps, ...textareaProps } = props;
    const reactId = useId();
    const idBasePrefix =
      typeof idBase === "string" && idBase.trim() ? slugify(idBase) : "textarea";
    const derivedId = `${idBasePrefix}-${reactId}`;
    const textareaId = id || derivedId;
    const errorId = `${textareaId}-error`;
    const hintId = `${textareaId}-hint`;
    const describedByFromStatus = error ? errorId : hint ? hintId : undefined;
    const ariaDescribedBy = mergeSpaceSeparatedIds(
      describedByFromProps,
      describedByFromStatus
    );
    const devTestId = import.meta.env.DEV && testId ? testId : undefined;
    const state = disabled ? "disabled" : error ? "error" : "enable";
    const uiMarker =
      typeof dataUi === "string" && dataUi.trim() ? dataUi.trim() : undefined;

    const resolvedLabelPlacement =
      labelPlacement === "inline" ? "inline" : "stack";
    const shouldInlineLabel = !!label && resolvedLabelPlacement === "inline";

    const labelNode = label ? (
      <label
        htmlFor={textareaId}
        className={cx("input_label", shouldInlineLabel && "whitespace-nowrap")}
        data-ui={uiMarker ? `${uiMarker}-label` : undefined}
      >
        {label}
      </label>
    ) : null;

    const fieldNode = (
      <div
        className={cx("input_field", "items-start py-2.5", fieldClassName)}
        data-icon="without"
        data-state={state}
        data-testid={devTestId}
        data-cta={cta}
        data-cta-position={ctaPosition}
        data-cta-copy={ctaCopy}
      >
        <textarea
          {...textareaProps}
          ref={ref}
          id={textareaId}
          name={name}
          rows={rows}
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={ariaDescribedBy}
          data-ui={uiMarker ? `${uiMarker}-input` : undefined}
          className={cx("textarea_native", textareaClassName)}
        />
      </div>
    );

    return (
      <div
        className={cx("input_warp", className)}
        data-style="input"
        data-ui={uiMarker}
      >
        {shouldInlineLabel ? (
          <div className="flex items-start gap-2">
            {labelNode}
            {fieldNode}
          </div>
        ) : (
          <>
            {labelNode}
            {fieldNode}
          </>
        )}

        {error ? (
          <div id={errorId} className="input_error">
            {error}
          </div>
        ) : null}
        {!error && hint ? (
          <div id={hintId} className="input_hint">
            {hint}
          </div>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export default Textarea;
