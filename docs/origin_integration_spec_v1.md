# Origin Integration Spec v1 (Web → Local Origin) (Bilingual / 双语)

Version: `origin_integration_v1`  
Date: `2026-01-10`  
Scope: From the web app, use exported (processed) Device Analysis data to open **local Origin** and auto-plot with a **fixed template**.

---

## 0) Summary / 摘要

**EN**
- Browsers cannot directly start local desktop apps (Origin) with arbitrary arguments due to security restrictions.
- To achieve “one-click from web → open Origin → import CSV → plot with template”, we need a **local bridge** (recommended), or accept a **manual step** (already implemented).

**CN**
- 浏览器出于安全限制，不能直接无条件拉起本地桌面软件（Origin）并传参执行。
- 若要做到 “网页一键 → 打开 Origin → 导入 CSV → 按模板出图”，要么引入 **本地桥接程序（推荐）**，要么接受 **手动一步**（目前已支持导出 Origin 包）。

---

## 1) Existing Capability / 现状能力

**EN**
We already have “Export for Origin” on Device Analysis page:
- It generates `device_analysis_origin.zip` containing:
  - `*.csv`: columns as `x1,y1,x2,y2,...` (one XY pair per curve group)
  - `*.ogs`: Origin LabTalk script that imports the CSV and runs `plotxy` with XY-pair mapping
  - `README_ORIGIN.txt`: manual instructions

**CN**
当前 Device Analysis 页面已经有 “Export for Origin”：
- 会导出 `device_analysis_origin.zip`，包含：
  - `*.csv`：列格式 `x1,y1,x2,y2,...`（每个 group 一对 XY）
  - `*.ogs`：Origin LabTalk 脚本，导入 CSV 并用 `plotxy` 按 XY 对出图
  - `README_ORIGIN.txt`：人工操作说明

**Code pointers / 代码定位**
- Export packaging: `src/pages/DeviceAnalysis.jsx` (`handleExportOrigin`, `buildOgsScript`)

---

## 2) Target Requirement / 目标需求

**EN**
From the web UI, the user clicks “Open in Origin”, and then:
1) Origin starts locally (or focuses if already running)  
2) The processed CSV data is loaded automatically  
3) A graph is created following a **specific Origin template** (styles/layout/axes/legend)  
4) The user sees the final plot with minimal manual steps

**CN**
在网页端点击 “Open in Origin” 后：
1) 本地 Origin 自动启动（已运行则激活）  
2) 自动加载处理后的 CSV 数据  
3) 按 **特定 Origin 模板**（样式/布局/坐标轴/图例）自动出图  
4) 尽量减少用户手工步骤

---

## 3) Key Constraints / 关键约束

**EN**
- Pure browser JS cannot reliably:
  - locate the downloaded file path
  - start `Origin.exe` with arguments
  - bypass user confirmation dialogs
- Therefore, “one-click” requires **one of**:
  1) a local helper app (protocol handler / localhost agent) (recommended)
  2) a browser extension + native messaging
  3) a user manual step (download ZIP + run script) (already available)

**CN**
- 纯网页 JS 无法可靠做到：
  - 获取下载文件的本地路径
  - 直接启动 `Origin.exe` 并传参执行
  - 绕过浏览器/系统的用户确认
- 所以 “一键” 必须依赖 **以下之一**：
  1) 本地 Helper（协议处理器 / localhost Agent）（推荐）
  2) 浏览器扩展 + 本地消息桥
  3) 允许用户手动一步（下载 ZIP + 在 Origin 里跑脚本）（目前已有）

---

## 4) Solution Options / 方案选型

### Option A — Keep current export (manual run) / 方案A：保持现状（手动）

**EN**
- Web exports `device_analysis_origin.zip`
- User unzips → opens Origin → runs `run.section("xxx.ogs", Main)` manually

**Pros**: no install; simplest; already done  
**Cons**: not “web one-click”; template application needs more work

**CN**
- 网页导出 `device_analysis_origin.zip`
- 用户解压 → 打开 Origin → 手动执行 `run.section("xxx.ogs", Main)`

优点：零安装，最简单，已完成  
缺点：不是网页一键；模板套用需继续补充

---

### Option B — Export ZIP + local “runner” script (semi‑automatic) / 方案B：导出ZIP + 本地一键脚本（半自动）

**EN**
- ZIP also contains `RunInOrigin.ps1` / `RunInOrigin.vbs` (or `.bat`)
- User double-clicks the runner → it:
  - finds CSV/OGS in the same folder
  - uses Origin Automation (COM) to execute `run.section(...)`

**Pros**: no separate installer (still relies on OS scripting); closer to one-click  
**Cons**: still requires user to run a local file; may be blocked by IT policy

**CN**
- ZIP 附带 `RunInOrigin.ps1` / `RunInOrigin.vbs`（或 `.bat`）
- 用户双击后：
  - 自动定位同目录 CSV/OGS
  - 通过 Origin COM 自动化执行 `run.section(...)`

优点：无需额外安装（但依赖脚本权限）；更接近一键  
缺点：仍需用户运行本地文件；可能被企业策略拦截

---

### Option C — Recommended: Local “OriginBridge” + custom URL scheme / 方案C：推荐：本地 OriginBridge + 自定义协议

**EN**
Install a small local helper once, which registers a protocol handler like:
- `appointer-origin://open?job=<id>&token=<one-time>`

Flow:
1) Web calls backend to create an export “job” and returns a protocol URL
2) Web navigates to this URL → browser prompts “Open OriginBridge?”
3) OriginBridge downloads the package (CSV/OGS/template) using the one-time token
4) OriginBridge launches Origin and executes the plot script (and applies template)

**Pros**: true “web one-click”; robust; scalable (supports auth + large data)  
**Cons**: requires installing a local helper; need security review

