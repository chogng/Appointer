import { forwardRef, useId } from "react";

const cx = (...parts) => parts.filter(Boolean).join(" ");

/**
 * Textarea (UI)
 * - Controlled: value + onChange(nextValue)
 * - Stable markers: data-style/data-state
 * - Optional DEV-only data-testid (align with Input/ToggleButton)
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
    const reactId = useId();
    const derivedId = `${idBase || "textarea"}-${reactId}`;
    const textareaId = id || derivedId;
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
        className={cx("ui-input_label", shouldInlineLabel && "whitespace-nowrap")}
        data-ui={uiMarker ? `${uiMarker}-label` : undefined}
      >
        {label}
      </label>
    ) : null;

    const fieldNode = (
      <div
        className={cx("ui-input_field", "items-start py-2.5")}
        data-state={state}
        data-icon="without"
        data-testid={devTestId}
        data-cta={cta}
        data-cta-position={ctaPosition}
        data-cta-copy={ctaCopy}
      >
        <textarea
          ref={ref}
          id={textareaId}
          name={name}
          rows={rows}
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!!error}
          data-ui={uiMarker ? `${uiMarker}-input` : undefined}
          className={cx("ui-textarea_native", textareaClassName)}
          {...props}
        />
      </div>
    );

    return (
      <div
        className={cx("ui-input_warp", className)}
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

        {error ? <div className="ui-input_error">{error}</div> : null}
        {!error && hint ? <div className="ui-input_hint">{hint}</div> : null}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export default Textarea;
