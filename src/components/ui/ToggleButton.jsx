import React, { useId, useRef, useState } from "react";

const cx = (...parts) => parts.filter(Boolean).join(" ");

const ToggleButton = ({
    options = [],
    value,
    onChange,
    className = "",
    itemClassName = "",
    a11yVariant = "radio", // "radio" | "tabs"
    groupLabel,
    idBase,
    size = "md", // "sm" | "md"
}) => {
    const [hoverMode, setHoverMode] = useState(null);
    const reactId = useId();
    const baseId = idBase || `toggle-${reactId}`;
    const buttonRefs = useRef([]);

    const isTabs = a11yVariant === "tabs";
    const containerRole = isTabs ? "tablist" : "radiogroup";
    const sizeClass = size === "sm" ? "toggle_btn--sm" : "toggle_btn--md";

    const focusAtIndex = (idx) => {
        const el = buttonRefs.current?.[idx];
        if (el && typeof el.focus === "function") el.focus();
    };

    const moveSelection = (currentIndex, dir) => {
        const len = options.length;
        if (len <= 0) return;
        const nextIndex = (currentIndex + dir + len) % len;
        const nextValue = options[nextIndex]?.value;
        if (nextValue !== undefined) {
            onChange?.(nextValue);
            focusAtIndex(nextIndex);
        }
    };

    return (
        <div
            data-toggle="menu"
            className={cx("toggle_menu", className)}
            role={containerRole}
            aria-label={groupLabel}
        >
            {options.map((option) => {
                const Icon = option.icon;
                const isActive = (hoverMode || value) === option.value;
                const ariaLabel = option?.ariaLabel;
                const testId =
                    import.meta.env.DEV && option?.testId ? option.testId : undefined;
                const role = isTabs ? "tab" : "radio";
                const id =
                    option?.id ??
                    `${baseId}-${String(option?.value ?? option?.label ?? "")}`
                        .toLowerCase()
                        .replace(/[^a-z0-9_-]+/g, "-")
                        .replace(/^-+|-+$/g, "");

                const tabIndex = isActive ? 0 : -1;

                return (
                    <button
                        key={option.value}
                        data-icon={Icon ? "with" : "without"}
                        data-tabs={isTabs ? "tab" : undefined}
                        data-cta={option?.cta}
                        data-cta-position={option?.ctaPosition}
                        data-cta-copy={option?.ctaCopy}
                        data-testid={testId}
                        type="button"
                        onClick={() => onChange && onChange(option.value)}
                        onMouseEnter={() => setHoverMode(option.value)}
                        onMouseLeave={() => setHoverMode(null)}
                        onKeyDown={(e) => {
                            if (e.key === "ArrowLeft") {
                                e.preventDefault();
                                moveSelection(
                                    options.findIndex((o) => o?.value === option.value),
                                    -1,
                                );
                            } else if (e.key === "ArrowRight") {
                                e.preventDefault();
                                moveSelection(
                                    options.findIndex((o) => o?.value === option.value),
                                    1,
                                );
                            } else if (e.key === "Home") {
                                e.preventDefault();
                                const firstValue = options[0]?.value;
                                if (firstValue !== undefined) {
                                    onChange?.(firstValue);
                                    focusAtIndex(0);
                                }
                            } else if (e.key === "End") {
                                e.preventDefault();
                                const lastIndex = options.length - 1;
                                const lastValue = options[lastIndex]?.value;
                                if (lastValue !== undefined) {
                                    onChange?.(lastValue);
                                    focusAtIndex(lastIndex);
                                }
                            }
                        }}
                        role={role}
                        id={id}
                        aria-label={ariaLabel}
                        aria-selected={isTabs ? isActive : undefined}
                        aria-checked={!isTabs ? isActive : undefined}
                        tabIndex={tabIndex}
                        ref={(el) => {
                            const idx = options.findIndex((o) => o?.value === option.value);
                            if (idx >= 0) buttonRefs.current[idx] = el;
                        }}
                        className={cx(
                            "toggle_btn",
                            sizeClass,
                            isActive ? "toggle_btn--active" : "toggle_btn--inactive",
                            itemClassName,
                        )}
                    >
                        {Icon && (
                            <span className="toggle_btn_icon">
                                <Icon size={16} />
                            </span>
                        )}
                        <span className="toggle_btn_text">{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default ToggleButton;
