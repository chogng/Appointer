import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const messageTabRef = useRef(messageTab);
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    messageTabRef.current = messageTab;
  }, [messageTab]);

  useEffect(() => () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const fetchPendingUsers = useCallback(async () => {
    if (!isAdmin) {
      setPendingUsers([]);
      setReviewedUsers([]);
      return;
    }

    try {
      const currentTab = messageTabRef.current;
      const shouldFetchPending = currentTab !== "reviewed";
      const shouldFetchReviewed = currentTab === "reviewed";

      const [pendingApps, reviewedApps] = await Promise.all([
        shouldFetchPending
          ? apiService.getUserApplications({ status: ["PENDING"] })
          : Promise.resolve([]),
        shouldFetchReviewed
          ? apiService.getUserApplications({
            status: ["APPROVED", "REJECTED"],
            limit: reviewedInboxLimit,
          })
          : Promise.resolve([]),
      ]);

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

      if (shouldFetchPending) setPendingUsers(normalizedPending);
      if (shouldFetchReviewed) {
        setReviewedUsers(
          normalizedReviewed
            .slice()
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
        );
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  }, [isAdmin, reviewedInboxLimit]);

  const fetchRequests = useCallback(async () => {
    try {
      const currentTab = messageTabRef.current;
      const shouldFetchPending = currentTab !== "reviewed";
      const shouldFetchReviewed = currentTab === "reviewed";

      const [pending, reviewed] = await Promise.all([
        shouldFetchPending
          ? apiService.getRequests({ status: ["PENDING"] })
          : Promise.resolve([]),
        shouldFetchReviewed
          ? apiService.getRequests({
            status: ["APPROVED", "REJECTED"],
            limit: reviewedInboxLimit,
          })
          : Promise.resolve([]),
      ]);

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

      if (shouldFetchPending) setRequests(visiblePending.map(normalizeRequest));
      if (shouldFetchReviewed) setReviewedRequests(visibleReviewed.map(normalizeRequest));
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    }
  }, [reviewedInboxLimit, user]);

  const scheduleInboxRefresh = useCallback((delayMs = 350) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      Promise.all([fetchPendingUsers(), fetchRequests()]).catch(() => null);
    }, delayMs);
  }, [fetchPendingUsers, fetchRequests]);

  const showProcessing = useCallback(() => {
    showToast?.(t("dashboard_processing"), "info");
  }, [showToast, t]);

  const removeFromPending = useCallback((msg) => {
    if (!msg) return;
    if (msg.msgType === "USER_REGISTRATION") {
      setPendingUsers((prev) => prev.filter((u) => u?.id !== msg.id));
      return;
    }
    if (msg.msgType === "INVENTORY_REQUEST") {
      setRequests((prev) => prev.filter((r) => r?.id !== msg.id));
    }
  }, []);

  const addToReviewed = useCallback((msg, status) => {
    if (!msg) return;
    const nowIso = new Date().toISOString();
    if (msg.msgType === "USER_REGISTRATION") {
      setReviewedUsers((prev) => [
        {
          ...msg,
          status,
          reviewedAt: nowIso,
          timestamp: nowIso,
        },
        ...prev,
      ].slice(0, reviewedInboxLimit));
      return;
    }
    if (msg.msgType === "INVENTORY_REQUEST") {
      setReviewedRequests((prev) => [
        {
          ...msg,
          status,
          timestamp: nowIso,
        },
        ...prev,
      ].slice(0, reviewedInboxLimit));
    }
  }, [reviewedInboxLimit]);

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
      if (selectedMessage?.id === msg?.id) setSelectedMessage(null);

      // Optimistic UI: move out of pending immediately.
      removeFromPending(msg);
      addToReviewed(msg, "APPROVED");
      showProcessing();

      try {
        if (msg.msgType === "USER_REGISTRATION") {
          await apiService.approveUserApplication(msg.id);
          showToast?.(t("dashboard_user_approved_success"), "success");
        } else if (msg.msgType === "INVENTORY_REQUEST") {
          await apiService.approveRequest(msg.id);
          showToast?.(t("dashboard_request_approved_success"), "success");
        }
      } catch {
        showToast?.(t("dashboard_failed_approve"), "error");
      } finally {
        // Reconcile with server (also repairs optimistic drift on failures).
        scheduleInboxRefresh();
      }
    },
    [addToReviewed, removeFromPending, scheduleInboxRefresh, selectedMessage, showProcessing, showToast, t],
  );

  const handleReject = useCallback(
    async (msg) => {
      const confirmMsg =
        msg.msgType === "USER_REGISTRATION"
          ? t("dashboard_confirm_reject_user")
          : t("dashboard_confirm_reject_request");

      showToast?.(confirmMsg, "warning", t("dashboard_reject"), async () => {
        closeToast?.();
        if (selectedMessage?.id === msg?.id) setSelectedMessage(null);

        // Optimistic UI: move out of pending immediately.
        removeFromPending(msg);
        addToReviewed(msg, "REJECTED");
        showProcessing();

        try {
          if (msg.msgType === "USER_REGISTRATION") {
            await apiService.rejectUserApplication(msg.id);
          } else if (msg.msgType === "INVENTORY_REQUEST") {
            await apiService.rejectRequest(msg.id);
          }
          showToast?.(t("dashboard_rejected_success"), "success");
        } catch {
          showToast?.(t("dashboard_failed_reject"), "error");
        } finally {
          scheduleInboxRefresh();
        }
      });
    },
    [
      addToReviewed,
      closeToast,
      removeFromPending,
      scheduleInboxRefresh,
      selectedMessage,
      showProcessing,
      showToast,
      t,
    ],
  );

  const handleRevoke = useCallback(
    async (msg) => {
      showToast?.(
        t("dashboard_confirm_revoke_request"),
        "warning",
        t("dashboard_revoke"),
        async () => {
          closeToast?.();
          if (selectedMessage?.id === msg?.id) setSelectedMessage(null);

          // Optimistic UI: remove from pending immediately.
          removeFromPending(msg);
          showProcessing();

          try {
            await apiService.deleteRequest(msg.id);
            showToast?.(t("dashboard_request_revoked_success"), "success");
          } catch {
            showToast?.(t("dashboard_failed_revoke_request"), "error");
          } finally {
            scheduleInboxRefresh();
          }
        },
      );
    },
    [closeToast, removeFromPending, scheduleInboxRefresh, selectedMessage, showProcessing, showToast, t],
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
          showProcessing();
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
    showProcessing,
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
        showProcessing();

        // Optimistic UI: move everything out of pending immediately.
        const toApprove = pendingMessages.slice();
        setPendingUsers([]);
        setRequests([]);
        for (const msg of toApprove) {
          addToReviewed(msg, "APPROVED");
        }

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
        showToast?.(t("approveAllSuccess"), "success");
      } catch (error) {
        console.error("Failed to approve all:", error);
        showToast?.(t("approveAllFailed"), "error");
      } finally {
        scheduleInboxRefresh();
      }
    });
  }, [addToReviewed, closeToast, isAdmin, pendingMessages, scheduleInboxRefresh, showProcessing, showToast, t]);

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
