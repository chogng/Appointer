import Database from 'better-sqlite3';

const db = new Database('drms.db');

// 创建表
db.exec(`
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
    color TEXT,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (deviceId) REFERENCES devices(id)
  );

  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

// 插入初始数据
const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (id, username, password, role, status, name, email, expiryDate)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const users = [
  ['admin_001', 'admin', '123', 'SUPER_ADMIN', 'ACTIVE', 'Super Admin', 'admin@example.com', null],
  ['manager_001', 'manager', '123', 'ADMIN', 'ACTIVE', '设备管理员', 'manager@example.com', null],
  ['user_001', 'user', '123', 'USER', 'ACTIVE', '张三', 'john@example.com', '2026-01-01']
];

users.forEach(user => insertUser.run(...user));

const insertDevice = db.prepare(`
  INSERT OR IGNORE INTO devices (id, name, description, isEnabled, openDays, timeSlots)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const devices = [
  ['dev_001', '高性能服务器 A', '32核 CPU, 128GB 内存, 适用于重型计算。', 1, JSON.stringify([1, 2, 3, 4, 5]), JSON.stringify(['09:00-10:00', '10:00-11:00', '11:00-12:00', '14:00-15:00', '15:00-16:00'])],
  ['dev_002', 'VR 测试单元', 'Oculus Quest 2 设置，带动作追踪。', 1, JSON.stringify([1, 3, 5]), JSON.stringify(['10:00-12:00', '14:00-16:00'])]
];

devices.forEach(device => insertDevice.run(...device));

console.log('✅ 数据库初始化完成！');
db.close();
