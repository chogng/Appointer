# 设备预约系统后端

基于 Node.js + Express 的后端 API 服务，数据库默认使用 **MySQL**（也可通过 `DB_TYPE=sqlite` 切回 SQLite；本地开发推荐 SQLite，零依赖）。

建议先阅读：
- [`../README.md`](../README.md)：整体架构/运行模式/前后端启动与部署提示
- [`../docs/README.md`](../docs/README.md)：Specs/Runbooks 索引（含 OriginBridge 联调手册）

## 快速开始

### 0. 配置环境变量（必做）

复制 [`.env.example`](./.env.example) 为 `.env`，并根据你的数据库选择修改：

- SQLite（推荐本地开发，零依赖）：
  - `DB_TYPE=sqlite`
  - `DB_PATH=drms.db`（默认即可；文件路径为 `server/drms.db`）
  - 重置：删除 `drms.db`
- MySQL（推荐生产）：
  - `DB_TYPE=mysql`
  - 配置 `DB_HOST/DB_USER/DB_PASSWORD/DB_NAME`
  - Docker 快速 MySQL：见 [`DOCKER_MYSQL.md`](./DOCKER_MYSQL.md)

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 启动服务器

```bash
npm run dev
```

服务器将运行在 `http://localhost:3001`。

### 3. （可选）初始化/验证数据库连接

```bash
npm run init-db
```

该命令会执行一次 `db.init()`（建表/迁移；SQLite 首次创建时会按 `DB_SEED_DATA` 播种示例数据）。  
注意：它**不会清空已有数据**；如需重置请按上面 SQLite/MySQL 的方式处理。

## API 接口

说明：以下为常用接口（非完整列表）；完整路由以 [`server.js`](./server.js) 中的 `/api/*` 定义为准。

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
- `devices` - 设备表（开放规则/时间段）
- `reservations` - 预约表
- `inventory` - 库存条目
- `requests` - 申请/审批流（入库变更等）
- `logs` - 操作日志
- `blocklist` - 黑名单（用户×设备）
- `system_settings` - 系统配置（含保留策略）
- `device_analysis_templates` - Device Analysis 模板
- `device_analysis_settings` - Device Analysis 用户设置（含 SS Fit 参数）
- `literature_research_settings` - Literature Research 用户设置

## 测试账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | 123 | SUPER_ADMIN |
| manager | 123 | ADMIN |
| user | 123 | USER |

## 生产部署

1. 设置环境变量 `CORS_ORIGIN`（或 `CLIENT_ORIGIN`，支持逗号分隔多个 origin）
2. 设置环境变量 `PORT`（默认 3001）与数据库连接配置（MySQL：`DB_HOST/DB_USER/DB_PASSWORD/DB_NAME`；或 SQLite：`DB_TYPE=sqlite` + `DB_PATH`）
3. 生产环境务必设置强随机 `JWT_SECRET`，并建议启用 HTTPS（`NODE_ENV=production` 时 Cookie 会启用 `secure: true`）
4. 选择部署方式：PM2 / Docker / systemd 等

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
