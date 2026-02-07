# Appointer 部署指南（学习版）

本项目结构（默认推荐）：
- 前端：Vite 构建产物在仓库根目录 `dist/`
- 后端：`server/`（Express），可在生产模式下托管 `../dist`，API 前缀为同域 `/api`，WebSocket 为同域 `/socket.io`

你大多数情况下只需要把后端跑起来并让它托管前端（“前后端一体”），然后：
- 要么用 Nginx/Caddy 做 HTTPS 反代（公网服务器常用）
- 要么用 Cloudflare Tunnel（内网穿透，不开公网端口，适合在公司/家里电脑上临时对外）

---

## 1) 本地“生产式”跑一遍（强烈建议先做）

目标：在本机用后端托管前端，跑出一个类似生产的同域站点：`http://localhost:3001`

### 1.1 前端构建

在仓库根目录：

```bash
npm ci
npm run build
```

构建成功后会生成 `dist/`。

### 1.2 后端配置与启动

```bash
cd server
npm ci
```

复制环境变量模板（Windows PowerShell）：

```powershell
Copy-Item .env.example .env
```

编辑 `server/.env`，最少要改/确认这些（学习用可以先用 SQLite）：

```ini
# 端口（示例：3001）
PORT=3001

# 让后端托管前端 dist（关键）
SERVE_CLIENT=1

# 学习用：SQLite（不依赖 MySQL）
DB_TYPE=sqlite
DB_PATH=drms.db

# ⚠️ 一定要改：JWT 密钥（生产必须是强随机）
JWT_SECRET=dev-secret-key-change-me

# 可选：只监听本机，避免局域网直接访问
HOST=127.0.0.1
```

初始化数据库（可选，但第一次建议执行一次）：

```bash
npm run init-db
```

启动后端：

```bash
npm run start
```

访问：`http://localhost:3001`

---

## 2) 方案 A（推荐）：一体部署到服务器（Nginx 反代 + HTTPS）

适用场景：你有一台公网服务器（或内网服务器），希望稳定提供服务。

### 2.1 服务器准备

建议：
- Linux（Ubuntu/Debian）+ Node.js 18/20
- 数据库：MySQL（生产推荐）或 SQLite（轻量/单机）

把代码放到服务器（git clone / scp 都行）。

### 2.2 构建与启动（最小步骤）

在仓库根目录：

```bash
npm ci
npm run build
cd server
npm ci
```

配置 `server/.env`（生产建议）：

```ini
NODE_ENV=production
PORT=3001
HOST=127.0.0.1
SERVE_CLIENT=1

# 生产务必强随机
JWT_SECRET=请替换为强随机

# 数据库（二选一）
# MySQL（推荐）
# DB_TYPE=mysql
# DB_HOST=...
# DB_PORT=3306
# DB_USER=...
# DB_PASSWORD=...
# DB_NAME=drms
# DB_SEED_DATA=0
#
# 或 SQLite（单机简化）
DB_TYPE=sqlite
DB_PATH=drms.db
DB_SEED_DATA=0

# 若前后端同域，通常不需要你手动管 CORS；
# 若你前端与 API 不同域，再设置 CORS_ORIGIN=https://your-frontend-domain
# CORS_ORIGIN=
```

初始化数据库（首次/迁移时）：

```bash
cd server
npm run init-db
```

启动后端：

```bash
cd server
npm run start
```

建议用 PM2 或 systemd 做守护（开机自启、崩溃拉起），这一步可等你跑通后再加。

### 2.3 Nginx 反代（含 WebSocket）

要点：
- 只把 80/443 暴露给公网
- 后端 `PORT` 只监听 `127.0.0.1:3001`
- WebSocket 要带 Upgrade 头

Nginx 片段示例（放到你的 server block 内）：

```nginx
location / {
  proxy_pass http://127.0.0.1:3001;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  # WebSocket
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

---

## 3) 方案 A（内网穿透）：Cloudflare Tunnel + Access（推荐给“发给别人用”）

适用场景：
- 你在公司/家里电脑上跑服务，不想开公网端口
- 想加“必须登录/白名单”防护再给别人访问

你要做的事其实只有两件：
1) 本机先跑起来 `http://localhost:3001`（见第 1 节）
2) 用 Cloudflare Tunnel 把域名转发到 `localhost:3001`，并用 Access 做权限

