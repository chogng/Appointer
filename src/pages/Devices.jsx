import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiService } from "../services/apiService";
import { usePermission } from "../hooks/usePermission";
import { useLanguage } from "../hooks/useLanguage";
import { queryKeys } from "../hooks/queries/queryKeys";
import { useDevicesQuery } from "../hooks/queries/useDevicesQuery";
import { useUserBlocklistQuery } from "../hooks/queries/useUserBlocklistQuery";
import { useDevicesRealtimeSync } from "../hooks/useDevicesRealtimeSync";
import DeviceCard from "../components/DeviceCard";
import AddDeviceCard from "../components/AddDeviceCard";
import Toast from "../components/ui/Toast";
import { useAuth } from "../hooks/useAuth";

const Devices = () => {
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id;

  const containerRef = useRef(null);
  const navigate = useNavigate();
  const { isAdmin } = usePermission();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  useDevicesRealtimeSync();

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [createConfirm, setCreateConfirm] = useState(false);
  const [toast, setToast] = useState({
    isVisible: false,
    message: "",
    type: "success",
  });

  const showToast = useCallback(
    (message, type = "success") => setToast({ isVisible: true, message, type }),
    [],
  );
  const closeToast = useCallback(
    () => setToast((prev) => ({ ...prev, isVisible: false })),
    [],
  );

  const devicesQuery = useDevicesQuery();
  const userBlocklistQuery = useUserBlocklistQuery(currentUserId);

  const devices = devicesQuery.data || [];
  const blockedDeviceIdSet = useMemo(
    () => new Set((userBlocklistQuery.data || []).map((b) => b.deviceId)),
    [userBlocklistQuery.data],
  );

  useEffect(() => {
    const handleClickOutside = () => {
      if (deleteConfirmId) setDeleteConfirmId(null);
      if (createConfirm) setCreateConfirm(false);
    };

    if (deleteConfirmId || createConfirm) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [deleteConfirmId, createConfirm]);

  const updateDeviceMutation = useMutation({
    mutationFn: ({ deviceId, updates }) =>
      apiService.updateDevice(deviceId, updates),
    onSuccess: (updatedDevice) => {
      if (!updatedDevice?.id) return;
      queryClient.setQueryData(queryKeys.devices(), (current) => {
        const currentDevices = Array.isArray(current) ? current : [];
        return currentDevices.map((d) =>
          d.id === updatedDevice.id ? updatedDevice : d,
        );
      });
    },
    onError: (error) => {
      console.error("Failed to update device:", error);
      showToast(t("updateFailed"), "error");
    },
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: (deviceId) => apiService.deleteDevice(deviceId),
    onSuccess: (_, deviceId) => {
      queryClient.setQueryData(queryKeys.devices(), (current) => {
        const currentDevices = Array.isArray(current) ? current : [];
        return currentDevices.filter((d) => d.id !== deviceId);
      });
    },
    onError: (error) => {
      console.error("Failed to delete device:", error);
      showToast(t("deleteFailed"), "error");
    },
  });

  const createDeviceMutation = useMutation({
    mutationFn: (deviceData) => apiService.createDevice(deviceData),
    onSuccess: (newDevice) => {
      if (!newDevice?.id) return;
      queryClient.setQueryData(queryKeys.devices(), (current) => {
        const currentDevices = Array.isArray(current) ? current : [];
        if (currentDevices.some((d) => d.id === newDevice.id))
          return currentDevices;
        return [...currentDevices, newDevice];
      });
    },
    onError: (error) => {
      console.error("Failed to create device:", error);
      showToast(t("createDeviceFailed"), "error");
    },
  });

  const handleUpdateDevice = (deviceId, updates) => {
    updateDeviceMutation.mutate({ deviceId, updates });
  };

  const handleToggleDevice = (deviceId) => {
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return;
    handleUpdateDevice(deviceId, { isEnabled: !device.isEnabled });
  };

  const handleDeleteClick = (deviceId, e) => {
    e.stopPropagation();
    if (deleteConfirmId === deviceId) {
      handleDeleteDevice(deviceId);
    } else {
      setDeleteConfirmId(deviceId);
    }
  };

  const handleDeleteDevice = (deviceId) => {
    deleteDeviceMutation.mutate(deviceId, {
      onSuccess: () => {
        setDeleteConfirmId(null);
        showToast(t("updateSuccess"), "success");
      },
    });
  };

  const handleCreateDevice = () => {
    createDeviceMutation.mutate(
      {
        name: t("newDevice"),
        description: "",
        isEnabled: true,
        openDays: [1, 2, 3, 4, 5],
        timeSlots: [],
        granularity: 60,
        openTime: { start: "09:00", end: "18:00" },
      },
      {
        onSuccess: (newDevice) => {
          console.log("设备创建成功:", newDevice);
          showToast(t("updateSuccess"), "success");
        },
      },
    );
  };

  const loading = devicesQuery.isLoading || userBlocklistQuery.isLoading;
  if (loading) return <div className="min-h-[200px]" />;

  return (
    <div
      className="max-w-[1500px] mx-auto min-h-screen relative"
      ref={containerRef}
    >
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-medium text-text-primary mb-2">
          {t("deviceList")}
        </h1>
        <p className="text-text-secondary">{t("selectDeviceToBook")}</p>
      </div>
      {/* Device Card List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            isAdmin={isAdmin()}
            isBlocked={blockedDeviceIdSet.has(device.id)}
            onToggle={handleToggleDevice}
            onUpdate={handleUpdateDevice}
            onBook={() => navigate(`/devices/${device.id}`)}
            deleteConfirmId={deleteConfirmId}
            onDeleteClick={handleDeleteClick}
            onShowToast={showToast}
          />
        ))}
        {isAdmin() && (
          <AddDeviceCard
            onClick={(e) => {
              e.stopPropagation();
              if (createConfirm) {
                handleCreateDevice();
                setCreateConfirm(false);
              } else {
                setCreateConfirm(true);
              }
            }}
            isConfirming={createConfirm}
          />
        )}
      </div>
      {/* Global Toast for this page */}
      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={closeToast}
        containerRef={containerRef}
        type={toast.type}
      />
    </div>
  );
};

export default Devices;
