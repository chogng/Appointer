# 设备预约系统后端

基于 Node.js + Express 的后端 API 服务，数据库默认使用 **MySQL**（也可通过 `DB_TYPE=sqlite` 切回 SQLite）。

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

这会根据 `server/.env` 中的数据库配置初始化数据表（MySQL 会自动建表；SQLite 会创建/加载 `drms.db`）。

### 3. 启动服务器

```bash
npm run dev
```

服务器将运行在 `http://localhost:3001`

> 可选：复制 `server/.env.example` 为 `server/.env`，配置 `PORT` / `CORS_ORIGIN` / `DB_PATH`（会自动加载）。
> 如需使用 MySQL，请在 `server/.env` 中配置 `DB_TYPE=mysql` 与 `DB_HOST/DB_USER/DB_PASSWORD/DB_NAME` 等参数。

## API 接口

### 用户相关

- `POST /api/auth/login` - 登录
- `GET /api/users` - 获取所有用户
- `POST /api/users` - 创建用户
- `PATCH /api/users/:id` - 更新用户

### 设备相关

- `GET /api/devices` - 获取所有设备
- `GET /api/devices/:id` - 获取单个设备
- `POST /api/devices` - 创建设备
- `PATCH /api/devices/:id` - 更新设备（包括启用/停用）

### 预约相关

- `GET /api/reservations` - 获取所有预约
- `POST /api/reservations` - 创建预约

### 日志相关

- `GET /api/logs` - 获取操作日志

## 数据库结构

- `users` - 用户表
- `devices` - 设备表
- `reservations` - 预约表
- `logs` - 操作日志表

## 测试账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | 123 | SUPER_ADMIN |
| manager | 123 | ADMIN |
| user | 123 | USER |

## 生产部署

1. 设置环境变量 `CORS_ORIGIN`（或 `CLIENT_ORIGIN`，支持逗号分隔多个 origin）
2. 设置环境变量 `PORT`（默认 3001）与数据库连接配置（MySQL：`DB_HOST/DB_USER/DB_PASSWORD/DB_NAME`；或 SQLite：`DB_TYPE=sqlite` + `DB_PATH`）
3. 添加身份验证中间件（JWT）
4. 使用 PM2 或 Docker 部署

## SQLite → MySQL 迁移

如果你已经有 SQLite 数据文件（默认 `server/drms.db`），可以用脚本把数据导入到 MySQL：

```bash
cd server

# 如 MySQL 中已存在数据，确认要覆盖时使用 --force
npm run migrate-sqlite-to-mysql -- --force

# 指定 SQLite 文件路径
npm run migrate-sqlite-to-mysql -- --sqlite ./drms.db
```

> 提示：生产环境建议设置 `NODE_ENV=production` 或 `DB_SEED_DATA=0`，以禁用示例数据的自动播种。

## 生产环境模拟（前后端一体）

目标：前端页面与 `/api`、`/socket.io` 同源（更接近生产环境），避免本地跨域/Cookie 问题。

```bash
# 项目根目录：构建前端到 dist/
npm run build

# 启动后端（会托管 ../dist）
cd server
npm run start
```

确保 `server/.env` 中设置了 `SERVE_CLIENT=1`（可参考 `server/.env.docker.example`）。
浏览器访问：`http://localhost:3001`。

开发模式仍然可以 `npm run dev`（前端）+ `npm run server`（后端）；Vite 已配置把 `/api`、`/socket.io` 代理到 3001，所以前端依然用相对路径 `/api`。
