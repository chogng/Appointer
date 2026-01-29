# Docs / 文档索引

本目录存放 Appointer 的设计规范（Specs）与联调/排障手册（Runbooks）。  
建议阅读顺序：先看根目录 [`README.md`](../README.md)（架构/快速开始/运行模式），再按需查阅本目录细分文档。

---

## UI 组件规范（Components）

- [`button_component_spec.md`](./button_component_spec.md)：基础 Button（点击按钮）DOM/A11y/类名约定
- [`card_component_spec.md`](./card_component_spec.md)：Card（v2）
- [`input_component_spec.md`](./input_component_spec.md)：Input（UI）规范
- [`focus_indicator_spec.md`](./focus_indicator_spec.md)：Keyboard-only focus halo 规范
- [`textarea_ui_component_spec.md`](./textarea_ui_component_spec.md)：Textarea（UI）规范（复用 Input 体系）
- [`dropdown_ui_component_spec.md`](./dropdown_ui_component_spec.md)：Dropdown（UI）规范
- [`popup_ui_component_spec.md`](./popup_ui_component_spec.md)：Popup（Dropdown menu 等弹层容器）
- [`tabs_ui_component_spec.md`](./tabs_ui_component_spec.md)：Tabs（UI）规范
- [`date_button_component_spec.md`](./date_button_component_spec.md)：DateButton（DatePicker 点击区域）规范
- [`modal_ui_component_spec.md`](./modal_ui_component_spec.md)：Modal（对话框/弹窗）
- [`toast_ui_component_spec.md`](./toast_ui_component_spec.md)：Toast（通知条）
- [`switch_ui_component_spec.md`](./switch_ui_component_spec.md)：Switch（开关）
- [`segmented_control_ui_component_spec.md`](./segmented_control_ui_component_spec.md)：SegmentedControl（分段选择器）
- [`tabs_component_spec.md`](./tabs_component_spec.md)：Tabs（Legacy）规范（弃用/仅历史参考）

### 其它 UI 组件（当前无独立 spec）

- [`../src/components/ui/DatePicker.jsx`](../src/components/ui/DatePicker.jsx)：日期选择（DateButton 规范见 [`date_button_component_spec.md`](./date_button_component_spec.md)）

---

## Device Analysis（CSV）相关（Specs）

- [`gm_spec_v1.md`](./gm_spec_v1.md)：gm（导数/跨 X 取值）计算与导出规范（双语）
- [`onoff_spec_v1.md`](./onoff_spec_v1.md)：Ion/Ioff 指标计算规范（双语）
- [`ssfit_spec_v1.md`](./ssfit_spec_v1.md)：SS Fit 拟合规范（双语）

---

## Origin 集成（Web → Local Origin）

- [`origin_integration_spec_v1.md`](./origin_integration_spec_v1.md)：总体方案与选型（双语）
- [`origin_open_in_origin_runbook.md`](./origin_open_in_origin_runbook.md)：已落地 “Open in Origin” 端到端流程与排障手册
- [`origin_open_in_origin_spec_v2.md`](./origin_open_in_origin_spec_v2.md)：v2（点击先拉起 OB + OB 自行拉包落盘）方案与本地验证对照
- [`origin_open_in_origin_originbridge_impl_v2.md`](./origin_open_in_origin_originbridge_impl_v2.md)：OriginBridge 侧补齐 v2 的实现步骤（404 轮询/退避/验证）
- [`origin_local_zip_mode_runbook.md`](./origin_local_zip_mode_runbook.md)：Local ZIP Mode（不走后端/不走协议）的本地出图流程与排障

---

## 页面/选择器/测试相关

- [`literature_research_page_spec.md`](./literature_research_page_spec.md)：Literature Research 页面稳定锚点（便于自动化/脚本）
- [`device_analysis_page_spec.md`](./device_analysis_page_spec.md)：Device Analysis 页面稳定锚点（便于自动化/脚本）
- [`stable_selectors_spec.md`](./stable_selectors_spec.md)：稳定选择器与 UI 标记规范（`data-*` 等约定）

---

## 后端部署与数据库（位于 `server/`）

- [`server/README.md`](../server/README.md)：后端快速开始与运行方式
- [`server/DOCKER_MYSQL.md`](../server/DOCKER_MYSQL.md)：MySQL（Docker）启动与配置
- [`server/MYSQL_MIGRATION.md`](../server/MYSQL_MIGRATION.md)：SQLite → MySQL 迁移说明
- [`server/docker-compose.yml`](../server/docker-compose.yml)：本地/容器化 MySQL 示例

---

## 工程质量（Engineering）

- [`code_review_2026-01-14.md`](./code_review_2026-01-14.md)：代码审查记录与整改实践（含逻辑链与验证）

---

## 文档维护约定（建议）

- Specs 尽量包含：`Version`、`Date`、`Scope`（或中文等价字段），并在开头说明目标读者与适用范围。
- 如涉及代码位置，优先给出可直接搜索的函数名/文件路径（便于快速定位）。
- 如新增/废弃文档，请同步更新本索引。
