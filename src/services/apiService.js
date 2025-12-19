const DEFAULT_API_BASE_URL = 'http://localhost:3001/api';
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');

class ApiService {
    async request(endpoint, options = {}) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });

        if (!response.ok) {
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

    async updateUser(id, updates) {
        return this.request(`/users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
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
    async getLogs() {
        return this.request('/logs');
    }
}

export const apiService = new ApiService();
