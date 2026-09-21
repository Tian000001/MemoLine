# ttq-time · 时间线事件记录与智能复盘系统

> 按时间线记录和整理事件，支持图文视频等多媒体素材与聊天记录导入，最后用大模型对整个事件链做梳理分析，生成结构化的复盘报告。

## 项目简介

`ttq-time` 是一个面向「事件复盘」的应用：以时间线为核心，记录带时间、地点、描述、标签的事件，关联图片/视频素材，导入对话记录，再通过大模型对整条事件链进行结构化分析，输出可导出的复盘报告。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 后端框架 | **FastAPI**（Python 3.13）+ Uvicorn |
| 数据校验 | Pydantic v2 |
| 数据库 | **SQLite**（Python 标准库 `sqlite3`，无 ORM） |
| 前端 | **静态 HTML + 原生 JavaScript**，Tailwind CSS（CDN，零构建） |
| 图标 | Lucide（CDN） |
| 大模型接入 | OpenAI 兼容接口（标准库 `urllib` 调用）；留空走本地结构化 mock |
| 部署形态 | 单端口同源：一个进程同时提供前端页面与 `/api` |

要求：**无需安装任何运行时**。项目内置便携 Python（`python/`），直接拷贝文件夹即可运行。

## 快速开始

### 方式一：双击启动（推荐）

双击项目根目录的 **`run.bat`**：

- 自动优先使用内置运行时 `python\python.exe`，找不到才回退系统 Python；
- 自动检查依赖，缺失时尝试安装（先默认源，失败再回退官方 PyPI）；
- 打开浏览器到 <http://127.0.0.1:3000/index.html>；
- 服务在当前窗口前台运行，**按 Ctrl+C 停止**。

开发模式（改代码自动重载）：

```bat
run.bat dev
```

自定义端口 / 监听地址（用环境变量覆盖）：

```bat
set TTQ_PORT=8088
set TTQ_HOST=0.0.0.0
run.bat
```

### 方式二：手动启动

```bash
# 内置运行时
python\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 3000

# 或者用系统 Python（需先装依赖）
python -m pip install -r backend/requirements.txt
cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 3000
```

访问地址：

- 应用主页：<http://127.0.0.1:3000/>
- 接口文档（Swagger）：<http://127.0.0.1:3000/docs>
- 接口前缀：`/api`

## 拷到其他电脑

把**整个项目文件夹**拷过去，双击 `run.bat` 即可，无需预装 Python。

需要注意：

1. **建议整体拷贝**，包含 `python\`（内置运行时）。只拷源码的话目标机器需要自备 Python 3.11+ 并装依赖。
2. **内置运行时是 Windows x64 专用**。拷到 macOS / Linux / ARM 需要删掉 `python\`，装好 Python 3.11+ 后 `pip install -r backend/requirements.txt` 再启动。
3. `legacy\` 目录（旧的 NestJS + React 实现 + 旧的便携 Node 运行时 + 旧的 `node_modules`）**可以整个删掉**，新版本完全不用它。

## 环境变量（`.env`）

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `SERVER_HOST` | 监听地址（仅手动启动时读取） | `127.0.0.1` |
| `SERVER_PORT` | 监听端口（仅手动启动时读取） | `3000` |
| `DATABASE_PATH` | SQLite 数据库路径 | `./data/app.db` |
| `UPLOADS_DIR` | 上传文件目录 | `./uploads` |
| `FRONTEND_DIR` | 前端静态目录 | `./frontend` |
| `AI_API_KEY` | 大模型 API Key（OpenAI 兼容），**留空则使用本地结构化 mock** | 空 |
| `AI_BASE_URL` | 大模型接口地址 | `https://api.openai.com/v1` |
| `AI_MODEL` | 模型名称 | `gpt-4o-mini` |

> 兼容旧的 `DATABASE_URL=file:./data/app.db` 写法。

## 功能模块

### 后端（`backend/`）

- `events` — 事件核心：CRUD、按关键词/地点/标签/时间区间筛选、媒体关联、聊天记录导入与解析
- `analysis` — 大模型复盘：按时间范围或指定事件生成结构化报告（后台异步生成，前端轮询状态）
- `media` — 媒体上传（`/api/media/upload`）与静态访问（`/api/media/<file>`）

### 前端页面（`frontend/`）

