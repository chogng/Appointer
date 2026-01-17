# OriginBridge 实现指南：支持 “Open in Origin” v2（OB Pull + 404 轮询）

Version: `originbridge_open_in_origin_v2_impl_draft`  
Date: `2026-01-14`  
Status: `Draft`  
Audience: OriginBridge / Appointer 联调开发者

> 本文只聚焦 **OriginBridge（OB）侧需要补齐的 v2 能力**：  
> 当 Web 端“点击先拉起 OB、后台再上传 ZIP”时，OB 必须支持 **404=包未就绪** 的轮询下载与退避。

相关文档：
- v2 总体方案：`docs/origin_open_in_origin_spec_v2.md`
- v1 已落地链路与排障：`docs/origin_open_in_origin_runbook.md`

---

## 0) 背景：为什么 v2 一定需要 OB 轮询

v2 的时序核心是：
1) 用户点击按钮（必须同步）→ 立即 deeplink 拉起 OB（满足浏览器 user-gesture）
2) Web 在后台生成 ZIP 并上传到 Appointer Server
3) OB 用 `{jobId, token}` 去 Server 拉取 ZIP，落盘到 OB 输出目录，解压并驱动 Origin

因此在 **OB 拉取 ZIP 的时刻**，Server 很可能还没收到/没写完 ZIP：
- `GET /package` 返回 `404 Job not found` 是 **正常态**
- OB 需要在一个合理窗口内（例如 30–60s）**等待包就绪**

**常见误解澄清**
- v2 不是“等网页把 ZIP 下载到本地某个路径再让 OB 解压”。浏览器无法可靠指定下载路径。
- v2 是“OB 自己下载 ZIP 到 OB 的 work/output dir”，因此 **OB 一定要等服务端把 ZIP 字节返回**；下载完成后 OB 才能解压并继续后续自动化。

---

## 1) 现状检查（你本地 OriginBridge 的行为）

路径（本地）：
- `C:\Users\lanxi\Desktop\OriginBridge\src-tauri\src\utils\origin.rs`

现状要点：
- deeplink 解析：只依赖 `apiBase/jobId/token`，忽略其它 query（`source/v` 不会破坏解析）
- OB 通过 PowerShell worker 执行下载/解压/COM 自动化
- **下载当前是一次性请求**（失败即抛错）：
  - PowerShell：`Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing`
  - 位置：`origin.rs` 内嵌脚本约 `Downloading package` 之后

结论：
- v1（prefetch）通常能直接 200，因此看起来“没问题”
- v2（click-first）下 **很容易先 404**，当前实现会直接进入错误弹窗（notepad），导致链路失败

---

## 2) v2 对 OB 的“必须”行为（HTTP 语义）

OB 下载包时需要按 HTTP 状态码分流：

### 2.1 允许重试（正常态）
- `404 Not Found`：job 尚未创建/ZIP 尚未上传完成  
  - 行为：记录日志 → 退避等待 → 重试直到超时

### 2.2 立即失败（不应重试）
- `403 Forbidden`：token 不匹配（通常是 jobId/token 不一致或被篡改）
- `410 Gone`：job 过期（TTL 到期或 Server 清理）

### 2.3 可重试但要受总超时约束（异常态）
- 网络不可达 / DNS / TLS / 5xx / 429 等
  - 行为：记录日志 → 退避 → 重试（直到总超时）

---

## 3) 实现方案（推荐）：在 PowerShell worker 里实现“下载轮询 + 退避”

> 这是最小改动：不引入新依赖，不改变 Rust 侧调用结构，只替换掉“一次性 Invoke-WebRequest”。

### 3.1 推荐参数（默认值）
- 总超时：`60_000 ms`（建议 30–60s，默认 60s）
- 初始退避：`200 ms`
- 最大退避：`2_000 ms`
- 退避策略：指数增长（每次 *2），封顶 maxDelay
- 可选：加入 0–100ms jitter（降低多个并发同时打点）

### 3.2 PowerShell 的关键细节（必须处理）
1) `Invoke-WebRequest` 在非 2xx 时**会抛异常**（尤其在 `$ErrorActionPreference='Stop'` 下）  
2) 异常对象里不一定总有 `Response`（网络错误时可能为空）  
3) 失败下载可能留下**半截 zip**，下一次重试前应清理

