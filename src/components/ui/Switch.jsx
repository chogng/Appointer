import React from "react";

const Switch = ({
  checked,
  onChange,
  disabled = false,
  className = "",
  activeColor,
  ariaLabel = "Toggle",
  dataUi,
  testId,
}) => {
  const uiMarker =
    typeof dataUi === "string" && dataUi.trim() ? dataUi.trim() : undefined;
  const devTestId = import.meta.env.DEV && testId ? testId : undefined;
  const state = checked ? "on" : "off";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      data-style="switch"
      data-state={state}
      data-disabled={disabled || undefined}
      data-ui={uiMarker}
      data-testid={devTestId}
      style={{
        ...(checked && activeColor
          ? { backgroundColor: activeColor, borderColor: activeColor }
          : {}),
        ...(!checked ? { backgroundColor: "#FDFDF7" } : {}),
      }}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30
        ${checked ? (!activeColor ? "bg-indigo-500" : "") : ""}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${className}
      `}
    >
      <span className="sr-only">{ariaLabel}</span>
      <span
        aria-hidden="true"
        className={`
          pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 block h-5 w-5 transform rounded-full bg-bg-surface shadow ring-0 
          transition duration-200 ease-in-out
          ${checked ? "translate-x-5" : "translate-x-0.5"}
        `}
      />
    </button>
  );
};

export default Switch;
