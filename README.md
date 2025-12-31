# Appointer（设备预约系统 / DRMS）

Appointer 是一个面向团队/实验室的设备预约与协作管理系统：支持设备开放规则配置、周视图日历预约、用户与权限管理、库存入库单（支持“申请-审批”）、操作日志与数据保留策略，并通过 Socket.IO 实现多端实时同步。

## 功能概览

### 预约与设备
- 设备管理：创建/编辑/删除、启用/停用、开放日期（周几）与开放时间配置
- 预约系统：周视图日历、冲突检测、取消/删除、标题/描述/颜色标注
- 黑名单（Blocklist）：管理员可限制某用户对某设备的预约权限

### 协作与治理
- 用户体系：注册/登录、账号审核（PENDING → ACTIVE）、到期时间、角色权限（USER / ADMIN / SUPER_ADMIN）
- 入库单（Inventory）：管理员可直接维护；普通用户提交变更/新增申请，管理员审核通过/拒绝
- 消息中心：展示已处理（APPROVED/REJECTED）的申请记录
- 操作日志：支持搜索与管理员清空
- 数据保留策略：SUPER_ADMIN 可配置日志/已处理申请保留天数，并可手动执行清理

### 统计与工具
- 排行榜：按预约总时长（timeSlot）统计用户排名（ADMIN/SUPER_ADMIN）
- Device Analysis：CSV 导入 → 选择真实 X 范围（可用 points 分组）→ 勾选 Y 列 → 图表/表格预览 → 导出（JSON）

## 技术栈

- 前端：React 19、React Router、Tailwind CSS、Vite、socket.io-client、date-fns、recharts、papaparse
- 后端：Node.js（ES Modules）、Express、Socket.IO
- 数据库：SQLite 文件（运行时 sql.js 内存加载 + 导出持久化到 `server/drms.db`）
- 认证：JWT（HttpOnly Cookie `token`；前端 `fetch` 默认 `credentials: include`；后端也支持 `Authorization: Bearer <token>` 便于脚本/调试）

## 运行环境

- Node.js >= 18（建议 20+）
- npm >= 9

## 快速开始（本地开发）

### 1）安装依赖

```bash
npm install
cd server
npm install
cd ..
```

### 2）初始化/重置数据库（可选）

- 一键初始化：`npm run server:init`
- 或删除 `server/drms.db` 后直接启动后端（后端会自动建表并插入初始数据）

### 3）启动后端

```bash
npm run server
```

默认：`http://localhost:3001`

### 4）启动前端

```bash
npm run dev
```

默认：`http://localhost:5173`

## 开发命令

前端（根目录）：

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

后端：

```bash
npm run server         # 等价于：cd server && npm run dev（watch 模式）
npm run server:init    # 安装后端依赖 + 初始化/重置数据库
cd server && npm run start
cd server && npm run init-db
```

## 默认账号

| 用户名 | 密码 | 角色 |
| --- | --- | --- |
| admin | 123 | SUPER_ADMIN |
| manager | 123 | ADMIN |
| user | 123 | USER |

说明：
- 初始账号密码为明文（用于开发/演示）；新注册用户密码会使用 bcrypt 哈希（登录同时兼容旧明文密码）。
- 可运行 `node server/migrate-passwords.js` 将旧密码批量迁移为 bcrypt 哈希，并用 `node server/verify-security.js` 校验。

## 环境变量

### 前端（`.env`）

复制 `.env.example` 为 `.env`：

- `VITE_API_BASE_URL`（默认 `http://localhost:3001/api`）
- `VITE_WS_URL`（默认 `http://localhost:3001`）

### 后端（`server/.env`）

复制 `server/.env.example` 为 `server/.env`：

- `PORT`（默认 `3001`）
- `CORS_ORIGIN`（默认 `http://localhost:5173`；支持逗号分隔多个 origin）
- `DB_PATH`（默认 `drms.db`，相对 `server/`）
- `JWT_SECRET`（建议生产环境务必覆盖；默认值仅用于开发）
- `NODE_ENV=production` 时 Cookie 将启用 `secure: true`（需要 HTTPS）

