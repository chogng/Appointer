import { useCallback, useMemo, useState } from "react";
import { zhCN } from "date-fns/locale";
import { apiService } from "../../services/apiService";
import {
  getDashboardMessageBehaviorLabel,
  getDashboardMessageTimestampLabel,
} from "../../utils/dashboardMessageFormatters";

export function useDashboardInbox({
  user,
  t,
  showToast,
  closeToast,
  reviewedInboxLimit = 100,
}) {
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const [pendingUsers, setPendingUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [reviewedUsers, setReviewedUsers] = useState([]);
  const [reviewedRequests, setReviewedRequests] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageTab, setMessageTab] = useState("pending");

  const fetchPendingUsers = useCallback(async () => {
    if (!isAdmin) {
      setPendingUsers([]);
      setReviewedUsers([]);
      return;
    }

    try {
      const pendingApps = await apiService.getUserApplications({
        status: ["PENDING"],
      });
      const reviewedApps = await apiService.getUserApplications({
        status: ["APPROVED", "REJECTED"],
        limit: reviewedInboxLimit,
      });

      const normalizedPending = pendingApps.map((u) => ({
        ...u,
        msgType: "USER_REGISTRATION",
        timestamp: u.createdAt || u.timestamp || new Date().toISOString(),
      }));
      const normalizedReviewed = reviewedApps.map((u) => ({
        ...u,
        msgType: "USER_REGISTRATION",
        timestamp: u.createdAt || u.timestamp || new Date().toISOString(),
      }));

      setPendingUsers(normalizedPending);
      setReviewedUsers(
        normalizedReviewed
          .slice()
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
      );
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  }, [isAdmin, reviewedInboxLimit]);

  const fetchRequests = useCallback(async () => {
    try {
      const pending = await apiService.getRequests({ status: ["PENDING"] });
      const reviewed = await apiService.getRequests({
        status: ["APPROVED", "REJECTED"],
        limit: reviewedInboxLimit,
      });

      let visiblePending = pending;
      let visibleReviewed = reviewed;
      if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
        visiblePending = pending.filter((r) => r.requesterId === user?.id);
        visibleReviewed = reviewed.filter((r) => r.requesterId === user?.id);
      }

      const normalizeRequest = (r) => ({
        ...r,
        msgType: "INVENTORY_REQUEST",
        timestamp: r.createdAt || r.timestamp || new Date().toISOString(),
      });

      setRequests(visiblePending.map(normalizeRequest));
      setReviewedRequests(visibleReviewed.map(normalizeRequest));
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    }
  }, [reviewedInboxLimit, user]);

  const pendingMessages = useMemo(
    () => [...pendingUsers, ...requests],
    [pendingUsers, requests],
  );

  const reviewedMessages = useMemo(
    () =>
      [...reviewedUsers, ...reviewedRequests]
        .slice()
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, reviewedInboxLimit),
    [reviewedInboxLimit, reviewedRequests, reviewedUsers],
  );

  const messages = messageTab === "reviewed" ? reviewedMessages : pendingMessages;

  const getMessageBehaviorLabel = useCallback(
    (msg) => getDashboardMessageBehaviorLabel(msg, t),
    [t],
  );

  const getMessageTimestampLabel = useCallback(
    (msg) => getDashboardMessageTimestampLabel(msg, { locale: zhCN }),
    [],
  );

  const handleApprove = useCallback(
    async (msg) => {
      try {
        if (msg.msgType === "USER_REGISTRATION") {
          await apiService.approveUserApplication(msg.id);
          showToast?.(t("dashboard_user_approved_success"), "success");
          fetchPendingUsers();
        } else if (msg.msgType === "INVENTORY_REQUEST") {
          await apiService.approveRequest(msg.id);
          showToast?.(t("dashboard_request_approved_success"), "success");
          fetchRequests();
        }
        if (selectedMessage?.id === msg.id) setSelectedMessage(null);
      } catch {
        showToast?.(t("dashboard_failed_approve"), "error");
      }
    },
    [fetchPendingUsers, fetchRequests, selectedMessage, showToast, t],
  );

  const handleReject = useCallback(
    async (msg) => {
      const confirmMsg =
        msg.msgType === "USER_REGISTRATION"
          ? t("dashboard_confirm_reject_user")
          : t("dashboard_confirm_reject_request");

      showToast?.(confirmMsg, "warning", t("dashboard_reject"), async () => {
        try {
          closeToast?.();
          if (msg.msgType === "USER_REGISTRATION") {
            await apiService.rejectUserApplication(msg.id);
            fetchPendingUsers();
          } else if (msg.msgType === "INVENTORY_REQUEST") {
            await apiService.rejectRequest(msg.id);
            fetchRequests();
          }
          showToast?.(t("dashboard_rejected_success"), "success");
          if (selectedMessage?.id === msg.id) setSelectedMessage(null);
        } catch {
          showToast?.(t("dashboard_failed_reject"), "error");
        }
      });
    },
    [closeToast, fetchPendingUsers, fetchRequests, selectedMessage, showToast, t],
  );

  const handleRevoke = useCallback(
    async (msg) => {
      showToast?.(
        t("dashboard_confirm_revoke_request"),
        "warning",
        t("dashboard_revoke"),
        async () => {
          try {
            closeToast?.();
            await apiService.deleteRequest(msg.id);
            fetchRequests();
            showToast?.(t("dashboard_request_revoked_success"), "success");
            if (selectedMessage?.id === msg.id) setSelectedMessage(null);
          } catch {
            showToast?.(t("dashboard_failed_revoke_request"), "error");
          }
        },
      );
    },
    [closeToast, fetchRequests, selectedMessage, showToast, t],
  );

  const handleClearReviewedRequests = useCallback(() => {
    if (!isAdmin) return;
    const hasReviewedRequests = Array.isArray(reviewedRequests) && reviewedRequests.length > 0;
    const hasReviewedUsers = Array.isArray(reviewedUsers) && reviewedUsers.length > 0;

    if (!hasReviewedRequests && !hasReviewedUsers) {
      showToast?.(t("dashboard_no_reviewed_requests"), "info");
      return;
    }

    showToast?.(
      t("dashboard_confirm_clear_reviewed"),
      "warning",
      t("dashboard_clear_reviewed"),
      async () => {
        try {
          closeToast?.();
          await Promise.all([
            hasReviewedRequests ? apiService.deleteReviewedRequests() : null,
            hasReviewedUsers ? apiService.deleteReviewedUserApplications() : null,
          ]);
          await fetchRequests();
          await fetchPendingUsers();
          showToast?.(t("dashboard_clear_reviewed_success"), "success");
        } catch (error) {
          console.error("Failed to clear reviewed requests:", error);
          showToast?.(t("dashboard_clear_reviewed_failed"), "error");
        }
      },
    );
  }, [
    closeToast,
    fetchPendingUsers,
    fetchRequests,
    isAdmin,
    reviewedRequests,
    reviewedUsers,
    showToast,
    t,
  ]);

  const handleApproveAll = useCallback(() => {
    if (!isAdmin) return;
    if (!Array.isArray(pendingMessages) || pendingMessages.length === 0) {
      showToast?.(t("noPendingRequests"), "info");
      return;
    }

    showToast?.(t("confirmApproveAll"), "warning", t("approveAll"), async () => {
      try {
        closeToast?.();
        await Promise.all(
          pendingMessages.map((msg) => {
            if (msg.msgType === "USER_REGISTRATION") {
              return apiService.approveUserApplication(msg.id);
            }
            if (msg.msgType === "INVENTORY_REQUEST") {
              return apiService.approveRequest(msg.id);
            }
            return Promise.resolve();
          }),
        );
        await Promise.all([fetchPendingUsers(), fetchRequests()]);
        showToast?.(t("approveAllSuccess"), "success");
      } catch (error) {
        console.error("Failed to approve all:", error);
        showToast?.(t("approveAllFailed"), "error");
      }
    });
  }, [closeToast, fetchPendingUsers, fetchRequests, isAdmin, pendingMessages, showToast, t]);

  return {
    isAdmin,
    reviewedInboxLimit,
    pendingUsers,
    requests,
    reviewedUsers,
    reviewedRequests,
    selectedMessage,
    setSelectedMessage,
    messageTab,
    setMessageTab,
    messages,
    pendingMessages,
    reviewedMessages,
    fetchPendingUsers,
    fetchRequests,
    handleApprove,
    handleReject,
    handleRevoke,
    handleClearReviewedRequests,
    handleApproveAll,
    getMessageBehaviorLabel,
    getMessageTimestampLabel,
  };
}
