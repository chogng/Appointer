# Origin “Open in Origin” 运行流程 & 调试手册（Appointer + OriginBridge）

版本：`2026-01-13`  
目标读者：需要联调/排障的开发者（前端/后端/OriginBridge）  

> 这份文档描述的是 **当前已落地** 的实现（不是设想方案），重点回答：点击 “Open in Origin” 后，系统内部到底做了哪些步骤、会落什么产物、卡住时怎么定位卡在第几步。

相关文档：
- [`origin_integration_spec_v1.md`](./origin_integration_spec_v1.md)：方案约束/选型与里程碑（Spec）
- [`README.md`](./README.md)：本仓库 docs 索引

注：文中出现的 `OriginBridge/...` 路径指的是 **OriginBridge 项目** 的源码目录（通常与本仓库分离）。

---

## 1. 组件与职责（What talks to what）

- **Appointer Web（浏览器）**：把当前选中的曲线导出成 Origin ZIP；向 Appointer Server 申请一次性 job；同步触发自定义协议 deeplink。
- **Appointer Server（Node/Express）**：接收 ZIP 并生成 `{jobId, token}`；提供下载接口给 OriginBridge（只校验 token）。
- **OriginBridge（本地 Tauri 程序）**：作为 Windows 自定义协议处理器；收到 deeplink 后创建 job 工作目录、下载 ZIP、解压、调用 Origin COM 自动绘图、保存 `.opju` 并拉起 Origin 打开。
- **Origin（本地桌面软件）**：最终展示项目和图。

---

## 2. 一键链路（End-to-end Flow）

下面按时间顺序列出 **一次 “Open in Origin”** 的完整链路（建议你用这些编号告诉我“卡在第几步”）。

### 2.1 前端：准备 job（在用户点击之前后台完成）

触发条件：用户切换/聚焦到某一条曲线（focused series）。

1) **打包 Origin ZIP（前端内存里生成）**
   - 生成一个 zip（Blob），包含：
     - `*.csv`：当前曲线的 `x1,y1` 两列数据（单曲线）
     - `*.ogs`：LabTalk 脚本（用于手动 fallback）
     - `README_ORIGIN.txt`
   - 代码位置：[`src/features/device-analysis/components/AnalysisCharts.jsx`](../src/features/device-analysis/components/AnalysisCharts.jsx)（`buildOriginPackageForFocusedSeries`）

2) **向后端创建 job**
   - `POST /api/device-analysis/origin/jobs`
   - 请求体：zip 二进制（`Content-Type: application/zip`）
   - 认证：走登录态 cookie（`credentials: "include"`）
   - 返回：`{ jobId, token, expiresAt }`
   - 代码位置：[`src/features/device-analysis/components/AnalysisCharts.jsx`](../src/features/device-analysis/components/AnalysisCharts.jsx)（`createOriginJob`）

3) **拼接 deeplink（缓存到前端状态）**
   - 格式：
     - `appointer-origin://open?apiBase=<...>&jobId=<...>&token=<...>`
   - 其中：
     - `apiBase`：OriginBridge 需要访问的后端 API Base（必须是可被本机直接访问的真实地址）
     - `jobId/token`：短期一次性凭证
   - 代码位置：[`src/features/device-analysis/components/AnalysisCharts.jsx`](../src/features/device-analysis/components/AnalysisCharts.jsx)（`originBridgeScheme` / `originJob`）

> 设计原因：浏览器对 “外部协议唤起” 有用户手势限制，因此 **deeplink 的跳转必须在点击事件里同步发生**；job 预先生成是为了保证点击时不需要 `await`。

### 2.2 前端：用户点击（同步触发协议）

4) **用户点击 “Open in Origin”**
   - 前端直接同步执行：`window.location.href = originJob.url`
   - 同时用 toast 提示：`Requested OriginBridge to open Origin...`
   - 代码位置：[`src/features/device-analysis/components/AnalysisCharts.jsx`](../src/features/device-analysis/components/AnalysisCharts.jsx)（`handleOpenInOrigin`）

### 2.3 Windows：协议分发（从浏览器 -> OriginBridge）

5) Windows 根据注册表把 `appointer-origin://...` 交给 OriginBridge 处理
   - 注册表关键项：
     - `HKCU:\Software\Classes\appointer-origin\shell\open\command`
   - 期望效果：OriginBridge 进程启动，并收到 1 个参数（完整 deeplink）
   - OriginBridge 协议解析：
     - scheme 必须是 `appointer-origin`
     - host 必须是 `open`
     - query 必须包含：`apiBase/jobId/token`
   - 代码位置：`OriginBridge/src-tauri/src/utils/origin.rs`（`parse_open_uri`）

