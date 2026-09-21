# 时间线事件记录与智能复盘系统

## 应用概览
用于按时间线记录和整理事件，支持图文视频多媒体素材与聊天记录导入，最后用大模型对整个事件链做梳理分析，生成结构化复盘报告。

## 技术架构

技术栈：**FastAPI（Python 3.13）+ 静态 HTML/Tailwind CDN + SQLite**。单端口同源部署，
无构建步骤；便携 Python 运行时内置在 `python/`，整个目录可直接拷到其他 Windows 电脑运行。

### 目录
- `backend/` - FastAPI 服务：`app/main.py`（应用入口/异常处理/静态挂载）、`app/db.py`（建表）、
  `app/schemas.py`（Pydantic 模型）、`app/routers/{events,analysis,media}.py`、
  `app/services/{events,analysis}_service.py`、`app/utils/{chat_parser,ai_report_parser}.py`
- `frontend/` - 静态前端：`index.html`（时间线）、`event.html`（录入/编辑）、`analysis.html`（复盘）、
  `404.html`、`js/{api,ui,timeline,event,analysis}.js`、`css/app.css`
- `python/` - 内置便携 Python 运行时（已预装依赖，不入 git）
- `scripts/check_commit.py` - pre-commit 校验脚本
- `legacy/` - 旧的 NestJS + React 实现，仅作参考

### 后端模块
- `events` - 事件核心模块：事件 CRUD、筛选搜索、媒体关联、聊天记录导入与解析
- `analysis` - 大模型分析模块：事件范围选择、AI 复盘报告生成、报告导出
- `media` - 媒体上传（`/api/media/upload`）与静态访问（`/api/media/<file>`）

### 前端页面
- `/index.html` - 时间线主界面 + 搜索筛选 + 事件详情
- `/event.html` - 事件录入 / 编辑页面（`?id=` 进入编辑模式）
- `/analysis.html` - 大模型分析与复盘报告页面

### 数据模型
- `events` - 事件主表（时间、地点、描述、标签）
- `event_media` - 事件媒体表（图片/视频文件关联）
- `event_chat_records` - 事件聊天记录表（导入的对话内容）
- `analysis_reports` - AI 复盘报告表

## 设计规范

### 色彩系统
- 主色：深蓝灰系（专业、沉稳），`bg-slate-900` 背景，`bg-slate-800` 卡片
- 强调色：青色 `text-cyan-400` / `border-cyan-500/30`
- 文字：主文字 `text-slate-100`，次文字 `text-slate-400`，辅助 `text-slate-500`
- 边框：`border-slate-700/50`

### 间距基线
- 页面左右内边距：`px-6` (桌面) / `px-4` (移动端)
- 卡片内边距：`p-5`
- 区块间距：`gap-6`
- 元素间距：`gap-3`

### 排版层级
- 页面标题：`text-2xl font-semibold tracking-tight`
- 卡片标题：`text-lg font-medium`
- 正文：`text-sm leading-relaxed`
- 辅助文字：`text-xs`

### 组件风格
- 卡片：`rounded-xl bg-slate-800/60 border border-slate-700/50 backdrop-blur-sm`
- 按钮：主按钮 `bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-medium`
- 时间线：左侧竖线 + 圆点节点，节点 hover 高亮
- 标签：`px-2 py-0.5 text-xs rounded-full bg-slate-700/80 text-slate-300`
