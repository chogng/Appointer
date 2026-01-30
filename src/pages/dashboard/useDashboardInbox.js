import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { zhCN } from "date-fns/locale";
import { apiService } from "../../services/apiService";
import {
  getDashboardMessageBehaviorLabel,
  getDashboardMessageTimestampLabel,
} from "../../utils/dashboardMessageFormatters";

const isAdminRole = (role) => role === "ADMIN" || role === "SUPER_ADMIN";

export function useDashboardInbox({
  user,
  t,
  showToast,
  closeToast,
  reviewedInboxLimit = 100,
}) {
  const isAdmin = isAdminRole(user?.role);

  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [reviewedUsers, setReviewedUsers] = useState([]);
  const [reviewedRequests, setReviewedRequests] = useState([]);

  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageTab, setMessageTab] = useState("pending"); // "pending" | "reviewed"

  const refreshTimerRef = useRef(null);
  const didInitRef = useRef(false);
  const messageTabRef = useRef(messageTab);
  const userAppsFetchIdRef = useRef(0);
  const requestsFetchIdRef = useRef(0);
  const tabIsReviewed = messageTab === "reviewed";

  useEffect(() => {
    messageTabRef.current = messageTab;
  }, [messageTab]);

  useEffect(() => () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const showToastImmediate = useCallback(
    (message, type = "success", actionText = null, onAction = null) => {
      if (!showToast) return;
      flushSync(() => {
        showToast(message, type, actionText, onAction);
      });
    },
    [showToast],
  );

  const showProcessing = useCallback(() => {
    showToastImmediate(t("dashboard_processing"), "info");
  }, [showToastImmediate, t]);

  const normalizeUserApplication = useCallback(
    (u) => ({
      ...u,
      msgType: "USER_REGISTRATION",
      timestamp: u.createdAt || u.timestamp || new Date().toISOString(),
    }),
    [],
  );

  const normalizeRequest = useCallback(
    (r) => ({
      ...r,
      msgType: "INVENTORY_REQUEST",
      timestamp: r.createdAt || r.timestamp || new Date().toISOString(),
    }),
    [],
  );

  const fetchUserApplications = useCallback(
    async ({ tab = messageTab } = {}) => {
      if (!isAdmin) {
        setPendingUsers([]);
        setReviewedUsers([]);
        return;
      }

      try {
        const fetchId = (userAppsFetchIdRef.current += 1);
        const shouldFetchReviewed = tab === "reviewed";
        const shouldFetchPending = tab !== "reviewed";

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

        if (fetchId !== userAppsFetchIdRef.current) return;

        if (shouldFetchPending) {
          setPendingUsers(pendingApps.map(normalizeUserApplication));
        }

        if (shouldFetchReviewed) {
          setReviewedUsers(reviewedApps.map(normalizeUserApplication));
        }
      } catch (error) {
        console.error("Failed to fetch user applications:", error);
      }
    },
    [isAdmin, messageTab, normalizeUserApplication, reviewedInboxLimit],
  );

  const fetchRequests = useCallback(
    async ({ tab = messageTab } = {}) => {
      try {
        const fetchId = (requestsFetchIdRef.current += 1);
        const shouldFetchReviewed = tab === "reviewed";
        const shouldFetchPending = tab !== "reviewed";

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

        if (!isAdmin) {
          visiblePending = pending.filter((r) => r.requesterId === user?.id);
          visibleReviewed = reviewed.filter((r) => r.requesterId === user?.id);
        }

        if (fetchId !== requestsFetchIdRef.current) return;

        if (shouldFetchPending) {
          setPendingRequests(visiblePending.map(normalizeRequest));
        }

        if (shouldFetchReviewed) {
          setReviewedRequests(visibleReviewed.map(normalizeRequest));
        }
      } catch (error) {
        console.error("Failed to fetch requests:", error);
      }
    },
    [isAdmin, messageTab, normalizeRequest, reviewedInboxLimit, user?.id],
  );

  const refreshCurrentTab = useCallback(
    async ({ delayMs = 0 } = {}) => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }

      if (delayMs > 0) {
        refreshTimerRef.current = setTimeout(() => {
          refreshTimerRef.current = null;
          Promise.all([
            fetchUserApplications({ tab: messageTabRef.current }),
            fetchRequests({ tab: messageTabRef.current }),
          ]).catch(() => null);
        }, delayMs);
        return;
      }

      await Promise.all([
        fetchUserApplications({ tab: messageTabRef.current }),
        fetchRequests({ tab: messageTabRef.current }),
      ]).catch(() => null);
    },
    [fetchRequests, fetchUserApplications],
  );

  useEffect(() => {
    // Initial data load is handled by the dashboard page loader to avoid duplicate API calls.
    if (!didInitRef.current) {
      didInitRef.current = true;
      return;
    }
    refreshCurrentTab();
  }, [messageTab, refreshCurrentTab]);

  const pendingMessages = useMemo(
    () => [...pendingUsers, ...pendingRequests],
    [pendingRequests, pendingUsers],
  );

  const reviewedMessages = useMemo(
    () =>
      [...reviewedUsers, ...reviewedRequests]
        .slice()
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, reviewedInboxLimit),
    [reviewedInboxLimit, reviewedRequests, reviewedUsers],
  );

  const messages = tabIsReviewed ? reviewedMessages : pendingMessages;

  const getMessageBehaviorLabel = useCallback(
    (msg) => getDashboardMessageBehaviorLabel(msg, t),
    [t],
  );

  const getMessageTimestampLabel = useCallback(
    (msg) => getDashboardMessageTimestampLabel(msg, { locale: zhCN }),
    [],
  );

  const removeFromPending = useCallback((msg) => {
    if (!msg) return;
    if (msg.msgType === "USER_REGISTRATION") {
      setPendingUsers((prev) => prev.filter((u) => u?.id !== msg.id));
      return;
    }
    if (msg.msgType === "INVENTORY_REQUEST") {
      setPendingRequests((prev) => prev.filter((r) => r?.id !== msg.id));
    }
  }, []);

  const addToReviewed = useCallback(
    (msg, status) => {
      if (!msg) return;
      const nowIso = new Date().toISOString();

      if (msg.msgType === "USER_REGISTRATION") {
        setReviewedUsers((prev) =>
          [
            {
              ...msg,
              status,
              reviewedAt: nowIso,
              timestamp: nowIso,
            },
            ...prev.filter((u) => u?.id !== msg.id),
          ].slice(0, reviewedInboxLimit),
        );
        return;
      }

      if (msg.msgType === "INVENTORY_REQUEST") {
        setReviewedRequests((prev) =>
          [
            {
              ...msg,
              status,
              timestamp: nowIso,
            },
            ...prev.filter((r) => r?.id !== msg.id),
          ].slice(0, reviewedInboxLimit),
        );
      }
    },
    [reviewedInboxLimit],
  );

  const handleApprove = useCallback(
    async (msg) => {
      if (selectedMessage?.id === msg?.id) setSelectedMessage(null);

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
        refreshCurrentTab({ delayMs: 350 });
      }
    },
    [
      addToReviewed,
      refreshCurrentTab,
      removeFromPending,
      selectedMessage?.id,
      showProcessing,
      showToast,
      t,
    ],
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
          refreshCurrentTab({ delayMs: 350 });
        }
      });
    },
    [
      addToReviewed,
      closeToast,
      refreshCurrentTab,
      removeFromPending,
      selectedMessage?.id,
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

          removeFromPending(msg);
          showProcessing();

          try {
            await apiService.deleteRequest(msg.id);
            showToast?.(t("dashboard_request_revoked_success"), "success");
          } catch {
            showToast?.(t("dashboard_failed_revoke_request"), "error");
          } finally {
            refreshCurrentTab({ delayMs: 350 });
          }
        },
      );
    },
    [
      closeToast,
      refreshCurrentTab,
      removeFromPending,
      selectedMessage?.id,
      showProcessing,
      showToast,
      t,
    ],
  );

  const handleClearReviewedRequests = useCallback(() => {
    if (!isAdmin) return;

    const hasReviewedRequests =
      Array.isArray(reviewedRequests) && reviewedRequests.length > 0;
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
          await refreshCurrentTab();
          showToast?.(t("dashboard_clear_reviewed_success"), "success");
        } catch (error) {
          console.error("Failed to clear reviewed requests:", error);
          showToast?.(t("dashboard_clear_reviewed_failed"), "error");
        }
      },
    );
  }, [
    closeToast,
    isAdmin,
    refreshCurrentTab,
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

        const toApprove = pendingMessages.slice();
        const selectedId = selectedMessage?.id;
        const selectedType = selectedMessage?.msgType;
        if (
          selectedId &&
          toApprove.some((msg) => msg?.id === selectedId && msg?.msgType === selectedType)
        ) {
          setSelectedMessage(null);
        }

        const userApplicationsToApprove = toApprove.filter(
          (msg) => msg.msgType === "USER_REGISTRATION",
        );
        const requestsToApprove = toApprove.filter(
          (msg) => msg.msgType === "INVENTORY_REQUEST",
        );

        const settleUserApplications = await Promise.allSettled(
          userApplicationsToApprove.map((msg) =>
            apiService.approveUserApplication(msg.id),
          ),
        );
        settleUserApplications.forEach((result, index) => {
          if (result.status !== "fulfilled") return;
          const msg = userApplicationsToApprove[index];
          removeFromPending(msg);
          addToReviewed(msg, "APPROVED");
        });

        const settleRequests = await Promise.allSettled(
          requestsToApprove.map((msg) => apiService.approveRequest(msg.id)),
        );
        settleRequests.forEach((result, index) => {
          if (result.status !== "fulfilled") return;
          const msg = requestsToApprove[index];
          removeFromPending(msg);
          addToReviewed(msg, "APPROVED");
        });

        const failureCount =
          settleUserApplications.filter((r) => r.status === "rejected").length +
          settleRequests.filter((r) => r.status === "rejected").length;

        if (failureCount === 0) {
          showToast?.(t("approveAllSuccess"), "success");
        } else {
          showToast?.(t("approveAllFailed"), "error");
        }
      } catch (error) {
        console.error("Failed to approve all:", error);
        showToast?.(t("approveAllFailed"), "error");
      } finally {
        refreshCurrentTab({ delayMs: 350 });
      }
    });
  }, [
    addToReviewed,
    closeToast,
    isAdmin,
    pendingMessages,
    refreshCurrentTab,
    removeFromPending,
    selectedMessage?.id,
    selectedMessage?.msgType,
    showProcessing,
    showToast,
    t,
  ]);

  return {
    isAdmin,
    reviewedInboxLimit,
    pendingUsers,
    requests: pendingRequests,
    reviewedUsers,
    reviewedRequests,
    selectedMessage,
    setSelectedMessage,
    messageTab,
    setMessageTab,
    messages,
    pendingMessages,
    reviewedMessages,
    fetchPendingUsers: fetchUserApplications,
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
