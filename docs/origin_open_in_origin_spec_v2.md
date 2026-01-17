# Origin “Open in Origin” v2 Spec（Click-first + OriginBridge Pull）

Version: `origin_open_in_origin_v2_draft`  
Date: `2026-01-14`  
Status: `Draft`  
Audience: Appointer Web / Server / OriginBridge developers

> 本文用于定义 Device Analysis 的 “Open in Origin” **v2 链路**：  
> **点击即拉起 OriginBridge（OB）→ OB 下载 ZIP 到 OB 输出目录 → 解压 → 自动化拉起/驱动 Origin 出图**。  
> 文档重点面向“和本地 OB 实现进行对照验证”。

See also:
- [`origin_open_in_origin_originbridge_impl_v2.md`](./origin_open_in_origin_originbridge_impl_v2.md)：OB 侧 v2 必要实现（404 轮询/退避/验证）
- [`origin_open_in_origin_runbook.md`](./origin_open_in_origin_runbook.md)：v1 已落地链路与排障手册（很多 COM/脚本问题 v2 仍适用）
- [`origin_integration_spec_v1.md`](./origin_integration_spec_v1.md)：背景/约束与总体方案选型

---

## 0) Summary / 摘要

**EN**
- Browsers cannot reliably download a file into a specified local folder (and cannot read the final download path).
- So “download ZIP into OB output dir” must be done by **OriginBridge**, not by the browser.
- v2 changes the flow to be **click-first**:
  - On click, Web synchronously launches OB with a deeplink that already contains `{jobId, token}`.
  - Web uploads the ZIP in the background to the server using the same `{jobId, token}`.
  - OB polls and downloads the ZIP when it becomes available.

**CN**
- 浏览器无法可靠地“把文件下载到指定目录”，也拿不到下载后的真实路径。
- 因此“ZIP 落到 OB 指定目录”必须由 **OriginBridge 自己下载并落盘**。
- v2 把链路改成 **先拉起 OB**：
  - 点击时同步生成 `{jobId, token}` 并立刻 deeplink 拉起 OB
  - Web 后台用同一 `{jobId, token}` 把 ZIP 上传到 Server
  - OB 轮询下载 ZIP，落盘到自己的 output dir，然后解压并驱动 Origin 出图

---

## 1) Motivation / 动机

### 1.1 v1（现状）的问题
- Web 端可能在用户真正点击前就创建 job 并上传包（prefetch），导致：
  - 无效/浪费的 job 与上传
  - 用户隔一段时间才点击 → token 过期
  - 选中曲线快速切换 → job 不稳定、边界情况增多

### 1.2 v2（目标）带来的收益
- “Open in Origin” 点击成为唯一触发点：
  - **点击即拉起 OB**（满足浏览器 user-gesture 限制）
  - 打包/上传可异步完成，OB 负责等待与重试
  - ZIP 由 OB 落盘到输出目录（路径稳定、可控）

---

## 2) Constraints / 关键约束

1) **自定义协议唤起必须发生在点击事件里（同步）**  
   否则浏览器会拦截拉起外部应用。

2) **Web 无法指定下载路径**  
   因此“下载 ZIP 到 OB 输出目录”只能由 OB 实现。

3) **OB 无法使用 Vite 的 `/api` 代理**  
   `apiBase` 必须是 OB 可直连的绝对地址（例如 `http://127.0.0.1:3001/api`）。

4) **OB Pull 模式必然依赖一次下载**  
   OB 要解压/出图，必须先拿到 ZIP 字节；因此在 “OB 自行拉包” 的选择下，OB 需要等待服务端返回 ZIP（只是等待时长取决于网络与包大小）。

### 2.1 延迟与可靠性（设计取舍）
- 如果 Appointer Server 与 OB 在同机（本地开发/本地部署），`apiBase=http://127.0.0.1:3001/api` 时“网络延迟”基本可忽略。
- 如果 Server 是远端环境，v2 会产生两段传输：
  - Web → Server（上传 ZIP）
  - OB → Server（下载 ZIP）
  这会受网络带宽/延迟影响，但可通过轮询/退避/总超时与清晰的 UI/错误提示来保证“可用性”和“可诊断”。
- 若未来需要进一步降低等待（非本 v2 必须）：
  - 选项 A：继续保留/启用 v1 的 prefetch（提前上传），点击时 OB 基本可直接 200 下载；
  - 选项 B：Web → localhost 直接推送 ZIP 到 OB（减少一次远端往返），但需要额外的安全握手与 CORS/nonce 设计。

---

## 3) Proposed End-to-End Flow / 端到端流程（v2）

### 3.1 时序（按实际执行顺序）

**T0（用户点击 “Open in Origin”）**
1. Web 本地生成 `jobId` + `token`（不依赖网络返回）  
2. Web 立即构造并跳转 deeplink，拉起 OB：  
   `appointer-origin://open?apiBase=...&jobId=...&token=...&source=device-analysis&v=2`  
3. Web 后台异步：构建 Origin ZIP → 上传到 Server（使用同一 `jobId/token`）

