import { forwardRef } from "react";

const cx = (...parts) => parts.filter(Boolean).join(" ");

/**
 * Button (UI)
 * - Matches `docs/button_component_spec.md` (`click_btn*` classes in `src/styles/global.css`)
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

    const resolvedVariant = (() => {
      if (isDisabled) return "disabled";
      if (variant === "outline") return "ghost";
      if (variant === "ghost") return "ghost";
      if (variant === "premium") return "primary";
      return variant;
    })();

    const variantClass = (() => {
      if (resolvedVariant === "disabled") return "click_btn--disabled";
      if (resolvedVariant === "secondary") return "click_btn--secondary";
      if (resolvedVariant === "ghost") return "click_btn--ghost";
      if (resolvedVariant === "text") return "click_btn--text";
      if (resolvedVariant === "danger") return "click_btn--danger";
      if (resolvedVariant === "dark") return "click_btn--claude-shadow";
      return "click_btn--primary";
    })();

    const sizeClass = (() => {
      if (size === "sm") return "click_btn--sm";
      if (size === "lg") return "click_btn--lg";
      if (size === "control") return "click_btn--control";
      return "click_btn--md";
    })();

    const shouldFx =
      (fx || withScale) && !isDisabled && resolvedVariant !== "dark";
    const shouldFxMuted =
      fxMuted &&
      shouldFx &&
      resolvedVariant !== "primary" &&
      resolvedVariant !== "danger";

    const computedDataStyle = (() => {
      if (isDisabled) return "disabled";
      if (resolvedVariant === "ghost" || resolvedVariant === "secondary")
        return "ghost";
      if (resolvedVariant === "primary") return "primary";
      return undefined;
    })();

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        data-style={dataStyle ?? computedDataStyle}
        data-icon={dataIcon}
        data-ui={uiMarker}
        data-testid={devTestId}
        data-cta={cta}
        data-cta-position={ctaPosition}
        data-cta-copy={ctaCopy}
        className={cx(
          "click_btn",
          sizeClass,
          variantClass,
          shouldFx && "click_btn--fx",
          shouldFxMuted && "click_btn--fx-muted",
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        <span className="click_btn_content">{children}</span>
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
