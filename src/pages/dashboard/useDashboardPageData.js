import { useEffect, useMemo, useState } from "react";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";

export function useDashboardPageData({
  fetchLogs,
  fetchPendingUsers,
  fetchRequests,
  fetchDevices,
  fetchReservations,
}) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchLogs?.(),
        fetchPendingUsers?.(),
        fetchRequests?.(),
        fetchDevices?.(),
        fetchReservations?.(),
      ]);
      setLoading(false);
    };

    loadData();
  }, [fetchDevices, fetchLogs, fetchPendingUsers, fetchRequests, fetchReservations]);

  const realtimeHandlers = useMemo(
    () => ({
      "reservation:created": () => {
        fetchLogs?.();
        fetchReservations?.();
      },
      "reservation:updated": () => {
        fetchLogs?.();
        fetchReservations?.();
      },
      "reservation:deleted": () => {
        fetchLogs?.();
        fetchReservations?.();
      },
      "device:created": fetchLogs,
      "user:created": () => {
        fetchLogs?.();
        fetchPendingUsers?.();
      },
      "user:updated": fetchPendingUsers,
      "user_application:created": fetchPendingUsers,
      "user_application:approved": fetchPendingUsers,
      "user_application:rejected": fetchPendingUsers,
      "user_application:reviewed_deleted": fetchPendingUsers,
      "request:created": fetchRequests,
      "request:updated": fetchRequests,
      "request:approved": fetchRequests,
      "request:rejected": fetchRequests,
      "request:deleted": fetchRequests,
      "request:bulk_deleted": fetchRequests,
    }),
    [fetchLogs, fetchPendingUsers, fetchRequests, fetchReservations],
  );

  useRealtimeSync(realtimeHandlers);

  return { loading };
}
