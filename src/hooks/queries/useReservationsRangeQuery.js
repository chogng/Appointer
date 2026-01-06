import { useQuery } from "@tanstack/react-query";
import { apiService } from "../../services/apiService";
import { queryKeys } from "./queryKeys";

export const useReservationsRangeQuery = ({ deviceId, from, to, active }) =>
  useQuery({
    queryKey: queryKeys.reservationsRange({ deviceId, from, to, active }),
    queryFn: () => apiService.getReservations({ deviceId, from, to, active }),
    enabled: Boolean(deviceId && from && to),
  });

