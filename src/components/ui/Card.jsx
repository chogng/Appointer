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
      cta,
      ctaPosition,
      ctaCopy,
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

    const ctaMarker = typeof cta === "string" && cta.trim() ? cta.trim() : undefined;
    const ctaPositionMarker =
      typeof ctaPosition === "string" && ctaPosition.trim()
        ? ctaPosition.trim()
        : undefined;
    const ctaCopyMarker =
      typeof ctaCopy === "string" && ctaCopy.trim() ? ctaCopy.trim() : undefined;

    const cardClasses = cx(variants[variant] || variants.default, className);

    return createElement(
      Component,
      {
        ref,
        className: cardClasses,
        "data-ui": uiMarker,
        "data-cta": ctaMarker,
        "data-cta-position": ctaPositionMarker,
        "data-cta-copy": ctaCopyMarker,
        "data-card": "card",
        ...props,
      },
      children,
    );
  }
);

Card.displayName = "Card";

export default Card;
