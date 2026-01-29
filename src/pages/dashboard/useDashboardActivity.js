import { useCallback, useState } from "react";
import { apiService } from "../../services/apiService";
import { buildDeviceNameById } from "../../utils/dashboardActivityFormatters";

export function useDashboardActivity({ user, t, showToast, closeToast }) {
  const [logs, setLogs] = useState([]);
  const [deviceNameById, setDeviceNameById] = useState({});
  const [searchTerm, setSearchTerm] = useState("");

  const getActivityBehaviorLabel = useCallback(
    (action, details) => {
      if (action === "LOGIN") return t("dashboard_activity_login_system");
      if (action === "RESERVATION_CREATED")
        return t("dashboard_activity_create_reservation");
      if (action === "RESERVATION_CANCELLED")
        return t("dashboard_activity_cancel_reservation");
      if (action === "DEVICE_CREATED") return t("dashboard_activity_create_device");
      if (action === "USER_CREATED") return t("dashboard_activity_register_user");
      if (action === "LITERATURE_RESEARCH")
        return t("dashboard_activity_literature_research");
      if (action === "RESERVATION_TIMEOUT")
        return t("dashboard_activity_reservation_timeout");

      if (typeof details === "string" && details.trim()) return details.trim();
      return typeof action === "string" ? action : "";
    },
    [t],
  );

  const fetchLogs = useCallback(async () => {
    try {
      const data = await apiService.getLogs(searchTerm);
      if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
        setLogs(data);
      } else {
        setLogs(data.filter((log) => log.userId === user?.id));
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    }
  }, [searchTerm, user]);

  const fetchDevices = useCallback(async () => {
    try {
      const devices = await apiService.getDevices();
      setDeviceNameById(buildDeviceNameById(devices));
    } catch (error) {
      console.error("Failed to fetch devices:", error);
    }
  }, []);

  const handleClearLogs = useCallback(() => {
    showToast?.(t("confirmClearLogs"), "warning", t("clearLogs"), async () => {
      try {
        closeToast?.();
        await apiService.deleteLogs();
        await fetchLogs();
        setTimeout(() => {
          showToast?.(t("updateSuccess"), "success");
        }, 300);
      } catch (error) {
        console.error("Failed to clear logs:", error);
        setTimeout(() => {
          showToast?.(t("clearLogsFailed"), "error");
        }, 300);
      }
    });
  }, [closeToast, fetchLogs, showToast, t]);

  return {
    logs,
    setLogs,
    deviceNameById,
    searchTerm,
    setSearchTerm,
    fetchLogs,
    fetchDevices,
    handleClearLogs,
    getActivityBehaviorLabel,
  };
}
