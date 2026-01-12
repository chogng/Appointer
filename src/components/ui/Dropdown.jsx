import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import Popup from "./Popup";

const cx = (...parts) => parts.filter(Boolean).join(" ");

const DropdownIcon = ({ className }) => (
  <img
    src="/dropdown.svg"
    alt=""
    className={cx("ui-dropdown_icon", className)}
  />
);

const isSelectableOption = (opt) =>
  opt && Object.prototype.hasOwnProperty.call(opt, "value");

const Dropdown = ({
  options = [], // [{ label, value, icon?, group? }]
  value,
  onChange,
  placeholder,
  title,
  disabled = false,
  size = "md", // "sm" | "md"
  className = "",
  formatDisplay,
  align = "left",
  zIndex = 20,
  id,
  popupClassName = "min-w-full",
  triggerClassName = "",
  dataUi,
  testId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);

  const internalTriggerId = useId();
  const internalMenuId = useId();
  const triggerId = id || `dropdown-${internalTriggerId}`;
  const menuId = `dropdown-menu-${internalMenuId}`;
  const uiMarker =
    typeof dataUi === "string" && dataUi.trim() ? dataUi.trim() : undefined;
  const devTestId = import.meta.env.DEV && testId ? testId : undefined;
  const sizeClass =
    size === "sm" ? "ui-dropdown_trigger--sm" : "ui-dropdown_trigger--md";
  const textSizeClass =
    size === "sm" ? "ui-dropdown_text--sm" : "ui-dropdown_text--md";

  const selectableOptions = useMemo(
    () => (Array.isArray(options) ? options.filter(isSelectableOption) : []),
    [options],
  );

  const selected = useMemo(
    () => selectableOptions.find((opt) => opt.value === value) ?? null,
    [selectableOptions, value],
  );

  const displayText = useMemo(() => {
    if (typeof formatDisplay === "function") {
      const formatted = formatDisplay(selected);
      if (formatted !== undefined && formatted !== null)
        return String(formatted);
    }
    if (selected?.label !== undefined && selected?.label !== null) {
      return String(selected.label);
    }
    if (placeholder !== undefined && placeholder !== null)
      return String(placeholder);
    if (value !== undefined && value !== null) return String(value);
    return "";
  }, [formatDisplay, placeholder, selected, value]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const opt of selectableOptions) {
      const group = opt?.group ? String(opt.group) : "";
      if (!map.has(group)) map.set(group, []);
      map.get(group).push(opt);
    }
    const groups = Array.from(map.keys());
    return { map, groups };
  }, [selectableOptions]);

  const flatOptions = useMemo(() => {
    const flat = [];
    for (const group of grouped.groups) {
      for (const opt of grouped.map.get(group) ?? []) {
        flat.push(opt);
      }
    }
    return flat;
  }, [grouped]);

  const indexedGroups = useMemo(() => {
    let nextIndex = 0;
    return grouped.groups.map((group) => ({
      group,
      options: (grouped.map.get(group) ?? []).map((opt) => ({
        option: opt,
        index: nextIndex++,
      })),
    }));
  }, [grouped]);

  const openMenu = () => {
    if (disabled) return;
    setIsOpen(true);
    const selectedIdx = selected
      ? flatOptions.findIndex((opt) => opt.value === selected.value)
      : -1;
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
  };

  const closeMenu = () => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const selectOption = (opt) => {
    if (!opt) return;
    onChange?.(opt.value);
    closeMenu();
  };

  const handleTriggerClick = () => {
    if (disabled) return;
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        const selectedIdx = selected
          ? flatOptions.findIndex((opt) => opt.value === selected.value)
          : -1;
        setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
      } else {
        setHighlightedIndex(-1);
      }
      return next;
    });
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        flatOptions.length
          ? (prev + 1 + flatOptions.length) % flatOptions.length
          : -1,
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        flatOptions.length
          ? (prev - 1 + flatOptions.length) % flatOptions.length
          : -1,
      );
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const opt = flatOptions[highlightedIndex];
      if (opt) selectOption(opt);
    }
  };

  // Keep highlight in-range if options change while open.
  useEffect(() => {
    if (!isOpen) return;
    if (!flatOptions.length) {
      setHighlightedIndex(-1);
      return;
    }
    setHighlightedIndex((prev) =>
      prev < 0 ? 0 : Math.min(prev, flatOptions.length - 1),
    );
  }, [flatOptions.length, isOpen]);

  return (
    <div
      ref={containerRef}
      className={cx("ui-dropdown_warp", className)}
      data-style="dropdown"
      data-disabled={disabled || undefined}
      data-ui={uiMarker}
    >
      <button
        id={triggerId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        disabled={disabled}
        data-state={isOpen ? "open" : "closed"}
        data-size={size}
        data-ui={uiMarker ? `${uiMarker}-trigger` : undefined}
        data-testid={devTestId}
        onClick={handleTriggerClick}
        onKeyDown={handleKeyDown}
        className={cx("ui-dropdown_trigger", sizeClass, triggerClassName)}
      >
        <span className={cx("ui-dropdown_text", textSizeClass)}>
          {displayText}
        </span>
        <DropdownIcon
          className={isOpen ? "rotate-180" : ""}
        />
      </button>

      <Popup
        isOpen={isOpen}
        onClose={closeMenu}
        align={align}
        zIndex={zIndex}
        triggerId={triggerId}
        menuId={menuId}
        menuDataUi={uiMarker ? `${uiMarker}-menu` : undefined}
        containerRef={containerRef}
        className={popupClassName}
      >
        {() => (
          <>
            {title ? (
              <div className="ui-dropdown_title">{title}</div>
            ) : null}

            <div className="ui-dropdown_list">
              {indexedGroups.map(({ group, options }, groupIdx) => (
                <div key={group || "default"} role={group ? "group" : undefined}>
                  {group ? (
                    <>
                      {groupIdx > 0 ? (
                        <div
                          role="separator"
                          aria-orientation="horizontal"
                          className="ui-dropdown_separator"
                        />
                      ) : null}
                      <div className="ui-dropdown_group">{group}</div>
                    </>
                  ) : null}

                  {options.map(({ option, index: currentIndex }) => {
                    const isHighlighted = highlightedIndex === currentIndex;
                    const isSelected = value === option.value;
                    const Icon = option.icon;

                    return (
                      <button
                        key={String(option.value)}
                        type="button"
                        role="menuitem"
                        tabIndex={-1}
                        data-highlighted={isHighlighted || undefined}
                        data-selected={isSelected || undefined}
                        data-value={String(option.value)}
                        data-ui={uiMarker ? `${uiMarker}-item` : undefined}
                        onClick={() => selectOption(option)}
                        onMouseEnter={() => setHighlightedIndex(currentIndex)}
                        className="ui-dropdown_item"
                      >
                        <span className="ui-dropdown_item-left">
                          {Icon ? (
                            <Icon
                              style={{ width: "0.9rem", height: "0.9rem" }}
                            />
                          ) : null}
                          <span className="truncate">
                            {option.label ?? String(option.value)}
                          </span>
                        </span>
                        {isSelected ? (
                          <Check
                            style={{ width: "0.9rem", height: "0.9rem" }}
                            className="text-accent"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}

              {flatOptions.length === 0 ? (
                <div className="ui-dropdown_empty">No options</div>
              ) : null}
            </div>
          </>
        )}
      </Popup>
    </div>
  );
};

export default Dropdown;