- `index.html` — 时间线主界面 + 搜索筛选 + 事件详情展开（详情区内含编辑/删除按钮，编辑跳转本页 `?id=` 模式，删除需确认）
- `event.html` — 事件录入 / 编辑（`?id=<事件ID>` 进入编辑模式）
- `analysis.html` — 智能复盘：创建报告 + 报告列表 + 结构化详情
- `404.html` — 未找到页面

### 数据模型

| 表 | 说明 |
| --- | --- |
| `events` | 事件主表（时间、地点、描述、标签） |
| `event_media` | 事件媒体表（图片/视频文件关联） |
| `event_chat_records` | 事件聊天记录表（导入的对话内容） |
| `analysis_reports` | AI 复盘报告表 |

> 表结构与旧版本完全一致，可直接复用旧的 `data/app.db`，无需数据迁移。

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/events` | 事件列表（`page`/`pageSize`/`keyword`/`location`/`tag`/`startTime`/`endTime`） |
| GET | `/api/events/{id}` | 事件详情（含媒体与聊天记录） |
| POST | `/api/events` | 创建事件（可带 `media` / `chatRecords` / `chatRecordText`） |
| PATCH | `/api/events/{id}` | 更新事件 |
| DELETE | `/api/events/{id}` | 删除事件（级联删除媒体与聊天记录） |
| POST | `/api/events/parse-chat` | 解析聊天记录文本 |
| POST | `/api/media/upload` | 上传媒体（multipart，字段名 `file`，单文件上限 200MB） |
| GET | `/api/media/{filename}` | 访问已上传的媒体 |
| GET | `/api/analysis/reports` | 报告列表 |
| GET | `/api/analysis/reports/{id}` | 报告详情 |
| POST | `/api/analysis/reports` | 创建报告（立即返回 pending，后台生成） |
| DELETE | `/api/analysis/reports/{id}` | 删除报告 |

错误统一返回：

```json
{ "error": { "code": "NOT_FOUND", "message": "事件不存在", "timestamp": 1789969864333 } }
```

## 设计规范

### 配色（集中定义于 `frontend/js/theme.js`）

- 配色参照 `F:\TTQ\TTQ-Solo-Linux` 呼吸心跳页截图采样得到，通过 Tailwind CDN 的
  `tailwind.config` **整体重映射** `slate / cyan / blue` 三个色阶，页面类名无需改动即换肤。
- 背景/文字：页面底 `#0E141C`（slate-900）、卡片 `#101826`（slate-800）、主文字 `#E8EDF5`、次文字 `#667484`
- 边框/标签：带青调的 `#223B3C`（slate-700），形成 HUD 描边感
- 主强调：薄荷绿 `#00F5A0`（cyan-500，按钮/时间点/图标/时间线光晕）；亮态 `#4DFAAE`、暗态 `#03A470`
- 状态色：生成中 天蓝 `#60A5FA`（blue-400）；完成/失败/疑点沿用 emerald/red/amber 默认色

### 色彩系统（组件层面沿用类名约定）

参照 `F:\TTQ\fengshui`「观象台」系列页面的墨底鎏金中式暗色主题，全部色值经 `frontend/js/theme.js` 对 Tailwind 色阶整体重映射落地（想调色只改这一个文件）：

- 底色：暖墨黑系 — 背景 `bg-slate-900`（#11110F），卡片 `bg-slate-800`（#1A1815），边框为金调描边（#2E2819）
- 主强调色：鎏金 `text-cyan-400`（#D8C27A）/ `bg-cyan-500`（#C9A44C）/ `border-cyan-500/30`
- 语义色：成功绿 `#36A766`、警示暖橙 `#FF9A6A`、危险红 `#FF6F6F`、状态天蓝 `#9DB4FF`
- 文字：主文字 `text-slate-100`（#F0EEE8）、次文字 `text-slate-400`（#A0A09E）、辅助 `text-slate-500`（#6D6D6B）

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

## 目录结构

