import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { useLanguage } from "../hooks/useLanguage";
import { apiService } from "../services/apiService";
import Card from "../components/ui/Card";
import Toast from "../components/ui/Toast";
import {
  User,
  Moon,
  Sun,
  Monitor,
  Lock,
  Camera,
  Check,
  ArrowUp,
  Database,
  Trash2,
} from "lucide-react";
function Section({ title, icon, children }) {
  const Icon = icon;
  return (
    <Card variant="glass" className="mb-6">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border-subtle">
        <Icon size={20} className="text-accent" />
        <h2 className="text-lg font-medium text-text-primary">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

const Settings = () => {
  const containerRef = useRef(null);
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const [name, setName] = useState(user?.name || "");
  const [passwordData, setPasswordData] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [toast, setToast] = useState({
    isVisible: false,
    message: "",
    type: "success",
  });

  const showToast = (message, type = "success") =>
    setToast({ isVisible: true, message, type });
  const closeToast = () => setToast((prev) => ({ ...prev, isVisible: false }));

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const [retentionLoading, setRetentionLoading] = useState(false);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [retentionRunning, setRetentionRunning] = useState(false);
  const [retention, setRetention] = useState(null);
  const [retentionForm, setRetentionForm] = useState({
    logsDays: "",
    requestsDays: "",
  });

  useEffect(() => {
    if (!isSuperAdmin) return;

    let cancelled = false;
    const load = async () => {
      try {
        setRetentionLoading(true);
        const data = await apiService.getRetentionSettings();
        if (cancelled) return;
        setRetention(data);
        setRetentionForm({
          logsDays: String(data.logsDays),
          requestsDays: String(data.requestsDays),
        });
      } catch {
        if (!cancelled) showToast(t("retentionLoadFailed"), "error");
      } finally {
        if (!cancelled) setRetentionLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, t]);

  const handleNameSave = async () => {
    if (!name.trim()) return;
    const result = await updateUser({ name: name.trim() });
    if (result.success) {
      showToast(t("updateSuccess"), "success");
    } else {
      showToast(t("updateFailed") || "Update failed", "error");
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const result = await updateUser({ avatar: reader.result });
      if (result.success) {
        showToast(t("updateSuccess"), "success");
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (passwordData.new !== passwordData.confirm) {
      showToast(t("passwordMismatch"), "error");
      return;
    }
    setPasswordData({ current: "", new: "", confirm: "" });
    showToast(t("updateSuccess"), "success");
  };

  const handleRetentionSave = async () => {
    try {
      setRetentionSaving(true);
      const updated = await apiService.updateRetentionSettings({
        logsDays: Number(retentionForm.logsDays),
        requestsDays: Number(retentionForm.requestsDays),
      });
      setRetention(updated);
      setRetentionForm({
        logsDays: String(updated.logsDays),
        requestsDays: String(updated.requestsDays),
      });
      showToast(t("updateSuccess"), "success");
    } catch (error) {
      showToast(error.message || t("updateFailed"), "error");
    } finally {
      setRetentionSaving(false);
    }
  };

  const handleRetentionRunNow = async () => {
    try {
      setRetentionRunning(true);
      const result = await apiService.runRetentionCleanup();
      setRetention(result);
      setRetentionForm({
        logsDays: String(result.logsDays),
        requestsDays: String(result.requestsDays),
      });
      showToast(t("updateSuccess"), "success");
    } catch (error) {
      showToast(error.message || t("retentionCleanupFailed"), "error");
    } finally {
      setRetentionRunning(false);
    }
  };

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto relative min-h-screen">
      <h1 className="text-3xl font-serif font-medium text-text-primary mb-8">
        {t("settings")}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title={t("profile")} icon={User}>
          <div className="mb-6">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg
                      fill="none"
                      height="32"
                      viewBox="0 0 24 24"
                      width="32"
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-white opacity-50"
                    >
                      <circle
                        cx="12"
                        cy="7"
                        r="4"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      ></circle>
                      <path
                        d="M20 21V19C20 16.7909 18.2091 15 16 15H8C5.79086 15 4 16.7909 4 19V21"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      ></path>
                      <path
                        d="M12 11V17"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      ></path>
                      <path
                        d="M12 17L10 15"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      ></path>
                      <path
                        d="M12 17L14 15"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      ></path>
                    </svg>
                  )}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
                  <Camera size={20} className="text-white" />
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleAvatarChange}
                  />
                </label>
              </div>

              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  {t("displayName")}
                </label>
                <div className="flex items-center p-1 bg-bg-page border border-border-subtle rounded-xl shadow-sm focus-within:ring-1 focus-within:ring-black transition-all">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1 min-w-0 pl-2 pr-4 py-1 bg-transparent border-none text-text-primary text-sm focus:outline-none focus:ring-0 placeholder:text-text-secondary"
                    placeholder={t("displayName")}
                  />
                  <button
                    type="button"
                    onClick={handleNameSave}
                    className="flex items-center justify-center gap-2 px-4 py-1.5 bg-black text-white text-sm font-medium rounded-lg hover:scale-102 active:scale-95 transition-all whitespace-nowrap"
                  >
                    <span>{t("saveChanges")}</span>
                    <ArrowUp size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className="w-20 flex justify-center mt-3">
              <p className="text-xs text-text-secondary font-medium uppercase tracking-wider whitespace-nowrap">
                {t(user?.role)}
              </p>
            </div>
          </div>
        </Section>

        <Section title={t("appearance")} icon={Monitor}>
          <div className="grid grid-cols-3 gap-4">
            {[
              { id: "light", icon: Sun, label: t("light") },
              { id: "dark", icon: Moon, label: t("dark") },
              { id: "system", icon: Monitor, label: t("system") },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id)}
                className={`
                                    flex flex-col items-center justify-center p-4 rounded-xl border transition-all
                                    ${
                                      theme === item.id
                                        ? "bg-accent/5 border-accent text-accent"
                                        : "border-border-subtle text-text-secondary hover:bg-bg-subtle"
                                    }
                                `}
              >
                <item.icon size={24} className="mb-2" />
                <span className="text-sm">{item.label}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title={t("language")} icon={Monitor}>
          <div className="grid grid-cols-2 gap-4">
            {[
              { id: "en", label: t("english") },
              { id: "zh", label: t("chinese") },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLanguage(item.id)}
                className={`
                                    flex items-center justify-between p-4 rounded-xl border transition-all text-left
                                    ${
                                      language === item.id
                                        ? "bg-accent/5 border-accent text-accent"
                                        : "border-border-subtle text-text-secondary hover:bg-bg-subtle"
                                    }
                                `}
              >
                <span className="text-xs font-serif font-medium">
                  {item.label}
                </span>
                {language === item.id && <Check size={16} />}
              </button>
            ))}
          </div>
        </Section>

        <Section title={t("security")} icon={Lock}>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {t("currentPassword")}
              </label>
              <input
                type="password"
                value={passwordData.current}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, current: e.target.value })
                }
                className="w-full px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {t("newPassword")}
              </label>
              <input
                type="password"
                value={passwordData.new}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, new: e.target.value })
                }
                className="w-full px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {t("confirmPassword")}
              </label>
              <input
                type="password"
                value={passwordData.confirm}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirm: e.target.value })
                }
                className="w-full px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium text-sm"
            >
              {t("saveChanges")}
            </button>
          </form>
        </Section>

        {isSuperAdmin && (
          <div className="md:col-span-2">
            <Section title={t("dataRetention")} icon={Database}>
              {retentionLoading ? (
                <div className="text-sm text-text-secondary">Loading...</div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-text-secondary">
                    {t("retentionHint")}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        {t("logsRetentionDays")}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="3650"
                        value={retentionForm.logsDays}
                        onChange={(e) =>
                          setRetentionForm((prev) => ({
                            ...prev,
                            logsDays: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        disabled={
                          retentionLoading ||
                          retentionSaving ||
                          retentionRunning
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        {t("requestsRetentionDays")}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="3650"
                        value={retentionForm.requestsDays}
                        onChange={(e) =>
                          setRetentionForm((prev) => ({
                            ...prev,
                            requestsDays: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        disabled={
                          retentionLoading ||
                          retentionSaving ||
                          retentionRunning
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-text-secondary">
                    <div>
                      <div className="text-xs text-text-tertiary mb-1">
                        {t("lastCleanupAt")}
                      </div>
                      <div className="text-text-primary">
                        {retention?.lastCleanupAt
                          ? new Date(retention.lastCleanupAt).toLocaleString()
                          : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-text-tertiary mb-1">
                        {t("nextCleanupAt")}
                      </div>
                      <div className="text-text-primary">
                        {retention?.nextCleanupAt
                          ? new Date(retention.nextCleanupAt).toLocaleString()
                          : "-"}
                      </div>
                    </div>
                  </div>

                  {retention?.deleted && (
                    <div className="text-sm text-text-secondary bg-bg-page/50 border border-border-subtle rounded-lg p-3">
                      <div className="text-xs text-text-tertiary mb-1">
                        {retention?.ranAt
                          ? new Date(retention.ranAt).toLocaleString()
                          : ""}
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <span>Logs: {retention.deleted.logs}</span>
                        <span>Requests: {retention.deleted.requests}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleRetentionSave}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium text-sm disabled:opacity-60"
                      disabled={
                        retentionLoading || retentionSaving || retentionRunning
                      }
                    >
                      <Check size={16} />
                      {retentionSaving
                        ? `${t("saveChanges")}...`
                        : t("saveChanges")}
                    </button>
                    <button
                      type="button"
                      onClick={handleRetentionRunNow}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-bg-page border border-border-subtle text-text-primary rounded-lg hover:bg-bg-subtle transition-colors font-medium text-sm disabled:opacity-60"
                      disabled={
                        retentionLoading || retentionSaving || retentionRunning
                      }
                    >
                      <Trash2 size={16} />
                      {retentionRunning
                        ? `${t("runCleanupNow")}...`
                        : t("runCleanupNow")}
                    </button>
                  </div>
                </div>
              )}
            </Section>
          </div>
        )}
      </div>

      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={closeToast}
        containerRef={containerRef}
        type={toast.type}
      />
    </div>
  );
};

export default Settings;
