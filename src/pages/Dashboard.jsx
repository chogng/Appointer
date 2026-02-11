import React, { useCallback, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import ListRow from "../components/ui/ListRow";
import Toast from "../components/ui/Toast";
import Modal from "../components/ui/Modal";
import Tabs from "../components/ui/Tabs";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  getDashboardActivityDeviceNames,
  getDashboardActivityDetailLabel,
} from "../utils/dashboardActivityFormatters";
import { useDashboardActivity } from "./dashboard/useDashboardActivity";
import { useDashboardInbox } from "./dashboard/useDashboardInbox";
import { useDashboardPageData } from "./dashboard/useDashboardPageData";
import { useDashboardStats } from "./dashboard/useDashboardStats";

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
import StatusBadge from "../components/ui/StatusBadge";

const Dashboard = () => {
  const containerRef = useRef(null);
  const { user } = useAuth();
  const { t } = useLanguage();
  const [toast, setToast] = useState({
    isVisible: false,
    message: "",
    type: "success",
    actionText: null,
    onAction: null,
  });

  const showToast = useCallback((
    message,
    type = "success",
    actionText = null,
    onAction = null,
  ) => {
    setToast({ isVisible: true, message, type, actionText, onAction });
  }, []);

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  }, []);

  const activity = useDashboardActivity({ user, t, showToast, closeToast });
  const inbox = useDashboardInbox({
    user,
    t,
    showToast,
    closeToast,
    reviewedInboxLimit: 100,
  });
  const dashboardStats = useDashboardStats({ user, t });
  const { loading } = useDashboardPageData({
    fetchLogs: activity.fetchLogs,
    fetchPendingUsers: inbox.fetchPendingUsers,
    fetchRequests: inbox.fetchRequests,
    fetchDevices: activity.fetchDevices,
    fetchReservations: dashboardStats.fetchReservations,
  });

  const isAdmin = inbox.isAdmin;

  const isStatsLoading = dashboardStats.isLoading || loading;
  const stats = [
    {
      id: "upcoming-reservations",
      label: t("upcomingReservations"),
      value: isStatsLoading ? "—" : String(dashboardStats.stats.upcomingCount),
      icon: Calendar,
      color: "#0071E3",
    },
    {
      id: "reserved-hours",
      label: t("reservedHours"),
      value: isStatsLoading ? "—" : dashboardStats.stats.reservedHoursLabel,
      icon: Clock,
      color: "#34C759",
    },
    {
      id: "completed",
      label: t("completed"),
      value: isStatsLoading ? "—" : String(dashboardStats.stats.completedCount),
      icon: CheckCircle,
      color: "#FF9F0A",
    },
  ];

  const logs = activity.logs;
  const deviceNameById = activity.deviceNameById;
  const searchTerm = activity.searchTerm;

  const messages = inbox.messages;
  const selectedMessage = inbox.selectedMessage;
  const messageTab = inbox.messageTab;

  const getActivityBehaviorLabel = activity.getActivityBehaviorLabel;
  const getMessageBehaviorLabel = inbox.getMessageBehaviorLabel;
  const getMessageTimestampLabel = inbox.getMessageTimestampLabel;

  const renderDashboardEmptyState = ({ icon, message, className = "" }) => (
    <div className={`empty_state_center h-full ${className}`.trim()}>
      <Avatar icon={icon} size="lg" variant="empty" iconClassName="opacity-50" />
      <p className="empty_state_hint">{message}</p>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="dashboard_page w-full relative flex flex-col lg:h-full lg:min-h-0"
    >
      <header className="page_head">
        <h1 className="page_title">{t("dashboard")}</h1>
        <p className="page_subtitle">
          {t("welcomeBack")}, {user?.name}
        </p>
      </header>

      <div className="page_content lg:flex-1 lg:min-h-0">
        <section aria-labelledby="dashboard-overview-title">
          <h2 id="dashboard-overview-title" className="section_title">
            {t("overview")}
          </h2>
          <div className="grid_auto_cards">
            {stats.map((stat) => (
              <Card
                key={stat.id}
                id={`dashboard-overview-stat-${stat.id}`}
                className="p-4 flex items-center gap-4"
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

        <div className="dashboard_fill_grid grid grid-cols-1 lg:grid-cols-2 gap-8 lg:flex-1 lg:min-h-0">
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
            >
              <div className="activity_card_head_warp">
                <div className="flex-1">
                  <Input
                    id="dashboard-search-logs"
                    idBase="dashboard-search-logs"
                    name="searchLogs"
                    type="text"
                    value={searchTerm}
                    onChange={activity.setSearchTerm}
                    placeholder={t("searchLogs")}
	                    leftIcon={Search}
	                    size="md"
	                    className="w-full"
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
                    onClick={activity.handleClearLogs}
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
                      const behaviorLabel = getActivityBehaviorLabel(
                        log.action,
                        log.details,
                      );
                      const detailLabel = getDashboardActivityDetailLabel(log, {
                        deviceNameById,
                      });
                      const deviceNames = getDashboardActivityDeviceNames(log, {
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
                              {deviceNames.map((name, idx) => (
                                <span key={`${log.id}-${name}`} className="device_name">
                                  {idx > 0 ? " " : ""}
                                  {name}
                                </span>
                              ))}
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
                  renderDashboardEmptyState({
                    icon: Search,
                    message: t("noActivity"),
                  })
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
            >
              <div className="message_card_head_warp">
                <div className="min-w-0">
                  <Tabs
                    idBase="dashboard-message-inbox-tabs"
                    groupLabel={t("recentMessages")}
                    value={messageTab}
                    onChange={(next) =>
                      inbox.setMessageTab(next === "reviewed" ? "reviewed" : "pending")
                    }
                    options={[
                      {
                        label: t("dashboard_tab_pending"),
                        value: "pending",
                        icon: Clock,
                        cta: "Dashboard",
                        ctaPosition: "pending-approvals-inbox",
                        ctaCopy: "tab-pending",
                      },
                      {
                        label: t("dashboard_tab_reviewed"),
                        value: "reviewed",
                        icon: CheckCircle,
                        cta: "Dashboard",
                        ctaPosition: "pending-approvals-inbox",
                        ctaCopy: "tab-reviewed",
                      },
                    ]}
                  />
                </div>
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") &&
                    messageTab === "pending" && (
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
                        onClick={inbox.handleApproveAll}
                      >
                        <CheckCircle size={16} />
                      </Button>
                    )}
                  {isAdmin && messageTab === "reviewed" && (
                    <Button
                      type="button"
                      id="dashboard-clear-reviewed-btn"
                      variant="danger"
                      size="control"
                      dataIcon="with"
                      cta="Dashboard"
                      ctaPosition="pending-approvals-inbox"
                      ctaCopy="clear-reviewed"
                      aria-label={t("dashboard_clear_reviewed")}
                      title={t("dashboard_clear_reviewed")}
                      onClick={inbox.handleClearReviewedRequests}
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
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
                          if (messageTab === "reviewed") {
                            return <StatusBadge status={msg.status} pendingLabelKey="reviewing" />;
                          }

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
                            onClick={() => inbox.setSelectedMessage(msg)}
                          >
                            <div className="msg_left">
                              <Avatar
                                size="md"
                                fallback={msg.name || "?"}
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
                  renderDashboardEmptyState({
                    icon: Inbox,
                    message:
                      messageTab === "reviewed"
                        ? t("dashboard_no_reviewed_requests")
                        : t("noPendingRequests"),
                    className: "py-8",
                  })
                )}
              </div>
            </Card>
          </section>
        </div>
      </div>

      {/* Message Details Modal */}
      <Modal
        isOpen={!!selectedMessage}
        onClose={() => inbox.setSelectedMessage(null)}
        idBase="message-details"
        title={
          selectedMessage?.msgType === "USER_REGISTRATION"
            ? t("dashboard_application_details")
            : t("dashboard_request_details")
        }
        footer={
          <>
            {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") &&
              selectedMessage?.status === "PENDING" ? (
              <>
                <Button
                  onClick={() => inbox.handleReject(selectedMessage)}
                  variant="ghost"
                  size="md"
                  className="action-btn--danger"
                >
                  {t("dashboard_reject")}
                </Button>
                <Button
                  onClick={() => inbox.handleApprove(selectedMessage)}
                  variant="primary"
                  size="md"
                >
                  {t("dashboard_approve")}
                </Button>
              </>
            ) : selectedMessage?.status === "PENDING" ? (
              <Button
                onClick={() => inbox.handleRevoke(selectedMessage)}
                variant="ghost"
                size="md"
                className="action-btn--danger"
              >
                {t("dashboard_revoke_request")}
              </Button>
            ) : null}
          </>
        }
      >
        {selectedMessage && selectedMessage.msgType === "USER_REGISTRATION" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-bg-200/50 rounded-xl">
                <div className="text-xs text-text-tertiary mb-1">
                  {t("student_id")}
                </div>
                <div className="text-sm font-medium text-text-primary flex items-center gap-2">
                  <User size={14} />
                  {selectedMessage.username}
                </div>
              </div>
              <div className="p-3 bg-bg-200/50 rounded-xl">
                <div className="text-xs text-text-tertiary mb-1">{t("status")}</div>
                <div className="text-sm font-medium text-orange-500 flex items-center gap-2">
                  <Clock size={14} />
                  {t("reviewing")}
                </div>
              </div>
              <div className="col-span-2 p-3 bg-bg-200/50 rounded-xl">
                <div className="text-xs text-text-tertiary mb-1">{t("email")}</div>
                <div className="text-sm font-medium text-text-primary">
                  {selectedMessage.email || t("common_not_provided")}
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedMessage &&
          (selectedMessage.msgType === "INVENTORY_REQUEST" ||
            selectedMessage.type === "INVENTORY_ADD") && (
            <div className="space-y-4">
              <div className="bg-bg-200/50 rounded-xl p-4">
                {(() => {
                  const original =
                    (selectedMessage.originalData
                      ? JSON.parse(selectedMessage.originalData)
                      : {}) || {};
                  const newData =
                    JSON.parse(selectedMessage.newData || "{}") || {};

                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 text-sm text-text-primary mb-1 border-b border-border/50 pb-2">
                        <div className="text-center">{t("inventory_field")}</div>
                        <div className="text-center">{t("inventory_original")}</div>
                        <div className="text-center">{t("inventory_new_value")}</div>
                      </div>

                      {["name", "category", "quantity"].map((field) => {
                        const isChanged = original[field] != newData[field];
                        const fieldLabelKey =
                          field === "name" ? "itemName" : field;
                        return (
                          <div
                            key={field}
                            className={`grid grid-cols-3 text-sm ${isChanged && selectedMessage.type !== "INVENTORY_ADD" ? "bg-accent/5 -mx-2 px-2 py-1 rounded" : ""}`}
                          >
                            <div className="text-text-secondary capitalize text-center">
                              {t(fieldLabelKey)}
                            </div>
                            <div className="text-text-secondary text-center">
                              {original[field] || "-"}
                            </div>
                            <div
                              className={`font-medium text-center ${isChanged ? "text-accent" : "text-text-primary"}`}
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
