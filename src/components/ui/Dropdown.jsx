import { useState, useRef, useId } from "react";
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

const Dropdown = ({
  options, // [{ label, value, icon?, group? }]
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
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const triggerId = useId();
  const menuId = useId();

  const selected = options.find((opt) => opt.value === value);
  const formatted = formatDisplay ? formatDisplay(selected) : undefined;
  const displayText =
    formatted ?? selected?.label ?? placeholder ?? value ?? "";

  // 键盘导航
  const handleKeyDown = (e) => {
    if (
      !isOpen &&
      (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")
    ) {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex(0);
      return;
    }
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          onChange(options[highlightedIndex].value);
          setIsOpen(false);
        }
        break;
      case "Escape":
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  // 分组处理
  const groupedOptions = options.reduce((acc, opt) => {
    const group = opt.group || "";
    if (!acc[group]) acc[group] = [];
    acc[group].push(opt);
    return acc;
  }, {});
  const groups = Object.keys(groupedOptions);

  if (disabled) {
    return (
      <div
        className={`flex items-center gap-[0.375rem] text-[0.75rem] text-gray-600 ${className}`}
      >
        <span>{displayText}</span>
      </div>
    );
  }

  let optionIndex = -1;

  return (
    <div
      id={id}
      ref={containerRef}
      className={`relative min-w-0 ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Trigger Button */}
      <button
        id={triggerId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        data-state={isOpen ? "open" : "closed"}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className="w-full h-10 flex items-center justify-center gap-[0.5rem] px-[0.75rem] rounded-[0.75rem] border border-border-subtle bg-white/40 backdrop-blur-sm hover:bg-white/60 hover:border-green-300 text-gray-700 transition-all duration-300 shadow-sm"
      >
        <span className="text-left text-[0.875rem] font-medium text-gray-700 whitespace-nowrap">
          {displayText}
        </span>
        <DropdownIcon
          className={`opacity-80 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Menu */}
      <Popup
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        align={align}
        zIndex={zIndex}
        triggerId={triggerId}
        menuId={menuId}
        containerRef={containerRef}
        className={popupClassName}
      >
        {title && (
          <div className="px-[0.75rem] py-[0.5rem] mr-[0.5rem] text-[0.6875rem] font-bold text-gray-400 uppercase tracking-widest">
            {title}
          </div>
        )}
        <div className="flex flex-col gap-[0.125rem] max-h-[15rem] pr-[0.375rem] overflow-y-auto custom-scrollbar">
          {groups.map((group, groupIdx) => (
            <div key={group || "default"} role={group ? "group" : undefined}>
              {group && (
                <>
                  {groupIdx > 0 && (
                    <div
                      role="separator"
                      aria-orientation="horizontal"
                      className="h-px bg-gray-50/50 my-[0.375rem] mx-[0.75rem]"
                    />
                  )}
                  <div className="px-[0.75rem] py-[0.375rem] text-[0.625rem] font-bold text-gray-300 uppercase tracking-widest">
                    {group}
                  </div>
                </>
              )}
              {groupedOptions[group].map((option) => {
                optionIndex++;
                const currentIndex = optionIndex;
                const isHighlighted = highlightedIndex === currentIndex;
                const isSelected = value === option.value;

                return (
                  <button
                    key={option.value}
                    role="menuitem"
                    tabIndex={-1}
                    data-highlighted={isHighlighted || undefined}
                    data-selected={isSelected || undefined}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => setHighlightedIndex(currentIndex)}
                    className={`
                                            w-full px-[0.75rem] py-[0.5rem] text-[0.875rem] text-left rounded-[0.375rem]
                                            transition-all duration-200 flex items-center justify-between
                                            ${isSelected ? "bg-[#FAFDF7] text-green-700 font-medium" : "text-gray-600 hover:bg-[#FAFDF7]/50"}
                                            ${isHighlighted && !isSelected ? "bg-green-50/50 text-green-600" : ""}
                                        `}
                  >
                    <span className="flex items-center gap-[0.5rem]">
                      {option.icon && (
                        <option.icon
                          style={{ width: "0.875rem", height: "0.875rem" }}
                        />
                      )}
                      {option.label}
                    </span>
                    {isSelected && (
                      <Check
                        style={{ width: "0.875rem", height: "0.875rem" }}
                        className="text-green-600"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </Popup>
    </div>
  );
};

export default Dropdown;
