import { getMockUser } from "../utils/mockAuthStore";

// Production-like default: same-origin API (works with backend-served dist and with Vite proxy in dev)
const DEFAULT_API_BASE_URL = "/api";
const API_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/$/, "");

// 开发模式：启用 mock API（与 AuthContext 中的 DEV_MOCK_LOGIN 保持一致）
const DEV_MOCK_API =
  import.meta.env?.DEV &&
  String(import.meta.env?.VITE_MOCK_API || "").toLowerCase() === "true";

let didWarnMockApi = false;

// Mock 数据
const MOCK_DATA = {
  devices: [
    {
      id: "dev_1",
      name: "测试设备 A",
      description: "用于验收测试",
      status: "AVAILABLE",
      category: "测试类",
      location: "实验室1",
    },
    {
      id: "dev_2",
      name: "测试设备 B",
      description: "演示设备",
      status: "AVAILABLE",
      category: "演示类",
      location: "实验室2",
    },
    {
      id: "dev_3",
      name: "测试设备 C",
      description: "维护中设备",
      status: "MAINTENANCE",
      category: "测试类",
      location: "实验室1",
    },
  ],
  reservations: [],
  users: [
    {
      id: "user_mock_admin",
      username: "admin",
      name: "管理员",
      email: "admin@example.com",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
    {
      id: "user_mock_user",
      username: "user",
      name: "普通用户",
      email: "user@example.com",
      role: "USER",
      status: "ACTIVE",
    },
  ],
  logs: [],
  inventory: [],
  requests: [],
  templates: [],
};

class ApiService {
  unauthorizedCallback = null;

  bindUnauthorizedCallback(callback) {
    this.unauthorizedCallback = callback;
  }

  async request(endpoint, options = {}) {
    // 开发模式：返回 mock 数据
    if (DEV_MOCK_API) {
      if (!didWarnMockApi) {
        didWarnMockApi = true;
        console.warn(
          "[apiService] VITE_MOCK_API=true: using mock API (backend will not be called).",
        );
      }
      return this._mockRequest(endpoint, options);
    }

    const isFormData =
      typeof FormData !== "undefined" && options?.body instanceof FormData;

    const headers = { ...(options.headers || {}) };
    const hasContentTypeHeader =
      Object.prototype.hasOwnProperty.call(headers, "Content-Type") ||
      Object.prototype.hasOwnProperty.call(headers, "content-type");

    if (!isFormData && !hasContentTypeHeader) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers,
      credentials: "include", // Important: Send cookies with request
      ...options,
    });

    if (!response.ok) {
      if (response.status === 401 && this.unauthorizedCallback) {
        this.unauthorizedCallback();
      }

      const fallbackMessage = `Request failed (${response.status} ${response.statusText})`;
      let message = fallbackMessage;
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const parsed = await response.json().catch(() => null);
        message = parsed?.error || parsed?.message || fallbackMessage;

        const error = new Error(message);
        if (parsed && typeof parsed === "object") {
          Object.entries(parsed).forEach(([k, v]) => {
            if (k === "error" || k === "message") return;
            error[k] = v;
          });
        }
        error.status = response.status;
        error.endpoint = endpoint;
        throw error;
      }

      const text = await response.text().catch(() => "");
      if (text) message = text;
      const error = new Error(message);
      error.status = response.status;
      error.endpoint = endpoint;
      throw error;
    }

    if (response.status === 204) return null;

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    return response.text();
  }

  // ============ 用户相关 ============
  async login(username, password) {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  }

  async getUsers() {
    return this.request("/users");
  }

  async createUser(userData) {
    return this.request("/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async adminCreateUser(userData) {
    return this.request("/admin/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id, updates) {
    return this.request(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async uploadUserAvatar(id, file) {
    const form = new FormData();
    form.append("avatar", file);
    return this.request(`/users/${id}/avatar`, {
      method: "POST",
      body: form,
    });
  }

  async deleteUser(id) {
    return this.request(`/users/${id}`, {
      method: "DELETE",
    });
  }

  // ============ 设备相关 ============
  async getDevices() {
    return this.request("/devices");
  }

  async getDevice(id) {
    return this.request(`/devices/${id}`);
  }

  async createDevice(deviceData) {
    return this.request("/devices", {
      method: "POST",
      body: JSON.stringify(deviceData),
    });
  }

  async updateDevice(id, updates) {
    return this.request(`/devices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async deleteDevice(id) {
    return this.request(`/devices/${id}`, {
      method: "DELETE",
    });
  }

  // ============ 预约相关 ============
  async getReservations(options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      return this.request("/reservations");
    }

    const params = new URLSearchParams();
    if (options.deviceId) params.set("deviceId", String(options.deviceId));
    if (options.from) params.set("from", String(options.from));
    if (options.to) params.set("to", String(options.to));
    if (options.active) params.set("active", "1");

    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/reservations${query}`);
  }

  async createReservation(reservationData) {
    return this.request("/reservations", {
      method: "POST",
      body: JSON.stringify(reservationData),
    });
  }

  async updateReservation(id, updates) {
    return this.request(`/reservations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async deleteReservation(id) {
    return this.request(`/reservations/${id}`, {
      method: "DELETE",
    });
  }

  // ============ 日志相关 ============
  async getLogs(search = "", options = {}) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (typeof options.limit === "number")
      params.set("limit", String(options.limit));
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/logs${query}`);
  }

  async deleteLogs() {
    return this.request("/logs", {
      method: "DELETE",
    });
  }

  // ============ 库存相关 ============
  async getInventory(search = "") {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    return this.request(`/inventory${query}`);
  }

  async createInventory(item) {
    return this.request("/inventory", {
      method: "POST",
      body: JSON.stringify(item),
    });
  }

  async updateInventory(id, updates) {
    return this.request(`/inventory/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async deleteInventory(id) {
    return this.request(`/inventory/${id}`, {
      method: "DELETE",
    });
  }

  // ============ 申请相关 ============
  async getRequests(options = {}) {
    const params = new URLSearchParams();
    if (options.status) {
      const statusValue = Array.isArray(options.status)
        ? options.status.join(",")
        : String(options.status);
      params.set("status", statusValue);
    }
    if (typeof options.limit === "number")
      params.set("limit", String(options.limit));
    if (typeof options.offset === "number")
      params.set("offset", String(options.offset));

    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/requests${query}`);
  }

  async createRequest(data) {
    return this.request("/requests", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async approveRequest(id) {
    return this.request(`/requests/${id}/approve`, {
      method: "POST",
    });
  }

  async rejectRequest(id) {
    return this.request(`/requests/${id}/reject`, {
      method: "POST",
    });
  }

  async deleteRequest(id) {
    return this.request(`/requests/${id}`, {
      method: "DELETE",
    });
  }

  // ============ 黑名单相关 ============
  async getUserBlocklist(userId) {
    return this.request(`/users/${userId}/blocklist`);
  }

  async blockUserDevice(userId, deviceId, reason = "") {
    return this.request(`/users/${userId}/blocklist`, {
      method: "POST",
      body: JSON.stringify({ deviceId, reason }),
    });
  }

  async unblockUserDevice(userId, deviceId) {
    return this.request(`/users/${userId}/blocklist/${deviceId}`, {
      method: "DELETE",
    });
  }

  // ============ SUPER_ADMIN: Data Retention ============
  async getRetentionSettings() {
    return this.request("/admin/retention");
  }

  async updateRetentionSettings(updates) {
    return this.request("/admin/retention", {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async runRetentionCleanup() {
    return this.request("/admin/retention/run", {
      method: "POST",
    });
  }

  // ============ Analytics/Leaderboard ============
  async getLeaderboard() {
    return this.request("/admin/leaderboard");
  }

  // ============ Device Analysis Templates ============
  async getDeviceAnalysisTemplates() {
    return this.request("/device-analysis/templates");
  }

  async createDeviceAnalysisTemplate(template) {
    return this.request("/device-analysis/templates", {
      method: "POST",
      body: JSON.stringify(template),
    });
  }

  async bulkCreateDeviceAnalysisTemplates(templates) {
    return this.request("/device-analysis/templates/bulk", {
      method: "POST",
      body: JSON.stringify({ templates }),
    });
  }

  async updateDeviceAnalysisTemplate(id, template) {
    return this.request(`/device-analysis/templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(template),
    });
  }

  async deleteDeviceAnalysisTemplate(id) {
    return this.request(`/device-analysis/templates/${id}`, {
      method: "DELETE",
    });
  }

  // ============ Device Analysis Settings ============
  async getDeviceAnalysisSettings() {
    return this.request("/device-analysis/settings");
  }

  async updateDeviceAnalysisSettings(updates) {
    return this.request("/device-analysis/settings", {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  // ============ Literature Research ============
  async getLiteratureSettings() {
    return this.request("/literature/settings");
  }

  async updateLiteratureSettings(updates) {
    return this.request("/literature/settings", {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async searchLiterature(payload) {
    return this.request("/literature/search", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async translateLiteratureAbstract(payload) {
    return this.request("/literature/translate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getLiteratureAdminTranslationKey() {
    return this.request("/admin/literature/translation-key");
  }

  async updateLiteratureAdminTranslationKey(payload) {
    return this.request("/admin/literature/translation-key", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async getLiteratureAdminTranslationModel() {
    return this.request("/admin/literature/translation-model");
  }

  async updateLiteratureAdminTranslationModel(payload) {
    return this.request("/admin/literature/translation-model", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async getLiteratureAdminTranslationBaseUrl() {
    return this.request("/admin/literature/translation-base-url");
  }

  async updateLiteratureAdminTranslationBaseUrl(payload) {
    return this.request("/admin/literature/translation-base-url", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async getLiteratureAdminTranslationProvider() {
    return this.request("/admin/literature/translation-provider");
  }

  async updateLiteratureAdminTranslationProvider(payload) {
    return this.request("/admin/literature/translation-provider", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  // ============ Mock API 处理 ============
  _mockRequest(endpoint, options = {}) {
    const method = options.method || "GET";

    // 路由匹配
    if (endpoint === "/auth/me") {
      const saved = getMockUser();
      if (saved) return saved;
      throw new Error("Not authenticated");
    }
    if (endpoint === "/auth/logout") return { success: true };

    if (endpoint === "/devices" && method === "GET")
      return [...MOCK_DATA.devices];
    if (endpoint.startsWith("/devices/") && method === "GET") {
      const id = endpoint.split("/")[2];
      return MOCK_DATA.devices.find((d) => d.id === id) || null;
    }

    if (endpoint.startsWith("/reservations"))
      return [...MOCK_DATA.reservations];
    if (endpoint === "/users" && method === "GET") return [...MOCK_DATA.users];
    if (endpoint === "/logs" || endpoint.startsWith("/logs?")) {
      if (method === "DELETE") {
        MOCK_DATA.logs = [];
        return { success: true };
      }

      const saved = getMockUser();
      const isAdmin =
        saved?.role === "ADMIN" || saved?.role === "SUPER_ADMIN";

      const [path, queryString = ""] = endpoint.split("?", 2);
      if (path !== "/logs") throw new Error("Unexpected logs endpoint");

      const params = new URLSearchParams(queryString);
      const search = (params.get("search") || "").trim();
      const limitRaw = params.get("limit");
      const defaultLimit = isAdmin ? 100 : 20;
      const maxLimit = isAdmin ? 100 : 20;
      const limitParsed = limitRaw === null ? defaultLimit : Number(limitRaw);
      const limit = Number.isFinite(limitParsed)
        ? Math.max(1, Math.min(maxLimit, Math.trunc(limitParsed)))
        : defaultLimit;

      let logs = [...MOCK_DATA.logs];
      if (!isAdmin && saved?.id) {
        logs = logs.filter((log) => log.userId === saved.id);
      }
      if (search) {
        const lowered = search.toLowerCase();
        logs = logs.filter((log) => {
          const action = String(log.action || "").toLowerCase();
          const details = String(log.details || "").toLowerCase();
          const userName = String(log.userName || "").toLowerCase();
          return (
            action.includes(lowered) ||
            details.includes(lowered) ||
            userName.includes(lowered)
          );
        });
      }

      logs.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
      return logs.slice(0, limit);
    }
    if (endpoint.startsWith("/inventory")) return [...MOCK_DATA.inventory];
    if (endpoint.startsWith("/requests")) return [...MOCK_DATA.requests];
    if (endpoint === "/device-analysis/templates")
      return [...MOCK_DATA.templates];
    if (endpoint === "/device-analysis/settings")
      return { defaultTemplate: null };
    if (endpoint === "/admin/leaderboard") return [];
    if (endpoint === "/admin/retention") {
      if (method === "PATCH") {
        let parsed = null;
        try {
          parsed = options?.body ? JSON.parse(options.body) : null;
        } catch {
          parsed = null;
        }

        const updates = parsed && typeof parsed === "object" ? parsed : {};
        return {
          logsMaxCount:
            typeof updates.logsMaxCount === "number"
              ? updates.logsMaxCount
              : 100,
          lastCleanupAt: null,
        };
      }

      return {
        logsMaxCount: 100,
        lastCleanupAt: null,
      };
    }

    if (endpoint === "/admin/retention/run" && method === "POST") {
      return {
        logsMaxCount: 100,
        lastCleanupAt: new Date().toISOString(),
        ranAt: new Date().toISOString(),
        deleted: { logs: 0 },
      };
    }

    if (endpoint === "/literature/settings" && method === "GET") {
      return {
        seedUrls: [],
        seedUrlsBySourceType: { nature: [], science: [] },
        seedUrlTitlesBySourceType: { nature: [], science: [] },
        sourceType: "nature",
        startDate: null,
        endDate: null,
        maxResults: null,
        hasTranslationApiKey: false,
        hasDefaultTranslationApiKey: false,
        translationApiKeySource: null,
        translationApiKeyMasked: null,
        translationProvider: null,
        translationModel: null,
        translationBaseUrl: null,
        hasDefaultTranslationBaseUrl: false,
        defaultTranslationProvider: "bigmodel",
        supportedTranslationProviders: ["bigmodel"],
        updatedAt: null,
      };
    }

    if (endpoint === "/literature/settings" && method === "PATCH") {
      let parsed = null;
      try {
        parsed = options?.body ? JSON.parse(options.body) : null;
      } catch {
        parsed = null;
      }

      const seedSource =
        parsed?.seedSource === "nature" || parsed?.seedSource === "science"
          ? parsed.seedSource
          : null;

      const translationModel =
        typeof parsed?.translationModel === "string" && parsed.translationModel.trim()
          ? parsed.translationModel.trim()
          : null;

      const hasUserKey =
        typeof parsed?.translationApiKey === "string" && parsed.translationApiKey.trim();

      const translationProvider =
        typeof parsed?.translationProvider === "string" && parsed.translationProvider.trim()
          ? parsed.translationProvider.trim()
          : null;

      const seedUrls = Array.isArray(parsed?.seedUrls) ? parsed.seedUrls : [];
      const seedUrlsBySourceTypeRaw = parsed?.seedUrlsBySourceType;
      const seedUrlsBySourceType =
        seedUrlsBySourceTypeRaw && typeof seedUrlsBySourceTypeRaw === "object"
          ? {
              nature: Array.isArray(seedUrlsBySourceTypeRaw.nature)
                ? seedUrlsBySourceTypeRaw.nature
                : [],
              science: Array.isArray(seedUrlsBySourceTypeRaw.science)
                ? seedUrlsBySourceTypeRaw.science
                : [],
            }
          : {
              nature: seedSource === "nature" ? seedUrls : [],
              science: seedSource === "science" ? seedUrls : [],
            };

      const seedUrlTitles = Array.isArray(parsed?.seedUrlTitles) ? parsed.seedUrlTitles : [];
      const seedUrlTitlesBySourceTypeRaw = parsed?.seedUrlTitlesBySourceType;
      const seedUrlTitlesBySourceType =
        seedUrlTitlesBySourceTypeRaw && typeof seedUrlTitlesBySourceTypeRaw === "object"
          ? {
              nature: Array.isArray(seedUrlTitlesBySourceTypeRaw.nature)
                ? seedUrlTitlesBySourceTypeRaw.nature
                : [],
              science: Array.isArray(seedUrlTitlesBySourceTypeRaw.science)
                ? seedUrlTitlesBySourceTypeRaw.science
                : [],
            }
          : {
              nature: seedSource === "nature" ? seedUrlTitles : [],
              science: seedSource === "science" ? seedUrlTitles : [],
            };

      const sourceType =
        parsed?.sourceType === "nature" || parsed?.sourceType === "science"
          ? parsed.sourceType
          : seedSource;

      return {
        seedUrls,
        seedUrlsBySourceType,
        seedUrlTitlesBySourceType,
        sourceType,
        startDate: typeof parsed?.startDate === "string" ? parsed.startDate : null,
        endDate: typeof parsed?.endDate === "string" ? parsed.endDate : null,
        maxResults: typeof parsed?.maxResults === "number" ? parsed.maxResults : null,
        hasTranslationApiKey: Boolean(hasUserKey),
        hasDefaultTranslationApiKey: false,
        translationApiKeySource: hasUserKey ? "user" : null,
        translationApiKeyMasked: hasUserKey ? "****mock" : null,
        translationProvider,
        translationModel,
        translationBaseUrl:
          typeof parsed?.translationBaseUrl === "string" && parsed.translationBaseUrl.trim()
            ? parsed.translationBaseUrl.trim()
            : null,
        hasDefaultTranslationBaseUrl: false,
        defaultTranslationProvider: "bigmodel",
        supportedTranslationProviders: ["bigmodel"],
        updatedAt: new Date().toISOString(),
      };
    }

    if (endpoint === "/literature/search") return [];

    if (endpoint === "/literature/translate" && method === "POST") {
      let parsed = null;
      try {
        parsed = options?.body ? JSON.parse(options.body) : null;
      } catch {
        parsed = null;
      }
      return {
        id: null,
        model: "glm-4.5-flash",
        modelSource: "mock",
        translatedText: "Mock translation (enable backend to translate).",
        targetLang: parsed?.targetLang || "zh",
        apiKeySource: "mock",
        translationProvider: "mock",
        translationProviderSource: "mock",
        translationBaseUrlSource: null,
        translationBaseUrlHost: null,
        cached: false,
      };
    }

    if (endpoint === "/admin/literature/translation-key" && method === "GET") {
      return {
        hasDefaultTranslationApiKey: false,
        defaultTranslationApiKeyMasked: null,
        updatedAt: null,
      };
    }

    if (endpoint === "/admin/literature/translation-key" && method === "PATCH") {
      return {
        hasDefaultTranslationApiKey: true,
        defaultTranslationApiKeyMasked: "****mock",
        updatedAt: new Date().toISOString(),
      };
    }

    if (endpoint === "/admin/literature/translation-model" && method === "GET") {
      return {
        hasDefaultTranslationModel: false,
        defaultTranslationModel: null,
        updatedAt: null,
        builtinDefaultTranslationModel: "glm-4.5-flash",
      };
    }

    if (endpoint === "/admin/literature/translation-model" && method === "PATCH") {
      let parsed = null;
      try {
        parsed = options?.body ? JSON.parse(options.body) : null;
      } catch {
        parsed = null;
      }

      const nextModel =
        typeof parsed?.defaultTranslationModel === "string" && parsed.defaultTranslationModel.trim()
          ? parsed.defaultTranslationModel.trim()
          : null;

      return {
        hasDefaultTranslationModel: Boolean(
          parsed?.defaultTranslationModel && parsed.defaultTranslationModel.trim(),
        ),
        defaultTranslationModel: nextModel,
        updatedAt: new Date().toISOString(),
        builtinDefaultTranslationModel: "glm-4.5-flash",
      };
    }

    if (endpoint === "/admin/literature/translation-base-url" && method === "GET") {
      return {
        hasDefaultTranslationBaseUrl: false,
        defaultTranslationBaseUrl: null,
        updatedAt: null,
      };
    }

    if (endpoint === "/admin/literature/translation-base-url" && method === "PATCH") {
      let parsed = null;
      try {
        parsed = options?.body ? JSON.parse(options.body) : null;
      } catch {
        parsed = null;
      }

      const nextBaseUrl =
        typeof parsed?.defaultTranslationBaseUrl === "string" && parsed.defaultTranslationBaseUrl.trim()
          ? parsed.defaultTranslationBaseUrl.trim()
          : null;

      return {
        hasDefaultTranslationBaseUrl: Boolean(
          parsed?.defaultTranslationBaseUrl && parsed.defaultTranslationBaseUrl.trim(),
        ),
        defaultTranslationBaseUrl: nextBaseUrl,
        updatedAt: new Date().toISOString(),
      };
    }

    if (endpoint === "/admin/literature/translation-provider" && method === "GET") {
      return {
        translationProvider: "bigmodel",
        hasTranslationProvider: true,
        supportedProviders: ["bigmodel"],
        updatedAt: new Date().toISOString(),
      };
    }

    if (endpoint === "/admin/literature/translation-provider" && method === "PATCH") {
      let parsed = null;
      try {
        parsed = options?.body ? JSON.parse(options.body) : null;
      } catch {
        parsed = null;
      }

      const provider =
        typeof parsed?.translationProvider === "string" && parsed.translationProvider.trim()
          ? parsed.translationProvider.trim()
          : "bigmodel";

      return {
        translationProvider: provider,
        hasTranslationProvider: true,
        supportedProviders: ["bigmodel"],
        updatedAt: new Date().toISOString(),
        clearedDefaults: true,
      };
    }

    // POST/PATCH/DELETE 操作返回成功
    if (method === "POST" || method === "PATCH" || method === "DELETE") {
      return { success: true };
    }

    return [];
  }
}

export const apiService = new ApiService();
