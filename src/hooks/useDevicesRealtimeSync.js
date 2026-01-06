import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeSync } from "./useRealtimeSync";
import { queryKeys } from "./queries/queryKeys";

export const useDevicesRealtimeSync = () => {
  const queryClient = useQueryClient();

  const handlers = useMemo(
    () => ({
      "device:created": (newDevice) => {
        if (!newDevice?.id) return;
        queryClient.setQueryData(queryKeys.devices(), (current) => {
          const devices = Array.isArray(current) ? current : [];
          if (devices.some((d) => d.id === newDevice.id)) return devices;
          return [...devices, newDevice];
        });
      },
      "device:updated": (updatedDevice) => {
        if (!updatedDevice?.id) return;
        queryClient.setQueryData(queryKeys.devices(), (current) => {
          const devices = Array.isArray(current) ? current : [];
          return devices.map((d) => (d.id === updatedDevice.id ? updatedDevice : d));
        });
      },
      "device:deleted": (data) => {
        const deletedId = data?.id;
        if (!deletedId) return;
        queryClient.setQueryData(queryKeys.devices(), (current) => {
          const devices = Array.isArray(current) ? current : [];
          return devices.filter((d) => d.id !== deletedId);
        });
      },
    }),
    [queryClient],
  );

  useRealtimeSync(handlers);
};

