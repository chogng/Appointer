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
      ...props
    },
    ref
  ) => {
    const variants = {
      default: "ui-card ui-card--default",
      panel: "ui-card ui-card--panel",
      glass: "glass",
      flat: "ui-card ui-card--flat",
    };

    const uiMarker =
      typeof dataUi === "string" && dataUi.trim() ? dataUi.trim() : undefined;

    const cardClasses = cx(variants[variant] || variants.default, className);

    return createElement(
      Component,
      { ref, className: cardClasses, "data-ui": uiMarker, ...props },
      children,
    );
  }
);

Card.displayName = "Card";

export default Card;
