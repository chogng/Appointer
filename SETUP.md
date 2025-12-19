# 设备预约系统 - 完整部署指南

## 项目架构

```
前端 (React + Vite)
     localhost:5173
          ↓ HTTP API (登录/CRUD)
          ↓ WebSocket (实时同步)
后端 (Node.js + Express + Socket.io)
     localhost:3001
          ↓ 数据库抽象层
数据库 (SQLite → 可迁移到 MySQL)
     drms.db
```

## 核心特性

✅ **实时同步**：使用 WebSocket，用户 A 预约后，用户 B 立即看到  
✅ **数据持久化**：SQLite 数据库，重启不丢失  
✅ **易于迁移**：数据库抽象层，可无缝切换到 MySQL  
✅ **多用户协作**：团队成员实时查看设备状态和预约情况

## 本地开发环境搭建

### 第一步：安装依赖

**安装前端依赖**：
```bash
npm install
```

**安装后端依赖**：
```bash
cd server
npm install
cd ..
```

这会安装：
- 前端：React, Socket.io-client, Tailwind CSS 等
- 后端：Express, Socket.io, sql.js 等

**可选：配置环境变量**（不改也可直接用默认 localhost）
- 前端：复制 `.env.example` 为 `.env`（`VITE_API_BASE_URL` / `VITE_WS_URL`）
- 后端：复制 `server/.env.example` 为 `server/.env`（`PORT` / `CORS_ORIGIN` / `DB_PATH`）

### 第二步：启动后端服务器

**打开第一个终端**，运行：

```bash
npm run server
```

你会看到：
```
🚀 服务器运行在 http://localhost:3001
```

### 第三步：启动前端开发服务器

**打开第二个终端**，运行：

```bash
npm run dev
```

你会看到：
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

### 第四步：访问应用

打开浏览器访问 `http://localhost:5173`

## 测试账号

| 用户名 | 密码 | 角色 | 功能 |
|--------|------|------|------|
| admin | 123 | 超级管理员 | 所有权限 + 用户管理 |
| manager | 123 | 管理员 | 设备管理 + 预约管理 |
| user | 123 | 普通用户 | 查看设备 + 预约 |

## 功能测试

### 测试实时同步功能

#### 测试 1：设备状态实时同步

1. **打开两个浏览器窗口**（或使用隐私模式）
2. **窗口 A**：使用 `admin` 登录，进入设备列表
3. **窗口 B**：使用 `user` 登录，进入设备列表
4. **在窗口 A** 中点击设备开关，切换状态
5. **在窗口 B** 中**无需刷新**，自动看到状态变化（可用 ↔ 维护中）

#### 测试 2：预约实时同步

1. **打开两个浏览器窗口**
2. **窗口 A**：使用 `user` 登录，进入某个设备的预约页面
3. **窗口 B**：使用 `manager` 登录，进入同一设备的预约页面
4. **在窗口 A** 中预约某个时间段
5. **在窗口 B** 中**无需刷新**，立即看到该时间段被占用

#### 测试 3：WebSocket 连接状态

打开浏览器控制台（F12），查看日志：
```
✅ WebSocket 已连接
📡 收到设备更新: {...}
📡 收到新预约（实时）: {...}
```

## 数据持久化

- 所有数据存储在 `server/drms.db` 文件中
- 重启服务器后数据不会丢失
- 如需重置数据，删除 `drms.db` 后重新运行 `npm run server:init`

## 生产环境部署

### 方案 1：传统服务器部署

1. **构建前端**：
```bash
npm run build
```

2. **配置后端提供静态文件**：
在 `server/server.js` 中添加：
```javascript
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '../dist')));
```

3. **使用 PM2 启动**：
```bash
npm install -g pm2
cd server
pm2 start server.js --name drms-server
```

### 方案 2：Docker 部署

创建 `Dockerfile`：
```dockerfile
FROM node:18-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm install
RUN cd server && npm install

# 复制代码
COPY . .

# 构建前端
RUN npm run build

# 初始化数据库
RUN cd server && npm run init-db

# 暴露端口
EXPOSE 3001

# 启动服务
CMD ["node", "server/server.js"]
```

### 方案 3：云平台部署

**Vercel（前端）+ Railway（后端）**：
- 前端部署到 Vercel
- 后端部署到 Railway/Render
- 配置前端环境变量 `VITE_API_BASE_URL`（REST API）和 `VITE_WS_URL`（WebSocket）指向你的后端地址

## 常见问题

### Q: 前端无法连接后端？
A: 确保后端服务器在运行（localhost:3001），检查浏览器控制台的 CORS 错误。

### Q: 数据库文件在哪里？
A: 默认是 `server/drms.db`（可用服务端环境变量 `DB_PATH` 修改），可以使用 DB Browser for SQLite 查看。

### Q: 如何添加新的 API 接口？
A: 在 `server/server.js` 中添加路由，在 `src/services/apiService.js` 中添加对应方法。

### Q: 如何修改端口？
A: 
- 后端：设置环境变量 `PORT`（默认 3001）
- 前端：修改 `vite.config.js` 中的 `server.port`（默认 5173）

## 迁移到 MySQL

当你的应用需要更高的并发性能或部署到生产环境时，可以迁移到 MySQL：

```bash
# 查看详细迁移指南
cat server/MYSQL_MIGRATION.md
```

迁移步骤：
1. 安装 MySQL 驱动：`npm install mysql2`
2. 配置环境变量：`DB_TYPE=mysql`
3. 无需修改任何业务代码！

## 下一步优化建议

1. ✅ **实时同步**：已完成（WebSocket）
2. ✅ **数据持久化**：已完成（SQLite）
3. ✅ **数据库抽象**：已完成（可迁移 MySQL）
4. **添加 JWT 身份验证**：替换当前的简单登录
5. **添加请求日志**：使用 morgan 中间件
6. **添加数据验证**：使用 joi 或 zod
7. **添加单元测试**：使用 vitest
8. **添加 API 文档**：使用 Swagger
9. **优化错误处理**：统一错误响应格式
10. **添加 Redis 缓存**：提升查询性能
