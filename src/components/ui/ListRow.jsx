import { createElement, forwardRef } from "react";

const cx = (...parts) => parts.filter(Boolean).join(" ");

const ListRow = forwardRef(
  ({ as: Component = "div", className = "", children, ...props }, ref) =>
    createElement(
      Component,
      {
        ref,
        className: cx("list-row group", className),
        ...props,
      },
      children,
    ),
);

ListRow.displayName = "ListRow";

export default ListRow;
