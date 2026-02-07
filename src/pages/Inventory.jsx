import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { flushSync } from "react-dom";
import { useLanguage } from "../hooks/useLanguage";
import { usePermission } from "../hooks/usePermission";
import {
  Plus,
  Trash2,
  Edit2,
  Package,
  Search,
  X,
  Check,
  FileQuestion,
} from "lucide-react";
import { apiService } from "../services/apiService";
import Toast from "../components/ui/Toast";
import { useRealtimeSync } from "../hooks/useRealtimeSync";
import StatusBadge from "../components/ui/StatusBadge";

import { useAuth } from "../hooks/useAuth";

const safeJsonParse = (input, fallback = null) => {
  if (typeof input !== "string" || !input) return fallback;
  try {
    return JSON.parse(input);
  } catch {
    return fallback;
  }
};

const Inventory = () => {
  const containerRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const inventoryFetchIdRef = useRef(0);
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isAdmin } = usePermission();
  const [items, setItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState({
    name: "",
    quantity: "",
    category: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const loadInventory = useCallback(async ({ showLoading = true } = {}) => {
    try {
      const fetchId = (inventoryFetchIdRef.current += 1);
      if (showLoading) setLoading(true);
      const [inventoryData, requestsData] = await Promise.all([
        apiService.getInventory(searchQuery),
        apiService.getRequests({ status: ["PENDING", "REJECTED"] }),
      ]);

      if (fetchId !== inventoryFetchIdRef.current) return;

      const relevantRequests = requestsData.filter((req) =>
        (req?.type === "INVENTORY_ADD" || req?.type === "INVENTORY_UPDATE") &&
        (req?.status === "PENDING" || req?.status === "REJECTED")
      );

      const updateRequestByTargetId = new Map();
      for (const req of relevantRequests) {
        if (req?.type !== "INVENTORY_UPDATE") continue;
        if (typeof req?.targetId !== "string" || !req.targetId) continue;

        const existing = updateRequestByTargetId.get(req.targetId);
        if (!existing || new Date(req.createdAt) > new Date(existing.createdAt)) {
          updateRequestByTargetId.set(req.targetId, req);
        }
      }

      // Process existing inventory
      const processedInventory = inventoryData.map((item) => ({
        ...item,
        status: updateRequestByTargetId.get(item.id)?.status || "APPROVED",
        isRequest: false,
        requester: item.requesterDisplayName || item.requesterName || "System",
      }));

      // Process request rows (inventory adds)
      const addRequestRows = relevantRequests
        .filter((req) => req.type === "INVENTORY_ADD")
        .map((req) => {
          const data = safeJsonParse(req.newData, {});
          return {
            id: req.id,
            name: data.name,
            category: data.category,
            quantity: data.quantity,
            date: String(req.createdAt || "").split("T")[0],
            status: req.status,
            isRequest: true,
            requester: req.requesterDisplayName || req.requesterName || "Unknown",
          };
        });

      // Combine and sort by date descending
      const allItems = [...addRequestRows, ...processedInventory].sort(
        (a, b) => new Date(b.date) - new Date(a.date),
      );

      setItems(allItems);
    } catch (error) {
      console.error("Failed to load inventory:", error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [searchQuery]);

  const scheduleInventoryRefresh = useCallback(({
    showLoading = false,
    delayMs = 450,
  } = {}) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      loadInventory({ showLoading });
    }, delayMs);
  }, [loadInventory]);

  const scheduleInventoryRefreshFromSubmit = useCallback(() => {
    // Fallback refresh: if socket events are delayed or disconnected, still reconcile.
    // Use a longer delay to avoid doubling up with socket-triggered refresh.
    scheduleInventoryRefresh({ showLoading: false, delayMs: 1200 });
  }, [scheduleInventoryRefresh]);

  const scheduleInventoryRefreshFromSocket = useCallback(() => {
    // Fast refresh when we receive realtime events.
    scheduleInventoryRefresh({ showLoading: false, delayMs: 250 });
  }, [scheduleInventoryRefresh]);

  useEffect(() => () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    loadInventory({ showLoading: true });
  }, [loadInventory]);

  const handleAddItem = () => {
    setIsEditing(false);
    setCurrentItem({ name: "", quantity: "", category: "" });
    setIsModalOpen(true);
  };

  const handleEditItem = (item) => {
    setIsEditing(true);
    setCurrentItem(item);
    setIsModalOpen(true);
  };

  const handleDeleteItem = async (id) => {
    showToast(
      t("confirm") + " " + t("delete") + "?",
      "warning",
      t("delete"),
      async () => {
        try {
          closeToast();
          await apiService.deleteInventory(id);
          setItems((prev) => prev.filter((item) => item.id !== id));
          setTimeout(
            () => showToast(t("updateSuccess"), "success"),
            300,
          );
        } catch (error) {
          console.error("Failed to delete item:", error);
          setTimeout(
            () => showToast(t("deleteFailed"), "error"),
            300,
          );
        }
      },
    );
  };

  const handleRequestModification = (item) => {
    setIsEditing(true);
    setCurrentItem(item);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const quantity = Number.parseInt(currentItem.quantity, 10);
      if (isEditing) {
        if (!isAdmin()) {
          // Submit Request
          const originalItem = items.find((i) => i.id === currentItem.id);
          const originalComparable = originalItem?.isRequest
            ? safeJsonParse(originalItem.originalData, {}) || {}
            : originalItem || {};
          const nextData = {
            name: currentItem.name,
            category: currentItem.category,
            quantity,
          };
          const hasChanges =
            String(originalComparable?.name ?? "") !== String(nextData.name ?? "") ||
            String(originalComparable?.category ?? "") !== String(nextData.category ?? "") ||
            Number(originalComparable?.quantity ?? 0) !== Number(nextData.quantity ?? 0);
          if (!hasChanges) {
            if (originalItem?.status === "PENDING") {
              showToast(t("inventory_under_review_wait"), "info");
              setIsModalOpen(false);
              return;
            }
            // Allow re-submitting a previously rejected request even if user doesn't change fields.
            if (originalItem?.status !== "REJECTED") {
              showToast(t("inventory_no_changes"), "info");
              setIsModalOpen(false);
              return;
            }
          }

          const originalData = {
            name: originalComparable?.name ?? "",
            category: originalComparable?.category ?? "",
            quantity: Number(originalComparable?.quantity ?? 0),
          };

          flushSync(() => {
            showToast(t("inventory_submitting_request"), "info");
          });
          const createdRequest = await apiService.createRequest({
            requesterId: user.id,
            requesterName: user.name || user.username,
            type: "INVENTORY_UPDATE",
            targetId: currentItem.id,
            originalData,
            newData: nextData,
          });
          showToast(t("inventory_request_submitted_success"), "success");
          setIsModalOpen(false);

          // Optimistic UI: mark the inventory item as pending immediately.
          if (createdRequest?.status === "PENDING") {
            setItems((prev) =>
              prev.map((row) =>
                row?.id === currentItem.id && row?.isRequest !== true
                  ? {
                    ...row,
                    status: "PENDING",
                    requester: user?.name || user?.username || row.requester,
                  }
                  : row,
              ),
            );
          }

          // Debounced refresh to reconcile with backend + avoid double-refresh (socket + manual).
          scheduleInventoryRefreshFromSubmit();
          return;
        } else {
          // Direct Update (Admin)
          flushSync(() => {
            showToast(t("inventory_submitting_request"), "info");
          });
          const updated = await apiService.updateInventory(currentItem.id, {
            name: currentItem.name,
            category: currentItem.category,
            quantity,
          });
          setItems((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item)),
          );
          setIsModalOpen(false);
          scheduleInventoryRefreshFromSubmit(); // Reload to be safe
          return;
        }
      } else {
        // Add new item
        if (!isAdmin()) {
          flushSync(() => {
            showToast(t("inventory_submitting_request"), "info");
          });
          const createdRequest = await apiService.createRequest({
            requesterId: user.id,
            requesterName: user.name || user.username,
            type: "INVENTORY_ADD",
            targetId: null,
            originalData: null,
            newData: {
              name: currentItem.name,
              category: currentItem.category,
              quantity,
            },
          });
          showToast(t("inventory_request_submitted_success"), "success");
          setIsModalOpen(false);

          // Optimistic UI: insert/update the pending request row immediately.
          if (createdRequest?.id && createdRequest?.type === "INVENTORY_ADD") {
            const data = safeJsonParse(createdRequest.newData, {}) || {};
            const optimisticRow = {
              id: createdRequest.id,
              name: data.name,
              category: data.category,
              quantity: data.quantity,
              date: String(createdRequest.createdAt || new Date().toISOString()).split("T")[0],
              status: createdRequest.status,
              isRequest: true,
              requester:
                createdRequest.requesterDisplayName ||
                createdRequest.requesterName ||
                user?.name ||
                user?.username ||
                "Unknown",
            };

            setItems((prev) => {
              const next = prev.filter((row) => row?.id !== optimisticRow.id);
              next.unshift(optimisticRow);
              return next;
            });
          }

          scheduleInventoryRefreshFromSubmit();
          return;
        } else {
          flushSync(() => {
            showToast(t("inventory_submitting_request"), "info");
          });
          const newItem = await apiService.createInventory({
            name: currentItem.name,
            category: currentItem.category,
            quantity: parseInt(currentItem.quantity),
          });
          setItems((prev) => [
            {
              ...newItem,
              status: "APPROVED",
              isRequest: false,
              requester:
                newItem.requesterDisplayName ||
                newItem.requesterName ||
                "Unknown",
            },
            ...prev,
          ]);
          setIsModalOpen(false);
          scheduleInventoryRefreshFromSubmit();
          return;
        }
      }
    } catch (error) {
      console.error("Failed to save item:", error);
      showToast(error?.message || t("updateFailed"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlers = useMemo(
    () => ({
      "request:created": scheduleInventoryRefreshFromSocket,
      "request:updated": scheduleInventoryRefreshFromSocket,
      "request:approved": scheduleInventoryRefreshFromSocket,
      "request:rejected": scheduleInventoryRefreshFromSocket,
      "request:deleted": scheduleInventoryRefreshFromSocket,
    }),
    [scheduleInventoryRefreshFromSocket],
  );

  useRealtimeSync(handlers);

  if (loading) {
    return (
      <div
        ref={containerRef}
        className="w-full min-h-screen relative"
      >
        <div className="text-text-secondary">{t("loading")}</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full min-h-screen relative"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-text-primary mb-2 flex items-center gap-3">
            {t("inventoryList")}
          </h1>
          <p className="text-text-secondary">
            {t("inventory_subtitle")}
          </p>
        </div>

        <div className="flex gap-4 w-full md:w-auto">
          <div className="relative group w-full md:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors"
              size={20}
            />
            <input
              id="inventory-search"
              name="inventorySearch"
              type="text"
              placeholder={t("searchLogs")}
              className="w-full bg-bg-surface border border-border rounded-xl py-2.5 pl-10 pr-4 outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <button
            id="inventory-add-item-btn"
            type="button"
            onClick={handleAddItem}
            className="action-btn action-btn--md action-btn--primary"
          >
            <span className="action-btn__content">
              <Plus size={20} />
              <span>{t("addItem")}</span>
            </span>
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-bg-surface/50 backdrop-blur-xl rounded-2xl border border-border-subtle/40 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-bg-100/60 text-left">
                <th className="py-4 px-6 text-text-secondary font-medium text-sm text-left">
                  {t("itemName")}
                </th>
                <th className="py-4 px-6 text-text-secondary font-medium text-sm text-left">
                  {t("category")}
                </th>
                <th className="py-4 px-6 text-text-secondary font-medium text-sm text-left">
                  {t("quantity")}
                </th>
                <th className="py-4 px-6 text-text-secondary font-medium text-sm text-left">
                  {t("status")}
                </th>
                <th className="py-4 px-6 text-text-secondary font-medium text-sm text-left">
                  {t("date")}
                </th>
                <th className="py-4 px-6 text-text-secondary font-medium text-sm text-left">
                  {t("applicant")}
                </th>
                <th className="py-4 px-6 text-text-secondary font-medium text-sm text-right">
                  {t("actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-text-primary">
              {items.length > 0 ? (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-bg-surface-hover/60 transition-colors group"
                  >
                    <td className="py-4 px-6 font-medium">{item.name}</td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-mono text-text-secondary">
                      {item.quantity}
                    </td>
                    <td className="py-4 px-6">
                      <StatusBadge status={item.status} pendingLabelKey="reviewing" />
                    </td>
                    <td className="py-4 px-6 text-text-secondary text-sm">
                      {item.date}
                    </td>
                    <td className="py-4 px-6 text-text-secondary text-sm">
                      {item.requester}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {isAdmin() ? (
                          <>
                            <button
                              type="button"
                              className="action-btn action-btn--control action-btn--ghost"
                              aria-label={t("edit")}
                              title={t("edit")}
                              onClick={() => handleEditItem(item)}
                            >
                              <span className="action-btn__content">
                                <Edit2 size={18} />
                              </span>
                            </button>
                            <button
                              type="button"
                              className="action-btn action-btn--control action-btn--ghost action-btn--danger"
                              aria-label={t("delete")}
                              title={t("delete")}
                              onClick={() => handleDeleteItem(item.id)}
                            >
                              <span className="action-btn__content">
                                <Trash2 size={18} />
                              </span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="action-btn action-btn--control action-btn--ghost"
                            aria-label={t("requestModification")}
                            title={t("requestModification")}
                            onClick={() => handleRequestModification(item)}
                          >
                            <span className="action-btn__content">
                              <FileQuestion size={18} />
                            </span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="5"
                    className="py-12 text-center text-text-secondary"
                  >
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Package size={48} className="text-text-secondary/20" />
                      <p>{t("noActivity")}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative bg-bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-text-primary">
                {isEditing
                  ? isAdmin()
                    ? t("edit")
                    : t("requestModification")
                  : t("addItem")}
              </h2>
              <button
                type="button"
                className="action-btn action-btn--control action-btn--ghost"
                aria-label={t("common_close")}
                onClick={() => setIsModalOpen(false)}
              >
                <span className="action-btn__content">
                  <X size={24} />
                </span>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  {t("itemName")}
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-bg-page border border-border rounded-xl px-4 py-2.5 text-text-primary focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                  value={currentItem.name}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, name: e.target.value })
                  }
                  placeholder={t("exampleItemName")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  {t("category")}
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-bg-page border border-border rounded-xl px-4 py-2.5 text-text-primary focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                  value={currentItem.category}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, category: e.target.value })
                  }
                  placeholder={t("exampleCategory")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  {t("quantity")}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  className="w-full bg-bg-page border border-border rounded-xl px-4 py-2.5 text-text-primary focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                  value={currentItem.quantity}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, quantity: e.target.value })
                  }
                  placeholder="0"
                />
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button
                  id="inventory-modal-cancel-btn"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="action-btn action-btn--md action-btn--ghost"
                >
                  <span className="action-btn__content">{t("cancel")}</span>
                </button>
                <button
                  id="inventory-modal-submit-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="action-btn action-btn--md action-btn--primary"
                >
                  <span className="action-btn__content">
                    <Check size={18} />
                    <span>
                      {isSubmitting
                        ? t("inventory_submitting_request")
                        : isEditing
                        ? isAdmin()
                          ? t("saveChanges")
                          : t("submitRequest")
                        : t("commit")}
                    </span>
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

export default Inventory;