**T0 ~ T+Δ（OB 启动后）**
4. OB 收到 deeplink → 创建工作目录（在 OB 输出目录下）  
5. OB 开始下载轮询：  
   - 在 Web 上传完成前，Server 可能返回 **404**（job 还不存在）→ OB 重试  
6. Server 返回 **200** 后：OB 保存 ZIP → 解压 → 执行 Origin 自动化出图 → 拉起/聚焦 Origin

---

## 4) Protocol URL Contract / 协议 URL 契约

### 4.1 URL 格式
`appointer-origin://open?apiBase=<ABS_API_BASE>&jobId=<JOB_ID>&token=<TOKEN>&source=device-analysis&v=2`

### 4.2 参数说明
- `apiBase`（必填）：OB 可直连的 API Base（绝对 URL）  
  - 本地推荐：`http://127.0.0.1:3001/api`
- `jobId`（必填）：点击时由 Web 生成  
  - 推荐格式：`da_origin_job_<uuid>`（前缀 + UUID）
- `token`（必填）：一次性短期 secret（下载包鉴权）  
  - 推荐：UUID v4
- `source`（可选）：`device-analysis`（用于日志/路由）
- `v`（可选）：`2`（用于 OB 分支逻辑与灰度）

### 4.3 编码/拼接规则（避免协议解析与引号问题）
- Web 端拼接 deeplink 时必须对 query value 做 `encodeURIComponent`（至少包括 `apiBase/jobId/token`）。
- `apiBase` 建议去掉末尾 `/`（OB 侧也会 `TrimEnd('/')`）。
- OB 侧会对 `apiBase/jobId/token` 做基础 `trim`，并剔除 `"`，但不应依赖此行为；Web 端不要在参数中额外包引号。

---

## 5) Server API Contract / 服务端接口契约（Appointer Server）

> 下载接口保持不变；扩展现有上传接口以支持“客户端指定 jobId/token”。

### 5.1 上传（扩展 v2）
`POST /api/device-analysis/origin/jobs`

- Auth：cookie session（与现状一致），Web 请求使用 `credentials: "include"`
- Body：ZIP 二进制（`Content-Type: application/zip`）
- Headers：
  - `x-origin-filename`：下载时建议文件名（可选，现有）
  - `x-origin-job-id`：**（新增，v2）**Web 点击时生成的 jobId
  - `x-origin-token`：**（新增，v2）**Web 点击时生成的 token

**Server 行为（建议）**
- 校验 ZIP payload 非空
- 校验 `jobId/token` 格式（建议严格一点，便于防注入/定位问题）：
  - `jobId`：`^da_origin_job_[0-9a-fA-F-]{36}$`
  - `token`：UUID-like
- 如果 `jobId` 已存在且未过期：返回 `409 Conflict`
- 落盘：`ORIGIN_JOB_DIR/<jobId>.zip`
- 内存记录：`{ userId, token, expiresAt, filePath, fileName }`
- 返回 `201`：`{ jobId, token, expiresAt }`

**Backward compatible（建议）**
- 如果 `x-origin-job-id/x-origin-token` 不存在：保持 v1 行为（Server 生成 `jobId/token` 并返回）。
- v2 的 Web 端只需要在点击路径使用 header；其它调用路径可不改。

### 5.2 下载（现有）
`GET /api/device-analysis/origin/jobs/:id/package?token=...`

**响应语义（OB 侧需要严格对照）**
- `200`：ZIP（二进制）
- `404`：job 不存在（v2 下可视为“Web 还没上传完/服务端还没写入”，需要重试）
- `403`：token 不匹配（立即失败，不重试）
- `410`：过期（立即失败，不重试）

---

## 6) Web UI Implementation Notes / Web 端实现要点（Device Analysis）

### 6.1 点击逻辑（必须同步拉起 OB）

点击 “Open in Origin”：
1) 生成：
- `jobId = "da_origin_job_" + crypto.randomUUID()`
- `token = crypto.randomUUID()`

2) 解析 `apiBase`（供 OB 使用）：
- 优先 `VITE_ORIGINBRIDGE_API_BASE_URL`（必须是绝对 URL）
- 兜底：把 `VITE_API_BASE_URL` 解析成绝对 URL（但不建议依赖 Vite 代理）

3) 立即拉起 OB：
- `window.location.href = deeplinkUrl`

4) 后台异步上传 ZIP（同一 `jobId/token`）：
- `POST /api/device-analysis/origin/jobs`
- headers 带：
  - `x-origin-job-id: <jobId>`
  - `x-origin-token: <token>`
  - `x-origin-filename: <zipName>`

### 6.2 UX 建议
- 点击后立即 toast：`Launching OriginBridge… Uploading package…`
- 上传失败 toast：提示 OB 可能超时，并提示 fallback：`Export for Origin`

**代码定位（现状 v1）**
- Web：`src/components/DeviceAnalysis/AnalysisCharts.jsx`
  - `handleOpenInOrigin`
  - `createOriginJob`
  - （v1 prefetch）选曲线时 `useEffect` 生成 `originJob`

