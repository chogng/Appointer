import React, { useMemo } from "react";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { useLanguage } from "../../hooks/useLanguage";

const cx = (...parts) => parts.filter(Boolean).join(" ");

const STATUS_STYLES = {
  PENDING: {
    className: "bg-status-pending/10 text-status-pending",
    Icon: Clock,
    labelKey: "reviewing",
  },
  APPROVED: {
    className: "bg-status-approved/10 text-status-approved",
    Icon: CheckCircle,
    labelKey: "approved",
  },
  REJECTED: {
    className: "bg-status-rejected/10 text-status-rejected",
    Icon: XCircle,
    labelKey: "rejected",
  },
};

export default function StatusBadge({
  status,
  pendingLabelKey = "reviewing",
  className,
}) {
  const { t } = useLanguage();

  const config = useMemo(() => {
    const raw = typeof status === "string" ? status.toUpperCase() : "";
    if (raw === "PENDING") return { ...STATUS_STYLES.PENDING, labelKey: pendingLabelKey };
    return STATUS_STYLES[raw] || null;
  }, [pendingLabelKey, status]);

  if (!config) return <span className="user_request_email">--</span>;

  const Icon = config.Icon;

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium",
        config.className,
        className,
      )}
    >
      <Icon size={12} />
      {t(config.labelKey)}
    </span>
  );
}
