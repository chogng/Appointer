import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SegmentedControl = ({
  options,
  value,
  onChange,
  className = "",
  groupLabel,
  dataUi,
  testId,
  ...props
}) => {
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const containerRef = useRef(null);
  const buttonsRef = useRef([]);

  const uiMarker =
    typeof dataUi === "string" && dataUi.trim() ? dataUi.trim() : undefined;
  const devTestId = import.meta.env.DEV && testId ? testId : undefined;

  const selectedIndex = useMemo(
    () => options.findIndex((o) => o.value === value),
    [options, value],
  );
  const hasSelectedValue = selectedIndex >= 0;
  const activeIndex = hasSelectedValue ? selectedIndex : 0;

  const updateIndicator = useCallback(() => {
    const activeButton = buttonsRef.current[activeIndex];
    if (!activeButton) return;
    setIndicatorStyle({
      left: activeButton.offsetLeft,
      width: activeButton.offsetWidth,
    });
  }, [activeIndex]);

  useEffect(() => {
    updateIndicator();
  }, [options, updateIndicator]);

  useEffect(() => {
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [updateIndicator]);

  const focusAtIndex = (idx) => {
    const el = buttonsRef.current?.[idx];
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

  const hasExplicitAriaLabel = props?.["aria-label"] != null;
  const hasAriaLabel = hasExplicitAriaLabel || !!groupLabel || props?.["aria-labelledby"] != null;
  const role = hasAriaLabel ? "radiogroup" : undefined;
  const resolvedGroupLabel = hasExplicitAriaLabel ? undefined : groupLabel;

  return (
    <div
      ref={containerRef}
      role={role}
      aria-label={resolvedGroupLabel}
      data-style="segmented"
      data-ui={uiMarker}
      data-testid={devTestId}
      className={`
                relative flex p-1 bg-gray-100/50 hover:bg-gray-100 dark:bg-gray-800/50
                rounded-lg border border-transparent hover:border-border-subtle
                transition-all duration-200 ${className}
            `}
      {...props}
    >
      <div
        className="absolute top-1 bottom-1 bg-white dark:bg-gray-700 shadow-sm rounded-md border border-border-subtle transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]"
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
        }}
      />
      {options.map((option, index) => {
        const isSelected = value === option.value;
        const isFocusable = isSelected || (!hasSelectedValue && index === 0);
        return (
          <button
            key={option.value}
            ref={(el) => (buttonsRef.current[index] = el)}
            type="button"
            role={role ? "radio" : undefined}
            aria-checked={role ? isSelected : undefined}
            tabIndex={isFocusable ? 0 : -1}
            data-ui={uiMarker ? `${uiMarker}-item` : undefined}
            data-value={String(option.value)}
            data-selected={isSelected || undefined}
            onClick={() => onChange?.(option.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                moveSelection(index, -1);
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                moveSelection(index, 1);
              } else if (e.key === "Home") {
                e.preventDefault();
                if (options[0]?.value !== undefined) {
                  onChange?.(options[0].value);
                  focusAtIndex(0);
                }
              } else if (e.key === "End") {
                e.preventDefault();
                const lastIndex = options.length - 1;
                if (lastIndex >= 0 && options[lastIndex]?.value !== undefined) {
                  onChange?.(options[lastIndex].value);
                  focusAtIndex(lastIndex);
                }
              }
            }}
            className={`
                            relative flex-1 py-1.5 px-3 text-sm font-medium rounded-md
                            transition-colors duration-200 z-10
                            ${isSelected ? "text-text-primary" : "text-text-secondary hover:text-text-primary"}
                        `}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedControl;
