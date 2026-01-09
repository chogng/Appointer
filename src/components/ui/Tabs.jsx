import React, { useId, useMemo, useRef, useState } from "react";

const cx = (...parts) => parts.filter(Boolean).join(" ");

const sanitizeKey = (input) =>
    String(input ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");

const Tabs = ({
    options = [], // [{ value, label, icon?, ariaLabel?, testId?, id? }]
    value,
    onChange,
    className = "",
    itemClassName = "",
    groupLabel,
    idBase,
    size = "md", // "sm" | "md"
}) => {
    const [hoverValue, setHoverValue] = useState(null);
    const reactId = useId();
    const instanceId = idBase || `tabs-${reactId}`;
    const buttonRefs = useRef([]);

    const btnSizeClass = size === "sm" ? "ui-tabs__btn--sm" : "ui-tabs__btn--md";

    const normalizedOptions = useMemo(
        () =>
            options.map((option) => {
                const key = sanitizeKey(option?.value ?? option?.label ?? "");
                const tabId = option?.id ?? `tab-${instanceId}-${key}`;
                const panelId = `panel-${instanceId}-${key}`;
                return { ...option, __key: key, __tabId: tabId, __panelId: panelId };
            }),
        [options, instanceId],
    );

    const focusAtIndex = (idx) => {
        const el = buttonRefs.current?.[idx];
        if (el && typeof el.focus === "function") el.focus();
    };

    const moveSelection = (currentIndex, dir) => {
        const len = normalizedOptions.length;
        if (len <= 0) return;
        const nextIndex = (currentIndex + dir + len) % len;
        const nextValue = normalizedOptions[nextIndex]?.value;
        if (nextValue !== undefined) {
            onChange?.(nextValue);
            focusAtIndex(nextIndex);
        }
    };

    return (
        <div
            data-tabs="menu"
            className={`ui-tabs__menu ${className}`}
            role="tablist"
            aria-label={groupLabel}
        >
            {normalizedOptions.map((option, index) => {
                const Icon = option.icon;
                const isSelected = value === option.value;
                const isVisualActive = (hoverValue ?? value) === option.value;
                const ariaLabel = option?.ariaLabel;
                const testId =
                    import.meta.env.DEV && option?.testId ? option.testId : undefined;

                return (
                    <button
                        key={option.value}
                        data-icon={Icon ? "with" : "without"}
                        data-tabs="tab"
                        data-cta={option?.cta}
                        data-cta-position={option?.ctaPosition}
                        data-cta-copy={option?.ctaCopy}
                        data-testid={testId}
                        type="button"
                        role="tab"
                        id={option.__tabId}
                        className={cx(
                            "ui-tabs__btn",
                            btnSizeClass,
                            itemClassName,
                            isVisualActive ? "ui-tabs__btn--active" : "ui-tabs__btn--inactive",
                        )}
                        aria-label={ariaLabel}
                        aria-controls={option.__panelId}
                        aria-selected={isSelected}
                        tabIndex={isSelected ? 0 : -1}
                        onClick={() => onChange?.(option.value)}
                        onMouseEnter={() => setHoverValue(option.value)}
                        onMouseLeave={() => setHoverValue(null)}
                        onKeyDown={(e) => {
                            if (e.key === "ArrowLeft") {
                                e.preventDefault();
                                moveSelection(index, -1);
                            } else if (e.key === "ArrowRight") {
                                e.preventDefault();
                                moveSelection(index, 1);
                            } else if (e.key === "Home") {
                                e.preventDefault();
                                const firstValue = normalizedOptions[0]?.value;
                                if (firstValue !== undefined) {
                                    onChange?.(firstValue);
                                    focusAtIndex(0);
                                }
                            } else if (e.key === "End") {
                                e.preventDefault();
                                const lastIndex = normalizedOptions.length - 1;
                                const lastValue = normalizedOptions[lastIndex]?.value;
                                if (lastValue !== undefined) {
                                    onChange?.(lastValue);
                                    focusAtIndex(lastIndex);
                                }
                            }
                        }}
                        ref={(el) => {
                            buttonRefs.current[index] = el;
                        }}
                    >
                        {Icon && (
                            <span className="ui-tabs__btn-icon" aria-hidden="true">
                                <Icon size={16} />
                            </span>
                        )}
                        <span className="ui-tabs__btn-text">{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default Tabs;
