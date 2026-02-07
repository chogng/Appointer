import React, { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import Card from "./Card";
import Button from "./Button";

const cx = (...parts) => parts.filter(Boolean).join(" ");

const sanitizeIdPart = (value) =>
  String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");

const CollapsiblePanel = ({
  id,
  title,
  meta,
  defaultOpen = false,
  className = "",
  headerClassName = "",
  bodyClassName = "",
  children,
  cta,
  ctaPosition,
  ctaCopy,
  toggleCta,
  toggleCtaPosition,
  toggleCtaCopy,
}) => {
  const reactId = useId();
  const panelId = useMemo(() => {
    const base = sanitizeIdPart(id);
    if (base) return base;
    return `collapsible-${sanitizeIdPart(reactId) || "panel"}`;
  }, [id, reactId]);
  const contentId = `${panelId}-content`;

  const [isOpen, setIsOpen] = useState(Boolean(defaultOpen));

  return (
    <Card
      className={className}
      cta={cta}
      ctaPosition={ctaPosition}
      ctaCopy={ctaCopy}
    >
      <Button
        id={`${panelId}-toggle`}
        type="button"
        variant="ghost"
        size="md"
        className={cx("w-full", headerClassName)}
        dataIcon="with"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((prev) => !prev)}
        cta={toggleCta ?? cta}
        ctaPosition={toggleCtaPosition ?? ctaPosition}
        ctaCopy={toggleCtaCopy ?? ctaCopy}
      >
        <div className="w-full flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text-primary truncate">
              {title}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {meta ? (
              <span className="text-xs text-text-secondary">{meta}</span>
            ) : null}
            <ChevronDown
              size={18}
              className={cx(
                "transition-transform duration-200",
                isOpen ? "rotate-180" : "rotate-0",
              )}
              aria-hidden="true"
            />
          </div>
        </div>
      </Button>

      {isOpen ? (
        <div id={contentId} className={cx("mt-4", bodyClassName)}>
          {children}
        </div>
      ) : null}
    </Card>
  );
};

export default CollapsiblePanel;
