# 设备预约系统后端

基于 Node.js + Express + SQLite 的后端 API 服务。

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

这会创建 `drms.db` 数据库文件，并插入初始数据：
- 3 个测试用户（admin/manager/user，密码都是 123）
- 2 个测试设备

### 3. 启动服务器

```bash
npm run dev
```

服务器将运行在 `http://localhost:3001`

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

1. 修改 CORS 配置（server.js 中的 cors()）
2. 使用环境变量配置端口和数据库路径
3. 添加身份验证中间件（JWT）
4. 使用 PM2 或 Docker 部署
