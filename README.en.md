# ttq-time · Timeline Event Logging & Intelligent Review System

> Log and organize events along a timeline. Import multimedia assets (images, video) and chat transcripts, then let a large language model analyse the entire event chain and produce a structured review report.

## Overview

`ttq-time` is built around **event retrospectives**. At its core is a timeline where you record events with a timestamp, location, description and tags; attach image/video assets; and import conversation transcripts. A large language model then runs a structured analysis over the whole event chain and outputs an exportable review report.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend framework | **FastAPI** (Python 3.13) + Uvicorn |
| Validation | Pydantic v2 |
| Database | **SQLite** (stdlib `sqlite3`, no ORM) |
| Frontend | **Static HTML + vanilla JavaScript**, Tailwind CSS via CDN (zero build) |
| Icons | Lucide (CDN) |
| LLM integration | OpenAI-compatible API (stdlib `urllib`); blank key falls back to a local structured mock |
| Deployment shape | Single port, same origin: one process serves both the pages and `/api` |

Requirements: **no runtime installation needed** — a portable Python runtime is bundled in `python/`, so copying the folder is enough.

## Getting Started

### Option 1: double-click (recommended)

Double-click **`run.bat`** in the project root. It will:

- prefer the bundled runtime `python\python.exe`, falling back to a system Python;
- verify dependencies and install them if missing (default index first, official PyPI as fallback);
- open the browser at <http://127.0.0.1:3000/index.html>;
- run the server in the foreground of that window — **press Ctrl+C to stop**.

Development mode (auto-reload):

```bat
run.bat dev
```

Override port / bind address with environment variables:

```bat
set TTQ_PORT=8088
set TTQ_HOST=0.0.0.0
run.bat
```

### Option 2: start manually

```bash
# bundled runtime
python\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 3000

# or a system Python (install deps first)
python -m pip install -r backend/requirements.txt
cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 3000
```

- App: <http://127.0.0.1:3000/>
- API docs (Swagger): <http://127.0.0.1:3000/docs>

## Copying to another machine

Copy the **whole project folder** and double-click `run.bat` — no Python installation required.

1. **Copy everything**, including `python\`. Copying source only means the target machine needs Python 3.11+ plus `pip install -r backend/requirements.txt`.
2. The **bundled runtime is Windows x64 only**. For macOS / Linux / ARM, delete `python\`, install Python 3.11+, then install the requirements.
3. The `legacy\` folder (the previous NestJS + React implementation plus the old portable Node runtime and `node_modules`) **can be deleted entirely** — the new version does not use it.

## Environment Variables (`.env`)

| Variable | Description | Default |
| --- | --- | --- |
| `SERVER_HOST` | Bind address (read only when starting manually) | `127.0.0.1` |
| `SERVER_PORT` | Bind port (read only when starting manually) | `3000` |
| `DATABASE_PATH` | SQLite database path | `./data/app.db` |
| `UPLOADS_DIR` | Upload directory | `./uploads` |
| `FRONTEND_DIR` | Static frontend directory | `./frontend` |
| `AI_API_KEY` | LLM API key (OpenAI-compatible); **blank → local structured mock** | empty |
| `AI_BASE_URL` | LLM endpoint | `https://api.openai.com/v1` |
| `AI_MODEL` | Model name | `gpt-4o-mini` |

> The legacy `DATABASE_URL=file:./data/app.db` form is still supported.

## Modules

### Backend (`backend/`)

- `events` — CRUD, filtering by keyword/location/tag/time range, media association, chat-record import & parsing
- `analysis` — review reports by time range or explicit event list (generated in the background, polled by the UI)
- `media` — upload (`/api/media/upload`) and static serving (`/api/media/<file>`)

### Frontend pages (`frontend/`)

- `index.html` — timeline + search/filter + expandable event detail
- `event.html` — event create/edit (`?id=<eventId>` for edit mode)
- `analysis.html` — report creation, report list, structured detail panel
- `404.html` — not-found page

### Data models

| Table | Description |
| --- | --- |
| `events` | Event master table (time, location, description, tags) |
| `event_media` | Event media table (image/video file associations) |
| `event_chat_records` | Event chat-record table (imported conversations) |
| `analysis_reports` | AI review-report table |

