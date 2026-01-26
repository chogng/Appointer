import React, { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useCallback, useMemo, useRef } from "react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import ListRow from "../components/ui/ListRow";
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

  Search,
  Trash2,

  Check,
  X,
  User,
  Package,
} from "lucide-react";

import { useLanguage } from "../hooks/useLanguage";
import Avatar from "../components/ui/Avatar";

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
      id: "upcoming-reservations",
      label: t("upcomingReservations"),
      value: "2",
      icon: Calendar,
      color: "#0071E3",
    },
    {
      id: "reserved-hours",
      label: t("reservedHours"),
      value: `14 ${t("hours")}`,
      icon: Clock,
      color: "#34C759",
    },
    {
      id: "completed",
      label: t("completed"),
      value: "8",
      icon: CheckCircle,
      color: "#FF9F0A",
    },
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
      t("confirmClearLogs"),
      "warning",
      t("clearLogs"),
      async () => {
        try {
          closeToast();
          await apiService.deleteLogs();
          await fetchLogs();
          setTimeout(() => {
            showToast(t("updateSuccess"), "success");
          }, 300);
        } catch (error) {
          console.error("Failed to clear logs:", error);
          setTimeout(() => {
            showToast(t("clearLogsFailed"), "error");
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
      className="dashboard_page w-full relative h-full min-h-0 flex flex-col"
    >
      <div className="page_head">
        <h1 className="page_title">{t("dashboard")}</h1>
        <p className="page_subtitle">
          {t("welcomeBack")}, {user?.name}
        </p>
      </div>

      <div className="page_content flex-1 min-h-0">
        <section aria-labelledby="dashboard-overview-title">
          <h2 id="dashboard-overview-title" className="section_title">
            {t("overview")}
          </h2>
          <div className="grid_auto_cards">
            {stats.map((stat) => (
              <Card
                key={stat.id}
                id={`dashboard-overview-stat-${stat.id}`}
                className="flex items-center gap-4"
                cta="Dashboard"
                ctaPosition="overview"
                ctaCopy={stat.id}
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
                  <div className="text-sm text-text-secondary">
                    {stat.label}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <div className="dashboard_fill_grid grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
          {/* Recent Activity Column */}
          <section
            aria-labelledby="dashboard-recent-activity-title"
            className="flex flex-col min-h-0"
          >
            <h2 id="dashboard-recent-activity-title" className="section_title">
              {t("recentActivity")}
            </h2>
            <Card
              id="dashboard-recent-activity-card"
              variant="fill"
              cta="Dashboard"
              ctaPosition="recent-activity"
              ctaCopy="activity-card"
            >
              <div className="card_head_warp">
                <div className="flex-1 max-w-sm">
                  <Input
                    id="dashboard-search-logs"
                    idBase="dashboard-search-logs"
                    name="searchLogs"
                    type="text"
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder={t("searchLogs")}
                    leftIcon={Search}
                    size="sm"
                    className="w-full"
                    fieldClassName="h-[38px]"
                    inputClassName="text-sm bg-bg-200/50 border-transparent focus:border-accent/20 focus:bg-bg-100 placeholder:text-text-tertiary"
                    autoComplete="off"
                    spellCheck={false}
                    cta="Dashboard"
                    ctaPosition="recent-activity"
                    ctaCopy="search-logs"
                    aria-label={t("searchLogs")}
                  />
                </div>
                {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && (
                  <Button
                    id="dashboard-clear-logs-btn"
                    type="button"
                    onClick={handleClearLogs}
                    variant="ghost"
                    size="sm"
                    fx
                    fxMuted
                    className="action-btn--icon-md-tight text-text-tertiary hover:text-red-500 hover:bg-red-500/10"
                    title={t("clearLogs")}
                    aria-label={t("clearLogs")}
                    cta="Dashboard"
                    ctaPosition="recent-activity"
                    ctaCopy="clear-logs"
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>
              <div className="mx-2 h-px bg-border-subtle/50" />
              <div className="overflow-y-auto flex-1 min-h-0 custom-scrollbar">
                {logs.length > 0 ? (
                  <div className="flex flex-col">
                    {logs.map((log) => {
                      const isLogin = log.action === "LOGIN";
                      const normalizedRole = (
                        typeof log.userRole === "string"
                          ? log.userRole
                          : typeof log.details === "string"
                            ? log.details
                            : ""
                      ).trim();

                      const roleLabel = ["USER", "ADMIN", "SUPER_ADMIN"].includes(
                        normalizedRole,
                      )
                        ? t(normalizedRole)
                        : "";

                      const actionLabel = isLogin
                        ? roleLabel
                        : getActionLabel(log.action);

                      return (
                        <ListRow key={log.id}>
                          <div className="flex items-center gap-3.5">
                            <Avatar
                              fallback={log.userName || t("systemUser")}
                              className="bg-accent/10 text-accent border border-accent/10 shadow-sm"
                            />
                            <div className="flex flex-col min-w-0">
                              <div className="text-sm font-semibold text-text-primary truncate" title={log.userName || t("systemUser")}>
                                {log.userName || t("systemUser")}
                              </div>
                              {actionLabel && (
                                <div className="text-xs text-text-secondary mt-0.5 truncate">
                                  {actionLabel}
                                </div>
                              )}
                              {!isLogin && (
                                <div className="text-xs text-text-tertiary/80 mt-0.5 line-clamp-1 break-all">
                                  {log.details}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-xs font-medium text-text-tertiary/70 shrink-0 transition-colors ml-2">
                            {format(new Date(log.timestamp), "MM-dd HH:mm", {
                              locale: zhCN,
                            })}
                          </div>
                        </ListRow>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-2">
                    <div className="w-12 h-12 rounded-full bg-bg-200/50 flex items-center justify-center">
                      <Search size={20} className="opacity-50" />
                    </div>
                    <p className="text-sm">{t("noActivity")}</p>
                  </div>
                )}
              </div>
            </Card>
          </section>

          {/* Recent Messages (Pending Approvals & Requests) Column */}
          <section
            aria-labelledby="dashboard-recent-messages-title"
            className="flex flex-col min-h-0"
          >
            <h2 id="dashboard-recent-messages-title" className="section_title">
              {t("recentMessages")}
            </h2>
            <Card
              id="dashboard-recent-messages-card"
              variant="fill"
              cta="Dashboard"
              ctaPosition="recent-messages"
              ctaCopy="messages-card"
            >
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {messages.length > 0 ? (
                  <div className="divide-y divide-border-subtle">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-4 flex items-center justify-between hover:bg-accent/5 transition-colors cursor-pointer group"
                        onClick={() => setSelectedMessage(msg)}
                      >
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <Avatar
                            size="md"
                            fallback={msg.name || "?"}
                            icon={msg.msgType !== "USER_REGISTRATION" ? Package : undefined}
                            className="bg-bg-200 group-hover:bg-accent/10 group-hover:text-accent"
                          />
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
                                ? t("dashboard_applied_for_account")
                                : t("dashboard_inventory_request")}
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
                                type="button"
                                aria-label={t("dashboard_approve")}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprove(msg);
                                }}
                                className="action-btn action-btn--icon-md-tight action-btn--fx action-btn--ghost"
                                title={t("dashboard_approve")}
                              >
                                <span className="action-btn__content">
                                  <Check size={18} />
                                </span>
                              </button>
                              <button
                                type="button"
                                aria-label={t("dashboard_reject")}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReject(msg);
                                }}
                                className="action-btn action-btn--icon-md-tight action-btn--fx action-btn--ghost action-btn--danger"
                                title={t("dashboard_reject")}
                              >
                                <span className="action-btn__content">
                                  <X size={18} />
                                </span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              aria-label={t("dashboard_revoke_request")}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRevoke(msg);
                              }}
                              className="action-btn action-btn--icon-md-tight action-btn--fx action-btn--ghost action-btn--danger"
                              title={t("dashboard_revoke_request")}
                            >
                              <span className="action-btn__content">
                                <Trash2 size={18} />
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-secondary text-center py-8">
                    {t("noPendingRequests")}
                  </p>
                )}
              </div>
            </Card>
          </section>
        </div>
      </div>

      {/* Message Details Modal */}
      <Modal
        isOpen={!!selectedMessage}
        onClose={() => setSelectedMessage(null)}
        title={
          selectedMessage?.msgType === "USER_REGISTRATION"
            ? t("dashboard_application_details")
            : t("dashboard_request_details")
        }
        footer={
          <>
            {user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" ? (
              <>
                <Button
                  onClick={() => handleReject(selectedMessage)}
                  variant="ghost"
                  size="md"
                  fx
                  className="action-btn--danger"
                >
                  {t("dashboard_reject")}
                </Button>
                <Button
                  onClick={() => handleApprove(selectedMessage)}
                  variant="primary"
                  size="md"
                  fx
                >
                  {t("dashboard_approve")}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => handleRevoke(selectedMessage)}
                variant="ghost"
                size="md"
                fx
                className="action-btn--danger"
              >
                {t("dashboard_revoke_request")}
              </Button>
            )}
          </>
        }
      >
        {selectedMessage && selectedMessage.msgType === "USER_REGISTRATION" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-6">
              <Avatar
                size="xl"
                fallback={selectedMessage.name || "?"}
                className="bg-bg-200 font-serif"
              />
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
                <Avatar
                  size="xl"
                  icon={Package}
                  className="bg-bg-200 font-serif"
                />
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
