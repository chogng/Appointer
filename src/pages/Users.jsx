import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../hooks/useLanguage";
import {
  Trash2,
  Edit2,
  Search,
  User,
  Shield,
  CheckCircle,
  XCircle,
  Plus,
  Ban,
  Users as UsersIcon,
} from "lucide-react";
import { apiService } from "../services/apiService";
import Toast from "../components/ui/Toast";

const Users = () => {
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Toast state
  const [toast, setToast] = useState({
    isVisible: false,
    message: "",
    type: "success",
  });
  const containerRef = useRef(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ isVisible: true, message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  }, []);

  const [editForm, setEditForm] = useState({
    username: "",
    name: "",
    expiryDate: "",
    expiryType: "permanent", // 'permanent' | 'limited'
    status: "ACTIVE",
  });
  const [devices, setDevices] = useState([]);
  const [userBlocklist, setUserBlocklist] = useState([]);
  const [loadingBlocklist, setLoadingBlocklist] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: "",
    password: "",
    name: "",
    email: "",
    role: "USER",
    expiryDate: "",
    expiryType: "permanent", // 'permanent' | 'limited'
  });

  const fetchUsers = useCallback(async () => {
    try {
      const data = await apiService.getUsers();
      setUsers(data);
    } catch (error) {
      console.error("Failed to fetch users", error);
      showToast(t("fetchFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDelete = async (userId) => {
    try {
      await apiService.deleteUser(userId);
      setUsers(users.filter((u) => u.id !== userId));
      setDeleteConfirm(null);
      showToast(t("updateSuccess"), "success");
    } catch (error) {
      console.error("Error deleting user", error);
      showToast(t("deleteFailed"), "error");
    }
  };

  const handleEditClick = async (user) => {
    setEditingUser(user);
    setEditForm({
      username: user.username,
      name: user.name,
      expiryDate: user.expiryDate || "",
      expiryType: user.expiryDate ? "limited" : "permanent",
      status: user.status,
    });

    // Fetch devices and blocklist
    try {
      setLoadingBlocklist(true);
      const [allDevices, blocklist] = await Promise.all([
        apiService.getDevices(),
        apiService.getUserBlocklist(user.id),
      ]);
      setDevices(allDevices);
      setUserBlocklist(blocklist.map((b) => b.deviceId));
    } catch (error) {
      console.error("Failed to load blocklist info", error);
      showToast(t("users_failed_load_restriction_details"), "error");
    } finally {
      setLoadingBlocklist(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    try {
      const updatedUser = await apiService.updateUser(editingUser.id, {
        username: editForm.username,
        name: editForm.name,
        expiryDate:
          editForm.expiryType === "limited" ? editForm.expiryDate : null,
        status: editForm.status,
      });

      setUsers(users.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
      setEditingUser(null);
      showToast(t("updateSuccess"), "success");
    } catch (error) {
      console.error("Update failed", error);
      showToast(t("updateFailed"), "error");
    }
  };

  const handleCreate = async () => {
    try {
      if (
        !createForm.username ||
        !createForm.password ||
        !createForm.name ||
        !createForm.email
      ) {
        showToast(
          t("fillAllFields"),
          "error",
        );
        return;
      }

      const newUser = await apiService.adminCreateUser({
        ...createForm,
        expiryDate:
          createForm.expiryType === "limited" ? createForm.expiryDate : null,
      });

      setUsers([newUser, ...users]); // Add to top or refetch
      setIsCreateModalOpen(false);
      setCreateForm({
        username: "",
        password: "",
        name: "",
        email: "",
        role: "USER",
        expiryDate: "",
        expiryType: "permanent",
      });
      showToast(t("createSuccess"), "success");
    } catch (error) {
      console.error("Create failed", error);
      showToast(error.message || "Failed to create user", "error");
    }
  };

  // Filter users
  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div
      ref={containerRef}
      className="w-full min-h-screen relative"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-text-primary mb-2 flex items-center gap-3">
            {t("user_management")}
          </h1>
          <p className="text-text-secondary">
            {t("user_management_subtitle")}
          </p>
        </div>
        <div className="relative flex gap-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
              size={20}
            />
            <input
              id="users-search"
              name="usersSearch"
              type="text"
              placeholder={t("search_users")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="pl-10 pr-4 py-2 bg-bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent w-64"
            />
          </div>
          <button
            id="users-add-user-btn"
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="action-btn action-btn--md action-btn--primary"
          >
            <span className="action-btn__content">
              <Plus size={20} />
              <span>{t("addUser")}</span>
            </span>
          </button>
        </div>
      </div>

      <div className="bg-bg-surface rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-bg-page/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                {t("user")}
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                {t("role")}
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                {t("status")}
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                {t("expiry_date")}
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                {t("actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredUsers.map((u) => (
              <tr key={u.id} className="hover:bg-bg-page/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                      <User size={16} />
                    </div>
                    <div>
                      <div className="font-medium text-text-primary">
                        {u.name}
                      </div>
                      <div className="text-sm text-text-secondary">
                        @{u.username}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium
                                        ${u.role === "SUPER_ADMIN"
                        ? "bg-purple-500/10 text-purple-500"
                        : u.role === "ADMIN"
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-gray-500/10 text-gray-400"
                      }`}
                  >
                    <Shield size={12} />
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium
                                        ${u.status === "ACTIVE" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}
                  >
                    {u.status === "ACTIVE" ? (
                      <CheckCircle size={12} />
                    ) : (
                      <XCircle size={12} />
                    )}
                    {u.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-text-secondary">
                  {u.expiryDate || t("permanent")}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="action-btn action-btn--control action-btn--ghost"
                      aria-label={t("edit")}
                      title={t("edit")}
                      onClick={() => handleEditClick(u)}
                      data-ui="users-edit-btn"
                      data-item-key={`user-${u.id}`}
                    >
                      <span className="action-btn__content">
                        <Edit2 size={16} />
                      </span>
                    </button>
                    {u.id !== currentUser?.id && (
                      <button
                        type="button"
                        className="action-btn action-btn--control action-btn--ghost action-btn--danger"
                        aria-label={t("delete")}
                        title={t("delete")}
                        onClick={() => setDeleteConfirm(u)}
                        data-ui="users-delete-btn"
                        data-item-key={`user-${u.id}`}
                      >
                        <span className="action-btn__content">
                          <Trash2 size={16} />
                        </span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-bg-surface border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-text-primary mb-4">
              {t("edit_user")}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {t("username")}
                </label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) =>
                    setEditForm({ ...editForm, username: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-bg-page border border-border rounded-lg text-text-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {t("displayName")}
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-bg-page border border-border rounded-lg text-text-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t("account_expiry")}
                </label>
                <div className="flex gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editExpiryType"
                      value="permanent"
                      checked={editForm.expiryType === "permanent"}
                      onChange={() =>
                        setEditForm((prev) => ({
                          ...prev,
                          expiryType: "permanent",
                        }))
                      }
                      className="text-accent focus:ring-accent"
                    />
                    <span className="text-text-primary">{t("permanent")}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editExpiryType"
                      value="limited"
                      checked={editForm.expiryType === "limited"}
                      onChange={() =>
                        setEditForm((prev) => ({
                          ...prev,
                          expiryType: "limited",
                        }))
                      }
                      className="text-accent focus:ring-accent"
                    />
                    <span className="text-text-primary">{t("limited_time")}</span>
                  </label>
                </div>
                {editForm.expiryType === "limited" && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    <input
                      type="date"
                      value={editForm.expiryDate}
                      onChange={(e) =>
                        setEditForm({ ...editForm, expiryDate: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-bg-page border border-border rounded-lg text-text-primary"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t("account_status")}
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editStatus"
                      value="ACTIVE"
                      checked={editForm.status === "ACTIVE"}
                      onChange={() =>
                        setEditForm((prev) => ({ ...prev, status: "ACTIVE" }))
                      }
                      className="text-accent focus:ring-accent"
                    />
                    <span className="text-text-primary flex items-center gap-1">
                      <CheckCircle size={14} className="text-green-500" />{" "}
                      Active
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editStatus"
                      value="DISABLED"
                      checked={editForm.status === "DISABLED"}
                      onChange={() =>
                        setEditForm((prev) => ({ ...prev, status: "DISABLED" }))
                      }
                      className="text-accent focus:ring-accent"
                    />
                    <span className="text-text-primary flex items-center gap-1">
                      <Ban size={14} className="text-red-500" /> {t("disabled")}
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <h3 className="text-base font-semibold text-text-primary mb-3">
                  {t("device_restrictions")}
                </h3>
                {loadingBlocklist ? (
                  <div className="text-sm text-text-secondary">
                    {t("loading_restrictions")}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {devices.map((device) => {
                      const isBlocked = userBlocklist.includes(device.id);
                      return (
                        <div
                          key={device.id}
                          className="flex items-center justify-between p-2 bg-bg-page rounded-lg border border-border"
                        >
                          <span className="text-sm text-text-primary">
                            {device.name}
                          </span>
                          <button
                            type="button"
                            aria-label={t("users_toggle_restriction")}
                            data-ui="users-device-restriction-toggle"
                            data-item-key={`device-${device.id}`}
                            onClick={async () => {
                              try {
                                if (isBlocked) {
                                  await apiService.unblockUserDevice(
                                    editingUser.id,
                                    device.id,
                                  );
                                  setUserBlocklist((prev) =>
                                    prev.filter((id) => id !== device.id),
                                  );
                                } else {
                                  await apiService.blockUserDevice(
                                    editingUser.id,
                                    device.id,
                                  );
                                  setUserBlocklist((prev) => [
                                    ...prev,
                                    device.id,
                                  ]);
                                }
                              } catch (error) {
                                console.error("Failed to toggle block", error);
                                showToast(
                                  t("users_failed_update_restriction"),
                                  "error",
                                );
                              }
                            }}
                            className={`action-btn action-btn--sm action-btn--ghost ${isBlocked ? "action-btn--danger" : ""}`}
                          >
                            <span className="action-btn__content">
                              {isBlocked ? t("blocked") : t("allowed")}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                    {devices.length === 0 && (
                      <div className="text-sm text-text-secondary">
                        {t("no_devices_found")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                id="users-edit-cancel-btn"
                type="button"
                onClick={() => setEditingUser(null)}
                className="action-btn action-btn--md action-btn--ghost"
              >
                <span className="action-btn__content">{t("cancel")}</span>
              </button>
              <button
                id="users-edit-save-btn"
                type="button"
                onClick={handleUpdate}
                className="action-btn action-btn--md action-btn--primary"
              >
                <span className="action-btn__content">{t("saveChanges")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-bg-surface border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-text-primary mb-4">
              {t("addUser")}
            </h2>

            <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {t("role")}
                </label>
                {currentUser?.role === "SUPER_ADMIN" ? (
                  <select
                    value={createForm.role}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, role: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-bg-page border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
                  >
                    <option value="USER">{t("users_role_user_regular")}</option>
                    <option value="ADMIN">{t("admin")}</option>
                  </select>
                ) : (
                  <div className="w-full px-3 py-2 bg-bg-page/50 border border-border rounded-lg text-text-secondary">
                    {t("users_role_user_regular")}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {t("username")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, username: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-bg-page border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
                  placeholder={t("example_username")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {t("password")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, password: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-bg-page border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
                  placeholder={t("password_placeholder")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {t("displayName")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-bg-page border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
                  placeholder={t("example_display_name")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {t("email")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, email: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-bg-page border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
                  placeholder={t("example_email")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t("account_expiry")}
                </label>
                <div className="flex gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="createExpiryType"
                      value="permanent"
                      checked={createForm.expiryType === "permanent"}
                      onChange={() =>
                        setCreateForm((prev) => ({
                          ...prev,
                          expiryType: "permanent",
                        }))
                      }
                      className="text-accent focus:ring-accent"
                    />
                    <span className="text-text-primary">{t("permanent")}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="createExpiryType"
                      value="limited"
                      checked={createForm.expiryType === "limited"}
                      onChange={() =>
                        setCreateForm((prev) => ({
                          ...prev,
                          expiryType: "limited",
                        }))
                      }
                      className="text-accent focus:ring-accent"
                    />
                    <span className="text-text-primary">{t("limited_time")}</span>
                  </label>
                </div>
                {createForm.expiryType === "limited" && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    <input
                      type="date"
                      value={createForm.expiryDate}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          expiryDate: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-bg-page border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                id="users-create-cancel-btn"
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="action-btn action-btn--md action-btn--ghost"
              >
                <span className="action-btn__content">{t("cancel")}</span>
              </button>
              <button
                id="users-create-submit-btn"
                type="button"
                onClick={handleCreate}
                className="action-btn action-btn--md action-btn--primary"
              >
                <span className="action-btn__content">{t("createUser")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-text-primary mb-2">
              {t("confirmDeletion")}
            </h2>
            <p className="text-text-secondary mb-6">
              {t("users_confirm_delete").replace("{name}", deleteConfirm.name)}
            </p>
            <div className="flex justify-end gap-3">
              <button
                id="users-delete-cancel-btn"
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="action-btn action-btn--md action-btn--ghost"
              >
                <span className="action-btn__content">{t("cancel")}</span>
              </button>
              <button
                id="users-delete-confirm-btn"
                type="button"
                onClick={() => handleDelete(deleteConfirm.id)}
                className="action-btn action-btn--md action-btn--ghost action-btn--danger"
              >
                <span className="action-btn__content">{t("delete")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={closeToast}
        type={toast.type}
      />
    </div>
  );
};

export default Users;
