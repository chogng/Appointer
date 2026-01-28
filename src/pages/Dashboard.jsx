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
  getDashboardMessageBehaviorLabel,
  getDashboardMessageTimestampLabel,
} from "../utils/dashboardMessageFormatters";
import {
  buildDeviceNameById,
  getDashboardActivityDetailLabel,
} from "../utils/dashboardActivityFormatters";

import {
  Calendar,
  Clock,
  CheckCircle,

  Search,
  Trash2,

  User,
  Package,
  Inbox,
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
  const [deviceNameById, setDeviceNameById] = useState({});
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
          .map((u) => ({
            ...u,
            msgType: "USER_REGISTRATION",
            timestamp: u.createdAt || u.timestamp || new Date().toISOString(),
          })),
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
        visibleRequests.map((r) => ({
          ...r,
          msgType: "INVENTORY_REQUEST",
          timestamp: r.createdAt || r.timestamp || new Date().toISOString(),
        })),
      );
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    }
  }, [user]);

  const fetchDevices = useCallback(async () => {
    try {
      const devices = await apiService.getDevices();
      setDeviceNameById(buildDeviceNameById(devices));
    } catch (error) {
      console.error("Failed to fetch devices:", error);
    }
  }, []);

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
        showToast(t("dashboard_user_approved_success"), "success");
        fetchPendingUsers();
      } else if (msg.msgType === "INVENTORY_REQUEST") {
        await apiService.approveRequest(msg.id);
        showToast(t("dashboard_request_approved_success"), "success");
        fetchRequests();
      }
      if (selectedMessage?.id === msg.id) setSelectedMessage(null);
    } catch {
      showToast(t("dashboard_failed_approve"), "error");
    }
  };

  const handleReject = async (msg) => {
    const confirmMsg =
      msg.msgType === "USER_REGISTRATION"
        ? t("dashboard_confirm_reject_user")
        : t("dashboard_confirm_reject_request");

    showToast(confirmMsg, "warning", t("dashboard_reject"), async () => {
      try {
        closeToast();
        if (msg.msgType === "USER_REGISTRATION") {
          await apiService.deleteUser(msg.id);
          fetchPendingUsers();
        } else if (msg.msgType === "INVENTORY_REQUEST") {
          await apiService.rejectRequest(msg.id);
          fetchRequests();
        }
        showToast(t("dashboard_rejected_success"), "success");
        if (selectedMessage?.id === msg.id) setSelectedMessage(null);
      } catch {
        showToast(t("dashboard_failed_reject"), "error");
      }
    });
  };

  const handleRevoke = async (msg) => {
    showToast(
      t("dashboard_confirm_revoke_request"),
      "warning",
      t("dashboard_revoke"),
      async () => {
        try {
          closeToast();
          await apiService.deleteRequest(msg.id);
          fetchRequests();
          showToast(t("dashboard_request_revoked_success"), "success");
          if (selectedMessage?.id === msg.id) setSelectedMessage(null);
        } catch {
          showToast(t("dashboard_failed_revoke_request"), "error");
        }
      },
    );
  };

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchLogs(),
        fetchPendingUsers(),
        fetchRequests(),
        fetchDevices(),
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchLogs, fetchPendingUsers, fetchRequests, fetchDevices]);

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

  const getBehaviorLabel = (action, details) => {
    if (action === "LOGIN") return t("dashboard_activity_login_system");
    if (action === "RESERVATION_CREATED") return t("dashboard_activity_create_reservation");
    if (action === "DEVICE_CREATED") return t("dashboard_activity_create_device");
    if (action === "USER_CREATED") return t("dashboard_activity_register_user");
    if (action === "LITERATURE_RESEARCH") return t("dashboard_activity_literature_research");
    if (action === "RESERVATION_TIMEOUT") return t("dashboard_activity_reservation_timeout");

    if (typeof details === "string" && details.trim()) return details.trim();
    return typeof action === "string" ? action : "";
  };

  const messages = [...pendingUsers, ...requests];

  const getMessageBehaviorLabel = (msg) => getDashboardMessageBehaviorLabel(msg, t);

  const getMessageTimestampLabel = (msg) =>
    getDashboardMessageTimestampLabel(msg, { locale: zhCN });

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
            data-cta="Dashboard"
            data-cta-position="activity-notifications"
            data-cta-copy="activity-notifications-section"
            aria-labelledby="dashboard-activity-notifications-title"
            className="flex flex-col min-h-0"
          >
            <h2 id="dashboard-activity-notifications-title" className="section_title">
              {t("recentActivity")}
            </h2>
            <Card
              id="dashboard-activity-notifications-card"
              variant="fill"
              className="activity_list"
              cta="Dashboard"
              ctaPosition="activity-notifications"
              ctaCopy="activity-notifications-card"
              data-list="activity"
            >
              <div className="activity_card_head_warp">
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
                    ctaPosition="activity-notifications"
                    ctaCopy="search-logs"
                    aria-label={t("searchLogs")}
                  />
                </div>
                {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && (
                  <Button
                    type="button"
                    id="dashboard-clear-logs-btn"
                    variant="danger"
                    size="control"
                    dataIcon="with"
                    cta="Dashboard"
                    ctaPosition="activity-notifications"
                    ctaCopy="clear-logs"
                    aria-label={t("clearLogs")}
                    title={t("clearLogs")}
                    onClick={handleClearLogs}
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>
              <div className="mx-2 h-px bg-border-subtle/50" />
              <div className="overflow-y-auto flex-1 min-h-0 custom-scrollbar">
                {logs.length > 0 ? (
                  <ul
                    id="dashboard-activity-notifications-list"
                    className="flex flex-col m-0 p-0 list-none"
                  >
                    {logs.map((log) => {
                      const behaviorLabel = getBehaviorLabel(log.action, log.details);
                      const detailLabel = getDashboardActivityDetailLabel(log, {
                        deviceNameById,
                      });

                      return (
                        <ListRow
                          as="li"
                          key={log.id}
                          className="list_item"
                        >
                          <div className="activity_left">
                            <Avatar
                              fallback={log.userName || t("systemUser")}
                              className="bg-accent/10 text-accent border border-accent/10 shadow-sm"
                            />
                            <div className="flex flex-col min-w-0">
                              <div
                                className="user_name"
                                title={log.userName || t("systemUser")}
                              >
                                {log.userName || t("systemUser")}
                              </div>
                              <div className="user_behavior">{behaviorLabel}</div>
                            </div>
                          </div>

                          <div className="activity_middle">
                            <div className="activity_detail" title={detailLabel ? detailLabel : undefined}>
                              {detailLabel}
                            </div>
                          </div>

                          <div className="activity_right">
                            <div className="activity_date">
                              {format(new Date(log.timestamp), "MM-dd HH:mm", {
                                locale: zhCN,
                              })}
                            </div>
                          </div>
                        </ListRow>
                      );
                    })}
                  </ul>
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

          {/* Pending Approvals Inbox Column */}
          <section
            data-cta="Dashboard"
            data-cta-position="pending-approvals-inbox"
            data-cta-copy="pending-approvals-inbox-section"
            aria-labelledby="dashboard-message-notifications-title"
            className="flex flex-col min-h-0"
          >
            <h2 id="dashboard-message-notifications-title" className="section_title">
              {t("recentMessages")}
            </h2>
            <Card
              id="dashboard-message-notifications-card"
              variant="fill"
              className="msg_list"
              cta="Dashboard"
              ctaPosition="pending-approvals-inbox"
              ctaCopy="pending-approvals-inbox-card"
              data-list="messages"
            >
              <div className="message_card_head_warp">
                <div className="msg_header">
                  <div className="msg_left">{t("requestUser")}</div>
                  <div className="msg_middle">{t("note")}</div>
                  <div className="msg_right">{t("date")}</div>
                </div>
                {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") &&
                  messages.length > 0 && (
                    <Button
                      type="button"
                      id="dashboard-approve-all-btn"
                      variant="ghost"
                      size="control"
                      dataIcon="with"
                      cta="Dashboard"
                      ctaPosition="pending-approvals-inbox"
                      ctaCopy="approve-all"
                      aria-label={t("approveAll")}
                      title={t("approveAll")}
                      onClick={() => {
                        showToast(
                          t("confirmApproveAll"),
                          "warning",
                          t("approveAll"),
                          async () => {
                            try {
                              closeToast();
                              await Promise.all(
                                messages.map((msg) => {
                                  if (msg.msgType === "USER_REGISTRATION") {
                                    return apiService.updateUser(msg.id, {
                                      status: "ACTIVE",
                                    });
                                  } else if (
                                    msg.msgType === "INVENTORY_REQUEST"
                                  ) {
                                    return apiService.approveRequest(msg.id);
                                  }
                                  return Promise.resolve();
                                }),
                              );
                              await Promise.all([
                                fetchPendingUsers(),
                                fetchRequests(),
                              ]);
                              showToast(t("approveAllSuccess"), "success");
                            } catch (error) {
                              console.error("Failed to approve all:", error);
                              showToast(t("approveAllFailed"), "error");
                            }
                          },
                        );
                      }}
                    >
                      <CheckCircle size={16} />
                    </Button>
                  )}
              </div>
              <div className="mx-2 h-px bg-border-subtle/50" />
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {messages.length > 0 ? (
                  <ul
                    id="dashboard-message-notifications-list"
                    className="flex flex-col m-0 p-0 list-none"
                  >
                    {messages.map((msg) => (
                      (() => {
                        const behaviorLabel = getMessageBehaviorLabel(msg);
                        const tsLabel = getMessageTimestampLabel(msg);

                        const detailsNode = (() => {
                          if (msg.msgType === "USER_REGISTRATION") {
                            return msg.email ? (
                              <span className="user_request_email">
                                {msg.email}
                              </span>
                            ) : (
                              <span className="user_request_email">
                                --
                              </span>
                            );
                          }
                          try {
                            const data = JSON.parse(msg.newData || "{}");
                            const itemName = data.name || "Unknown Item";
                            const quantity = data.quantity || 0;
                            return (
                              <span className="msg_pill">
                                <span className="msg_pill_name">
                                  {itemName}
                                </span>
                                <span className="msg_pill_qty">
                                  x{quantity}
                                </span>
                              </span>
                            );
                          } catch {
                            return (
                              <span className="user_request_email">
                                --
                              </span>
                            );
                          }
                        })();

                        return (
                      <li
                        key={msg.id}
                        className="list-row group list_item"
                        onClick={() => setSelectedMessage(msg)}
                      >
                        <div className="msg_left">
                          <Avatar
                            size="md"
                            fallback={msg.name || "?"}
                            groupHover
                            icon={
                              msg.msgType !== "USER_REGISTRATION"
                                ? Package
                                : undefined
                            }
                          />
                          <div className="min-w-0">
                            <div
                              className="user_name"
                            >
                              {msg.msgType === "USER_REGISTRATION"
                                ? msg.name
                                : msg.requesterName}
                            </div>
                            <div
                              className="user_behavior"
                            >
                              {behaviorLabel}
                            </div>
                          </div>
                        </div>

                        <div
                          className="msg_middle msg_detail"
                        >
                          {detailsNode}
                        </div>

                        <div
                          className="msg_right msg_date"
                        >
                          {tsLabel}
                        </div>
                      </li>
                        );
                      })()
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-2 py-8">
                    <div className="w-12 h-12 rounded-full bg-bg-200/50 flex items-center justify-center">
                      <Inbox size={20} className="opacity-50" />
                    </div>
                    <p className="text-sm">{t("noPendingRequests")}</p>
                  </div>
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
                  className="action-btn--danger"
                >
                  {t("dashboard_reject")}
                </Button>
                <Button
                  onClick={() => handleApprove(selectedMessage)}
                  variant="primary"
                  size="md"
                >
                  {t("dashboard_approve")}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => handleRevoke(selectedMessage)}
                variant="ghost"
                size="md"
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
    </div >
  );
};

export default Dashboard;