## 项目结构

```text
.
├─ public/                   # 静态资源
├─ src/                      # 前端源码
│  ├─ assets/                # 图片/图标等
│  ├─ components/            # 业务组件（WeeklyCalendar/BookingPopover/...）
│  │  ├─ ui/                 # 通用 UI 组件（Button/Card/Toast/...）
│  │  └─ DeviceAnalysis/     # CSV 分析工具组件
│  ├─ context/               # Auth/Theme/Language Provider
│  ├─ hooks/                 # useRealtimeSync / usePermission
│  ├─ layouts/               # MainLayout/AuthLayout
│  ├─ pages/                 # 页面路由（Dashboard/Devices/Inventory/...）
│  ├─ services/              # apiService / socketService
│  ├─ styles/                # 全局样式
│  └─ utils/                 # 工具方法
└─ server/                   # 后端源码
   ├─ server.js              # Express + Socket.IO + REST API
   ├─ database.js            # sql.js(SQLite) 初始化 + schema 迁移 + 文件持久化
   ├─ db-adapter.js          # 数据库抽象层（当前固定 sqlite；MySQL 需补实现）
   ├─ retention.js           # 日志/已处理申请保留策略
   ├─ init-db.js             # 初始化/重置数据库脚本（better-sqlite3）
   ├─ test-api.js            # 手动测试 API
   ├─ migrate-passwords.js   # 明文密码迁移为 bcrypt
   ├─ verify-*.js            # 校验脚本（realtime/inventory/security）
   └─ src/                   # 认证/中间件（JWT Cookie）
      ├─ config/             # env/db 统一出口（env.js/db.js）
      ├─ controllers/        # authController.js
      ├─ middleware/         # authMiddleware.js / rateLimiter.js
      └─ routes/             # authRoutes.js
```

## 前端页面路由

- `/dashboard`：仪表盘（日志、待审核用户、待处理申请）
- `/devices`：设备列表（管理员可管理设备开关/配置）
- `/devices/:id`：预约日历（周视图 + 实时同步）
- `/reservations`：我的预约（管理员可切换查看其他用户）
- `/inventory`：入库单（普通用户走申请流；管理员直接改）
- `/messages`：消息中心（已处理申请）
- `/users`：用户管理（ADMIN/SUPER_ADMIN）
- `/leaderboard`：排行榜（ADMIN/SUPER_ADMIN）
- `/device-analysis`：CSV 分析工具
- `/settings`：设置（主题/语言；SUPER_ADMIN 可配置数据保留策略）

## Device Analysis（CSV）使用说明

Template 会以**第一个导入的 CSV**作为预览基准，但会对**所有已导入 CSV**应用同一套提取规则。

### 1）设置真实 X（必填）

- 在「X Data」里填写或选择 `Start Cell` / `End Cell`（例如 `A2` 到 `A1408`）。
- 可在输入框获得焦点后，直接在右侧预览表格点击单元格自动填充（`A1` 风格引用）。
- 约束：`Start/End` 必须在**同一列**（同一个真实 X 列）。

### 2）points 分组（可选）

`Points` 表示“每条曲线包含的点数”（按 X 范围顺序切分）：

- 留空：整个 X 范围就是 1 组（1 条曲线）。
- 填整数：将 X 范围按 `Points` 切成多组，每组对应同一张图中的一条曲线。
  - 示例：`A2-A1408` 共 `1407` 点，`Points=201` ⇒ `1407/201=7` 组 ⇒ 同一张图里 `7` 条 line（每个 Y 列都会生成 7 条）。
- 强校验：若 `X 点数 % Points !== 0`，会 toast 警告并**停止提取**（不生成结果）。

### 3）选择 Y 列（必填）

- 在预览表格的列标题（A/B/C…）点击勾选需要的 Y 列。
- 约束：Y 列不能包含 X 列。

### 4）应用与导出

- 点击 `Apply to All Files`：对所有已导入 CSV 执行提取；任意文件遇到空值/非数字会 toast 报错并**停止**。
- `Charts`：使用真实 X 绘制多条线（支持同一张图多条 line）。
- `Data Table`：按文件 + series 查看点数据。
- `Export Data`：导出 `device_analysis_export.json`。

