import { useCallback, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addWeeks, subWeeks, startOfWeek, addDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
} from "lucide-react";
import { apiService } from "../services/apiService";
import { useAuth } from "../hooks/useAuth";
import WeeklyCalendar from "../components/WeeklyCalendar";
import Button from "../components/ui/Button";
import Toast from "../components/ui/Toast";
import Dropdown from "../components/ui/Dropdown";
import { queryKeys } from "../hooks/queries/queryKeys";
import { useReservationsRangeQuery } from "../hooks/queries/useReservationsRangeQuery";
import { useReservationsRealtimeSync } from "../hooks/useReservationsRealtimeSync";

const DeviceBooking = () => {
  const { id: deviceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const { user } = useAuth();
  const highlightUserName = location.state?.highlightUserName;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("Weeks");
  const [layoutMode, setLayoutMode] = useState("grid"); // 'grid' | 'list'
  const containerRef = useRef(null);
  const [toastState, setToastState] = useState({
    isVisible: false,
    message: "",
    actionText: null,
    onAction: null,
  });

  const showToast = useCallback(
    (message, actionText = null, onAction = null) => {
      setToastState({
        isVisible: true,
        message,
        actionText,
        onAction,
      });
    },
    [],
  );

  const hideToast = useCallback(() => {
    setToastState((prev) => ({ ...prev, isVisible: false }));
  }, []);

  useReservationsRealtimeSync();

  const weekRange = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = addDays(start, 6);
    return {
      start,
      end,
      from: format(start, "yyyy-MM-dd"),
      to: format(end, "yyyy-MM-dd"),
    };
  }, [currentDate]);

  const reservationsRangeKey = useMemo(
    () =>
      queryKeys.reservationsRange({
        deviceId,
        from: weekRange.from,
        to: weekRange.to,
        active: true,
      }),
    [deviceId, weekRange.from, weekRange.to],
  );

  const deviceQuery = useQuery({
    queryKey: ["device", deviceId],
    queryFn: () => apiService.getDevice(deviceId),
    enabled: Boolean(deviceId),
  });

  const reservationsQuery = useReservationsRangeQuery({
    deviceId,
    from: weekRange.from,
    to: weekRange.to,
    active: true,
  });

  const device = deviceQuery.data || null;
  const reservations = reservationsQuery.data || [];

  const invalidateWeekReservations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: reservationsRangeKey });
  }, [queryClient, reservationsRangeKey]);

  const createReservationMutation = useMutation({
    mutationFn: ({ date, timeSlot, title, description, color }) =>
      apiService.createReservation({
        deviceId,
        date,
        timeSlot,
        title,
        description,
        color,
      }),
    onSuccess: (newReservation) => {
      queryClient.setQueryData(reservationsRangeKey, (current) => {
        const list = Array.isArray(current) ? current : [];
        if (list.some((r) => r.id === newReservation.id)) return list;
        return [...list, newReservation];
      });
    },
  });

  const updateReservationMutation = useMutation({
    mutationFn: ({ reservationId, updates }) =>
      apiService.updateReservation(reservationId, updates),
    onSuccess: (updatedReservation) => {
      queryClient.setQueryData(reservationsRangeKey, (current) => {
        const list = Array.isArray(current) ? current : [];
        const exists = list.some((r) => r.id === updatedReservation.id);
        if (!exists) return [...list, updatedReservation];
        return list.map((r) =>
          r.id === updatedReservation.id ? updatedReservation : r,
        );
      });
    },
  });

  const deleteReservationMutation = useMutation({
    mutationFn: (reservationId) => apiService.deleteReservation(reservationId),
    onSuccess: (_, reservationId) => {
      queryClient.setQueryData(reservationsRangeKey, (current) => {
        const list = Array.isArray(current) ? current : [];
        return list.filter((r) => r.id !== reservationId);
      });
    },
  });

  const handlePrev = () => setCurrentDate((prev) => subWeeks(prev, 1));
  const handleNext = () => setCurrentDate((prev) => addWeeks(prev, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleBook = async (date, slot, extraData = {}) => {
    try {
      if (!deviceId) return;

      const formattedDate = format(date, "yyyy-MM-dd");
      const payload = {
        date: formattedDate,
        timeSlot: slot,
        title: extraData.title ?? "",
        description: extraData.description ?? "",
        color: extraData.color ?? "default",
      };

      if (extraData.id) {
        await updateReservationMutation.mutateAsync({
          reservationId: extraData.id,
          updates: payload,
        });
        showToast("预约已更新");
        return;
      }

      const created = await createReservationMutation.mutateAsync(payload);
      showToast("预约已保存", "撤销", async () => {
        try {
          await deleteReservationMutation.mutateAsync(created.id);
          hideToast();
        } catch (err) {
          console.error("Undo failed", err);
          showToast("撤销失败，请刷新后重试");
          invalidateWeekReservations();
        }
      });
    } catch (error) {
      if (error?.status === 409) {
        showToast("该时间段已被其他人预约，请刷新后重试");
        invalidateWeekReservations();
        return;
      }
      alert(error.message);
    }
  };

  const handleDelete = async (reservationId) => {
    const resToDelete = reservations.find((r) => r.id === reservationId);
    if (!resToDelete) return;

    try {
      // Optimistic update: Remove immediately from UI
      queryClient.setQueryData(reservationsRangeKey, (current) => {
        const list = Array.isArray(current) ? current : [];
        return list.filter((r) => r.id !== reservationId);
      });

      await deleteReservationMutation.mutateAsync(reservationId);

      showToast("预约已删除", "撤销", async () => {
        try {
          await createReservationMutation.mutateAsync({
            date: resToDelete.date,
            timeSlot: resToDelete.timeSlot,
            title: resToDelete.title || "",
            description: resToDelete.description || "",
            color: resToDelete.color || "default",
          });
          hideToast();
        } catch (err) {
          if (err?.status === 409) {
            showToast("撤销失败：该时间段已被其他人预约");
          } else {
            console.error("Undo delete failed", err);
            showToast("撤销失败，请刷新后重试");
          }
          invalidateWeekReservations();
        }
      });
    } catch (error) {
      console.error("Delete failed:", error);
      showToast("删除失败，请刷新后重试");
      invalidateWeekReservations();
    }
  };

  const loading = deviceQuery.isLoading || reservationsQuery.isLoading;
  if (loading) return <div className="min-h-[200px]" />;
  if (!device) return <div>Device not found</div>;

  const isSavingReservation =
    createReservationMutation.isPending || updateReservationMutation.isPending;

  return (
    <div ref={containerRef} className="h-full flex flex-col relative">
      <div className="mb-2 -mt-[8px] grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* Left buttons */}
        <div className="flex items-center gap-4 justify-self-start">
          <Button
            variant="text"
            onClick={() => navigate("/devices")}
            className="pl-0 hover:bg-transparent text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={28} className="mr-2" />
            返回
          </Button>

          <Button
            variant="secondary"
            onClick={handleToday}
            className="px-4 py-1.5 text-sm border border-border rounded-md"
          >
            今天
          </Button>
          {/* Calendar switch */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="p-1.5 hover:bg-bg-100 rounded-full"
              aria-label="上一周"
            >
              <ChevronLeft size={20} className="text-text-secondary" />
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 hover:bg-bg-100 rounded-full"
              aria-label="下一周"
            >
              <ChevronRight size={20} className="text-text-secondary" />
            </button>
          </div>
          {/* Calendar Date */}
          <h2 className="text-xl font-normal text-text-primary ml-2 min-w-[120px] text-center">
            {format(currentDate, "yyyy年M月", { locale: zhCN })}
          </h2>
        </div>

        {/* Device Name - Centered */}
        <h1 className="text-2xl font-serif font-medium text-text-primary justify-self-center whitespace-nowrap flex items-center gap-2">
          {device.name}
          {highlightUserName && (
            <span className="text-lg text-text-secondary font-normal">
              - {highlightUserName}
            </span>
          )}
        </h1>

        {/* Right Side Controls */}
        <div className="flex items-center gap-2 justify-self-end">
          {/* Layout Toggle */}
          <div className="flex items-center bg-bg-100 rounded-lg p-0.5">
            <button
              onClick={() => setLayoutMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${layoutMode === "grid" ? "bg-white shadow-sm text-accent" : "text-text-secondary hover:text-text-primary"}`}
              title="网格视图"
              aria-label="网格视图"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setLayoutMode("list")}
              className={`p-1.5 rounded-md transition-colors ${layoutMode === "list" ? "bg-white shadow-sm text-accent" : "text-text-secondary hover:text-text-primary"}`}
              title="列表视图"
              aria-label="列表视图"
            >
              <List size={18} />
            </button>
          </div>
          <Dropdown
            options={[
              { label: "周", value: "Weeks" },
              { label: "日", value: "Days" },
              { label: "月", value: "Month" },
            ]}
            value={viewMode}
            onChange={setViewMode}
            className=""
            align="right"
            zIndex={50}
            id="view-mode-dropdown"
            popupClassName="min-w-[8.75rem]"
          />
        </div>
      </div>

      <WeeklyCalendar
        device={device}
        reservations={reservations}
        onBook={handleBook}
        onDelete={handleDelete}
        currentUserId={user.id}
        currentDate={currentDate}
        layoutMode={layoutMode}
        isSaving={isSavingReservation}
        className="flex-1 min-h-0"
      />

      <Toast
        isVisible={toastState.isVisible}
        message={toastState.message}
        actionText={toastState.actionText}
        onAction={toastState.onAction}
        onClose={hideToast}
        containerRef={containerRef}
      />
    </div>
  );
};

export default DeviceBooking;
