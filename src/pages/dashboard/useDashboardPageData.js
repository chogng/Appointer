import { useEffect, useMemo, useState } from "react";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";

export function useDashboardPageData({
  fetchLogs,
  fetchPendingUsers,
  fetchRequests,
  fetchDevices,
}) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchLogs?.(),
        fetchPendingUsers?.(),
        fetchRequests?.(),
        fetchDevices?.(),
      ]);
      setLoading(false);
    };

    loadData();
  }, [fetchDevices, fetchLogs, fetchPendingUsers, fetchRequests]);

  const realtimeHandlers = useMemo(
    () => ({
      "reservation:created": fetchLogs,
      "reservation:updated": fetchLogs,
      "reservation:deleted": fetchLogs,
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
      "request:approved": fetchRequests,
      "request:rejected": fetchRequests,
      "request:deleted": fetchRequests,
      "request:bulk_deleted": fetchRequests,
    }),
    [fetchLogs, fetchPendingUsers, fetchRequests],
  );

  useRealtimeSync(realtimeHandlers);

  return { loading };
}
