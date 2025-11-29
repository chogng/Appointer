# 设备预约系统 - 技术架构文档

## 📐 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层 (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  设备列表    │  │  预约日历    │  │  用户管理    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│         ┌──────────────────┴──────────────────┐              │
│         │                                     │              │
│    HTTP API (CRUD)              WebSocket (实时同步)         │
│         │                                     │              │
└─────────┼─────────────────────────────────────┼─────────────┘
          │                                     │
          ▼                                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    后端层 (Node.js)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Express + Socket.io                     │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │  │ REST API   │  │ WebSocket  │  │  广播系统  │    │   │
│  │  └────────────┘  └────────────┘  └────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            数据库抽象层 (db-adapter.js)              │   │
│  │         支持 SQLite ↔ MySQL 无缝切换                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据持久层                              │
│  ┌──────────────┐              ┌──────────────┐            │
│  │   SQLite     │  ◄────────►  │    MySQL     │            │
│  │  (开发环境)  │   可迁移      │  (生产环境)  │            │
│  └──────────────┘              └──────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 技术栈

### 前端
- **框架**：React 19.2.0
- **路由**：React Router 7.9.6
- **样式**：Tailwind CSS 3.4.17
- **实时通信**：Socket.io-client 4.7.2
- **日期处理**：date-fns 4.1.0
- **图标**：Lucide React 0.554.0
- **构建工具**：Vite 7.2.4

### 后端
- **运行时**：Node.js (ES Modules)
- **框架**：Express 4.18.2
- **实时通信**：Socket.io 4.7.2
- **数据库**：sql.js 1.10.3 (SQLite)
- **跨域**：CORS 2.8.5

### 数据库
- **开发环境**：SQLite (sql.js)
- **生产环境**：MySQL (可选，通过适配器切换)

## 📊 数据模型

### Users (用户表)
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,           -- 用户 ID
    username TEXT UNIQUE NOT NULL, -- 用户名
    password TEXT NOT NULL,        -- 密码（生产环境需加密）
    role TEXT NOT NULL,            -- 角色：USER/ADMIN/SUPER_ADMIN
    status TEXT NOT NULL,          -- 状态：ACTIVE/PENDING/DISABLED
    name TEXT NOT NULL,            -- 姓名
    email TEXT NOT NULL,           -- 邮箱
    expiryDate TEXT                -- 账号过期日期
);
```

### Devices (设备表)
```sql
CREATE TABLE devices (
    id TEXT PRIMARY KEY,           -- 设备 ID
    name TEXT NOT NULL,            -- 设备名称
    description TEXT NOT NULL,     -- 设备描述
    isEnabled INTEGER NOT NULL,    -- 是否启用：1/0
    openDays TEXT NOT NULL,        -- 开放日期（JSON 数组）
    timeSlots TEXT NOT NULL        -- 时间段（JSON 数组）
);
```

### Reservations (预约表)
```sql
CREATE TABLE reservations (
    id TEXT PRIMARY KEY,           -- 预约 ID
    userId TEXT NOT NULL,          -- 用户 ID
    deviceId TEXT NOT NULL,        -- 设备 ID
    date TEXT NOT NULL,            -- 预约日期
    timeSlot TEXT NOT NULL,        -- 时间段
    status TEXT NOT NULL,          -- 状态：CONFIRMED/CANCELLED
    createdAt TEXT NOT NULL        -- 创建时间
);
```

### Logs (日志表)
```sql
CREATE TABLE logs (
    id TEXT PRIMARY KEY,           -- 日志 ID
    userId TEXT NOT NULL,          -- 用户 ID
    action TEXT NOT NULL,          -- 操作类型
    details TEXT,                  -- 详细信息
    timestamp TEXT NOT NULL        -- 时间戳
);
```

## 🔄 实时同步机制

### WebSocket 事件

#### 服务器 → 客户端（广播）

| 事件名 | 触发时机 | 数据格式 |
|--------|---------|---------|
| `device:created` | 创建设备 | `{ id, name, description, ... }` |
| `device:updated` | 更新设备（启用/停用） | `{ id, isEnabled, ... }` |
| `reservation:created` | 创建预约 | `{ id, userId, deviceId, date, timeSlot, ... }` |
| `reservation:updated` | 更新预约（取消等） | `{ id, status, ... }` |
| `reservation:deleted` | 删除预约 | `{ id }` |
| `user:created` | 创建用户 | `{ id, username, role, ... }` |
| `user:updated` | 更新用户（审核等） | `{ id, status, ... }` |

#### 客户端 → 服务器

当前版本使用 HTTP API 进行数据修改，服务器自动广播。  
未来可扩展客户端主动发送事件。

### 同步流程

```
用户 A (管理员)                服务器                    用户 B (普通用户)
     │                          │                            │
     │  PATCH /api/devices/1    │                            │
     ├─────────────────────────►│                            │
     │  { isEnabled: false }    │                            │
     │                          │                            │
     │  ◄─────────────────────  │                            │
     │  200 OK                  │                            │
     │                          │                            │
     │                          │  broadcast('device:updated')│
     │                          ├───────────────────────────►│
     │                          │  { id: 1, isEnabled: false }│
     │                          │                            │
     │  ◄───────────────────────┤                            │
     │  device:updated          │                            │
     │                          │                            │
     ▼                          ▼                            ▼
  UI 自动更新              数据库已保存                  UI 自动更新
