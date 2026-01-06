import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeSync } from "./useRealtimeSync";

const isReservationRangeQuery = (queryKey) =>
  Array.isArray(queryKey) && queryKey[0] === "reservations" && queryKey[1] === "range";

const getRangeParams = (queryKey) => {
  if (!isReservationRangeQuery(queryKey)) return null;
  const params = queryKey[2];
  if (!params || typeof params !== "object" || Array.isArray(params)) return null;
  return params;
};

const shouldInclude = (reservation, rangeParams) => {
  if (!reservation?.id) return false;
  if (rangeParams?.deviceId && reservation.deviceId !== rangeParams.deviceId) return false;
  if (rangeParams?.from && reservation.date < rangeParams.from) return false;
  if (rangeParams?.to && reservation.date > rangeParams.to) return false;
  if (rangeParams?.active && reservation.status === "CANCELLED") return false;
  return true;
};

export const useReservationsRealtimeSync = () => {
  const queryClient = useQueryClient();

  const handlers = useMemo(
    () => ({
      connect: () => {
        queryClient.invalidateQueries({ queryKey: ["reservations"] });
      },
      "reservation:created": (newReservation) => {
        if (!newReservation?.id) return;
        const queries = queryClient
          .getQueryCache()
          .findAll({ queryKey: ["reservations", "range"] });
        for (const query of queries) {
          const rangeParams = getRangeParams(query.queryKey);
          if (!rangeParams) continue;
          if (!shouldInclude(newReservation, rangeParams)) continue;

          queryClient.setQueryData(query.queryKey, (current) => {
            const list = Array.isArray(current) ? current : [];
            if (list.some((r) => r.id === newReservation.id)) return list;
            return [...list, newReservation];
          });
        }
      },
      "reservation:updated": (updatedReservation) => {
        if (!updatedReservation?.id) return;
        const queries = queryClient
          .getQueryCache()
          .findAll({ queryKey: ["reservations", "range"] });
        for (const query of queries) {
          const rangeParams = getRangeParams(query.queryKey);
          if (!rangeParams) continue;
          if (rangeParams.deviceId && updatedReservation.deviceId !== rangeParams.deviceId) continue;

          queryClient.setQueryData(query.queryKey, (current) => {
            const list = Array.isArray(current) ? current : [];
            const exists = list.some((r) => r.id === updatedReservation.id);
            const keep = shouldInclude(updatedReservation, rangeParams);

            if (!keep) {
              return exists ? list.filter((r) => r.id !== updatedReservation.id) : list;
            }

            if (!exists) return [...list, updatedReservation];
            return list.map((r) => (r.id === updatedReservation.id ? updatedReservation : r));
          });
        }
      },
      "reservation:deleted": (deleted) => {
        const deletedId = deleted?.id;
        if (!deletedId) return;

        const queries = queryClient
          .getQueryCache()
          .findAll({ queryKey: ["reservations", "range"] });
        for (const query of queries) {
          const rangeParams = getRangeParams(query.queryKey);
          if (!rangeParams) continue;
          if (deleted?.deviceId && rangeParams.deviceId && deleted.deviceId !== rangeParams.deviceId)
            continue;

          queryClient.setQueryData(query.queryKey, (current) => {
            const list = Array.isArray(current) ? current : [];
            return list.filter((r) => r.id !== deletedId);
          });
        }
      },
    }),
    [queryClient],
  );

  useRealtimeSync(handlers);
};