**CN**
一次性安装一个本地 Helper，并注册协议：
- `appointer-origin://open?job=<id>&token=<一次性token>`

流程：
1) 网页调用后端创建导出任务，拿到协议 URL
2) 网页跳转协议 URL → 浏览器提示 “是否打开 OriginBridge”
3) OriginBridge 用 token 下载包（CSV/OGS/模板）
4) OriginBridge 启动 Origin 并执行出图脚本（并套用模板）

优点：真正网页一键；更稳；可支持鉴权与大数据  
缺点：需要安装本地程序；需要安全评审

---

## 5) Recommended Architecture (Option C) / 推荐方案架构（方案C）

### 5.1 Components / 组件拆分

**EN**
- Frontend (React):
  - “Open in Origin” button
  - fallback to “Export for Origin” ZIP if bridge not installed
- Backend (Express):
  - create job + issue one-time token
  - serve an “Origin package” ZIP for that job
- Local OriginBridge (Windows app):
  - protocol handler receiver
  - downloads ZIP, unpacks to temp folder
  - automates Origin to import + plot + apply template

**CN**
- 前端（React）：
  - “Open in Origin” 按钮
  - 若未安装 Bridge，fallback 到下载 ZIP
- 后端（Express）：
  - 创建任务并发放一次性 token
  - 提供该任务对应的 Origin 包 ZIP
- 本地 OriginBridge（Windows 程序）：
  - 协议处理器入口
  - 下载 ZIP，解压到临时目录
  - 自动化驱动 Origin 导入+出图+套模板

### 5.2 Package Format / 包格式

Reuse the existing `device_analysis_origin.zip` idea, but formalize it:
- `data.csv` (or multiple CSVs)
- `plot.ogs` (LabTalk)
- `template.otp/.otpu` (Origin graph template or project template) — **provided by you**
- `manifest.json` (optional, mapping + metadata)

### 5.3 Protocol + Auth / 协议与鉴权

**EN**
- Protocol URL contains only a `jobId` + short-lived one-time token (e.g., 60–120s)
- OriginBridge fetches package over HTTPS:
  - `GET /api/device-analysis/origin/jobs/:jobId/package?token=...`
- Server validates:
  - token signature / expiry
  - user authorization (job belongs to user)

**Dev note / 开发注意**
- If the web UI is served by Vite with proxy (e.g. `http://localhost:5173` → `/api`), OriginBridge cannot use the proxy.
- Provide OriginBridge a real absolute API base URL (e.g. `http://127.0.0.1:3001/api`). In this repo, the UI supports `VITE_ORIGINBRIDGE_API_BASE_URL` for that.

**Cleanup note / 协议注册清理**
- The custom protocol handler is stored in Windows registry under `HKCU\Software\Classes\appointer-origin` (no admin needed).
- The NSIS uninstaller hook removes this key on uninstall to avoid leaving a broken protocol entry.
- Developer cleanup:
  - Run `OriginBridge.exe --unregister-protocol`, or
  - Run `scripts/unregister-protocol.cmd` (best-effort removes HKCU/HKLM in 32/64 views).

**CN**
- 协议 URL 只带 `jobId` + 短时一次性 token（如 60–120 秒）
- OriginBridge 通过 HTTPS 拉取：
  - `GET /api/device-analysis/origin/jobs/:jobId/package?token=...`
- 服务端校验：
  - token 签名/过期
  - 用户权限（job 属于该用户）

### 5.4 Origin Automation / Origin 自动化

**EN**
Preferred approach: Origin COM automation (Windows):
- Start/focus Origin
- Execute LabTalk:
  - set working folder to extracted package
  - run `run.section("plot.ogs", Main, "C:\\path\\data.csv")`
- Template application:
  - either handled inside `plot.ogs`
  - or applied via additional LabTalk commands executed by COM

**CN**
推荐：使用 Origin 的 Windows COM 自动化：
- 启动/激活 Origin
- 执行 LabTalk：
  - `cd` 到解压目录
  - `run.section("plot.ogs", Main, "C:\\path\\data.csv")`
- 模板套用：
  - 要么写在 `plot.ogs` 里
  - 要么由 COM 额外执行 LabTalk 命令完成

---

## 6) Implementation Plan / 落地计划（里程碑）

**Milestone 1 — Define template contract / 定义模板契约**
- Provide the Origin template file (`.otp/.otpu` or project template) and define:
  - expected worksheet/column layout
  - which columns become which curves
  - style rules (axes titles, legend, colors, line width, symbols)

**Milestone 2 — Extend Origin export package / 扩展导出包**
- Update `handleExportOrigin` to optionally include:
  - the template file
  - a `manifest.json` describing XY pair counts and labels
  - script commands to apply template

**Milestone 3 — Build OriginBridge (MVP) / 开发 OriginBridge（最小可用）**
- Windows installer registers protocol handler
- Implements download → unzip → run LabTalk via COM
- User-friendly errors: missing Origin, token expired, download failed

**Milestone 4 — Web “Open in Origin” UX / 网页端一键体验**
- Frontend button:
  - create job → open protocol URL
  - timeout fallback: show “Bridge not installed?” + download link
- Backend endpoints for job + package

**Milestone 5 — Security hardening / 安全加固**
- Token TTL, one-time use
- allowlist host + HTTPS only
- visible confirmation in bridge before executing

---

## 7) Acceptance Checklist / 验收清单

- Click “Open in Origin” → browser prompt → Origin opens and a plot appears.
- Plot matches the given Origin template (style/layout).
- Works with multiple curves (multiple XY pairs).
- If OriginBridge is not installed → user sees clear fallback (download ZIP).
- Token expiry or permission mismatch returns readable errors (web + bridge).