```

## 🎯 核心功能

### 1. 设备管理
- ✅ 创建/编辑设备
- ✅ 启用/停用设备（实时同步）
- ✅ 设备列表展示
- ✅ 权限控制（管理员可操作）

### 2. 预约系统
- ✅ 日历视图（周视图）
- ✅ 时间段选择
- ✅ 冲突检测
- ✅ 实时同步（多人协作）
- ✅ 预约状态管理

### 3. 用户管理
- ✅ 用户注册/登录
- ✅ 角色权限（USER/ADMIN/SUPER_ADMIN）
- ✅ 账号审核
- ✅ 账号过期管理

### 4. 实时通信
- ✅ WebSocket 连接管理
- ✅ 自动重连机制
- ✅ 事件广播系统
- ✅ 客户端订阅/取消订阅

## 🔐 权限系统

### 角色定义

| 角色 | 权限 |
|------|------|
| **USER** | 查看设备、创建预约、查看自己的预约 |
| **ADMIN** | USER 权限 + 管理设备、查看所有预约 |
| **SUPER_ADMIN** | ADMIN 权限 + 用户管理、系统配置 |

### 权限检查

```javascript
// 前端权限检查
const { isAdmin, isSuperAdmin, isUser } = usePermission();

// 后端权限检查（未来实现）
function requireAdmin(req, res, next) {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
}
```

## 🚀 部署架构

### 开发环境
```
localhost:5173 (前端 Vite)
localhost:3001 (后端 Express + SQLite)
```

### 生产环境（推荐）

#### 方案 1：单服务器部署
```
Nginx (反向代理)
  ├─ /          → 前端静态文件
  ├─ /api       → 后端 API
  └─ /socket.io → WebSocket
```

#### 方案 2：分离部署
```
Vercel/Netlify (前端)
  ↓ HTTPS
Railway/Render (后端 + MySQL)
  ↓ WebSocket
```

#### 方案 3：Docker 容器化
```
Docker Compose
  ├─ frontend (Nginx + React build)
  ├─ backend (Node.js + Express)
  └─ database (MySQL)
```

## 📈 性能优化

### 已实现
- ✅ WebSocket 连接复用
- ✅ 数据库抽象层（易于切换）
- ✅ 前端状态管理（减少请求）

### 待优化
- ⏳ Redis 缓存热点数据
- ⏳ 数据库索引优化
- ⏳ CDN 加速静态资源
- ⏳ 服务端渲染（SSR）
- ⏳ 懒加载和代码分割

## 🔧 扩展性

### 数据库迁移
通过 `db-adapter.js` 抽象层，可无缝切换：
- SQLite → MySQL
- SQLite → PostgreSQL
- SQLite → MongoDB（需重写适配器）

### 功能扩展
- 📧 邮件通知（预约确认/取消）
- 💬 实时聊天（基于现有 WebSocket）
- 📊 数据统计（设备使用率、用户活跃度）
- 🔔 推送通知（浏览器通知 API）
- 📱 移动端适配（响应式设计）

## 🐛 已知限制

1. **身份验证**：当前使用简单的用户名/密码，生产环境需使用 JWT
2. **密码加密**：密码明文存储，需使用 bcrypt 加密
3. **并发控制**：SQLite 写入并发有限，大规模应用需迁移 MySQL
4. **文件上传**：暂不支持设备图片上传
5. **国际化**：界面混合中英文，需统一或支持多语言

## 📚 相关文档

- [快速开始](./SETUP.md) - 本地开发环境搭建
- [MySQL 迁移](./server/MYSQL_MIGRATION.md) - 数据库迁移指南
- [实时同步测试](./TEST_REALTIME.md) - WebSocket 功能测试
- [API 文档](./server/README.md) - 后端 API 接口说明

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程
1. Fork 项目
2. 创建功能分支：`git checkout -b feature/xxx`
3. 提交代码：`git commit -m 'Add xxx'`
4. 推送分支：`git push origin feature/xxx`
5. 提交 Pull Request

---

**版本**：1.0.0  
**最后更新**：2025-11-28  
**作者**：设备预约系统开发团队
