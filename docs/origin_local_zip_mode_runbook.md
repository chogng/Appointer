# Origin Local ZIP Mode Runbook (No Server / No Deeplink)
Version: `origin_local_zip_mode_v2`  
Date: `2026-01-14`  
Audience: Appointer users / OriginBridge developers

> 目标：把 Device Analysis 的 Origin 出图链路彻底简化为“本地 ZIP 输入”。
> - Appointer 只负责导出一个 Origin 包 ZIP（浏览器下载）。
> - 用户把 ZIP 保存到任意本地路径（输入目录由用户决定）。
> - OriginBridge 让用户选择这个 ZIP，然后执行：复制 -> 解压 -> 自动化拉起 Origin -> 导入/绘图 -> 保存 `.opju` -> 打开 Origin。
>
> 这条链路不依赖：后端 job/token、不依赖：浏览器下载完成回调、不依赖：自定义协议 deeplink。

---

## 0) 为什么要这么做（对应你提到的关键担忧）

- 浏览器拿不到真实下载路径，也无法“下载完成即通知本地程序”而不引入复杂扩展/协议。
- 让后端“等下载完成再响应”会受网络延迟影响，不可靠；而且这类数据处理不该强依赖后端。
- 让用户自行把 ZIP “另存为”到想要的目录最稳定：本地文件路径明确、可复现、链路可离线。

---

## 1) 适用 / 不适用

适用：
- 只追求“确定性 + 最小复杂度”的本地出图方案。
- 接受一个人工动作：下载 ZIP + 在 OriginBridge 里选择 ZIP。

不适用：
- 想要实现“网页一键直接拉起 OriginBridge/Origin 并出图”的无人工链路（需要协议/扩展/本地监听服务等）。

---

## 2) 角色与责任边界（必须对齐）

- Appointer：保证 `Export for Origin` 下载到的 ZIP 格式正确、内容完整。
- 用户：决定 ZIP 的保存位置，并确认下载完成后再交给 OriginBridge。
- OriginBridge：只做“读取选中的 ZIP 并出图”，不需要和网页/后端建立任何“下载完成联动”。

---

## 3) 用户操作流程（最小闭环）

### 3.1 Appointer：导出 ZIP

1) 打开 Appointer 的 Device Analysis 页面，完成曲线选择/聚焦（按当前产品交互）。  
2) 点击 `Export for Origin`，浏览器开始下载 `device_analysis_origin.zip`。  
3)（推荐）使用浏览器“另存为”把 ZIP 保存到一个自己好找的目录，例如：`D:\\Downloads\\Appointer\\Origin\\`。  
4) 等下载完成：确保文件后缀是 `.zip` 且大小大于 0。不要选择类似 `.crdownload` 的临时文件。

### 3.2 OriginBridge：选择 ZIP 并出图（GUI）

1) 打开 OriginBridge。  
2)（可选）先设置输出目录（见 5.1），并点击“打开目录”确认可写。  
3) 点击 `选择 ZIP 并出图`，选择刚下载的 `device_analysis_origin.zip`。  
4) OriginBridge 会立刻创建一个 job 目录并在后台运行出图任务；稍等片刻 Origin 会自动打开并展示结果。

### 3.3 OriginBridge：命令行（CLI）

```powershell
OriginBridge.exe --open-zip "C:\\path\\device_analysis_origin.zip"
```

---

## 4) ZIP 包格式约定（Appointer 必须保证）

OriginBridge 对 ZIP 的要求是“能消费”，不是“必须保存到固定目录”。  
ZIP 内文件可以在子目录里，OriginBridge 会递归查找。

### 4.1 必需文件

- 至少 1 个 `*.csv`

### 4.2 推荐文件

- 1 个 `*.ogs`（Origin LabTalk 脚本，用于更精准的导入/绘图）
  - 推荐包含 `[Main]`（或 `[main]`）section
  - 必须避免使用 `dlgfile` 等会弹窗阻塞自动化的命令（OriginBridge 会检测并跳过）

### 4.3 CSV 格式建议

