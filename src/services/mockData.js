const STORAGE_KEYS = {
    USERS: 'drms_users',
    DEVICES: 'drms_devices',
    RESERVATIONS: 'drms_reservations',
    CONFIG: 'drms_config',
    LOGS: 'drms_logs'
};

// Initial Data
const INITIAL_USERS = [
    {
        id: 'admin_001',
        username: 'admin',
        password: '123', // In real app, hash this
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        name: 'Super Admin',
        email: 'admin@example.com'
    },
    {
        id: 'manager_001',
        username: 'manager',
        password: '123',
        role: 'ADMIN',
        status: 'ACTIVE',
        name: '设备管理员',
        email: 'manager@example.com'
    },
    {
        id: 'user_001',
        username: 'user',
        password: '123',
        role: 'USER',
        status: 'ACTIVE',
        name: '张三',
        email: 'john@example.com',
        expiryDate: '2026-01-01'
    }
];

const INITIAL_DEVICES = [
    {
        id: 'dev_001',
        name: '高性能服务器 A',
        description: '32核 CPU, 128GB 内存, 适用于重型计算。',
        isEnabled: true,
        openDays: [1, 2, 3, 4, 5], // Mon-Fri
        timeSlots: ['09:00-10:00', '10:00-11:00', '11:00-12:00', '14:00-15:00', '15:00-16:00']
    },
    {
        id: 'dev_002',
        name: 'VR 测试单元',
        description: 'Oculus Quest 2 设置，带动作追踪。',
        isEnabled: true,
        openDays: [1, 3, 5], // Mon, Wed, Fri
        timeSlots: ['10:00-12:00', '14:00-16:00']
    }
];

class MockService {
    constructor() {
        this.init();
    }

    init() {
        if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
        }
        if (!localStorage.getItem(STORAGE_KEYS.DEVICES)) {
            localStorage.setItem(STORAGE_KEYS.DEVICES, JSON.stringify(INITIAL_DEVICES));
        }
        if (!localStorage.getItem(STORAGE_KEYS.RESERVATIONS)) {
            localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify([]));
        }
        if (!localStorage.getItem(STORAGE_KEYS.LOGS)) {
            localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
        }
    }

    // Generic Helpers
    _get(key) {
        return JSON.parse(localStorage.getItem(key) || '[]');
    }

    _set(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    // User Methods
    login(username, password) {
        const users = this._get(STORAGE_KEYS.USERS);
        const user = users.find(u => u.username === username && u.password === password);
        if (user) {
            if (user.status !== 'ACTIVE') throw new Error('Account is not active.');
            this.logAction(user.id, 'LOGIN', 'User logged in');
            return { ...user, password: '' }; // Remove password
        }
        throw new Error('Invalid credentials');
    }

    getUsers() {
        return this._get(STORAGE_KEYS.USERS).map(u => {
            const { password: _password, ...rest } = u;
            return rest;
        });
    }

    createUser(userData) {
        const users = this._get(STORAGE_KEYS.USERS);
        if (users.find(u => u.username === userData.username)) {
            throw new Error('Username already exists');
        }
        const newUser = {
            id: 'user_' + Date.now(),
            status: 'PENDING',
            role: 'USER',
            ...userData
        };
        users.push(newUser);
        this._set(STORAGE_KEYS.USERS, users);
        return newUser;
    }

    updateUser(id, updates) {
        const users = this._get(STORAGE_KEYS.USERS);
        const index = users.findIndex(u => u.id === id);
        if (index === -1) throw new Error('User not found');
        users[index] = { ...users[index], ...updates };
        this._set(STORAGE_KEYS.USERS, users);
        return users[index];
    }

    // Device Methods
    getDevices() {
        return this._get(STORAGE_KEYS.DEVICES);
    }

    createDevice(deviceData) {
        const devices = this._get(STORAGE_KEYS.DEVICES);
        const newDevice = {
            id: 'dev_' + Date.now(),
            isEnabled: true,
            ...deviceData
        };
        devices.push(newDevice);
        this._set(STORAGE_KEYS.DEVICES, devices);
        return newDevice;
    }

    updateDevice(id, updates) {
        const devices = this._get(STORAGE_KEYS.DEVICES);
        const index = devices.findIndex(d => d.id === id);
        if (index === -1) throw new Error('Device not found');
        devices[index] = { ...devices[index], ...updates };
        this._set(STORAGE_KEYS.DEVICES, devices);
        return devices[index];
    }

    // Reservation Methods
    getReservations() {
        return this._get(STORAGE_KEYS.RESERVATIONS);
    }

    createReservation(reservation) {
        const reservations = this._get(STORAGE_KEYS.RESERVATIONS);
        // Basic conflict check
        const conflict = reservations.find(r =>
            r.deviceId === reservation.deviceId &&
            r.date === reservation.date &&
            r.timeSlot === reservation.timeSlot &&
            r.status !== 'CANCELLED'
        );

        if (conflict) throw new Error('Time slot already booked');

        const newReservation = {
            id: 'res_' + Date.now(),
            status: 'CONFIRMED',
            createdAt: new Date().toISOString(),
            ...reservation
        };
        reservations.push(newReservation);
        this._set(STORAGE_KEYS.RESERVATIONS, reservations);
        return newReservation;
    }

    // Logging
    logAction(userId, action, details) {
        const logs = this._get(STORAGE_KEYS.LOGS);
        logs.unshift({
            id: 'log_' + Date.now(),
            userId,
            action,
            details,
            timestamp: new Date().toISOString()
        });
        this._set(STORAGE_KEYS.LOGS, logs);
    }
}

export const mockService = new MockService();