## API 概览（后端：`/api`）

标记说明：
- `[auth]`：需要登录（`token` Cookie 或 `Authorization: Bearer <token>`）
- `[admin]`：需要 ADMIN/SUPER_ADMIN
- `[super_admin]`：需要 SUPER_ADMIN

### 认证

- `POST /api/auth/login`：登录（设置 `token` Cookie；有登录限流）
- `POST /api/auth/logout`：退出（清除 Cookie）
- `GET /api/auth/me` [auth]：获取当前用户

### 用户

- `GET /api/users` [auth] [admin]：获取用户列表
- `POST /api/users`：用户注册（默认 `role=USER`，`status=PENDING`，密码 bcrypt 哈希）
- `POST /api/admin/users` [auth] [admin]：管理员创建用户（ADMIN 只能创建 USER；SUPER_ADMIN 可创建 ADMIN/USER）
- `PATCH /api/users/:id` [auth]：更新用户
  - 本人：可更新 `name/email/username`
  - ADMIN：仅可更新 USER 的 `status/expiryDate`（以及 `name/email/username`）
  - SUPER_ADMIN：可额外更新 `role`
- `DELETE /api/users/:id` [auth] [admin]：删除用户（不可删自己；ADMIN 只能删除 USER）

### 黑名单（Blocklist）

- `GET /api/users/:id/blocklist` [auth]：查看用户黑名单（管理员或本人）
- `POST /api/users/:id/blocklist` [auth] [admin]：拉黑用户对某设备的预约（管理员）
- `DELETE /api/users/:id/blocklist/:deviceId` [auth] [admin]：解除拉黑（管理员）

### 设备

- `GET /api/devices`：设备列表
- `GET /api/devices/:id`：设备详情
- `POST /api/devices` [auth] [admin]：创建设备
- `PATCH /api/devices/:id` [auth] [admin]：更新设备（启用/停用、开放规则等）
- `DELETE /api/devices/:id` [auth] [admin]：删除设备

### 预约

- `GET /api/reservations` [auth]：预约列表（当前实现返回全部预约，用于日历占用展示）
- `POST /api/reservations` [auth]：创建预约（含冲突检测 + 黑名单检查）
- `PATCH /api/reservations/:id` [auth]：更新预约（本人或管理员）
- `DELETE /api/reservations/:id` [auth]：删除预约（本人或管理员）

### 入库单（Inventory）

- `GET /api/inventory?search=` [auth]：查询入库单（支持模糊搜索）
- `POST /api/inventory` [auth] [admin]：新增入库单
- `PATCH /api/inventory/:id` [auth] [admin]：更新入库单
- `DELETE /api/inventory/:id` [auth] [admin]：删除入库单

### 申请（Requests）

- `GET /api/requests?status=&limit=&offset=` [auth]：查询申请（普通用户仅可见自己的；管理员可见全部）
- `POST /api/requests` [auth]：提交申请（如 `INVENTORY_ADD` / `INVENTORY_UPDATE`）
- `POST /api/requests/:id/approve` [auth] [admin]：审核通过（管理员）
- `POST /api/requests/:id/reject` [auth] [admin]：审核拒绝（管理员）
- `DELETE /api/requests/:id` [auth]：删除/撤回申请（管理员可删任意；普通用户仅可撤回 PENDING）

### 日志 & 保留策略

- `GET /api/logs?search=&limit=` [auth]：查询日志（普通用户仅可见自己的）
- `DELETE /api/logs` [auth] [admin]：清空日志（管理员）
- `GET /api/admin/retention` [auth] [super_admin]：查询保留策略（SUPER_ADMIN）
- `PATCH /api/admin/retention` [auth] [super_admin]：更新保留策略（SUPER_ADMIN）
- `POST /api/admin/retention/run` [auth] [super_admin]：立即执行清理（SUPER_ADMIN）

### 统计