### 2.4 OriginBridge：创建 job 目录 + 启动 worker

6) OriginBridge 创建 job 工作目录（这一步一旦成功，你应该立刻能看到 “产物” 出现）
   - 默认输出根目录：
     - `%USERPROFILE%\Documents\Appointer\Origin`
   - job 目录：
     - `job_<timestamp>_<pid>_<jobId>/`
   - 代码位置：`OriginBridge/src-tauri/src/utils/origin.rs`（`run_origin_job`）

7) OriginBridge 写入并启动 PowerShell worker（隐藏窗口）
   - 写入：
     - `<WorkDir>\.originbridge\run_origin_job.ps1`
   - 启动：
     - `powershell.exe -WindowStyle Hidden -File <ps1> ...`

### 2.5 PowerShell worker：下载 ZIP -> 解压 -> Origin COM -> 保存 -> 打开

8) 下载 ZIP
   - URL：
     - `GET {apiBase}/device-analysis/origin/jobs/{jobId}/package?token={token}`
   - 保存到：
     - `<WorkDir>\.originbridge\origin_package.zip`

9) 解压 ZIP
   - 目录：
     - `<WorkDir>\pkg\...`

10) Origin COM 自动化绘图（核心）
   - 尝试运行 `.ogs`（但会规避会弹框/阻塞的脚本逻辑）
   - 若 `.ogs` 包含 `dlgfile`（会阻塞隐藏自动化），则跳过 `.ogs`，走 fallback：`impCSV + plotxy`
   - 保存：
     - `<WorkDir>\*.opju`
   - 保存后会验证是否真的有 `GraphPage`；没有则再次 fallback 并重存

11) 拉起 Origin 打开项目（避免 read-only）
   - 为避免 Origin 报 “project will be set as read-only / restricted folder”，会把 `.opju` 复制到：
     - `%TEMP%\appointer-originbridge-open\*_open_*.opju`
   - 再用 Origin 打开这个 temp copy

12) 日志/错误文件
   - 运行日志（最重要）：
     - `<WorkDir>\.originbridge\originbridge.log`
   - worker 级错误（在 job 目录里）：
     - `<WorkDir>\OriginBridge_error.txt`
   - 参数解析/启动级错误（在临时目录里，且会尝试打开 Notepad）：
     - `%TEMP%\appointer-originbridge\OriginBridge_error_*.txt`

---

## 3. 产物清单（你应该在磁盘上看到什么）

### 3.1 Appointer Server（后端临时 ZIP）

- `%TEMP%\appointer-origin-jobs\<jobId>.zip`
  - 注意：job 索引在内存 Map；**服务器重启会导致旧 job 直接 404（即使 zip 文件还在）**。

### 3.2 OriginBridge（本地 job 目录）

- `%USERPROFILE%\Documents\Appointer\Origin\job_...`
  - `.originbridge\originbridge.log`
  - `.originbridge\origin_package.zip`
  - `.originbridge\run_origin_job.ps1`
  - `pkg\...`（解压内容）
  - `*.opju`（保存出的 Origin 项目）
  - `OriginBridge_error.txt`（如失败）

---

## 4. “卡在一步”的快速定位（按现象对照）

### A) 点击后 **完全没有 job 目录**（`Documents\Appointer\Origin` 下无 `job_*`）

结论：基本说明 **OriginBridge 没被 Windows 唤起**（或根本没收到 deeplink）。

排查顺序：
1) 浏览器是否真的发生了 `appointer-origin://...` 导航（DevTools Console/Network/地址栏行为）
2) 协议是否注册成功：
   - `HKCU:\Software\Classes\appointer-origin\shell\open\command` 是否存在且指向正确 exe
3) 是否出现临时错误文件：
   - `%TEMP%\appointer-originbridge\OriginBridge_error_*.txt`
   - 若连这个都没有，通常是浏览器/系统层面阻止了协议唤起

### B) 有 job 目录，但 **没有 `originbridge.log`**

结论：OriginBridge 被拉起了，但 worker 脚本没跑起来（或启动即崩）。

看：
- `<WorkDir>\.originbridge\run_origin_job.ps1` 是否存在
- `<WorkDir>\OriginBridge_error.txt` 是否生成