---

## 7) OriginBridge Implementation Notes / OB 实现要点（用于本地对照）

### 7.1 下载轮询策略（v2 的关键）

OB 收到 deeplink 后下载包：
- 遇到 `404`：视为“包未就绪”，进行重试 + 退避
- 遇到 `200`：保存 ZIP → 解压 → 继续
- 遇到 `403/410`：立即失败（通常不应重试）

建议参数（可按本地实现调整）：
- 退避：200ms → 500ms → 1s → 2s（封顶 2s）
- 总超时：30–60s（可配置）

**实现注意（PowerShell / Invoke-WebRequest）**
- PowerShell 的 `Invoke-WebRequest` 在非 2xx 时会抛异常；需要在 `catch` 中提取 HTTP 状态码：
  - `404`：继续重试（包未就绪是 v2 的正常态）
  - `403/410`：直接失败
  - 其它：按“网络/服务错误”重试若干次或计入总超时

### 7.2 输出目录职责

OB 必须保证 ZIP 最终落在 OB output dir（示例）：
- 默认：`%USERPROFILE%\\Documents\\Appointer\\Origin`
- 覆盖：`ORIGINBRIDGE_OUTPUT_DIR` 或 config.json（按你们现有 OB 规则）

建议工作目录命名：
- `<OutputRoot>\\<YYYYMMDD_HHMMSS>_<jobId>\\`

### 7.3 Origin 自动化（保持现状即可）

解压后执行：
- 通过 COM 自动化导入 CSV + 出图
- 可复用 ZIP 里的 `.ogs`，或直接执行等价 LabTalk（按现有 OB 实现即可）

---

## 8) Local Verification Checklist / 本地验证对照清单

### 8.1 环境前置
- 设置 `VITE_ORIGINBRIDGE_API_BASE_URL`（本地推荐）：`http://127.0.0.1:3001/api`
- 协议注册检查（PowerShell）：
  - `Get-ItemProperty 'HKCU:\\Software\\Classes\\appointer-origin\\shell\\open\\command' | Select-Object -ExpandProperty '(default)'`

### 8.2 v2 预期观测点（按层对照）

**Browser / DevTools**
- 点击后立即触发外部应用拉起（先于网络完成）
- 随后出现 `POST /api/device-analysis/origin/jobs`，并带：
  - `x-origin-job-id`
  - `x-origin-token`

**Server**
- 临时目录出现 ZIP：
  - `%TEMP%\\appointer-origin-jobs\\<jobId>.zip`

**OriginBridge**
- 日志顺序应包含：
  1) 解析 deeplink（拿到同一个 `jobId/token/apiBase`）
  2) 多次 GET 下载尝试：前几次 `404` 是允许的
  3) 最终 `200` 下载成功并落盘到 OB output dir
  4) 解压 + Origin 自动化 + 拉起 Origin

**Origin**
- Origin 被拉起/聚焦，并出现图（或至少自动化执行成功的提示与产物）

### 8.4 快速排查命令（PowerShell）
- Server 端 job ZIP 是否写入（Appointer 现状默认）：
  - `Get-ChildItem \"$env:TEMP\\appointer-origin-jobs\" -Filter '*.zip' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 5 Name, LastWriteTime, FullName`
- OB 输出目录（默认）最近 job：
  - `Get-ChildItem \"$env:USERPROFILE\\Documents\\Appointer\\Origin\" -Directory -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 5 Name, LastWriteTime, FullName`
- 读取最新 job 的 OB 日志：
  - `$job = Get-ChildItem \"$env:USERPROFILE\\Documents\\Appointer\\Origin\" -Directory -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($job) { Get-Content (Join-Path $job.FullName '.originbridge\\originbridge.log') -Tail 120 } else { 'No job directory found.' }`

### 8.3 v1 vs v2 快速对照

| 项 | v1（现状） | v2（提案） |
| --- | --- | --- |
| job 创建/上传时机 | 选中曲线时 prefetch | 仅点击时 |
| deeplink 的 jobId/token 来源 | server 返回 | 点击时本地生成 |
| OB 下载行为 | 通常直接 200 | 可能先 404 → 重试 → 200 |
| 无效上传 | 可能发生 | 显著减少 |
| token 过期风险 | 更高（用户迟点） | 更低 |

---

## 9) Required Changes Summary / 变更摘要（用于对照实现）

**Appointer Web**
- “Open in Origin” 改为 click-first：本地生成 `{jobId, token}` 并同步拉起 OB
- 后台上传 ZIP 时携带相同 `{jobId, token}`（header 传递）

**Appointer Server**
- 扩展 `POST /api/device-analysis/origin/jobs`：支持接收 `x-origin-job-id/x-origin-token`
- `GET /api/device-analysis/origin/jobs/:id/package` 保持不变

**OriginBridge**
- 对 `404` 增加轮询退避（包未就绪的正常态）
- 保持现有解压与 Origin 自动化链路