- `GET /api/admin/leaderboard` [auth] [admin]：排行榜（ADMIN/SUPER_ADMIN）

## WebSocket 事件（服务端广播 → 客户端）

- 设备：`device:created` / `device:updated` / `device:deleted`
- 预约：`reservation:created` / `reservation:updated` / `reservation:deleted`
- 用户：`user:created` / `user:updated` / `user:deleted`
- 申请：`request:created` / `request:approved` / `request:rejected` / `request:deleted`

## 数据模型（SQLite）

运行时 schema 由 `server/database.js` 维护（自动建表 + 迁移 + 索引）。

- `users`：`id` `username` `password` `role` `status` `name` `email` `expiryDate`
- `devices`：`id` `name` `description` `isEnabled` `openDays(JSON)` `timeSlots(JSON)` `granularity` `openTime(JSON)`
- `reservations`：`id` `userId` `deviceId` `date(YYYY-MM-DD)` `timeSlot(HH:MM-HH:MM)` `status` `createdAt` `title` `description` `color`
- `inventory`：`id` `name` `category` `quantity` `date` `requesterName` `requesterId`
- `requests`：`id` `requesterId` `requesterName` `type` `targetId` `originalData(JSON)` `newData(JSON)` `status` `createdAt`
- `logs`：`id` `userId` `action` `details` `timestamp`
- `blocklist`：`id` `userId` `deviceId` `reason` `createdAt`
- `system_settings`：`key` `value` `updatedAt`

关键索引：
- 防止重复预约：`reservations(deviceId, date, timeSlot)`（仅对未取消状态生效）
- 防止重复拉黑：`blocklist(userId, deviceId)`

## 常用脚本

- 初始化/重置 DB：`npm run server:init`
- 迁移旧密码为 bcrypt：`node server/migrate-passwords.js`
- 校验密码哈希：`node server/verify-security.js`
- 查看用户数据：`node server/view-users.js`
- 校验实时广播（需先启动后端）：`node server/verify-realtime.js`
- 检查入库数据：`node server/verify-inventory.js`

## 部署提示（简版）

### 单机部署（同域名）

- 前端：`npm run build` 生成 `dist/`，用 Nginx/静态服务托管
- 后端：`cd server && npm run start`（或使用 PM2）
- Nginx 需反代 `/api` 与 `/socket.io`，并开启 WebSocket Upgrade

示例（仅示意）：

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:3001;
}

location /socket.io/ {
  proxy_pass http://127.0.0.1:3001/socket.io/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

### 前后端分离部署（跨域 Cookie）

当前后端登录依赖 HttpOnly Cookie，若前端与后端跨“站点”部署（不同 site 域名），需要：
- 修改 `server/src/controllers/authController.js` 中 Cookie `sameSite: "lax"` 为 `sameSite: "none"`，并确保 `secure: true`（必须 HTTPS）
- 后端 CORS 允许对应 origin，并开启 `credentials: true`
- 前端请求保持 `credentials: include`（项目已默认开启）

## 常见问题

- 登录后接口仍 401：检查浏览器是否带上 `token` Cookie（跨站点部署需按上方“跨域 Cookie”处理）。
- CORS 报错：设置 `server/.env` 的 `CORS_ORIGIN`（可逗号分隔），并重启后端。
- 注册后无法登录：新用户默认 `status=PENDING`，需要管理员在 `/dashboard` 审核通过后才能登录。
- 多次登录失败被限制：`POST /api/auth/login` 有限流（15 分钟内最多 5 次），等待窗口期后再试。

## 安全与已知限制

- 生产环境务必设置强随机 `JWT_SECRET`，并配合 HTTPS 部署（`NODE_ENV=production` 时 Cookie 才会启用 `secure: true`）。
- 跨站点部署目前需要手动调整 Cookie 的 `sameSite`（见上方“跨域 Cookie”）。
- MySQL 迁移：仓库内有迁移草案，但当前 `server/db-adapter.js` 默认固定使用 SQLite（sql.js）；如需 MySQL 需补全适配器实现与切换逻辑。
- 设置页“修改密码”目前仅前端交互，尚未对接后端接口。
