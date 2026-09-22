# Changelog — 纪事轴 MemoLine（TTQ-time）

本文件记录 TTQ-time 的版本演进。版本号管理规则：三段各 0~9、逢 10 进 1；改动版本号只用 `node bump_version.js`。

## V1.0.5 (2026-09-21)

### 系统设置页 + 大模型 API 配置
- 导航栏「智能复盘」后新增平级栏目「系统设置」（`settings.html` + `js/settings.js`，图标 settings）。
- 大模型 API 设置页：API Key（密码框/可切换明文，已存 Key 打码显示）/ API 地址 / 模型名；支持「保存设置」「测试连接」（保存前可先试，表单临时值优先）；状态条显示当前来源（设置页已存 / .env / 本地演示 mock）。
- 后端：新增 `app_settings` 键值表（本地 SQLite，Key 明文仅存本机，接口永远打码回传）；`GET/PUT /api/settings/ai`、`POST /api/settings/ai/test`（`routers/settings.py` + `services/settings_service.py`）。
- 配置优先级：设置页保存 > `.env`（AI_API_KEY / AI_BASE_URL / AI_MODEL）> 本地 mock；`analysis_service` 改为**每次生成报告时实时解析配置**，保存后立即生效、无需重启。
- 清空 Key 即回退 mock / .env；Base URL 自动去尾部斜杠；空保存请求返回 400。

### 回归
- py_compile / node --check 全部通过；设置服务冒烟（临时库）：初始来源、保存/打码/尾斜杠、实时 resolve、清除回退、部分更新、空请求 400、无 Key 测试提示 —— 全过。

## V1.0.4 (2026-09-21)

MVP 缺口补齐（产品规划 v0.2 的 MVP 第 ①② 项）：

### 事件类型 type 字段
- `events` 表新增 `event_type` 列（`记事` / `假设` / `待办` / `结论`，默认 `记事`）；旧库启动时自动 `ALTER TABLE` 补列并回填 `记事`，幂等。
- API：`POST /api/events`、`PATCH /api/events/{id}` 支持 `eventType`；`EventItem` / `EventDetail` 返回 `eventType`；列表接口新增 `eventType` 筛选参数。
- 前端：事件表单增加类型下拉（默认记事）；时间线卡片显示类型徽标（记事=灰、假设=琥珀、待办=蓝、结论=绿）；筛选面板增加类型筛选。

### 事件关联 links
- 新增 `event_links` 表（`from_event` / `to_event` / `relation` / `note`，外键级联删除）。
- API：`POST /api/links`（新建关联，禁自关联、禁重复）、`DELETE /api/links/{id}`、`GET /api/events/{id}/links`（双向展开，附对方事件摘要与方向 out/in）；`EventDetail` 内嵌 `links`，`EventItem` 返回 `linkCount`。
- 前端：编辑页新增「关联事件」区块（选目标事件 + 引用/因果/反驳，增删关联）；时间线展开详情显示关联事件并可跳转；卡片显示关联数徽标。

### 回归
- 后端冒烟：建/改类型、默认值、类型筛选、建/查/删关联、双向方向、重复与自关联拦截、级联删除、旧库迁移 —— 全部通过（临时库，不影响 `data/app.db`）。
- 新增版本号管理：`version.js` / `VERSION` / `bump_version.js`。

## V1.0.3 (2026-09-20)

- `run.bat` 重写为纯 cmd 结构（去 PowerShell 依赖），修复双击闪退；启动时自动检测并杀掉占用端口的进程后再启动。

## V1.0.2 (2026-09-19)

- 事件与时间的修改 / 删除功能。
- 生成演示数据；配色对齐 `F:/TTQ/fengshui/` 风格。

## V1.0.1 (2026-09-18)

- 首个可运行版本：FastAPI + SQLite 后端、静态前端（时间线 / 事件录入 / 图片上传 / 分析 Mock）、单端口同源部署与便携运行时。
