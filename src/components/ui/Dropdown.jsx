import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import Popup from "./Popup";

const DropdownIcon = ({ className }) => (
  <img
    src="/dropdown.svg"
    alt=""
    className={className}
    style={{ width: "0.75rem", height: "0.75rem" }}
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
  className = "",
  formatDisplay,
  align = "left",
  zIndex = 20,
  id,
  popupClassName = "min-w-full",
  triggerClassName = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);

  const internalTriggerId = useId();
  const internalMenuId = useId();
  const triggerId = id || `dropdown-${internalTriggerId}`;
  const menuId = `dropdown-menu-${internalMenuId}`;

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
      className={`relative ${className}`}
      data-disabled={disabled || undefined}
    >
      <button
        id={triggerId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        disabled={disabled}
        data-state={isOpen ? "open" : "closed"}
        onClick={handleTriggerClick}
        onKeyDown={handleKeyDown}
        className={`w-full h-10 flex items-center justify-between gap-2 px-3 rounded-lg border border-border bg-bg-page text-text-primary hover:bg-bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${triggerClassName}`}
      >
        <span className="text-left text-[0.875rem] font-medium whitespace-nowrap truncate">
          {displayText}
        </span>
        <DropdownIcon
          className={`opacity-80 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <Popup
        isOpen={isOpen}
        onClose={closeMenu}
        align={align}
        zIndex={zIndex}
        triggerId={triggerId}
        menuId={menuId}
        containerRef={containerRef}
        className={popupClassName}
      >
        {() => (
          <>
            {title ? (
              <div className="px-3 py-2 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                {title}
              </div>
            ) : null}

            <div className="flex flex-col gap-1 max-h-[15rem] overflow-y-auto pr-1 custom-scrollbar">
              {indexedGroups.map(({ group, options }, groupIdx) => (
                <div key={group || "default"} role={group ? "group" : undefined}>
                  {group ? (
                    <>
                      {groupIdx > 0 ? (
                        <div
                          role="separator"
                          aria-orientation="horizontal"
                          className="h-px bg-border my-1 mx-3"
                        />
                      ) : null}
                      <div className="px-3 py-1 text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
                        {group}
                      </div>
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
                        onClick={() => selectOption(option)}
                        onMouseEnter={() => setHighlightedIndex(currentIndex)}
                        className={`w-full px-3 py-2 text-sm text-left rounded-md transition-colors flex items-center justify-between ${
                          isSelected
                            ? "bg-bg-surface-hover text-text-primary font-medium"
                            : isHighlighted
                              ? "bg-bg-surface-hover/70 text-text-primary"
                              : "text-text-secondary hover:bg-bg-surface-hover/60 hover:text-text-primary"
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
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
                <div className="px-3 py-2 text-sm text-text-secondary">
                  No options
                </div>
              ) : null}
            </div>
          </>
        )}
      </Popup>
    </div>
  );
};

export default Dropdown;
