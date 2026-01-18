import { forwardRef, useId } from "react";

const cx = (...parts) => parts.filter(Boolean).join(" ");

/**
 * Input (UI)
 * - Controlled: value + onChange(nextValue)
 * - Stable markers: data-style/data-state
 * - Optional DEV-only data-testid (align with Tabs)
 */
const Input = forwardRef(
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
      type = "text",
      autoComplete,
      size = "md", // "sm" | "md" | "lg"
      className = "",
      inputClassName = "",
      error,
      hint,
      leftIcon: LeftIcon,
      rightSlot,
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
    const derivedId = `${idBase || "input"}-${reactId}`;
    const inputId = id || derivedId;
    const devTestId = import.meta.env.DEV && testId ? testId : undefined;
    const state = disabled ? "disabled" : error ? "error" : "enable";
    const sizeClass =
      size === "sm"
        ? "ui-input_field--sm"
        : size === "lg"
          ? "ui-input_field--lg"
          : "ui-input_field--md";
    const uiMarker =
      typeof dataUi === "string" && dataUi.trim() ? dataUi.trim() : undefined;
    const resolvedLabelPlacement =
      labelPlacement === "inline" ? "inline" : "stack";
    const shouldInlineLabel = !!label && resolvedLabelPlacement === "inline";
    const labelNode = label ? (
      <label
        htmlFor={inputId}
        className={cx("ui-input_label", shouldInlineLabel && "whitespace-nowrap")}
        data-ui={uiMarker ? `${uiMarker}-label` : undefined}
      >
        {label}
      </label>
    ) : null;

    return (
      <div
        className={cx("ui-input_warp", className)}
        data-style="input"
        data-ui={uiMarker}
      >
        {shouldInlineLabel ? (
          <div className="flex items-center gap-2">
            {labelNode}
            <div
              className={cx("ui-input_field", sizeClass)}
              data-state={state}
              data-icon={LeftIcon ? "with" : "without"}
              data-testid={devTestId}
              data-cta={cta}
              data-cta-position={ctaPosition}
              data-cta-copy={ctaCopy}
            >
              {LeftIcon ? (
                <span className="ui-input_icon" aria-hidden="true">
                  <LeftIcon size={16} />
                </span>
              ) : null}

              <input
                ref={ref}
                id={inputId}
                name={name}
                type={type}
                value={value ?? ""}
                onChange={(e) => onChange?.(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete={autoComplete}
                aria-invalid={!!error}
                data-ui={uiMarker ? `${uiMarker}-input` : undefined}
                className={cx("ui-input_native", inputClassName)}
                {...props}
              />

              {rightSlot ? (
                <div className="ui-input_right">{rightSlot}</div>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            {labelNode}
            <div
              className={cx("ui-input_field", sizeClass)}
              data-state={state}
              data-icon={LeftIcon ? "with" : "without"}
              data-testid={devTestId}
              data-cta={cta}
              data-cta-position={ctaPosition}
              data-cta-copy={ctaCopy}
            >
              {LeftIcon ? (
                <span className="ui-input_icon" aria-hidden="true">
                  <LeftIcon size={16} />
                </span>
              ) : null}

              <input
                ref={ref}
                id={inputId}
                name={name}
                type={type}
                value={value ?? ""}
                onChange={(e) => onChange?.(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete={autoComplete}
                aria-invalid={!!error}
                data-ui={uiMarker ? `${uiMarker}-input` : undefined}
                className={cx("ui-input_native", inputClassName)}
                {...props}
              />

              {rightSlot ? (
                <div className="ui-input_right">{rightSlot}</div>
              ) : null}
            </div>
          </>
        )}

        {error ? <div className="ui-input_error">{error}</div> : null}
        {!error && hint ? <div className="ui-input_hint">{hint}</div> : null}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
