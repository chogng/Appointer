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

const io = new Server(httpServer, {
    cors: {
        origin: corsOrigins,
        methods: ['GET', 'POST']
    }
});

const PORT = Number(process.env.PORT) || 3001;

// 中间件
app.use(cors(corsOriginEnv ? { origin: corsOrigins } : undefined));
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
        const updates = req.body;

        const user = db.queryOne('SELECT * FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
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
            openDays: JSON.parse(d.openDays),
            timeSlots: JSON.parse(d.timeSlots),
            granularity: d.granularity || 60,
            openTime: d.openTime ? JSON.parse(d.openTime) : { start: '09:00', end: '18:00' }
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
            openDays: JSON.parse(device.openDays),
            timeSlots: JSON.parse(device.timeSlots),
            granularity: device.granularity || 60,
            openTime: device.openTime ? JSON.parse(device.openTime) : { start: '09:00', end: '18:00' }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/devices', (req, res) => {
    try {
        const { name, description, openDays, timeSlots, granularity = 60, openTime } = req.body;

        const newDevice = {
            id: 'dev_' + Date.now(),
            name,
            description,
            isEnabled: 1,
            openDays: JSON.stringify(openDays || [1, 2, 3, 4, 5]),
            timeSlots: JSON.stringify(timeSlots || []),
            granularity,
            openTime: JSON.stringify(openTime || { start: '09:00', end: '18:00' })
        };

        db.execute(
            'INSERT INTO devices (id, name, description, isEnabled, openDays, timeSlots, granularity, openTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [newDevice.id, newDevice.name, newDevice.description, newDevice.isEnabled, newDevice.openDays, newDevice.timeSlots, newDevice.granularity, newDevice.openTime]
        );

        const result = {
            ...newDevice,
            isEnabled: Boolean(newDevice.isEnabled),
            openDays: JSON.parse(newDevice.openDays),
            timeSlots: JSON.parse(newDevice.timeSlots),
            openTime: JSON.parse(newDevice.openTime)
        };

        // 广播新设备创建
        broadcast('device:created', result);

        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/devices/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body };

        const device = db.queryOne('SELECT * FROM devices WHERE id = ?', [id]);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        if (updates.isEnabled !== undefined) {
            updates.isEnabled = updates.isEnabled ? 1 : 0;
        }
        if (updates.openDays) {
            updates.openDays = JSON.stringify(updates.openDays);
        }
        if (updates.timeSlots) {
            updates.timeSlots = JSON.stringify(updates.timeSlots);
        }
        if (updates.openTime) {
            updates.openTime = JSON.stringify(updates.openTime);
        }

        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), id];

        db.execute(`UPDATE devices SET ${fields} WHERE id = ?`, values);

        const updated = db.queryOne('SELECT * FROM devices WHERE id = ?', [id]);
        const result = {
            ...updated,
            isEnabled: Boolean(updated.isEnabled),
            openDays: JSON.parse(updated.openDays),
            timeSlots: JSON.parse(updated.timeSlots),
            granularity: updated.granularity || 60,
            openTime: updated.openTime ? JSON.parse(updated.openTime) : { start: '09:00', end: '18:00' }
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

        db.execute(
            'INSERT INTO reservations (id, userId, deviceId, date, timeSlot, status, createdAt, title, description, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [newReservation.id, newReservation.userId, newReservation.deviceId, newReservation.date, newReservation.timeSlot, newReservation.status, newReservation.createdAt, newReservation.title, newReservation.description, newReservation.color]
        );

        // 广播新预约（重要：实时显示）
        broadcast('reservation:created', newReservation);

        res.status(201).json(newReservation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/reservations/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const reservation = db.queryOne('SELECT * FROM reservations WHERE id = ?', [id]);
        if (!reservation) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), id];

        db.execute(`UPDATE reservations SET ${fields} WHERE id = ?`, values);

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
        const logs = db.query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 100');
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