```
ttq-time/
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── main.py          # 应用入口：路由、异常处理、静态挂载
│   │   ├── config.py        # 配置与 .env 读取（路径基于本文件推导）
│   │   ├── db.py            # SQLite 连接与幂等建表
│   │   ├── schemas.py       # Pydantic 请求/响应模型
│   │   ├── errors.py        # 领域异常
│   │   ├── routers/         # events / analysis / media 路由
│   │   ├── services/        # 事件、复盘业务逻辑
│   │   └── utils/           # 聊天解析、报告解析、时间工具
│   ├── capabilities/        # 大模型提示词配置
│   └── requirements.txt
├── frontend/                # 静态前端（Tailwind CDN，零构建）
│   ├── index.html           # 时间线
│   ├── event.html           # 事件录入/编辑
│   ├── analysis.html        # 智能复盘
│   ├── 404.html
│   ├── css/app.css
│   └── js/{api,ui,timeline,event,analysis}.js
├── python/                  # 内置便携 Python 运行时（不入 git）
├── data/app.db              # SQLite（运行时生成）
├── uploads/                 # 上传的媒体（运行时生成）
├── scripts/
│   ├── check_commit.py      # pre-commit 校验（Python 语法 + .bat 编码）
│   ├── e2e_test.py          # 端到端回归测试（真实 HTTP，自建自删测试数据）
│   ├── demo_data.py         # 演示数据生成 / 清理（--clean）
│   ├── demo_media/          # 演示用占位图片
│   └── frontend_smoke.js    # 前端渲染冒烟（Node + 桩 DOM）
├── legacy/                  # 旧的 NestJS + React 实现（仅供参考，可删）
├── .githooks/pre-commit     # Git 钩子
├── .env / .env.example
└── run.bat                  # 一键启动
```

## 代码规范与 Git 钩子

- 提交前会校验 **本次暂存** 的文件：
  - `*.py` — `ast.parse` 语法检查（不执行代码）
  - `*.bat` / `*.cmd` — 必须是**纯 ASCII + CRLF + 无 BOM**（否则 `cmd.exe` 在 GBK 控制台会解析崩溃）
- 启用钩子（克隆后执行一次即可；`run.bat` 每次启动也会静默执行一遍，通常无需手动操作）：

```bash
git config core.hooksPath .githooks
```

- 临时跳过：`SKIP_GIT_HOOKS=1 git commit ...`

## 演示数据

想快速看到有内容的时间线和复盘报告，可以灌一批带「演示」标记的数据（12 条事件 + 5 张占位图 + 3 份报告）：

```bat
python\python.exe scripts\demo_data.py --spawn
```

- **不触碰已有真实数据**：演示事件全部带 `演示` 标签、描述以 `【演示】` 开头，报告标题以 `【演示】` 开头；
- 可重复执行（幂等，先清后建）；清单写在 `data/demo_manifest.json`；
- 清除全部演示数据：`python\python.exe scripts\demo_data.py --clean`（连演示图片文件一起删）。

## 自检 / 回归测试

改完代码想确认没搞坏东西，跑这两条即可（都不碰本地既有数据）：

```bat
rem 1) 端到端回归：自动起服务 -> 打一遍真实 HTTP -> 自动关服务
python\python.exe scripts\e2e_test.py --spawn

rem 2) 前端渲染冒烟：用 Node + 桩 DOM 依次渲染三个页面，捕捉运行时报错
legacy\node\node.exe scripts\frontend_smoke.js
```

- `e2e_test.py` 覆盖静态页面与资源、事件 CRUD 与各类筛选、聊天记录解析、媒体上传 + 静态访问、
  复盘报告生成（mock）、404 / 422 错误行为；测试数据全部自建自删，结束时校验事件总数回到基线。
  退出码 0 = 全通过；报告同时写入 `e2e-report.txt`（已在 `.gitignore` 中）。
  服务已在跑时可省掉 `--spawn`，直接打默认的 <http://127.0.0.1:3000>；换地址用 `--base`。
- `frontend_smoke.js` 需要任意 Node（项目 `legacy\node\` 里有便携版；删了 `legacy\` 就用系统 Node）。
  它把 `localStorage` / `document` / `fetch` 打成桩，真实执行页面脚本并断言渲染结果。

## 已知注意事项

1. **前端依赖 Tailwind 与 Lucide 的 CDN**（`cdn.tailwindcss.com`、`unpkg.com`）。离线/内网环境页面会没有样式与图标，但接口与功能仍可用。若要完全离线，需把这两个库下载到 `frontend/vendor/` 并改为本地引用。
2. 生产环境下建议用 `run.bat dev` 之外的方式托管（当前启动方式已带 Uvicorn 生产级 ASGI 服务，但未配置多 worker / HTTPS 反向代理）。