### C) 有 `originbridge.log`，但日志显示 **下载失败**

常见原因：
- `apiBase` 不是一个 OriginBridge 能直接访问的真实地址（例如依赖了浏览器 proxy）
- Appointer Server 不在运行 / 端口不通
- token 过期（TTL）或 server 重启导致 job 丢失

### D) Origin 打开了，但提示 **read-only / restricted folder**

原因：
- Origin 对某些目录（例如被同步/权限受限/正在被占用）会强制只读

当前策略：
- OriginBridge 会把 `.opju` 复制到 `%TEMP%\appointer-originbridge-open\` 再打开

### E) Origin 打开了 Script Window，但 **曲线没画出来**

已知根因（已在 worker 里做了规避/补救）：
- `.ogs` 里 `dlgfile` 会弹文件选择框，隐藏自动化会阻塞
- Origin 某些 `Execute` 返回 success 但实际没出图

当前策略：
- 检测到 `dlgfile` -> 跳过 `.ogs`，直接 `impCSV + plotxy`
- 保存后 `ProjectSearch('G',...)` 校验 GraphPage；没图则 fallback 并重存

---

## 5. 关键代码定位（Code pointers）

### Appointer（Web）

- [`src/features/device-analysis/components/AnalysisCharts.jsx`](../src/features/device-analysis/components/AnalysisCharts.jsx)
  - `buildOriginPackageForFocusedSeries`
  - `createOriginJob`
  - `handleOpenInOrigin`

### Appointer（Server）

- [`server/server.js`](../server/server.js)
  - `POST /api/device-analysis/origin/jobs`
  - `GET /api/device-analysis/origin/jobs/:id/package`

### OriginBridge

- `src-tauri/src/lib.rs`
  - CLI：`--register-protocol / --unregister-protocol`
  - 解析失败会写：`%TEMP%\appointer-originbridge\OriginBridge_error_*.txt`
- `src-tauri/src/utils/origin.rs`
  - `parse_open_uri`
  - `run_origin_job`（创建 job 目录 + 启动 worker）
- `src-tauri/src/utils/config.rs`
  - 默认输出根目录：`%USERPROFILE%\Documents\Appointer\Origin`
  - 支持覆盖：`ORIGINBRIDGE_OUTPUT_DIR` 或 config.json（`APPDATA\Appointer\OriginBridge\config.json`）

---

## 6. 你现在“卡在第几步”？

按上面的编号（2.1~2.5）告诉我你卡住的 **最早一步**，并贴以下其中一个信息即可继续：

- A) DevTools 里 `POST /api/device-analysis/origin/jobs` 的状态码和响应体（是否拿到 `jobId/token`）
- B) 你点击时真正跳转的 deeplink（`appointer-origin://...` 全量）
- C) `HKCU:\Software\Classes\appointer-origin\shell\open\command` 的值
- D) 若存在 job 目录：`<WorkDir>\.originbridge\originbridge.log` 最后 30 行

---

## 7. 快速命令（PowerShell）

> 下面命令都可以直接在 PowerShell 里跑，方便快速定位“卡在哪一层”。

- 查看协议注册命令（是否指向正确 exe）：
  - `Get-ItemProperty 'HKCU:\Software\Classes\appointer-origin\shell\open\command' | Select-Object -ExpandProperty '(default)'`
- 查看 OriginBridge 输出根目录（如果你有 exe 路径）：
  - `& 'C:\Users\lanxi\Desktop\OriginBridge\src-tauri\target\debug\tauri-app.exe' --get-output-dir`
- 列出最近的 job 目录：
  - `Get-ChildItem "$env:USERPROFILE\Documents\Appointer\Origin" -Directory -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 10 Name, LastWriteTime, FullName`
- 读取最新的启动/解析错误（会在 `%TEMP%`）：
  - `Get-ChildItem "$env:TEMP\appointer-originbridge" -Filter 'OriginBridge_error_*.txt' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | ForEach-Object { $_.FullName; Get-Content $_.FullName -Raw }`
- 读取最新 job 的 worker 日志（自动定位最新 job）：
  - `$job = Get-ChildItem "$env:USERPROFILE\Documents\Appointer\Origin" -Directory -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($job) { Get-Content (Join-Path $job.FullName '.originbridge\originbridge.log') -Tail 80 } else { 'No job directory found.' }`
