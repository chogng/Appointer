import { format } from "date-fns";

// Dashboard-specific helpers: keep display labels/formatting rules out of JSX.
export function getDashboardMessageBehaviorLabel(msg, t) {
  if (msg?.msgType === "USER_REGISTRATION") return t("dashboard_applied_for_account");
  if (msg?.type === "INVENTORY_ADD") return t("dashboard_inventory_create");
  if (msg?.type === "INVENTORY_UPDATE") return t("dashboard_inventory_update");
  return t("dashboard_inventory_request");
}

export function getDashboardMessageTimestampLabel(
  msg,
  { locale, pattern = "MM-dd HH:mm" } = {},
) {
  const ts =
    msg?.timestamp ||
    msg?.createdAt ||
    msg?.created_at ||
    msg?.updatedAt ||
    msg?.updated_at;

  const dateObj = ts ? new Date(ts) : null;
  const hasValidTs = dateObj instanceof Date && !Number.isNaN(dateObj.getTime());
  if (!hasValidTs) return "--";

  return format(dateObj, pattern, locale ? { locale } : undefined);
}
