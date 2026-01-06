import { useQuery } from "@tanstack/react-query";
import { apiService } from "../../services/apiService";
import { queryKeys } from "./queryKeys";

export const useDevicesQuery = () =>
  useQuery({
    queryKey: queryKeys.devices(),
    queryFn: () => apiService.getDevices(),
  });

