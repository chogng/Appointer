import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiService } from "../services/apiService";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../hooks/useLanguage";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Dropdown from "../components/ui/Dropdown";
import Tabs from "../components/ui/Tabs";
import {
  Calendar,
  Clock,
  LayoutGrid,
  List,
  Trash2,
  CheckSquare,
  Square,
} from "lucide-react";

const MyReservations = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [allReservations, setAllReservations] = useState([]); // Store all raw data
  const [users, setUsers] = useState([]); // Store users for admin view
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDeviceId, setFilterDeviceId] = useState("all");
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'grid'
  const [scope, setScope] = useState("mine"); // 'mine' | 'all'
  const [selectedIds, setSelectedIds] = useState(new Set());

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const promises = [apiService.getReservations(), apiService.getDevices()];

      // If admin, also fetch users
      if (isAdmin) {
        promises.push(apiService.getUsers());
      }

      const [allRes, allDevices, allUsers] = await Promise.all(promises);

      // Filter out cancelled ones, but keep all users' reservations for now
      const validRes = allRes.filter((r) => r.status !== "CANCELLED");
      setAllReservations(validRes);
      setDevices(allDevices);

      if (allUsers) {
        setUsers(allUsers);
      }
    } catch (error) {
      console.error("Failed to load reservations:", error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!user?.id) return;
    loadData();
  }, [user?.id, loadData]); // Reload if admin status changes (though unlikely without re-login)

  const getDeviceName = (id) =>
    devices.find((d) => d.id === id)?.name || t("unknownDevice");
  const getUserName = (id) =>
    users.find((u) => u.id === id)?.name || t("unknownUser");

  const handleCancel = async (id) => {
    if (!confirm(t("confirmCancelReservation"))) return;

    try {
      await apiService.updateReservation(id, { status: "CANCELLED" });
      await loadData();
    } catch (error) {
      console.error("Failed to cancel reservation:", error);
      alert(t("cancelFailedRetry"));
    }
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkCancel = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(t("confirmBulkCancel", { count: selectedIds.size }))) return;

    try {
      setLoading(true);
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          apiService.updateReservation(id, { status: "CANCELLED" }),
        ),
      );
      setSelectedIds(new Set());
      await loadData();
    } catch (error) {
      console.error("Batch cancel failed:", error);
      alert(t("bulkCancelFailedRetry"));
    } finally {
      setLoading(false);
    }
  };

  const getFilteredReservations = () => {
    let result = allReservations;

    // 1. Scope filter (Mine vs All/Others)
    if (!isAdmin || scope === "mine") {
      // Show only my reservations
      result = result.filter((r) => r.userId === user.id);
    } else if (scope === "all") {
      // Show only OTHER users' reservations (exclude mine)
      result = result.filter((r) => r.userId !== user.id);
    }

    // 2. Device filter
    if (filterDeviceId !== "all") {
      result = result.filter((res) => res.deviceId === filterDeviceId);
    }

    // 3. Sort by creation date (newest first)
    return [...result].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
  };

  const filteredReservations = getFilteredReservations();
  const isAllSelected =
    filteredReservations.length > 0 &&
    selectedIds.size === filteredReservations.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReservations.map((r) => r.id)));
    }
  };

  const filterOptions = [
    { label: t("allDevices"), value: "all" },
    ...devices.map((d) => ({ label: d.name, value: d.id })),
  ];

  if (loading) {
    return <div className="min-h-[200px]" />;
  }

  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-6">
          {!isAdmin && (
            <h1 className="text-3xl font-serif font-medium text-text-primary">
              {t("myReservationsTitle")}
            </h1>
          )}
          {isAdmin && (
            <div className="w-[200px] mt-1">
              <Tabs
                idBase="my-reservations-scope"
                groupLabel="Reservation scope"
                value={scope}
                onChange={setScope}
                options={[
                  { label: t("myReservationsTitle"), value: "mine" },
                  { label: t("userReservationsTitle"), value: "all" },
                ]}
                size="md"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center animate-in fade-in slide-in-from-right-4 duration-300">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBulkCancel}
                fx
                className="action-btn--danger"
              >
                <Trash2 size={16} />
                {t("cancelSelected")} ({selectedIds.size})
              </Button>
            </div>
          )}

          {/* Device Filter */}
          <div className="w-[180px]">
            <Dropdown
              options={filterOptions}
              value={filterDeviceId}
              onChange={setFilterDeviceId}
              placeholder={t("filterDevice")}
            />
          </div>

          {/* View Switcher */}
          <div id="my-reservations-view-toggle" className="tab_menu">
            <button
              type="button"
              onClick={toggleSelectAll}
              className={`tab_btn tab_btn--control ${
                isAllSelected ? "tab_btn--active" : "tab_btn--inactive"
              }`}
              title={isAllSelected ? t("deselectAll") : t("selectAll")}
            >
              <span className="tab_btn_icon">
                {isAllSelected ? <CheckSquare size={20} /> : <Square size={20} />}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`tab_btn tab_btn--control ${
                viewMode === "list" ? "tab_btn--active" : "tab_btn--inactive"
              }`}
              title={t("listView")}
            >
              <span className="tab_btn_icon">
                <List size={20} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`tab_btn tab_btn--control ${
                viewMode === "grid" ? "tab_btn--active" : "tab_btn--inactive"
              }`}
              title={t("gridView")}
            >
              <span className="tab_btn_icon">
                <LayoutGrid size={20} />
              </span>
            </button>
          </div>
        </div>
      </div>

      {filteredReservations.length === 0 ? (
        <Card
          variant="glass"
          className="flex flex-col items-center justify-center py-16"
        >
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
            <Calendar size={32} className="text-indigo-400 opacity-50" />
          </div>
          <p className="text-text-secondary">
            {filterDeviceId === "all"
              ? t("noReservations")
              : t("noReservationsForDevice")}
          </p>
        </Card>
      ) : (
        <div
          className={
            viewMode === "list"
              ? "flex flex-col gap-4"
              : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          }
        >
          {filteredReservations.map((res) => (
            <Card
              key={res.id}
              variant="glass"
              className={`hover-lift group relative ${viewMode === "list" ? "flex items-center gap-4 py-4 pr-6" : "flex flex-col gap-6 p-6"}`}
              onClick={(e) => {
                // Allow selecting by clicking card background if not clicking interactive elements
                if (!e.target.closest("button") && !e.target.closest("a")) {
                  toggleSelect(res.id);
                }
              }}
            >
              <div
                className={`absolute top-4 left-4 z-10 ${viewMode === "list" ? "relative top-auto left-auto" : ""}`}
              >
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-all duration-200 cursor-pointer ${
                    selectedIds.has(res.id)
                      ? "bg-accent border-accent text-white shadow-sm"
                      : "bg-white border-gray-300 text-transparent hover:border-accent/60"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(res.id);
                  }}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </div>
              {/* 1. Device Info (Left) */}
              <div
                className={`flex gap-4 sm:gap-6 items-center ${viewMode === "list" ? "w-[280px] shrink-0" : ""}`}
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#FAFDF7] dark:bg-green-900/20 flex items-center justify-center shrink-0 border border-green-100/50 group-hover:scale-110 transition-transform duration-300">
                  <Calendar
                    size={24}
                    className="text-accent"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold text-text-primary truncate leading-normal">
                    {getDeviceName(res.deviceId)}
                    {scope === "all" && (
                      <span className="ml-2 text-sm font-normal text-text-secondary">
                        By {getUserName(res.userId)}
                      </span>
                    )}
                  </h3>
                </div>
              </div>

              {/* 2. Date Info (Middle Left) */}
              <div
                className={`flex items-center ${viewMode === "list" ? "flex-1 justify-center" : ""}`}
              >
                <span className="flex items-center gap-1.5 text-sm text-text-secondary whitespace-nowrap bg-bg-subtle/50 px-3 py-1.5 rounded-lg border border-border-subtle/50">
                  <Calendar size={14} className="opacity-70" /> {res.date}
                </span>
              </div>

              {/* 3. Time Info (Middle Right) */}
              <div
                className={`flex items-center ${viewMode === "list" ? "flex-1 justify-center" : ""}`}
              >
                <span className="flex items-center gap-1.5 text-sm text-text-secondary whitespace-nowrap bg-bg-subtle/50 px-3 py-1.5 rounded-lg border border-border-subtle/50">
                  <Clock size={14} className="opacity-70" /> {res.timeSlot}
                </span>
              </div>

              {/* 4. Actions (Right) */}
              <div
                className={
                  viewMode === "list"
                    ? "shrink-0 ml-4 flex items-center gap-2"
                    : "w-full flex gap-2"
                }
              >
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    navigate(`/devices/${res.deviceId}`, {
                      state: {
                        highlightUserName: getUserName(res.userId),
                      },
                    })
                  }
                  className={`transition-all duration-300 ${viewMode === "list" ? "" : "flex-1"} bg-white/40 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 border-border-subtle backdrop-blur-sm`}
                >
                  {t("view")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCancel(res.id)}
                  className={`transition-all duration-300 ${viewMode === "list" ? "" : "flex-1"} bg-white/40 hover:bg-red-50 hover:text-red-600 hover:border-red-100 border-border-subtle backdrop-blur-sm`}
                >
                  {t("cancel")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyReservations;
