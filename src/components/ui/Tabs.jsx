import React, { useEffect, useId, useMemo, useRef, useState } from "react";

const cx = (...parts) => parts.filter(Boolean).join(" ");

const Tabs = ({
    options = [], // [{ value, label, icon?, ariaLabel?, testId?, id?, panelId? }]
    value,
    onChange,
    className = "",
    itemClassName = "",
    keyboardActivation = "auto", // "auto" | "manual"
    hoverPreview = true, // visual only: highlight on hover without changing selection
    groupLabel,
    dataUi,
    dta, // { page?, slot?, comp? } -> emits data-dta-* markers for automation/analytics
    testId,
    idBase,
    panelIdBase,
    panelIdMode = "scoped", // "scoped" | "short"
    renderPanel, // (option, { index, isSelected }) => ReactNode
    keepMounted = false, // keep inactive panels mounted (hidden) after first visit
    size = "md", // "sm" | "md"
    ...props
}) => {
    const safeOptions = useMemo(
        () => (Array.isArray(options) ? options : []),
        [options],
    );
    const reactId = useId();
    const slugify = (input) =>
        String(input ?? "")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9_-]+/g, "-")
            .replace(/^-+|-+$/g, "");

    const dtaPage =
        typeof dta?.page === "string" && dta.page.trim() ? dta.page.trim() : undefined;
    const dtaSlot =
        typeof dta?.slot === "string" && dta.slot.trim() ? dta.slot.trim() : undefined;
    const dtaComp =
        typeof dta?.comp === "string" && dta.comp.trim() ? dta.comp.trim() : undefined;
    const dtaKey = [dtaPage, dtaSlot, dtaComp].filter(Boolean).join(".");
    const dtaMarker = dtaKey ? dtaKey : undefined;

    // Prefer stable, semantic IDs (provided by caller), fallback to React-generated IDs.
    const hasExplicitIdBase = typeof idBase === "string" && idBase.trim();
    const instanceId = (() => {
        if (hasExplicitIdBase) return slugify(idBase);
        return `tabs-${reactId}`;
    })();

    // Allow overriding panel prefix, otherwise follow the recommended "{idBase}-panel-*" convention.
    const panelPrefix =
        typeof panelIdBase === "string" && panelIdBase.trim()
            ? panelIdBase.trim()
            : `${instanceId}-panel`;
    const shortPanelPrefix =
        typeof panelIdBase === "string" && panelIdBase.trim()
            ? slugify(panelIdBase)
            : "";
    const buttonRefs = useRef([]);
    const [hoveredValue, setHoveredValue] = useState(null);
    const uiMarker =
        typeof dataUi === "string" && dataUi.trim() ? dataUi.trim() : undefined;
    const devTestId = import.meta.env.DEV && testId ? testId : undefined;

    const sizeClass = size === "sm" ? "tab_btn--sm" : "tab_btn--md";
    const resolvedHoverPreview = !!hoverPreview;

    const normalizedOptions = useMemo(() => {
        const seenValues = new Set();
        const usedTokens = new Set();
        const out = safeOptions.map((option, index) => {
            const optionValue = option?.value;
            const baseTokenRaw =
                optionValue !== undefined
                    ? optionValue
                    : option?.label != null
                        ? option.label
                        : `item-${index}`;

            let token = slugify(baseTokenRaw);
            if (!token) token = `item-${index}`;

            // Ensure DOM id uniqueness even if value/label repeats.
            if (usedTokens.has(token)) token = `${token}-${index}`;
            usedTokens.add(token);

            const tabId = option?.id ?? `${instanceId}-tab-${token}`;
            const panelId =
                panelIdMode === "short"
                    ? option?.panelId ??
                      (shortPanelPrefix ? `${shortPanelPrefix}-${token}` : token)
                    : option?.panelId ?? `${panelPrefix}-${token}`;
            const key = tabId;

            if (import.meta.env.DEV) {
                if (optionValue === undefined) {
                    console.warn(
                        "[Tabs] option.value is undefined; this tab cannot be selected reliably.",
                        option,
                    );
                } else if (seenValues.has(optionValue)) {
                    console.warn(
                        "[Tabs] duplicate option.value detected; selection/keepMounted may be ambiguous.",
                        optionValue,
                        safeOptions,
                    );
                }

                if (hasExplicitIdBase && option?.panelId) {
                    console.warn(
                        "[Tabs] option.panelId overrides the derived panel id; prefer panelIdBase/panelIdMode for consistency.",
                        { idBase, option },
                    );
                }
            }

            if (optionValue !== undefined) seenValues.add(optionValue);

            return {
                ...option,
                __index: index,
                __key: key,
                __tabId: tabId,
                __panelId: panelId,
                __token: token,
            };
        });

        return out;
    }, [
        safeOptions,
        instanceId,
        panelPrefix,
        shortPanelPrefix,
        hasExplicitIdBase,
        idBase,
        panelIdMode,
    ]);

    const selectedIndex = useMemo(
        () => normalizedOptions.findIndex((o) => o?.value === value),
        [normalizedOptions, value],
    );
    const hasSelectedValue = selectedIndex >= 0;

    // Keep a record of mounted panels so we can "keep-alive" after first visit.
    const [mountedValues, setMountedValues] = useState(() => {
        const next = new Set();
        if (value !== undefined) next.add(value);
        return next;
    });

    useEffect(() => {
        if (!keepMounted || typeof renderPanel !== "function") return;
        if (value === undefined) return;
        // Keep-alive cache needs to track programmatic value changes too.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMountedValues((prev) => {
            if (prev.has(value)) return prev;
            const next = new Set(prev);
            next.add(value);
            return next;
        });
    }, [keepMounted, renderPanel, value]);

    const noteMounted = (nextValue) => {
        if (!keepMounted || typeof renderPanel !== "function") return;
        setMountedValues((prev) => {
            const next = new Set(prev);
            if (value !== undefined) next.add(value);
            if (nextValue !== undefined) next.add(nextValue);
            return next.size === prev.size ? prev : next;
        });
    };

    const focusAtIndex = (idx) => {
        const el = buttonRefs.current?.[idx];
        if (el && typeof el.focus === "function") el.focus();
    };

    const moveSelection = (currentIndex, dir) => {
        const len = normalizedOptions.length;
        if (len <= 0) return;
        const nextIndex = (currentIndex + dir + len) % len;
        focusAtIndex(nextIndex);

        // Tabs can be "automatic" (arrow keys activate) or "manual" (arrow keys only move focus).
        const shouldActivate = keyboardActivation !== "manual";
        if (!shouldActivate) return;

        const nextValue = normalizedOptions[nextIndex]?.value;
        if (nextValue !== undefined) {
            noteMounted(nextValue);
            onChange?.(nextValue);
            setHoveredValue(null);
        }
    };

    const menu = (
        <div
            data-tabs="menu"
            data-dta={dtaMarker}
            data-dta-page={dtaPage}
            data-dta-slot={dtaSlot}
            data-dta-comp={dtaComp}
            data-ui={uiMarker}
            data-testid={devTestId}
            className={cx("tab_menu", className)}
            role="tablist"
            aria-label={groupLabel}
            {...props}
        >
            {normalizedOptions.map((option, index) => {
                const Icon = option.icon;
                const isSelected = value === option.value;
                const resolvedVisualValue =
                    resolvedHoverPreview && hoveredValue != null ? hoveredValue : value;
                const isVisuallyActive = resolvedVisualValue === option.value;
                const ariaLabel = option?.ariaLabel;
                const testId =
                    import.meta.env.DEV && option?.testId ? option.testId : undefined;
                const tabId = option.__tabId;
                const panelId = option.__panelId;
                const token = option.__token;

                const tabIndex = isSelected || (!hasSelectedValue && index === 0) ? 0 : -1;

                return (
                    <button
                        key={option.__key}
                        data-icon={Icon ? "with" : "without"}
                        data-tabs="tab"
                        data-value={token}
                        data-ui={uiMarker ? `${uiMarker}-tab-${token}` : undefined}
                        data-cta={option?.cta}
                        data-cta-position={option?.ctaPosition}
                        data-cta-copy={option?.ctaCopy}
                        data-testid={testId}
                        type="button"
                        onClick={() => {
                            const nextValue = option.value;
                            if (nextValue === undefined) return;
                            noteMounted(nextValue);
                            onChange?.(nextValue);
                            setHoveredValue(null);
                        }}
                        onMouseEnter={() => {
                            if (resolvedHoverPreview) setHoveredValue(option.value);
                        }}
                        onMouseLeave={() => {
                            if (resolvedHoverPreview) setHoveredValue(null);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "ArrowLeft") {
                                e.preventDefault();
                                moveSelection(index, -1);
                            } else if (e.key === "ArrowRight") {
                                e.preventDefault();
                                moveSelection(index, 1);
                            } else if (e.key === "Home") {
                                e.preventDefault();
                                focusAtIndex(0);
                                const shouldActivate = keyboardActivation !== "manual";
                                if (!shouldActivate) return;
                                const firstValue = normalizedOptions[0]?.value;
                                if (firstValue !== undefined) {
                                    noteMounted(firstValue);
                                    onChange?.(firstValue);
                                    setHoveredValue(null);
                                }
                            } else if (e.key === "End") {
                                e.preventDefault();
                                const lastIndex = normalizedOptions.length - 1;
                                focusAtIndex(lastIndex);
                                const shouldActivate = keyboardActivation !== "manual";
                                if (!shouldActivate) return;
                                const lastValue = normalizedOptions[lastIndex]?.value;
                                if (lastValue !== undefined) {
                                    noteMounted(lastValue);
                                    onChange?.(lastValue);
                                    setHoveredValue(null);
                                }
                            } else if (keyboardActivation === "manual") {
                                // Manual activation: Enter/Space selects the focused tab.
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    const nextValue = normalizedOptions[index]?.value;
                                    if (nextValue !== undefined) {
                                        noteMounted(nextValue);
                                        onChange?.(nextValue);
                                        setHoveredValue(null);
                                    }
                                }
                            }
                        }}
                        role="tab"
                        id={tabId}
                        aria-label={ariaLabel}
                        aria-selected={isSelected}
                        aria-controls={panelId}
                        tabIndex={tabIndex}
                        ref={(el) => {
                            buttonRefs.current[index] = el;
                        }}
                        className={cx(
                            "tab_btn",
                            sizeClass,
                            isVisuallyActive ? "tab_btn--active" : "tab_btn--inactive",
                            itemClassName,
                        )}
                    >
                        {Icon && (
                            <span className="tab_btn_icon">
                                <Icon size={16} />
                            </span>
                        )}
                        <span className="tab_btn_text">{option.label}</span>
                    </button>
                );
            })}
        </div>
    );

    if (normalizedOptions.length === 0) return null;

    if (typeof renderPanel !== "function") return menu;

    return (
        <div className="w-full">
            {menu}
            <div className="w-full">
                {normalizedOptions.map((option, index) => {
                    const tabId = option.__tabId;
                    const panelId = option.__panelId;
                    const token = option.__token;

                    const isSelected = value === option.value;
                    const shouldRender = keepMounted
                        ? isSelected || mountedValues.has(option.value)
                        : isSelected;
                    if (!shouldRender) return null;

                    return (
                        <div
                            key={`${option.__key}-panel`}
                            role="tabpanel"
                            id={panelId}
                            aria-labelledby={tabId}
                            hidden={!isSelected}
                            tabIndex={0}
                            data-tabs="panel"
                            data-value={token}
                            data-ui={uiMarker ? `${uiMarker}-panel-${token}` : undefined}
                        >
                            {renderPanel(option, { index, isSelected })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Tabs;
