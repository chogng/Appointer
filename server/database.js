import dotenv from 'dotenv';
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const DEFAULT_DB_PATH = path.join(__dirname, 'drms.db');
const DB_PATH = process.env.DB_PATH ? path.resolve(__dirname, process.env.DB_PATH) : DEFAULT_DB_PATH;

let db = null;

// 初始化数据库
export async function initDatabase() {
    const SQL = await initSqlJs();
    const dbFileExists = fs.existsSync(DB_PATH);

    // 尝试加载现有数据库
    if (dbFileExists) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
        console.log('✅ 数据库已加载');
    } else {
        db = new SQL.Database();
        console.log('✅ 创建新数据库');
    }

    await createTables();
    await migrateSchema();

    if (!dbFileExists) {
        await insertInitialData();
    }

    // sql.js 在内存中运行：需要显式写回文件以持久化 schema/数据变化。
    saveDatabase();
    return db;
}

// 保存数据库到文件
export function saveDatabase() {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

// 创建表
async function createTables() {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            status TEXT NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            expiryDate TEXT
        );
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            isEnabled INTEGER NOT NULL DEFAULT 1,
            openDays TEXT NOT NULL,
            timeSlots TEXT NOT NULL,
            granularity INTEGER DEFAULT 60,
            openTime TEXT DEFAULT '{"start":"09:00","end":"18:00"}'
        );
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS reservations (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            deviceId TEXT NOT NULL,
            date TEXT NOT NULL,
            timeSlot TEXT NOT NULL,
            status TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            title TEXT,
            description TEXT,
            color TEXT
        );
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS logs (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            action TEXT NOT NULL,
            details TEXT,
            timestamp TEXT NOT NULL
        );
    `);
}

function listTableColumns(table) {
    const stmt = db.prepare(`PRAGMA table_info(${table});`);
    const columns = [];

    while (stmt.step()) {
        columns.push(stmt.getAsObject().name);
    }

    stmt.free();
    return columns;
}

function ensureColumn(table, column, typeWithConstraints) {
    const columns = listTableColumns(table);
    if (columns.includes(column)) return false;

    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeWithConstraints};`);
    return true;
}

async function migrateSchema() {
    // Keep runtime schema consistent with server.js expectations.
    ensureColumn('devices', 'granularity', 'INTEGER DEFAULT 60');
    ensureColumn('devices', 'openTime', `TEXT DEFAULT '{"start":"09:00","end":"18:00"}'`);

    // Older databases may miss reservation detail fields.
    ensureColumn('reservations', 'title', `TEXT DEFAULT ''`);
    ensureColumn('reservations', 'description', `TEXT DEFAULT ''`);
    ensureColumn('reservations', 'color', `TEXT DEFAULT 'default'`);

    // Prevent double-booking the same device/date/slot (while allowing re-booking after cancellation).
    db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS reservations_unique_active
        ON reservations (deviceId, date, timeSlot)
        WHERE status != 'CANCELLED'
    `);
}

// 插入初始数据
async function insertInitialData() {
    const users = [
        ['admin_001', 'admin', '123', 'SUPER_ADMIN', 'ACTIVE', 'Super Admin', 'admin@example.com', null],
        ['manager_001', 'manager', '123', 'ADMIN', 'ACTIVE', '设备管理员', 'manager@example.com', null],
        ['user_001', 'user', '123', 'USER', 'ACTIVE', '张三', 'john@example.com', '2026-01-01']
    ];

    users.forEach(user => {
        db.run(
            'INSERT INTO users (id, username, password, role, status, name, email, expiryDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            user
        );
    });

    const devices = [
        ['dev_001', '高性能服务器 A', '32核 CPU, 128GB 内存, 适用于重型计算。', 1, JSON.stringify([1, 2, 3, 4, 5]), JSON.stringify(['09:00-10:00', '10:00-11:00', '11:00-12:00', '14:00-15:00', '15:00-16:00'])],
        ['dev_002', 'VR 测试单元', 'Oculus Quest 2 设置，带动作追踪。', 1, JSON.stringify([1, 3, 5]), JSON.stringify(['10:00-12:00', '14:00-16:00'])]
    ];

    devices.forEach(device => {
        db.run(
            'INSERT INTO devices (id, name, description, isEnabled, openDays, timeSlots) VALUES (?, ?, ?, ?, ?, ?)',
            device
        );
    });

    console.log('✅ 初始数据已插入');
}

// 获取数据库实例
export function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized');
    }
    return db;
}
