import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiService } from "../services/apiService";
import { useAuth } from "../hooks/useAuth";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Dropdown from "../components/ui/Dropdown";
import SegmentedControl from "../components/ui/SegmentedControl";
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
    devices.find((d) => d.id === id)?.name || "未知设备";
  const getUserName = (id) =>
    users.find((u) => u.id === id)?.name || "未知用户";

  const handleCancel = async (id) => {
    if (!confirm("您确定要取消此预约吗？")) return;

    try {
      await apiService.updateReservation(id, { status: "CANCELLED" });
      await loadData();
    } catch (error) {
      console.error("Failed to cancel reservation:", error);
      alert("取消失败，请重试");
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
    if (!confirm(`确定要取消选中的 ${selectedIds.size} 个预约吗？`)) return;

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
      alert("批量取消失败，请重试");
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
    { label: "全部设备", value: "all" },
    ...devices.map((d) => ({ label: d.name, value: d.id })),
  ];

  if (loading) {
    return <div className="min-h-[200px]" />;
  }

  return (
    <div className="max-w-[1500px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-6">
          {!isAdmin && (
            <h1 className="text-3xl font-serif font-medium text-text-primary">
              我的预约
            </h1>
          )}
          {isAdmin && (
            <div className="w-[200px] mt-1">
              <SegmentedControl
                options={[
                  { label: "我的预约", value: "mine" },
                  { label: "用户预约", value: "all" },
                ]}
                value={scope}
                onChange={setScope}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center animate-in fade-in slide-in-from-right-4 duration-300">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBulkCancel}
                className="flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
              >
                <Trash2 size={16} />
                取消选中 ({selectedIds.size})
              </Button>
            </div>
          )}

          {/* Device Filter */}
          <div className="w-[180px]">
            <Dropdown
              options={filterOptions}
              value={filterDeviceId}
              onChange={setFilterDeviceId}
              placeholder="筛选设备"
            />
          </div>

          {/* View Switcher */}
          <div className="flex bg-white/40 backdrop-blur-sm border border-border-subtle rounded-xl p-1 shadow-sm">
            <button
              onClick={toggleSelectAll}
              className={`p-2 rounded-lg transition-all duration-200 ${
                isAllSelected
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-text-secondary hover:bg-white/60"
              }`}
              title={isAllSelected ? "取消全选" : "全选"}
            >
              {isAllSelected ? <CheckSquare size={20} /> : <Square size={20} />}
            </button>
            <div className="w-[1px] bg-border-subtle my-1 mx-1" />
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition-all duration-200 ${
                viewMode === "list"
                  ? "bg-[#7FB77E] text-white shadow-md shadow-green-100"
                  : "text-text-secondary hover:bg-white/60"
              }`}
              title="列表视图"
            >
              <List size={20} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg transition-all duration-200 ${
                viewMode === "grid"
                  ? "bg-[#7FB77E] text-white shadow-md shadow-green-100"
                  : "text-text-secondary hover:bg-white/60"
              }`}
              title="网格视图"
            >
              <LayoutGrid size={20} />
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
              ? "您当前没有有效的预约。"
              : "该设备下没有预约记录。"}
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
                      ? "bg-[#7FB77E] border-[#7FB77E] text-white shadow-sm"
                      : "bg-white border-gray-300 text-transparent hover:border-[#7FB77E]"
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
                    className="text-[#7FB77E] dark:text-green-400"
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
                  查看
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCancel(res.id)}
                  className={`transition-all duration-300 ${viewMode === "list" ? "" : "flex-1"} bg-white/40 hover:bg-red-50 hover:text-red-600 hover:border-red-100 border-border-subtle backdrop-blur-sm`}
                >
                  取消
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
