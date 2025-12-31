import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useLanguage } from "../context/useLanguage";
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
  Clock,
} from "lucide-react";
import { apiService } from "../services/apiService";
import Toast from "../components/ui/Toast";
import { useRealtimeSync } from "../hooks/useRealtimeSync";

import { useAuth } from "../context/useAuth";

const Inventory = () => {
  const containerRef = useRef(null);
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

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      const [inventoryData, requestsData] = await Promise.all([
        apiService.getInventory(searchQuery),
        apiService.getRequests(),
      ]);

      // Process existing inventory
      const processedInventory = inventoryData.map((item) => ({
        ...item,
        status: "APPROVED",
        isRequest: false,
        requester: item.requesterDisplayName || item.requesterName || "System",
      }));

      // Process pending requests (only add requests for now)
      const pendingRequests = requestsData
        .filter(
          (req) =>
            req.type === "INVENTORY_ADD" &&
            (req.status === "PENDING" || req.status === "REJECTED"),
        )
        .map((req) => {
          const data = JSON.parse(req.newData);
          return {
            id: req.id,
            name: data.name,
            category: data.category,
            quantity: data.quantity,
            date: req.createdAt.split("T")[0],
            status: req.status === "REJECTED" ? "REJECTED" : "REVIEWING",
            isRequest: true,
            requester:
              req.requesterDisplayName || req.requesterName || "Unknown",
          };
        });

      // Combine and sort by date descending
      const allItems = [...pendingRequests, ...processedInventory].sort(
        (a, b) => new Date(b.date) - new Date(a.date),
      );

      setItems(allItems);
    } catch (error) {
      console.error("Failed to load inventory:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadInventory();
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
          setItems(items.filter((item) => item.id !== id));
          setTimeout(
            () => showToast(t("updateSuccess") || "Success", "success"),
            300,
          );
        } catch (error) {
          console.error("Failed to delete item:", error);
          setTimeout(
            () => showToast(t("deleteFailed") || "Failed to delete", "error"),
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

    try {
      if (isEditing) {
        if (!isAdmin()) {
          // Submit Request
          const originalItem = items.find((i) => i.id === currentItem.id);
          await apiService.createRequest({
            requesterId: user.id,
            requesterName: user.name || user.username,
            type: "INVENTORY_UPDATE",
            targetId: currentItem.id,
            originalData: originalItem,
            newData: {
              name: currentItem.name,
              category: currentItem.category,
              quantity: parseInt(currentItem.quantity),
            },
          });
          showToast("Request submitted successfully!", "success");
        } else {
          // Direct Update (Admin)
          const updated = await apiService.updateInventory(currentItem.id, {
            name: currentItem.name,
            category: currentItem.category,
            quantity: parseInt(currentItem.quantity),
          });
          setItems(
            items.map((item) => (item.id === updated.id ? updated : item)),
          );
          await loadInventory(); // Reload to be safe
        }
      } else {
        // Add new item
        if (!isAdmin()) {
          await apiService.createRequest({
            requesterId: user.id,
            requesterName: user.name || user.username,
            type: "INVENTORY_ADD",
            targetId: null,
            originalData: null,
            newData: {
              name: currentItem.name,
              category: currentItem.category,
              quantity: parseInt(currentItem.quantity),
            },
          });
          showToast("Request submitted successfully!", "success");
          await loadInventory();
        } else {
          const newItem = await apiService.createInventory({
            name: currentItem.name,
            category: currentItem.category,
            quantity: parseInt(currentItem.quantity),
          });
          setItems([
            {
              ...newItem,
              status: "APPROVED",
              isRequest: false,
              requester:
                newItem.requesterDisplayName ||
                newItem.requesterName ||
                "Unknown",
            },
            ...items,
          ]);
        }
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to save item:", error);
      showToast(t("updateFailed") || "Operation failed", "error");
    }
  };

  const filteredItems = items; // Handling filtering via API now

  const handlers = useMemo(
    () => ({
      "request:created": loadInventory,
      "request:approved": loadInventory,
      "request:rejected": loadInventory,
      "request:deleted": loadInventory,
    }),
    [loadInventory],
  );

  useRealtimeSync(handlers);

  if (loading) {
    return (
      <div
        ref={containerRef}
        className="max-w-[1500px] mx-auto min-h-screen relative"
      >
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="max-w-[1500px] mx-auto min-h-screen relative"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-text-primary mb-2 flex items-center gap-3">
            {t("inventoryList")}
          </h1>
          <p className="text-text-secondary">
            Manage your inbound stock and inventory records
          </p>
        </div>

        <div className="flex gap-4 w-full md:w-auto">
          <div className="relative group w-full md:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors"
              size={20}
            />
            <input
              type="text"
              placeholder={t("searchLogs")}
              className="w-full bg-bg-surface border border-border rounded-xl py-2.5 pl-10 pr-4 outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            onClick={handleAddItem}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-accent/20 active:scale-95"
          >
            <Plus size={20} />
            <span className="font-medium">{t("addItem")}</span>
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-bg-surface/50 backdrop-blur-xl rounded-2xl border border-white/5 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-black/5 text-left">
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
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-white/5 transition-colors group"
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
                      {item.status === "REVIEWING" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                          <Clock size={12} />
                          {t("reviewing")}
                        </span>
                      ) : item.status === "REJECTED" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                          <X size={12} />
                          {t("rejected")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          <Check size={12} />
                          {t("approved")}
                        </span>
                      )}
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
                              onClick={() => handleEditItem(item)}
                              className="p-2 text-text-secondary hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
                              title={t("edit")}
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-2 text-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                              title={t("delete")}
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleRequestModification(item)}
                            className="p-2 text-text-secondary hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
                            title={t("requestModification")}
                          >
                            <FileQuestion size={18} />
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
                onClick={() => setIsModalOpen(false)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X size={24} />
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
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-text-secondary hover:bg-white/5 transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium shadow-lg shadow-accent/20 transition-all flex items-center gap-2"
                >
                  <Check size={18} />
                  {isEditing
                    ? isAdmin()
                      ? t("saveChanges")
                      : t("submitRequest") || "Submit Request"
                    : t("commit")}
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
