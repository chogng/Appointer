import React, { useState, useRef, useEffect } from "react";
import { format, parseISO, isValid } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import MiniCalendar from "../MiniCalendar";
import { useLanguage } from "../../hooks/useLanguage";
import { normalizeCtaName, normalizeCtaToken } from "../../utils/cta";

const cx = (...parts) => parts.filter(Boolean).join(" ");

const DatePicker = ({
  value,
  onChange,
  placeholder = "Select date",
  className = "",
  buttonClassName = "",
  textClassName = "",
  dataUi,
  cta,
  ctaPosition,
  ctaCopy,
  align = "left",
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const { language } = useLanguage();
  const locale = language === "zh" ? zhCN : enUS;

  const dateValue = value ? parseISO(value) : null;
  const isValidDate = dateValue && isValid(dateValue);
  const uiMarker =
    typeof dataUi === "string" && dataUi.trim() ? dataUi.trim() : undefined;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDateSelect = (date) => {
    onChange(format(date, "yyyy-MM-dd"));
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  const handleToday = () => {
    onChange(format(new Date(), "yyyy-MM-dd"));
    setIsOpen(false);
  };

  return (
    <div
      className={`relative ${className}`}
      ref={containerRef}
      data-ui={uiMarker}
    >
      {(() => {
        const ariaLabel = props?.["aria-label"];
        const derivedCta =
          ariaLabel === "start date" || ariaLabel === "end date"
            ? {
                cta: "Literature research",
                ctaPosition: "date filter warp",
                ctaCopy: ariaLabel,
              }
            : null;

        return (
          <div
            data-ui={uiMarker ? `${uiMarker}-btn` : undefined}
            data-style="date"
            data-icon="with"
            data-state={isOpen ? "open" : "closed"}
            data-cta={normalizeCtaName(cta ?? derivedCta?.cta)}
            data-cta-position={normalizeCtaToken(
              ctaPosition ?? derivedCta?.ctaPosition
            )}
            data-cta-copy={normalizeCtaToken(ctaCopy ?? derivedCta?.ctaCopy)}
            className={cx(
              "date_btn",
              isOpen ? "date_btn--open" : "date_btn--closed",
              buttonClassName
            )}
            onClick={() => setIsOpen(!isOpen)}
            role="button"
            tabIndex={0}
            {...props}
          >
            <div
              className={cx(
                "date_btn_text",
                isValidDate
                  ? "date_btn_text--value"
                  : "date_btn_text--placeholder",
                textClassName
              )}
            >
              {isValidDate
                ? format(dateValue, "yyyy-MM-dd", { locale })
                : placeholder}
            </div>
            <div className="date_btn_icon">
              <CalendarIcon size={16} />
            </div>
          </div>
        );
      })()}

      {isOpen && (
        <div
          className={`
                        absolute top-full ${
                          align === "right" ? "right-0" : "left-0"
                        } mt-2 z-50 
                        bg-white/90 backdrop-blur-xl border border-white/40 shadow-2xl rounded-2xl overflow-hidden 
                        min-w-[320px] animate-in fade-in zoom-in-95 duration-200 ring-1 ring-black/5
                    `}
        >
          <div className="relative z-10">
            <MiniCalendar
              selectedDate={dateValue || new Date()}
              onDateSelect={handleDateSelect}
              className="p-4"
            />
            <div className="flex items-center justify-between px-6 pb-4 pt-2">
              <button
                onClick={handleClear}
                className="text-xs text-text-tertiary hover:text-red-500 transition-colors px-2 py-1 rounded-md hover:bg-red-50"
              >
                {language === "zh" ? "清除" : "Clear"}
              </button>
              <button
                onClick={handleToday}
                className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors px-2 py-1 rounded-md hover:bg-accent/10"
              >
                {language === "zh" ? "今天" : "Today"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
