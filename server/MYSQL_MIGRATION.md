# 从 SQLite 迁移到 MySQL

## 为什么要迁移？

- **并发性能**：MySQL 支持更高的并发写入
- **生产环境**：大多数云平台推荐 MySQL/PostgreSQL
- **扩展性**：支持主从复制、分库分表

## 迁移步骤

### 1. 安装 MySQL 驱动

```bash
cd server
npm install mysql2
```

### 2. 创建 MySQL 数据库适配器

创建 `server/mysql-adapter.js`：

```javascript
import mysql from 'mysql2/promise';

let pool = null;

export async function initMySQLDatabase() {
    pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'drms',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    // 创建表
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(50) PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(20) NOT NULL,
            status VARCHAR(20) NOT NULL,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) NOT NULL,
            expiryDate DATE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS devices (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT NOT NULL,
            isEnabled TINYINT(1) NOT NULL DEFAULT 1,
            openDays JSON NOT NULL,
            timeSlots JSON NOT NULL,
            INDEX idx_enabled (isEnabled)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS reservations (
            id VARCHAR(50) PRIMARY KEY,
            userId VARCHAR(50) NOT NULL,
            deviceId VARCHAR(50) NOT NULL,
            date DATE NOT NULL,
            timeSlot VARCHAR(20) NOT NULL,
            status VARCHAR(20) NOT NULL,
            createdAt DATETIME NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id),
            FOREIGN KEY (deviceId) REFERENCES devices(id),
            INDEX idx_device_date (deviceId, date),
            INDEX idx_user (userId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS logs (
            id VARCHAR(50) PRIMARY KEY,
            userId VARCHAR(50) NOT NULL,
            action VARCHAR(50) NOT NULL,
            details TEXT,
            timestamp DATETIME NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id),
            INDEX idx_timestamp (timestamp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('✅ MySQL 数据库初始化完成');
}

export async function mysqlQuery(sql, params = []) {
    const [rows] = await pool.execute(sql, params);
    return rows;
}

export async function mysqlExecute(sql, params = []) {
    await pool.execute(sql, params);
}

export function getMySQLPool() {
    return pool;
}
```

### 3. 更新数据库适配器

修改 `server/src/db/db-adapter.js`：

```javascript
import { initDatabase, getDatabase, saveDatabase } from './database.js';
import { initMySQLDatabase, mysqlQuery, mysqlExecute } from './mysql-adapter.js';

class DatabaseAdapter {
    constructor() {
        // 通过环境变量切换数据库
        this.dbType = process.env.DB_TYPE || 'sqlite'; // 'sqlite' 或 'mysql'
    }

    async init() {
        if (this.dbType === 'sqlite') {
            await initDatabase();
        } else if (this.dbType === 'mysql') {
            await initMySQLDatabase();
        }
    }

    async query(sql, params = []) {
        if (this.dbType === 'sqlite') {
            // SQLite 实现
            const db = getDatabase();
            const stmt = db.prepare(sql);
            stmt.bind(params);
            
            const results = [];
            while (stmt.step()) {
                results.push(stmt.getAsObject());
            }
            stmt.free();
            return results;
        } else if (this.dbType === 'mysql') {
            // MySQL 实现
            return await mysqlQuery(sql, params);
        }
    }

    queryOne(sql, params = []) {
        const results = this.query(sql, params);
        return results.length > 0 ? results[0] : null;
    }

    execute(sql, params = []) {
        if (this.dbType === 'sqlite') {
            const db = getDatabase();
            db.run(sql, params);
            saveDatabase();
        } else if (this.dbType === 'mysql') {
            return mysqlExecute(sql, params);
        }
    }
}

export const db = new DatabaseAdapter();
```

### 4. 配置环境变量

创建 `server/.env`：

```env
# 数据库类型：sqlite 或 mysql
DB_TYPE=mysql

# MySQL 配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=drms
```

### 5. 数据迁移

如果需要从 SQLite 迁移现有数据到 MySQL：

```bash
# 导出 SQLite 数据
sqlite3 drms.db .dump > dump.sql

# 转换并导入 MySQL（需要手动调整 SQL 语法）
# 或使用工具：https://github.com/dumblob/mysql2sqlite
```

### 6. 启动服务器

```bash
# 使用 SQLite（默认）
npm run dev

# 使用 MySQL
DB_TYPE=mysql npm run dev
```

## SQL 语法差异

### SQLite vs MySQL

| 功能 | SQLite | MySQL |
|------|--------|-------|
| 自增 ID | `INTEGER PRIMARY KEY AUTOINCREMENT` | `INT AUTO_INCREMENT PRIMARY KEY` |
| 布尔值 | `INTEGER (0/1)` | `TINYINT(1)` 或 `BOOLEAN` |
| JSON | `TEXT` | `JSON` |
| 日期时间 | `TEXT` | `DATETIME` |
| 字符串 | `TEXT` | `VARCHAR(n)` |

### 需要调整的查询

**SQLite**:
```sql
SELECT last_insert_rowid() as id
```

**MySQL**:
```sql
SELECT LAST_INSERT_ID() as id
```

## 性能优化建议

### MySQL 配置

1. **连接池**：使用 `mysql2/promise` 的连接池
2. **索引**：为常用查询字段添加索引
3. **缓存**：使用 Redis 缓存热点数据
4. **读写分离**：主库写入，从库读取

### 示例：添加索引

```sql
-- 预约查询优化
CREATE INDEX idx_device_date ON reservations(deviceId, date);
CREATE INDEX idx_user ON reservations(userId);

-- 日志查询优化
CREATE INDEX idx_timestamp ON logs(timestamp);
```

## 云平台部署

### AWS RDS MySQL

```javascript
const pool = mysql.createPool({
    host: process.env.RDS_HOSTNAME,
    user: process.env.RDS_USERNAME,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DB_NAME,
    port: process.env.RDS_PORT || 3306,
    ssl: { rejectUnauthorized: false }
});
```

### 阿里云 RDS

```javascript
const pool = mysql.createPool({
    host: 'rm-xxxxx.mysql.rds.aliyuncs.com',
    user: 'drms_user',
    password: process.env.DB_PASSWORD,
    database: 'drms',
    port: 3306
});
```

## 回滚到 SQLite

如果遇到问题，可以随时切换回 SQLite：

```bash
# 设置环境变量
DB_TYPE=sqlite npm run dev

# 或删除 .env 文件中的 DB_TYPE 配置
```

## 常见问题

### Q: 需要修改前端代码吗？
A: 不需要！前端通过 API 和 WebSocket 通信，数据库切换对前端透明。

### Q: 性能会提升多少？
A: 对于小规模应用（<1000 用户），差异不大。大规模应用（>10000 用户），MySQL 并发性能更好。

### Q: 可以同时支持两种数据库吗？
A: 可以！通过环境变量 `DB_TYPE` 切换，代码无需修改。