### 3.3 建议新增的脚本函数（伪代码级别，便于直接落地）

**(A) 提取 HTTP 状态码**
- 目标：从 `catch { $_ }` 里尽可能拿到 `404/403/410/...`，拿不到则返回 `$null`

示例逻辑（实现可按你们风格调整）：
- 优先 `$_ .Exception.Response.StatusCode`（常见于 Windows PowerShell 5.1 的 `WebException`）
- 兼容 `$_ .Exception.Response.StatusCode.value__`（某些对象是 enum）
- 兼容 `$_ .Exception.StatusCode`（部分实现会有）

**(B) Download-OriginPackageWithRetry**
- 输入：`$downloadUrl, $zipPath, $timeoutMs, $initialDelayMs, $maxDelayMs`
- 输出：成功时返回；失败时 `throw`（由外层 try/catch 统一写错误文件并弹 notepad）

核心流程：
1) 记录开始时间与 attempt 计数
2) 循环直到 `elapsed >= timeoutMs`：
   - try:
     - 删除已有 `$zipPath`（避免残留）
     - `Invoke-WebRequest ... -OutFile $zipPath ...`
     - 校验 zip 非空（size > 0），必要时可 `Wait-FileUnlocked`
     - 成功返回
   - catch:
     - 取 statusCode（可能为空）
     - `404`：记录“not ready”日志并继续
     - `403/410`：拼出可读错误并 `throw`
     - 其它：记录日志并继续
   - Sleep 当前 delay
   - delay = min(delay*2, maxDelay)（可加 jitter）
3) 超时后 `throw "Timeout waiting for package"`

### 3.4 参考实现片段（PowerShell 5.1 兼容）

> 下面代码片段可以直接放进 `build_run_script()` 的脚本中（函数名/参数可按你们风格调整）。  
> 注意：该片段只负责“下载 ZIP”，外层仍复用现有 try/catch + `Write-OriginBridgeError`。

```powershell
function Try-GetHttpStatusCode($err) {
  try {
    $resp = $err.Exception.Response
    if ($resp -and $resp.StatusCode) { return [int]$resp.StatusCode }
  } catch {}
  try {
    if ($err.Exception.StatusCode) { return [int]$err.Exception.StatusCode }
  } catch {}
  return $null
}

function Remove-IfExists([string]$path) {
  try { if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue } } catch {}
}

function Download-OriginPackageWithRetry(
  [Parameter(Mandatory=$true)][string]$Url,
  [Parameter(Mandatory=$true)][string]$OutFile,
  [int]$TimeoutMs = 60000,
  [int]$InitialDelayMs = 200,
  [int]$MaxDelayMs = 2000
) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $attempt = 0
  $delay = [Math]::Max(50, $InitialDelayMs)

  while ($sw.ElapsedMilliseconds -lt $TimeoutMs) {
    $attempt++
    try {
      Remove-IfExists $OutFile
      Write-OriginBridgeLog "Download attempt #$attempt (elapsed ${($sw.ElapsedMilliseconds)}ms)"
      Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing -ErrorAction Stop
      if (-not (Test-Path -LiteralPath $OutFile)) { throw "Download finished but file missing: $OutFile" }
      $len = (Get-Item -LiteralPath $OutFile).Length
      if ($len -le 0) { throw "Downloaded zip is empty (0 bytes)" }
      return
    } catch {
      $code = Try-GetHttpStatusCode $_
      if ($code -eq 403) { throw "Package download forbidden (403). Token mismatch or unauthorized." }
      if ($code -eq 410) { throw "Package job expired (410)." }

      if ($code -eq 404) {
        Write-OriginBridgeLog "Package not ready yet (404). Retrying in ${delay}ms..."
      } else {
        $msg = $_.Exception.Message
        if ($code) { Write-OriginBridgeLog "Download error (HTTP $code): $msg. Retrying in ${delay}ms..." }
        else { Write-OriginBridgeLog "Download error: $msg. Retrying in ${delay}ms..." }
      }

      Start-Sleep -Milliseconds $delay
      $delay = [Math]::Min([int]($delay * 2), $MaxDelayMs)
    }
  }

  throw "Timeout waiting for package to be ready (elapsed ${($sw.ElapsedMilliseconds)}ms, attempts $attempt)."
}
```

