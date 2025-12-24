const DEFAULT_API_BASE_URL = 'http://localhost:3001/api';
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');

class ApiService {
    unauthorizedCallback = null;

    bindUnauthorizedCallback(callback) {
        this.unauthorizedCallback = callback;
    }

    async request(endpoint, options = {}) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            credentials: 'include', // Important: Send cookies with request
            ...options,
        });

        if (!response.ok) {
            if (response.status === 401 && this.unauthorizedCallback) {
                this.unauthorizedCallback();
            }
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    }

    // ============ 用户相关 ============
    async login(username, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
    }

    async getUsers() {
        return this.request('/users');
    }

    async createUser(userData) {
        return this.request('/users', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
    }

    async adminCreateUser(userData) {
        return this.request('/admin/users', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
    }

    async updateUser(id, updates) {
        return this.request(`/users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    }

    async deleteUser(id) {
        return this.request(`/users/${id}`, {
            method: 'DELETE',
        });
    }

    // ============ 设备相关 ============
    async getDevices() {
        return this.request('/devices');
    }

    async getDevice(id) {
        return this.request(`/devices/${id}`);
    }

    async createDevice(deviceData) {
        return this.request('/devices', {
            method: 'POST',
            body: JSON.stringify(deviceData),
        });
    }

    async updateDevice(id, updates) {
        return this.request(`/devices/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    }

    async deleteDevice(id) {
        return this.request(`/devices/${id}`, {
            method: 'DELETE',
        });
    }

    // ============ 预约相关 ============
    async getReservations() {
        return this.request('/reservations');
    }

    async createReservation(reservationData) {
        return this.request('/reservations', {
            method: 'POST',
            body: JSON.stringify(reservationData),
        });
    }

    async updateReservation(id, updates) {
        return this.request(`/reservations/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    }

    async deleteReservation(id) {
        return this.request(`/reservations/${id}`, {
            method: 'DELETE',
        });
    }

    // ============ 日志相关 ============
    async getLogs(search = '', options = {}) {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (typeof options.limit === 'number') params.set('limit', String(options.limit));
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/logs${query}`);
    }

    async deleteLogs() {
        return this.request('/logs', {
            method: 'DELETE',
        });
    }

    // ============ 库存相关 ============
    async getInventory(search = '') {
        const query = search ? `?search=${encodeURIComponent(search)}` : '';
        return this.request(`/inventory${query}`);
    }

    async createInventory(item) {
        return this.request('/inventory', {
            method: 'POST',
            body: JSON.stringify(item),
        });
    }

    async updateInventory(id, updates) {
        return this.request(`/inventory/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    }

    async deleteInventory(id) {
        return this.request(`/inventory/${id}`, {
            method: 'DELETE',
        });
    }

    // ============ 申请相关 ============
    async getRequests(options = {}) {
        const params = new URLSearchParams();
        if (options.status) {
            const statusValue = Array.isArray(options.status) ? options.status.join(',') : String(options.status);
            params.set('status', statusValue);
        }
        if (typeof options.limit === 'number') params.set('limit', String(options.limit));
        if (typeof options.offset === 'number') params.set('offset', String(options.offset));

        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/requests${query}`);
    }

    async createRequest(data) {
        return this.request('/requests', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async approveRequest(id) {
        return this.request(`/requests/${id}/approve`, {
            method: 'POST',
        });
    }

    async rejectRequest(id) {
        return this.request(`/requests/${id}/reject`, {
            method: 'POST',
        });
    }

    async deleteRequest(id) {
        return this.request(`/requests/${id}`, {
            method: 'DELETE',
        });
    }

    // ============ 黑名单相关 ============
    async getUserBlocklist(userId) {
        return this.request(`/users/${userId}/blocklist`);
    }

    async blockUserDevice(userId, deviceId, reason = '') {
        return this.request(`/users/${userId}/blocklist`, {
            method: 'POST',
            body: JSON.stringify({ deviceId, reason }),
        });
    }

    async unblockUserDevice(userId, deviceId) {
        return this.request(`/users/${userId}/blocklist/${deviceId}`, {
            method: 'DELETE',
        });
    }

    // ============ SUPER_ADMIN: Data Retention ============
    async getRetentionSettings() {
        return this.request('/admin/retention');
    }

    async updateRetentionSettings(updates) {
        return this.request('/admin/retention', {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    }

    async runRetentionCleanup() {
        return this.request('/admin/retention/run', {
            method: 'POST',
        });
    }

    // ============ Analytics/Leaderboard ============
    async getLeaderboard() {
        return this.request('/admin/leaderboard');
    }
}

export const apiService = new ApiService();
