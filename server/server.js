import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { db } from './db-adapter.js';

const app = express();
const httpServer = createServer(app);

const DEFAULT_CLIENT_ORIGIN = 'http://localhost:5173';
const corsOriginEnv = process.env.CORS_ORIGIN || process.env.CLIENT_ORIGIN;
const corsOrigins = (corsOriginEnv || DEFAULT_CLIENT_ORIGIN)
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

function safeJsonParse(value, fallback) {
    if (value === null || value === undefined) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidDateString(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTimeSlot(value) {
    return typeof value === 'string' && /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(value);
}

function isUniqueConstraintError(error) {
    const msg = String(error?.message || '');
    return msg.includes('UNIQUE constraint failed') || msg.includes('constraint failed');
}

const io = new Server(httpServer, {
    cors: {
        origin: corsOrigins,
        methods: ['GET', 'POST']
    }
});

const PORT = Number(process.env.PORT) || 3001;

// 中间件
app.use(cors({ origin: corsOrigins }));
app.use(express.json());

// 初始化数据库
await db.init();

// WebSocket 连接管理
io.on('connection', (socket) => {
    console.log('✅ 客户端连接:', socket.id);

    socket.on('disconnect', () => {
        console.log('❌ 客户端断开:', socket.id);
    });
});

// 广播函数：通知所有客户端数据变化
function broadcast(event, data) {
    io.emit(event, data);
    console.log(`📡 广播事件: ${event}`, data);
}

// ============ 用户相关 API ============

app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const user = db.queryOne('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.status !== 'ACTIVE') {
            return res.status(403).json({ error: 'Account is not active' });
        }

        db.execute(
            'INSERT INTO logs (id, userId, action, details, timestamp) VALUES (?, ?, ?, ?, ?)',
            ['log_' + Date.now(), user.id, 'LOGIN', 'User logged in', new Date().toISOString()]
        );

        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users', (req, res) => {
    try {
        const users = db.query('SELECT id, username, role, status, name, email, expiryDate FROM users');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/users', (req, res) => {
    try {
        const { username, password, name, email, expiryDate } = req.body;

        const existing = db.queryOne('SELECT id FROM users WHERE username = ?', [username]);
        if (existing) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const newUser = {
            id: 'user_' + Date.now(),
            username,
            password,
            role: 'USER',
            status: 'PENDING',
            name,
            email,
            expiryDate: expiryDate || null
        };

        db.execute(
            'INSERT INTO users (id, username, password, role, status, name, email, expiryDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [newUser.id, newUser.username, newUser.password, newUser.role, newUser.status, newUser.name, newUser.email, newUser.expiryDate]
        );

        const { password: _, ...userWithoutPassword } = newUser;

        // 广播新用户创建
        broadcast('user:created', userWithoutPassword);

        res.status(201).json(userWithoutPassword);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/users/:id', (req, res) => {
    try {
        const { id } = req.params;
        if (!isPlainObject(req.body)) {
            return res.status(400).json({ error: 'Invalid update payload' });
        }

        const rawUpdates = req.body;
        const allowedKeys = new Set(['role', 'status', 'name', 'email', 'expiryDate']);
        const unknownKeys = Object.keys(rawUpdates).filter(key => !allowedKeys.has(key));
        if (unknownKeys.length > 0) {
            return res.status(400).json({ error: `Unknown fields: ${unknownKeys.join(', ')}` });
        }

        const user = db.queryOne('SELECT * FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updates = {};
        if ('name' in rawUpdates) {
            if (typeof rawUpdates.name !== 'string' || !rawUpdates.name.trim()) {
                return res.status(400).json({ error: 'Invalid name' });
            }
            updates.name = rawUpdates.name.trim();
        }
        if ('email' in rawUpdates) {
            if (typeof rawUpdates.email !== 'string' || !rawUpdates.email.trim()) {
                return res.status(400).json({ error: 'Invalid email' });
            }
            updates.email = rawUpdates.email.trim();
        }
        if ('expiryDate' in rawUpdates) {
            if (rawUpdates.expiryDate !== null && !isValidDateString(rawUpdates.expiryDate)) {
                return res.status(400).json({ error: 'Invalid expiryDate (expected YYYY-MM-DD or null)' });
            }
            updates.expiryDate = rawUpdates.expiryDate;
        }
        if ('status' in rawUpdates) {
            const allowedStatuses = new Set(['ACTIVE', 'PENDING', 'DISABLED']);
            if (typeof rawUpdates.status !== 'string' || !allowedStatuses.has(rawUpdates.status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }
            updates.status = rawUpdates.status;
        }
        if ('role' in rawUpdates) {
            const allowedRoles = new Set(['USER', 'ADMIN', 'SUPER_ADMIN']);
            if (typeof rawUpdates.role !== 'string' || !allowedRoles.has(rawUpdates.role)) {
                return res.status(400).json({ error: 'Invalid role' });
            }
            updates.role = rawUpdates.role;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), id];

        db.execute(`UPDATE users SET ${fields} WHERE id = ?`, values);

        const updated = db.queryOne('SELECT id, username, role, status, name, email, expiryDate FROM users WHERE id = ?', [id]);

        // 广播用户更新
        broadcast('user:updated', updated);

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ 设备相关 API ============

app.get('/api/devices', (req, res) => {
    try {
        const devices = db.query('SELECT * FROM devices');
        const parsed = devices.map(d => ({
            ...d,
            isEnabled: Boolean(d.isEnabled),
            openDays: safeJsonParse(d.openDays, [1, 2, 3, 4, 5]),
            timeSlots: safeJsonParse(d.timeSlots, []),
            granularity: d.granularity || 60,
            openTime: d.openTime ? safeJsonParse(d.openTime, { start: '09:00', end: '18:00' }) : { start: '09:00', end: '18:00' }
        }));
        res.json(parsed);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/devices/:id', (req, res) => {
    try {
        const device = db.queryOne('SELECT * FROM devices WHERE id = ?', [req.params.id]);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        res.json({
            ...device,
            isEnabled: Boolean(device.isEnabled),
            openDays: safeJsonParse(device.openDays, [1, 2, 3, 4, 5]),
            timeSlots: safeJsonParse(device.timeSlots, []),
            granularity: device.granularity || 60,
            openTime: device.openTime ? safeJsonParse(device.openTime, { start: '09:00', end: '18:00' }) : { start: '09:00', end: '18:00' }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/devices', (req, res) => {
    try {
        const { name, description, openDays, timeSlots, granularity = 60, openTime } = req.body;
        if (typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Device name is required' });
        }
        if (typeof description !== 'string') {
            return res.status(400).json({ error: 'Invalid device description' });
        }
        if (openDays !== undefined && !Array.isArray(openDays)) {
            return res.status(400).json({ error: 'Invalid openDays (expected array)' });
        }
        if (timeSlots !== undefined && !Array.isArray(timeSlots)) {
            return res.status(400).json({ error: 'Invalid timeSlots (expected array)' });
        }
        const parsedGranularity = Number(granularity);
        if (!Number.isInteger(parsedGranularity) || parsedGranularity <= 0) {
            return res.status(400).json({ error: 'Invalid granularity' });
        }
        if (openTime !== undefined && (!isPlainObject(openTime) || typeof openTime.start !== 'string' || typeof openTime.end !== 'string')) {
            return res.status(400).json({ error: 'Invalid openTime (expected {start,end})' });
        }

        const newDevice = {
            id: 'dev_' + Date.now(),
            name: name.trim(),
            description,
            isEnabled: 1,
            openDays: JSON.stringify(openDays || [1, 2, 3, 4, 5]),
            timeSlots: JSON.stringify(timeSlots || []),
            granularity: parsedGranularity,
            openTime: JSON.stringify(openTime || { start: '09:00', end: '18:00' })
        };

        db.execute(
            'INSERT INTO devices (id, name, description, isEnabled, openDays, timeSlots, granularity, openTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [newDevice.id, newDevice.name, newDevice.description, newDevice.isEnabled, newDevice.openDays, newDevice.timeSlots, newDevice.granularity, newDevice.openTime]
        );

        const result = {
            ...newDevice,
            isEnabled: Boolean(newDevice.isEnabled),
            openDays: safeJsonParse(newDevice.openDays, [1, 2, 3, 4, 5]),
            timeSlots: safeJsonParse(newDevice.timeSlots, []),
            openTime: safeJsonParse(newDevice.openTime, { start: '09:00', end: '18:00' })
        };

        // 广播新设备创建
        broadcast('device:created', result);

        // 记录日志
        db.execute(
            'INSERT INTO logs (id, userId, action, details, timestamp) VALUES (?, ?, ?, ?, ?)',
            ['log_' + Date.now(), 'system', 'DEVICE_CREATED', `Created device: ${result.name}`, new Date().toISOString()]
        );

        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/devices/:id', (req, res) => {
    try {
        const { id } = req.params;
        if (!isPlainObject(req.body)) {
            return res.status(400).json({ error: 'Invalid update payload' });
        }

        const rawUpdates = { ...req.body };
        const allowedKeys = new Set(['name', 'description', 'isEnabled', 'openDays', 'timeSlots', 'granularity', 'openTime']);
        const unknownKeys = Object.keys(rawUpdates).filter(key => !allowedKeys.has(key));
        if (unknownKeys.length > 0) {
            return res.status(400).json({ error: `Unknown fields: ${unknownKeys.join(', ')}` });
        }

        const device = db.queryOne('SELECT * FROM devices WHERE id = ?', [id]);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const updates = {};
        if ('name' in rawUpdates) {
            if (typeof rawUpdates.name !== 'string' || !rawUpdates.name.trim()) {
                return res.status(400).json({ error: 'Invalid device name' });
            }
            updates.name = rawUpdates.name.trim();
        }
        if ('description' in rawUpdates) {
            if (typeof rawUpdates.description !== 'string') {
                return res.status(400).json({ error: 'Invalid device description' });
            }
            updates.description = rawUpdates.description;
        }
        if ('isEnabled' in rawUpdates) {
            updates.isEnabled = rawUpdates.isEnabled ? 1 : 0;
        }
        if ('openDays' in rawUpdates) {
            if (!Array.isArray(rawUpdates.openDays)) {
                return res.status(400).json({ error: 'Invalid openDays (expected array)' });
            }
            updates.openDays = JSON.stringify(rawUpdates.openDays);
        }
        if ('timeSlots' in rawUpdates) {
            if (!Array.isArray(rawUpdates.timeSlots)) {
                return res.status(400).json({ error: 'Invalid timeSlots (expected array)' });
            }
            updates.timeSlots = JSON.stringify(rawUpdates.timeSlots);
        }
        if ('granularity' in rawUpdates) {
            const parsedGranularity = Number(rawUpdates.granularity);
            if (!Number.isInteger(parsedGranularity) || parsedGranularity <= 0) {
                return res.status(400).json({ error: 'Invalid granularity' });
            }
            updates.granularity = parsedGranularity;
        }
        if ('openTime' in rawUpdates) {
            if (!isPlainObject(rawUpdates.openTime) || typeof rawUpdates.openTime.start !== 'string' || typeof rawUpdates.openTime.end !== 'string') {
                return res.status(400).json({ error: 'Invalid openTime (expected {start,end})' });
            }
            updates.openTime = JSON.stringify(rawUpdates.openTime);
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), id];

        db.execute(`UPDATE devices SET ${fields} WHERE id = ?`, values);

        const updated = db.queryOne('SELECT * FROM devices WHERE id = ?', [id]);
        const result = {
            ...updated,
            isEnabled: Boolean(updated.isEnabled),
            openDays: safeJsonParse(updated.openDays, [1, 2, 3, 4, 5]),
            timeSlots: safeJsonParse(updated.timeSlots, []),
            granularity: updated.granularity || 60,
            openTime: updated.openTime ? safeJsonParse(updated.openTime, { start: '09:00', end: '18:00' }) : { start: '09:00', end: '18:00' }
        };

        // 广播设备更新（重要：启用/停用状态）
        broadcast('device:updated', result);

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/devices/:id', (req, res) => {
    try {
        const { id } = req.params;

        const device = db.queryOne('SELECT * FROM devices WHERE id = ?', [id]);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        db.execute('DELETE FROM devices WHERE id = ?', [id]);

        // 广播设备删除
        broadcast('device:deleted', { id });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ 预约相关 API ============

app.get('/api/reservations', (req, res) => {
    try {
        const reservations = db.query('SELECT * FROM reservations');
        res.json(reservations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/reservations', (req, res) => {
    try {
        const { userId, deviceId, date, timeSlot, title, description, color } = req.body;
        if (typeof userId !== 'string' || !userId.trim()) {
            return res.status(400).json({ error: 'userId is required' });
        }
        if (typeof deviceId !== 'string' || !deviceId.trim()) {
            return res.status(400).json({ error: 'deviceId is required' });
        }
        if (!isValidDateString(date)) {
            return res.status(400).json({ error: 'Invalid date (expected YYYY-MM-DD)' });
        }
        if (!isValidTimeSlot(timeSlot)) {
            return res.status(400).json({ error: 'Invalid timeSlot (expected HH:MM-HH:MM)' });
        }

        const conflict = db.queryOne(
            `SELECT * FROM reservations WHERE deviceId = ? AND date = ? AND timeSlot = ? AND status != 'CANCELLED'`,
            [deviceId, date, timeSlot]
        );

        if (conflict) {
            return res.status(409).json({ error: 'Time slot already booked' });
        }

        const newReservation = {
            id: 'res_' + Date.now(),
            userId,
            deviceId,
            date,
            timeSlot,
            status: 'CONFIRMED',
            createdAt: new Date().toISOString(),
            title: title || '',
            description: description || '',
            color: color || 'default'
        };

        try {
            db.execute(
                'INSERT INTO reservations (id, userId, deviceId, date, timeSlot, status, createdAt, title, description, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [newReservation.id, newReservation.userId, newReservation.deviceId, newReservation.date, newReservation.timeSlot, newReservation.status, newReservation.createdAt, newReservation.title, newReservation.description, newReservation.color]
            );
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                return res.status(409).json({ error: 'Time slot already booked' });
            }
            throw error;
        }

        // 广播新预约（重要：实时显示）
        broadcast('reservation:created', newReservation);

        // 记录日志
        db.execute(
            'INSERT INTO logs (id, userId, action, details, timestamp) VALUES (?, ?, ?, ?, ?)',
            ['log_' + Date.now(), newReservation.userId, 'RESERVATION_CREATED', `Created reservation for device ${newReservation.deviceId}`, new Date().toISOString()]
        );

        res.status(201).json(newReservation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/reservations/:id', (req, res) => {
    try {
        const { id } = req.params;
        if (!isPlainObject(req.body)) {
            return res.status(400).json({ error: 'Invalid update payload' });
        }
        const rawUpdates = req.body;
        const allowedKeys = new Set(['status', 'date', 'timeSlot', 'title', 'description', 'color']);
        const unknownKeys = Object.keys(rawUpdates).filter(key => !allowedKeys.has(key));
        if (unknownKeys.length > 0) {
            return res.status(400).json({ error: `Unknown fields: ${unknownKeys.join(', ')}` });
        }

        const reservation = db.queryOne('SELECT * FROM reservations WHERE id = ?', [id]);
        if (!reservation) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        const updates = {};
        if ('status' in rawUpdates) {
            const allowedStatuses = new Set(['CONFIRMED', 'CANCELLED']);
            if (typeof rawUpdates.status !== 'string' || !allowedStatuses.has(rawUpdates.status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }
            updates.status = rawUpdates.status;
        }
        if ('date' in rawUpdates) {
            if (!isValidDateString(rawUpdates.date)) {
                return res.status(400).json({ error: 'Invalid date (expected YYYY-MM-DD)' });
            }
            updates.date = rawUpdates.date;
        }
        if ('timeSlot' in rawUpdates) {
            if (!isValidTimeSlot(rawUpdates.timeSlot)) {
                return res.status(400).json({ error: 'Invalid timeSlot (expected HH:MM-HH:MM)' });
            }
            updates.timeSlot = rawUpdates.timeSlot;
        }
        if ('title' in rawUpdates) {
            if (rawUpdates.title !== null && typeof rawUpdates.title !== 'string') {
                return res.status(400).json({ error: 'Invalid title' });
            }
            updates.title = rawUpdates.title ?? '';
        }
        if ('description' in rawUpdates) {
            if (rawUpdates.description !== null && typeof rawUpdates.description !== 'string') {
                return res.status(400).json({ error: 'Invalid description' });
            }
            updates.description = rawUpdates.description ?? '';
        }
        if ('color' in rawUpdates) {
            if (rawUpdates.color !== null && typeof rawUpdates.color !== 'string') {
                return res.status(400).json({ error: 'Invalid color' });
            }
            updates.color = rawUpdates.color ?? 'default';
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), id];

        try {
            db.execute(`UPDATE reservations SET ${fields} WHERE id = ?`, values);
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                return res.status(409).json({ error: 'Time slot already booked' });
            }
            throw error;
        }

        const updated = db.queryOne('SELECT * FROM reservations WHERE id = ?', [id]);

        // 广播预约更新（取消等操作）
        broadcast('reservation:updated', updated);

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/reservations/:id', (req, res) => {
    try {
        const { id } = req.params;

        const reservation = db.queryOne('SELECT * FROM reservations WHERE id = ?', [id]);
        if (!reservation) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        db.execute('DELETE FROM reservations WHERE id = ?', [id]);

        // 广播预约删除
        broadcast('reservation:deleted', { id });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ 日志相关 API ============

app.get('/api/logs', (req, res) => {
    try {
        const logs = db.query(`
            SELECT l.*, u.name as userName 
            FROM logs l 
            LEFT JOIN users u ON l.userId = u.id 
            ORDER BY l.timestamp DESC 
            LIMIT 10
        `);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 启动服务器
httpServer.listen(PORT, () => {
    console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
    console.log(`🔌 WebSocket 已启用`);
});
