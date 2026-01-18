import { createElement, forwardRef } from "react";

const cx = (...parts) => parts.filter(Boolean).join(" ");

const Card = forwardRef(
  (
    {
      as: Component = "div",
      children,
      className = "",
      variant = "default",
      dataUi,
      dta, // { page?, slot?, comp? } -> emits data-dta-* markers for automation/analytics
      ...props
    },
    ref
  ) => {
    const variants = {
      default: "card",
      panel: "card card--panel",
      glass: "card card--glass",
      flat: "card card--flat",
    };

    const uiMarker =
      typeof dataUi === "string" && dataUi.trim() ? dataUi.trim() : undefined;

    const dtaPage =
      typeof dta?.page === "string" && dta.page.trim() ? dta.page.trim() : undefined;
    const dtaSlot =
      typeof dta?.slot === "string" && dta.slot.trim() ? dta.slot.trim() : undefined;
    const dtaComp =
      typeof dta?.comp === "string" && dta.comp.trim() ? dta.comp.trim() : undefined;
    const dtaKey = [dtaPage, dtaSlot, dtaComp].filter(Boolean).join(".");
    const dtaMarker = dtaKey ? dtaKey : undefined;

    const cardClasses = cx(variants[variant] || variants.default, className);

    return createElement(
      Component,
      {
        ref,
        className: cardClasses,
        "data-ui": uiMarker,
        "data-dta": dtaMarker,
        "data-dta-page": dtaPage,
        "data-dta-slot": dtaSlot,
        "data-dta-comp": dtaComp,
        "data-card": "card",
        ...props,
      },
      children,
    );
  }
);

Card.displayName = "Card";

export default Card;
