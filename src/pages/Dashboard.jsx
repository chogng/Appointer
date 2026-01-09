import React, { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useCallback, useMemo, useRef } from "react";
import Card from "../components/ui/Card";
import Toast from "../components/ui/Toast";
import Modal from "../components/ui/Modal";
import { apiService } from "../services/apiService";
import { useRealtimeSync } from "../hooks/useRealtimeSync";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

import {
  Calendar,
  Clock,
  CheckCircle,
  Activity,
  Search,
  Trash2,
  MessageSquare,
  Check,
  X,
  User,
  Package,
} from "lucide-react";

import { useLanguage } from "../hooks/useLanguage";

const Dashboard = () => {
  const containerRef = useRef(null);
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState({
    isVisible: false,
    message: "",
    type: "success",
    actionText: null,
    onAction: null,
  });

  const showToast = (
    message,
    type = "success",
    actionText = null,
    onAction = null,
  ) => {
    setToast({ isVisible: true, message, type, actionText, onAction });
  };

  const closeToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  const stats = [
    {
      label: t("upcomingReservations"),
      value: "2",
      icon: Calendar,
      color: "#0071E3",
    },
    {
      label: t("reservedHours"),
      value: `14 ${t("hours")}`,
      icon: Clock,
      color: "#34C759",
    },
    { label: t("completed"), value: "8", icon: CheckCircle, color: "#FF9F0A" },
  ];

  const fetchLogs = useCallback(async () => {
    try {
      const data = await apiService.getLogs(searchTerm);
      if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
        setLogs(data);
      } else {
        setLogs(data.filter((log) => log.userId === user?.id));
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    }
  }, [searchTerm, user]);

  const fetchPendingUsers = useCallback(async () => {
    if (!isAdmin) {
      setPendingUsers([]);
      return;
    }

    try {
      const users = await apiService.getUsers();
      setPendingUsers(
        users
          .filter((u) => u.status === "PENDING")
          .map((u) => ({ ...u, msgType: "USER_REGISTRATION" })),
      );
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  }, [isAdmin]);

  const fetchRequests = useCallback(async () => {
    try {
      const reqs = (await apiService.getRequests()).filter(
        (r) => r.status === "PENDING",
      );
      let visibleRequests = reqs;
      if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
        visibleRequests = reqs.filter((r) => r.requesterId === user?.id);
      }
      setRequests(
        visibleRequests.map((r) => ({ ...r, msgType: "INVENTORY_REQUEST" })),
      );
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    }
  }, [user]);

  const handleClearLogs = async () => {
    showToast(
      t("confirmClearLogs") || "Are you sure you want to clear all logs?",
      "warning",
      t("clearLogs") || "Clear",
      async () => {
        try {
          closeToast();
          await apiService.deleteLogs();
          await fetchLogs();
          setTimeout(() => {
            showToast(t("updateSuccess") || "Success", "success");
          }, 300);
        } catch (error) {
          console.error("Failed to clear logs:", error);
          setTimeout(() => {
            showToast(t("clearLogsFailed") || "Failed to clear logs", "error");
          }, 300);
        }
      },
    );
  };

  const handleApprove = async (msg) => {
    try {
      if (msg.msgType === "USER_REGISTRATION") {
        await apiService.updateUser(msg.id, { status: "ACTIVE" });
        showToast("User approved successfully", "success");
        fetchPendingUsers();
      } else if (msg.msgType === "INVENTORY_REQUEST") {
        await apiService.approveRequest(msg.id);
        showToast("Request approved successfully", "success");
        fetchRequests();
      }
      if (selectedMessage?.id === msg.id) setSelectedMessage(null);
    } catch {
      showToast("Failed to approve", "error");
    }
  };

  const handleReject = async (msg) => {
    const confirmMsg =
      msg.msgType === "USER_REGISTRATION"
        ? "Are you sure you want to reject and delete this user?"
        : "Are you sure you want to reject this request?";

    showToast(confirmMsg, "warning", "Reject", async () => {
      try {
        closeToast();
        if (msg.msgType === "USER_REGISTRATION") {
          await apiService.deleteUser(msg.id);
          fetchPendingUsers();
        } else if (msg.msgType === "INVENTORY_REQUEST") {
          await apiService.rejectRequest(msg.id);
          fetchRequests();
        }
        showToast("Rejected successfully", "success");
        if (selectedMessage?.id === msg.id) setSelectedMessage(null);
      } catch {
        showToast("Failed to reject", "error");
      }
    });
  };

  const handleRevoke = async (msg) => {
    showToast(
      "Are you sure you want to revoke this request?",
      "warning",
      "Revoke",
      async () => {
        try {
          closeToast();
          await apiService.deleteRequest(msg.id);
          fetchRequests();
          showToast("Request revoked successfully", "success");
          if (selectedMessage?.id === msg.id) setSelectedMessage(null);
        } catch {
          showToast("Failed to revoke request", "error");
        }
      },
    );
  };

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchLogs(), fetchPendingUsers(), fetchRequests()]);
      setLoading(false);
    };
    loadData();
  }, [fetchLogs, fetchPendingUsers, fetchRequests]);

  const logSyncHandlers = useMemo(
    () => ({
      "reservation:created": fetchLogs,
      "device:created": fetchLogs,
      "user:created": () => {
        fetchLogs();
        fetchPendingUsers();
      },
      "user:updated": fetchPendingUsers,
      "request:created": fetchRequests,
      "request:approved": fetchRequests,
      "request:rejected": fetchRequests,
      "request:deleted": fetchRequests,
    }),
    [fetchLogs, fetchPendingUsers, fetchRequests],
  );

  useRealtimeSync(logSyncHandlers);

  if (loading) {
    return <div className="min-h-[200px]" />;
  }

  const getActionLabel = (action) => {
    const labels = {
      LOGIN: t("loginParams"),
      DEVICE_CREATED: t("createDevice"),
      RESERVATION_CREATED: t("createReservation"),
      USER_CREATED: t("registerUser"),
    };
    return labels[action] || action;
  };

  const messages = [...pendingUsers, ...requests];

  return (
    <div
      ref={containerRef}
      className="w-full relative min-h-screen"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-medium text-text-primary mb-2">
          {t("dashboard")}
        </h1>
        <p className="text-text-secondary">
          {t("welcomeBack")}, {user?.name}
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-6">
        {stats.map((stat, index) => (
          <Card
            key={index}
            variant="glass"
            className="flex items-center gap-4 hover:shadow-md transition-shadow duration-200"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${stat.color}15` }}
            >
              <stat.icon size={24} color={stat.color} />
            </div>
            <div>
              <div className="text-2xl font-bold text-text-primary">
                {stat.value}
              </div>
              <div className="text-sm text-text-secondary">{stat.label}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity Column */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity size={20} className="text-accent" />
              <h2 className="text-xl font-serif font-medium text-text-primary">
                {t("recentActivity")}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                  size={16}
                />
                <input
                  type="text"
                  placeholder={t("searchLogs") || "Search logs..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-sm bg-bg-200 border-none rounded-lg focus:ring-1 focus:ring-accent w-40 transition-all"
                />
              </div>
              {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && (
                <button
                  onClick={handleClearLogs}
                  className="p-1.5 text-text-tertiary hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title={t("clearLogs") || "Clear logs"}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
          <Card
            variant="glass"
            className="p-0 overflow-hidden h-[500px] overflow-y-auto"
          >
            {logs.length > 0 ? (
              <div className="divide-y divide-border-subtle">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 flex items-center justify-between hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-bg-200 flex items-center justify-center text-text-secondary shrink-0">
                        {log.userName?.[0] || t("systemUser")[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-text-primary">
                          <span className="text-accent">
                            {log.userName || t("systemUser")}
                          </span>{" "}
                          {getActionLabel(log.action)}
                        </div>
                        <div className="text-xs text-text-tertiary">
                          {log.details}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-text-tertiary shrink-0">
                      {format(new Date(log.timestamp), "MM-dd HH:mm", {
                        locale: zhCN,
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary text-center py-8">
                {t("noActivity")}
              </p>
            )}
          </Card>
        </div>

        {/* Recent Messages (Pending Approvals & Requests) Column */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={20} className="text-accent" />
            <h2 className="text-xl font-serif font-medium text-text-primary">
              {t("recentMessages") || "Recent Messages"}
            </h2>
          </div>
          <Card
            variant="glass"
            className="p-0 overflow-hidden h-[500px] overflow-y-auto"
          >
            {messages.length > 0 ? (
              <div className="divide-y divide-border-subtle">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-4 flex items-center justify-between hover:bg-accent/5 transition-colors cursor-pointer group"
                    onClick={() => setSelectedMessage(msg)}
                  >
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="w-10 h-10 rounded-full bg-bg-200 flex items-center justify-center text-text-primary font-medium shrink-0 group-hover:bg-accent/10 group-hover:text-accent transition-colors">
                        {msg.msgType === "USER_REGISTRATION" ? (
                          msg.name?.[0] || "?"
                        ) : (
                          <Package size={18} />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                          {msg.msgType === "USER_REGISTRATION"
                            ? msg.name
                            : msg.requesterName}
                          {msg.msgType === "USER_REGISTRATION" && (
                            <span className="text-text-tertiary text-xs">
                              {" "}
                              ({msg.username})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-text-secondary">
                          {msg.msgType === "USER_REGISTRATION"
                            ? "Applied for account"
                            : "Inventory Request"}
                        </div>
                        {msg.email && (
                          <div className="text-xs text-text-tertiary">
                            {msg.email}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 flex items-center justify-end px-4 text-sm text-text-secondary">
                      {(() => {
                        if (msg.msgType === "USER_REGISTRATION") return null;
                        try {
                          const data = JSON.parse(msg.newData || "{}");
                          const itemName = data.name || "Unknown Item";
                          const quantity = data.quantity || 0;
                          return (
                            <span className="flex items-center gap-2 bg-bg-200/50 px-3 py-1.5 rounded-lg border border-border/50">
                              <span className="font-medium text-text-primary">
                                {itemName}
                              </span>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                                x{quantity}
                              </span>
                            </span>
                          );
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      {user?.role === "ADMIN" ||
                      user?.role === "SUPER_ADMIN" ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(msg);
                            }}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-colors"
                            title="Approve"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(msg);
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                            title="Reject"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRevoke(msg);
                          }}
                          className="p-2 text-text-tertiary hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                          title="Revoke request"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary text-center py-8">
                {t("noPendingRequests") || "No new messages"}
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Message Details Modal */}
      <Modal
        isOpen={!!selectedMessage}
        onClose={() => setSelectedMessage(null)}
        title={
          selectedMessage?.msgType === "USER_REGISTRATION"
            ? "Application Details"
            : "Request Details"
        }
        footer={
          <>
            {user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" ? (
              <>
                <button
                  onClick={() => handleReject(selectedMessage)}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleApprove(selectedMessage)}
                  className="px-4 py-2 bg-text-primary text-white hover:bg-text-primary/90 rounded-lg transition-colors text-sm font-medium"
                >
                  Approve
                </button>
              </>
            ) : (
              <button
                onClick={() => handleRevoke(selectedMessage)}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
              >
                Revoke Request
              </button>
            )}
          </>
        }
      >
        {selectedMessage && selectedMessage.msgType === "USER_REGISTRATION" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-bg-200 flex items-center justify-center text-text-primary text-2xl font-serif">
                {selectedMessage.name?.[0] || "?"}
              </div>
              <div>
                <h3 className="text-lg font-medium text-text-primary">
                  {selectedMessage.name}
                </h3>
                <p className="text-text-secondary">
                  {selectedMessage.username}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-bg-200/50 rounded-xl">
                <div className="text-xs text-text-tertiary mb-1">
                  Student ID
                </div>
                <div className="text-sm font-medium text-text-primary flex items-center gap-2">
                  <User size={14} />
                  {selectedMessage.username}
                </div>
              </div>
              <div className="p-3 bg-bg-200/50 rounded-xl">
                <div className="text-xs text-text-tertiary mb-1">Status</div>
                <div className="text-sm font-medium text-orange-500 flex items-center gap-2">
                  <Clock size={14} />
                  Pending Review
                </div>
              </div>
              <div className="col-span-2 p-3 bg-bg-200/50 rounded-xl">
                <div className="text-xs text-text-tertiary mb-1">Email</div>
                <div className="text-sm font-medium text-text-primary">
                  {selectedMessage.email || "Not provided"}
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedMessage &&
          (selectedMessage.msgType === "INVENTORY_REQUEST" ||
            selectedMessage.type === "INVENTORY_ADD") && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-bg-200 flex items-center justify-center text-text-primary text-2xl font-serif">
                  <Package size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-text-primary">
                    {selectedMessage.type === "INVENTORY_ADD"
                      ? "New Inventory Item"
                      : "Inventory Modification"}
                  </h3>
                  <p className="text-text-secondary">
                    Requested by {selectedMessage.requesterName}
                  </p>
                </div>
              </div>

              <div className="bg-bg-200/50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-text-primary mb-3">
                  {selectedMessage.type === "INVENTORY_ADD"
                    ? "Item Details"
                    : "Changes Breakdown"}
                </h4>

                {(() => {
                  const original =
                    (selectedMessage.originalData
                      ? JSON.parse(selectedMessage.originalData)
                      : {}) || {};
                  const newData =
                    JSON.parse(selectedMessage.newData || "{}") || {};

                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 text-xs text-text-tertiary mb-1 border-b border-border/50 pb-2">
                        <div>Field</div>
                        <div>Original</div>
                        <div>New Value</div>
                      </div>

                      {["name", "category", "quantity"].map((field) => {
                        const isChanged = original[field] != newData[field];
                        return (
                          <div
                            key={field}
                            className={`grid grid-cols-3 text-sm ${isChanged && selectedMessage.type !== "INVENTORY_ADD" ? "bg-accent/5 -mx-2 px-2 py-1 rounded" : ""}`}
                          >
                            <div className="text-text-secondary capitalize">
                              {field}
                            </div>
                            <div className="text-text-secondary">
                              {original[field] || "-"}
                            </div>
                            <div
                              className={`font-medium ${isChanged ? "text-accent" : "text-text-primary"}`}
                            >
                              {newData[field]}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
      </Modal>

      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={closeToast}
        actionText={toast.actionText}
        onAction={toast.onAction}
        containerRef={containerRef}
        type={toast.type}
      />
    </div>
  );
};

export default Dashboard;
