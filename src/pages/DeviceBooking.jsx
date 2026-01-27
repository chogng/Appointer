import { useCallback, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addWeeks, subWeeks, startOfWeek, addDays } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
} from "lucide-react";
import { apiService } from "../services/apiService";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../hooks/useLanguage";
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
  const { language, t } = useLanguage();
  const locale = language === "zh" ? zhCN : enUS;
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
        showToast(t("bookingUpdated"));
        return;
      }

      const created = await createReservationMutation.mutateAsync(payload);
      showToast(t("bookingSaved"), t("undo"), async () => {
        try {
          await deleteReservationMutation.mutateAsync(created.id);
          hideToast();
        } catch (err) {
          console.error("Undo failed", err);
          showToast(t("undoFailedRefresh"));
          invalidateWeekReservations();
        }
      });
    } catch (error) {
      if (error?.status === 409) {
        showToast(t("slotAlreadyBookedRefresh"));
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

      showToast(t("bookingDeleted"), t("undo"), async () => {
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
            showToast(t("undoFailedSlotBooked"));
          } else {
            console.error("Undo delete failed", err);
            showToast(t("undoFailedRefresh"));
          }
          invalidateWeekReservations();
        }
      });
    } catch (error) {
      console.error("Delete failed:", error);
      showToast(t("deleteFailedRefresh"));
      invalidateWeekReservations();
    }
  };

  const loading = deviceQuery.isLoading || reservationsQuery.isLoading;
  if (loading) return <div className="min-h-[200px]" />;
  if (!device) return <div>{t("deviceNotFound")}</div>;

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
            {t("back")}
          </Button>

          <Button
            variant="ghost"
            onClick={handleToday}
            size="md"
          >
            {t("today")}
          </Button>
          {/* Calendar switch */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="action-btn action-btn--control action-btn--ghost"
              aria-label={t("prevWeek")}
              onClick={handlePrev}
            >
              <span className="action-btn__content">
                <ChevronLeft size={20} className="text-text-secondary" />
              </span>
            </button>
            <button
              type="button"
              className="action-btn action-btn--control action-btn--ghost"
              aria-label={t("nextWeek")}
              onClick={handleNext}
            >
              <span className="action-btn__content">
                <ChevronRight size={20} className="text-text-secondary" />
              </span>
            </button>
          </div>
          {/* Calendar Date */}
          <h2 className="text-xl font-normal text-text-primary ml-2 min-w-[120px] text-center">
            {format(currentDate, language === "zh" ? "yyyy年M月" : "MMM yyyy", {
              locale,
            })}
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
          <div id="device-booking-layout-toggle" className="tab_menu">
            <button
              type="button"
              onClick={() => setLayoutMode("grid")}
              className={`tab_btn tab_btn--control ${layoutMode === "grid" ? "tab_btn--active" : "tab_btn--inactive"}`}
              title={t("gridView")}
              aria-label={t("gridView")}
            >
              <span className="tab_btn_icon">
                <LayoutGrid size={18} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("list")}
              className={`tab_btn tab_btn--control ${layoutMode === "list" ? "tab_btn--active" : "tab_btn--inactive"}`}
              title={t("listView")}
              aria-label={t("listView")}
            >
              <span className="tab_btn_icon">
                <List size={18} />
              </span>
            </button>
          </div>
          <Dropdown
            options={[
              { label: t("viewModeWeek"), value: "Weeks" },
              { label: t("viewModeDay"), value: "Days" },
              { label: t("viewModeMonth"), value: "Month" },
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