- 第一行是 header，推荐 `x1,y1,x2,y2,...`（每一对 XY 对应一条曲线）。

### 4.4 OGS 约定（让它和 OriginBridge 更“对得上”）

OriginBridge 在执行 OGS 前会：
- 设置以下 LabTalk 变量（OGS 可直接读取）：
  - `ob_work_dir$`：job 根目录
  - `ob_pkg_dir$`：解压目录（`pkg`）
  - `ob_ogs_path$`：OGS 绝对路径
  - `ob_csv_path$`：CSV 绝对路径（若找到）
- 然后尝试多种 `run.section()` 调用方式（优先执行 `[main]`，否则执行 OGS 中的第一个 section）
- 若检测到 `dlgfile`，会跳过 OGS 并走 CSV fallback 出图

---

## 5) OriginBridge 输出、日志与验收（用于你本地 OB 对照验证）

### 5.1 输出根目录优先级

1) 环境变量 `ORIGINBRIDGE_OUTPUT_DIR`（最高优先级）  
2) `config.json`（OriginBridge UI 设置）  
3) 默认：`%USERPROFILE%\\Documents\\Appointer\\Origin`

### 5.2 每次出图的产物结构

一次“选择 ZIP 并出图”会创建一个 job 目录：`job_<timestamp>_<pid>_local_<zipName>`，包含：

- `<job>\\.originbridge\\origin_package.zip`：复制进去的 ZIP（用于复现/排查）
- `<job>\\pkg\\...`：解压后的文件（csv/ogs/README 等）
- `<job>\\.originbridge\\originbridge.log`：worker 日志（最重要）
- `<job>\\*.opju`：保存的 Origin project

另外，OriginBridge 会把 `.opju` 复制到：`%TEMP%\\appointer-originbridge-open\\` 再交给 Origin UI 打开，避免某些目录被 Origin 判定为只读。

### 5.3 验收清单（逐项核对）

执行一次 GUI 或 CLI 后，逐项核对：

1) 输出根目录下出现新的 `job_*` 目录。  
2) `<job>\\.originbridge\\origin_package.zip` 存在且大小 > 0。  
3) `<job>\\pkg\\` 下能看到解压后的 `*.csv`（以及 `*.ogs` 若有）。  
4) `<job>\\.originbridge\\originbridge.log` 包含关键步骤（至少应出现）：
   - `WorkDir: ...`
   - `Using local package ZIP: ...`
   - `Extracting: ... -> ...`
   - `Saving Origin project: ...`
   - `Opening project ...`
5) `<job>\\*.opju` 存在；Origin 自动打开后能看到至少 1 个 GraphPage（曲线已绘制）。

### 5.4 负向验证（故障定位必备）

- 选择未下载完成的文件（例如 `.crdownload`）：应提示“请等待下载完成再选择最终 .zip”。  
- ZIP 内没有 `*.csv`：应失败并弹出 `OriginBridge_error.txt`（见 5.5）。  
- OGS 含 `dlgfile`：日志应提示跳过 OGS，并走 CSV fallback 出图。  
- Origin 未安装或 COM 未注册：应明确报错 “Could not create Origin COM object …”。  

### 5.5 出错时看哪里

- job 级错误文件（worker 失败会自动弹出 Notepad）：`<job>\\OriginBridge_error.txt`  
- worker 日志：`<job>\\.originbridge\\originbridge.log`  

---

## 6) 代码定位（联调时用）

### Appointer（导出 ZIP）

- `src/pages/DeviceAnalysis.jsx`: `handleExportOrigin`
- `src/features/device-analysis/components/AnalysisCharts.jsx`: `buildOriginPackageForFocusedSeries` / `handleDownloadOriginPackage`

### OriginBridge（本地 ZIP 模式）

- UI: `OriginBridge/index.html`（“选择 ZIP 并出图”按钮 -> `open_local_zip`）
- Tauri commands/CLI: `OriginBridge/src-tauri/src/lib.rs`（`open_local_zip` / `--open-zip`）
- Worker: `OriginBridge/src-tauri/src/utils/origin.rs`（PowerShell 脚本参数 `-LocalZip`）