> The schema is identical to the previous version, so an existing `data/app.db` works as-is — no migration needed.

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/events` | List (`page`/`pageSize`/`keyword`/`location`/`tag`/`startTime`/`endTime`) |
| GET | `/api/events/{id}` | Detail (with media and chat records) |
| POST | `/api/events` | Create (accepts `media` / `chatRecords` / `chatRecordText`) |
| PATCH | `/api/events/{id}` | Update |
| DELETE | `/api/events/{id}` | Delete (cascades to media and chat records) |
| POST | `/api/events/parse-chat` | Parse chat transcript text |
| POST | `/api/media/upload` | Upload media (multipart field `file`, 200MB limit) |
| GET | `/api/media/{filename}` | Serve an uploaded file |
| GET | `/api/analysis/reports` | Report list |
| GET | `/api/analysis/reports/{id}` | Report detail |
| POST | `/api/analysis/reports` | Create report (returns `pending`, generated in background) |
| DELETE | `/api/analysis/reports/{id}` | Delete report |

Errors are normalised as:

```json
{ "error": { "code": "NOT_FOUND", "message": "事件不存在", "timestamp": 1789969864333 } }
```

## Design System

### Color system

- Primary: dark slate — background `bg-slate-900`, cards `bg-slate-800`
- Accent: cyan `text-cyan-400` / `border-cyan-500/30`
- Text: primary `text-slate-100`, secondary `text-slate-400`, muted `text-slate-500`
- Borders: `border-slate-700/50`

### Spacing baseline

- Page horizontal padding: `px-6` (desktop) / `px-4` (mobile)
- Card padding: `p-5`
- Section gap: `gap-6`
- Element gap: `gap-3`

### Typography scale

- Page title: `text-2xl font-semibold tracking-tight`
- Card title: `text-lg font-medium`
- Body: `text-sm leading-relaxed`
- Helper text: `text-xs`

### Component style

- Card: `rounded-xl bg-slate-800/60 border border-slate-700/50 backdrop-blur-sm`
- Button: primary `bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-medium`
- Timeline: vertical line on the left + dot nodes, nodes highlight on hover
- Tag: `px-2 py-0.5 text-xs rounded-full bg-slate-700/80 text-slate-300`

## Project Structure

```
ttq-time/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py          # entry point: routers, error handling, static mounts
│   │   ├── config.py        # config + .env loading (paths derived from __file__)
│   │   ├── db.py            # SQLite connection + idempotent schema bootstrap
│   │   ├── schemas.py       # Pydantic request/response models
│   │   ├── errors.py        # domain exceptions
│   │   ├── routers/         # events / analysis / media
│   │   ├── services/        # event + analysis business logic
│   │   └── utils/           # chat parsing, report parsing, time helpers
│   ├── capabilities/        # LLM prompt configuration
│   └── requirements.txt
├── frontend/                # static frontend (Tailwind CDN, zero build)
├── python/                  # bundled portable Python runtime (not committed)
├── data/app.db              # SQLite (created at runtime)
├── uploads/                 # uploaded media (created at runtime)
├── scripts/check_commit.py  # pre-commit checks
├── legacy/                  # previous NestJS + React implementation (reference only)
├── .githooks/pre-commit
└── run.bat
```

## Code Standards & Git Hooks

- On commit, **only staged** files are checked:
  - `*.py` — `ast.parse` syntax check (code is never executed)
  - `*.bat` / `*.cmd` — must be **pure ASCII + CRLF + no BOM** (non-ASCII bytes break `cmd.exe` on GBK consoles)
- Enable the hook once per clone:

```bash
git config core.hooksPath .githooks
```

- Skip for one commit: `SKIP_GIT_HOOKS=1 git commit ...`

## Known Caveats

1. The frontend loads **Tailwind and Lucide from CDNs** (`cdn.tailwindcss.com`, `unpkg.com`). In offline/air-gapped environments the pages will lose styling and icons, though the API still works. For fully offline use, vendor both libraries into `frontend/vendor/` and reference them locally.
2. The bundled Uvicorn setup is a solid single-process ASGI server, but multi-worker scaling and HTTPS termination are not configured — add a reverse proxy for those.