### 3.5 日志与安全（强烈建议）
当前脚本会 `Write-OriginBridgeLog "Downloading package: $downloadUrl"`，downloadUrl 含 `token`。
- 建议：日志里对 token 做脱敏（例如只保留前 6–8 位）
- 失败错误文件（`OriginBridge_error.txt`）也不建议明文写 token

---

## 4) 具体实现步骤（对照你本地 OriginBridge 源码）

> 目标：让 OB 在 v2 下“先启动、404 等待、最终成功下载并继续”。

### Step 1：定位需要替换的下载点
文件：`C:\Users\lanxi\Desktop\OriginBridge\src-tauri\src\utils\origin.rs`  
脚本片段（现状）：
- 构造 `$downloadUrl = "$apiBaseTrimmed/device-analysis/origin/jobs/$JobId/package?token=$Token"`
- 直接 `Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath ...`

### Step 2：在脚本中新增下载轮询函数
在 `build_run_script()` 返回的 PowerShell 脚本中：
1) 增加 `Get-HttpStatusCode`（或等价函数）
2) 增加 `Download-OriginPackageWithRetry`

### Step 3：替换“一次性下载”为“轮询下载”
把：
- `Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath ...`

替换为：
- `Download-OriginPackageWithRetry -Url $downloadUrl -OutFile $zipPath -TimeoutMs 60000 -InitialDelayMs 200 -MaxDelayMs 2000`

### Step 4：保证失败时仍走现有错误处理
外层已有：
- `Write-OriginBridgeError(...)` 写错误文件到 `$WorkDir\\OriginBridge_error.txt` 并弹 notepad

下载轮询函数在最终失败时只需要 `throw`，即可复用现有错误链路。

---

## 5) 本地验证步骤（重点验证“404→重试→200”）

### 5.1 前置条件（要能制造“先 404 后 200”）
要验证 v2 的下载轮询，必须满足：
- OB 被拉起时：Server 还没有该 job（因此 404）
- 稍后：Server 出现该 job（因此 200）

这通常意味着 Appointer Server 需要支持 v2 的“客户端指定 jobId/token”的上传方式（见 `docs/origin_open_in_origin_spec_v2.md` 的 Server 章节），否则你很难在 OB 启动后再用同一 `jobId/token` 创建 job。

### 5.2 验证流程（推荐的观测点）
1) 启动 OB（带自定义 `jobId/token`）  
2) 观察 OB 日志（`<WorkDir>\\.originbridge\\originbridge.log`）出现：
   - 多次下载尝试
   - 若干次 `404`（not ready）
3) 触发 Server 端把该 job 写入（Web 后台上传完成）
4) 观察 OB 日志出现：
   - `200` 下载成功
   - 解压成功
   - Origin COM 自动化执行

### 5.3 验证通过标准（Acceptance）
- `404` 不再直接弹错误 notepad
- `404` 期间日志持续输出“not ready / retrying / backoff”
- 包就绪后能自动继续解压与出图
- 超时/403/410 时错误信息清晰可读

### 5.4 负向用例（建议至少跑一遍）
- `403`：token 故意写错 → OB 应立即失败并提示 token 无效
- `410`：用一个已过期 jobId/token → OB 应立即失败并提示过期
- Server 不可达：拔网线/停服务 → OB 退避重试直至超时，提示网络或超时

---

## 6) 与 v1 的兼容性说明

引入轮询后：
- v1（prefetch）场景：第一次通常就是 200，轮询函数会快速成功返回
- v2（click-first）场景：允许若干次 404，再转 200 成功
- 只有当包长时间未就绪才会超时失败（这比“直接失败”更符合用户预期）

---

## 7) 可选增强（非必须，但很值）

1) **把总超时/退避参数做成可配置**
   - 环境变量：`ORIGINBRIDGE_DOWNLOAD_TIMEOUT_MS` / `ORIGINBRIDGE_DOWNLOAD_MAX_DELAY_MS` 等
   - 或 config.json 字段（与 outputRoot 同级）

2) **日志脱敏 token**
   - 防止把 token 明文写进 `.originbridge/originbridge.log`

3) **deeplink 增加 `expiresAt`（可选）**
   - Web 把 `expiresAt`（ISO 或 epoch）带给 OB
   - OB 轮询总时长可 `min(60s, expiresAt-now)`，减少无意义等待
