import { useQuery } from "@tanstack/react-query";
import { apiService } from "../../services/apiService";
import { queryKeys } from "./queryKeys";

export const useUserBlocklistQuery = (userId) =>
  useQuery({
    queryKey: queryKeys.userBlocklist(userId),
    queryFn: () => apiService.getUserBlocklist(userId),
    enabled: Boolean(userId),
  });

