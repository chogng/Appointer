import { forwardRef } from "react";

const cx = (...parts) => parts.filter(Boolean).join(" ");

/**
 * Button (UI)
 * - Matches `docs/button_component_spec.md` (`action-btn*` classes in `src/styles/global.css`)
 * - Defaults `type="button"` to avoid accidental submits
 */
const Button = forwardRef(
  (
    {
      children,
      type = "button",
      variant = "primary", // primary | secondary | ghost | text | danger | dark (outline/premium aliases supported)
      size = "md", // sm | md | lg | control
      fullWidth = false,
      className = "",
      disabled = false,
      fx = false,
      fxMuted = false,
      withScale = false, // legacy alias -> `fx`
      dataUi,
      testId,
      dataStyle,
      dataIcon,
      cta,
      ctaPosition,
      ctaCopy,
      ...props
    },
    ref,
  ) => {
    const isDisabled = !!disabled;
    const uiMarker =
      typeof dataUi === "string" && dataUi.trim() ? dataUi.trim() : undefined;
    const devTestId = import.meta.env.DEV && testId ? testId : undefined;
    const styleMarker =
      typeof dataStyle === "string" && dataStyle.trim()
        ? dataStyle.trim()
        : undefined;

    const resolvedVariant = (() => {
      if (isDisabled) return "disabled";
      if (variant === "outline") return "ghost";
      if (variant === "ghost") return "ghost";
      if (variant === "premium") return "primary";
      return variant;
    })();

    const variantClass = (() => {
      if (resolvedVariant === "disabled") return "action-btn--disabled";
      if (resolvedVariant === "secondary") return "action-btn--secondary";
      if (resolvedVariant === "ghost") return "action-btn--ghost";
      if (resolvedVariant === "text") return "action-btn--text";
      if (resolvedVariant === "danger") return "action-btn--danger";
      if (resolvedVariant === "dark") return "action-btn--claude-shadow";
      return "action-btn--primary";
    })();

    const sizeClass = (() => {
      if (size === "sm") return "action-btn--sm";
      if (size === "lg") return "action-btn--lg";
      if (size === "control") return "action-btn--control";
      return "action-btn--md";
    })();

    const shouldFx =
      (fx || withScale) && !isDisabled && resolvedVariant !== "dark";
    const shouldFxMuted =
      fxMuted &&
      shouldFx &&
      resolvedVariant !== "primary" &&
      resolvedVariant !== "danger";

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        data-style={styleMarker}
        data-icon={dataIcon}
        data-ui={uiMarker}
        data-testid={devTestId}
        data-cta={cta}
        data-cta-position={ctaPosition}
        data-cta-copy={ctaCopy}
        className={cx(
          "action-btn",
          sizeClass,
          variantClass,
          shouldFx && "action-btn--fx",
          shouldFxMuted && "action-btn--fx-muted",
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        <span className="action-btn__content">{children}</span>
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