### 3.1 Cloudflare 前置条件

- 你的域名 DNS 托管在 Cloudflare
- 开通 Cloudflare Zero Trust（Access / Tunnels）

### 3.2 创建 Tunnel（命令行）

安装并登录 `cloudflared` 后：

```bash
cloudflared tunnel login
cloudflared tunnel create appointer
```

把一个域名（示例 `app.yourdomain.com`）指向这个 tunnel：

```bash
cloudflared tunnel route dns appointer app.yourdomain.com
```

### 3.3 配置转发到本机服务

创建配置文件 `config.yml`（路径按系统不同；你也可以直接用命令行参数跑）：

```yml
tunnel: <TUNNEL_ID>
credentials-file: <PATH_TO_JSON>

ingress:
  - hostname: app.yourdomain.com
    service: http://localhost:3001
  - service: http_status:404
```

启动：

```bash
cloudflared tunnel run appointer
```

### 3.4 Access（强烈建议立刻加）

在 Cloudflare Zero Trust 控制台：
- Access → Applications → Add application → Self-hosted
- Domain 选 `app.yourdomain.com`
- Policy：只允许你的邮箱/组织域（或指定人员邮箱）

这样别人打开 `https://app.yourdomain.com` 会先过 Access 验证，再进入你的系统。

#### 3.4.1 Access 是什么（你会看到什么）

- Access 在你的应用“前面”做一层门禁：不通过的人**到不了**你的站点（看不到你应用的登录页）。
- 按“邮箱”放行时，邮箱指的是 **Cloudflare 用来验证身份的账号**（会发验证码或走 SSO），不是你项目数据库里的用户邮箱。
- 通过一次后，Cloudflare 会在浏览器里写入 Access 会话 Cookie；在会话有效期内通常是“静默放行”，直接进入你的网站。
- 仅通过 Access 不会自动登录你的应用：默认仍是“两道门”（先 Access，再你应用自己的登录）。想变成“一道门”需要做应用内 SSO（改后端）。

#### 3.4.2 推荐策略（Access-only 起步）

- 小团队/没学校 SSO：先用 **One-time PIN（邮箱收码）**，并把 Session duration 设长一点（比如 7 天/30 天，按风险取舍）。
- 有学校/组织 SSO：用 **Google/Microsoft/SAML/OIDC** 接入，并按 `@school.edu` 域或组放行；体验更接近“静默”。
- Policy 建议：`Allow`（你的邮箱/域名） + `Deny`（All other users）。

---

## 4) 上线前检查清单（登录项目必看）

- `JWT_SECRET`：必须强随机；不要用默认值
- `DB_SEED_DATA=0`：生产不要自动播种示例数据
- `NODE_ENV=production`：生产建议开启
- HTTPS：建议通过 Nginx/Caddy 或 Cloudflare 提供（登录 Cookie 更稳）
- 监听地址：建议 `HOST=127.0.0.1`，只让反代/隧道来访问
- 账号策略：给外部/同事用时尽量创建专用测试账号，不要共享你自己的账号

---

## 5) 常见问题（排错）

### 5.1 刷新页面 404

一体部署时，后端需要托管 `dist/` 并做 SPA fallback：
- 确认 `SERVE_CLIENT=1`
- 确认根目录存在 `dist/`（先 `npm run build`）

### 5.2 能登录但刷新后像没登录（会话没保存）

优先检查：
- 你是不是走了 HTTPS（或反代是否正确传了 `X-Forwarded-Proto`）
- 浏览器是否拦截了 Cookie（跨域场景尤其容易出问题）

推荐做法：用“同域一体部署”或 Cloudflare Tunnel + Access。

### 5.3 WebSocket 不工作

如果你用了 Nginx/反代：
- 确认启用了 `Upgrade`/`Connection` 头（见 2.3）
- 确认没有把 `/socket.io` 单独路由到错误的 upstream
