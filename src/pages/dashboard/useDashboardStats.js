import { useCallback, useMemo, useState } from "react";
import { format } from "date-fns";
import { apiService } from "../../services/apiService";

const isAdminRole = (role) => role === "ADMIN" || role === "SUPER_ADMIN";

function parseTimeSlotMinutes(timeSlot) {
  if (typeof timeSlot !== "string") return 0;
  const [start, end] = timeSlot.split("-");
  if (!start || !end) return 0;

  const parsePart = (part) => {
    const [h, m] = String(part).split(":").map((v) => Number(v));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  };

  const startMin = parsePart(start);
  const endMin = parsePart(end);
  if (startMin === null || endMin === null) return 0;

  const duration = endMin - startMin;
  return duration > 0 ? duration : 0;
}

function formatHoursLabel(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "0";
  if (totalMinutes % 60 === 0) return String(totalMinutes / 60);
  return (totalMinutes / 60).toFixed(1);
}

export function useDashboardStats({ user, t }) {
  const [reservations, setReservations] = useState(null);

  const fetchReservations = useCallback(async () => {
    try {
      const data = await apiService.getReservations({ active: true });
      setReservations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch reservations:", error);
      setReservations([]);
    }
  }, []);

  const stats = useMemo(() => {
    const todayLocal = format(new Date(), "yyyy-MM-dd");
    const allReservations = Array.isArray(reservations) ? reservations : [];
    const visible = isAdminRole(user?.role)
      ? allReservations
      : allReservations.filter((r) => r?.userId === user?.id);

    let upcomingCount = 0;
    let completedCount = 0;
    let upcomingMinutes = 0;

    for (const r of visible) {
      const date = typeof r?.date === "string" ? r.date : "";
      if (!date) continue;
      if (date >= todayLocal) {
        upcomingCount += 1;
        upcomingMinutes += parseTimeSlotMinutes(r?.timeSlot);
      } else {
        completedCount += 1;
      }
    }

    return {
      upcomingCount,
      reservedHoursLabel: `${formatHoursLabel(upcomingMinutes)} ${t("hours")}`,
      completedCount,
    };
  }, [reservations, t, user?.id, user?.role]);

  return {
    reservations,
    isLoading: reservations === null,
    fetchReservations,
    stats,
  };
}
