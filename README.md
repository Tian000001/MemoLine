# ttq-time · 时间线事件记录与智能复盘系统

> 按时间线记录和整理事件，支持图文视频等多媒体素材与聊天记录导入，最后用大模型对整个事件链做梳理分析，生成结构化的复盘报告。

## 项目简介

`ttq-time` 是一个面向「事件复盘」的应用：以时间线为核心，记录带时间、地点、描述、标签的事件，关联图片/视频素材，导入对话记录，再通过大模型对整条事件链进行结构化分析，输出可导出的复盘报告。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端框架 | React 19 + TypeScript + Vite 8 |
| 样式方案 | Tailwind CSS 4 + Radix UI 组件库 |
| 数据请求 | TanStack Query / TanStack Form、React Hook Form |
| 路由 | React Router 7 |
| 可视化 | ECharts 6、Recharts |
| 动画 | Framer Motion、GSAP |
| 后端框架 | NestJS 10（Express 平台）+ Swagger |
| ORM | Drizzle ORM |
| 数据库 | libSQL / SQLite（`file:./data/app.db`） |
| 文件上传 | Multer |
| 大模型接入 | OpenAI 兼容接口（可选，留空走本地结构化 mock） |

要求：**Node ≥ 22**、**npm ≥ 10**。

## 功能模块

### 后端模块（`server`）

- `events` — 事件核心模块：事件 CRUD、筛选搜索、媒体关联、聊天记录导入与解析
- `analysis` — 大模型分析模块：事件范围选择、AI 复盘报告生成、报告导出

### 前端页面（`client`）

- `/`（TimelinePage）— 时间线主界面 + 搜索筛选 + 事件详情
- `/new`（EventFormPage）— 事件录入页面
- `/analysis`（AnalysisPage）— 大模型分析与复盘报告页面

### 数据模型

| 表 | 说明 |
| --- | --- |
| `events` | 事件主表（时间、地点、描述、标签） |
| `event_media` | 事件媒体表（图片/视频文件关联） |
| `event_chat_records` | 事件聊天记录表（导入的对话内容） |
| `analysis_reports` | AI 复盘报告表 |

## 设计规范

### 色彩系统

- 主色：深蓝灰系（专业、沉稳）— 背景 `bg-slate-900`，卡片 `bg-slate-800`
- 强调色：青色 `text-cyan-400` / `border-cyan-500/30`
- 文字：主文字 `text-slate-100`、次文字 `text-slate-400`、辅助 `text-slate-500`
- 边框：`border-slate-700/50`

### 间距基线

- 页面左右内边距：`px-6`（桌面）/ `px-4`（移动端）
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

## 快速开始

### 环境要求

- Node.js ≥ 22
- npm ≥ 10

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env` 并按需修改，关键变量见下方「环境变量」一节。

### 运行开发环境

一条命令同时启动后端（3000）与前端（8080）：

```bash
npm run dev
```

- 前端地址：<http://localhost:8080>
- 后端地址：<http://localhost:3000>
- API 文档（Swagger）：<http://localhost:3000/api>（或 `/api-json`）
- 前端开发服务器已配置将 `/api` 代理到 `http://localhost:3000`

### 构建与生产运行

```bash
# 同时构建服务端（dist/server）与前端（dist/client）
npm run build

# 以生产模式启动（Node 运行 dist/server/main.js）
npm start
```

### 其他脚本

```bash
npm run dev:server     # 仅启动后端（监听改动）
npm run dev:client     # 仅启动前端（Vite）
npm run type:check     # 服务端 + 前端 TypeScript 类型检查
npm run eslint         # 代码 lint
```

## 环境变量（`.env`）

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `LOG_DIR` | 日志目录 | `./logs` |
| `LOG_REQUEST_BODY` | 是否记录请求体 | `false` |
| `LOG_RESPONSE_BODY` | 是否记录响应体 | `false` |
| `DATABASE_URL` | 本地数据库路径（libSQL/SQLite） | `file:./data/app.db` |
| `AI_API_KEY` | 大模型 API Key（OpenAI 兼容），**留空则使用本地结构化 mock** | 空 |
| `AI_BASE_URL` | 大模型接口地址 | 空 |
| `AI_MODEL` | 模型名称 | 空 |

## 目录结构

```
ttq-time/
├── client/        # 前端（React + Vite）
├── server/        # 后端（NestJS）
├── shared/        # 前后端共享代码/类型
├── scripts/       # 辅助脚本
├── .githooks/     # Git 钩子（pre-commit 自动启用）
├── .spark/        # Spark 项目配置
├── .env           # 环境变量
├── package.json
└── AGENTS.md      # 项目说明文档
```

## 代码规范

- 使用 ESLint + TypeScript-ESLint 做静态检查，Prettier 格式化，Stylelint 校验样式。
- 仓库内置 Git 钩子，安装依赖后 `prepare` 脚本会自动设置 `core.hooksPath` 指向 `.githooks`。
- 前端路径别名：`@` / `@client` → `client/src`，`@shared` → `shared`，`@server` → `server`。
