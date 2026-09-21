# ttq-time · Timeline Event Logging & Intelligent Review System

> Log and organize events along a timeline. Import multimedia assets (images, video) and chat transcripts, then let a large language model analyze the entire event chain and produce a structured review report.

## Overview

`ttq-time` is an application built around **event retrospectives**. At its core is a timeline where you record events with a timestamp, location, description, and tags; attach image/video assets; and import conversation transcripts. A large language model then runs a structured analysis over the whole event chain and outputs an exportable review report.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend framework | React 19 + TypeScript + Vite 8 |
| Styling | Tailwind CSS 4 + Radix UI component library |
| Data fetching | TanStack Query / TanStack Form, React Hook Form |
| Routing | React Router 7 |
| Visualization | ECharts 6, Recharts |
| Animation | Framer Motion, GSAP |
| Backend framework | NestJS 10 (Express platform) + Swagger |
| ORM | Drizzle ORM |
| Database | libSQL / SQLite (`file:./data/app.db`) |
| File uploads | Multer |
| LLM integration | OpenAI-compatible API (optional; falls back to a local structured mock) |

Requirements: **Node ≥ 22**, **npm ≥ 10**.

## Modules

### Backend modules (`server`)

- `events` — Core event module: event CRUD, filtering & search, media association, chat-record import & parsing
- `analysis` — LLM analysis module: event-range selection, AI review-report generation, report export

### Frontend pages (`client`)

- `/` (TimelinePage) — Timeline main view + search/filter + event detail
- `/new` (EventFormPage) — Event creation page
- `/analysis` (AnalysisPage) — LLM analysis & review-report page

### Data models

| Table | Description |
| --- | --- |
| `events` | Event master table (time, location, description, tags) |
| `event_media` | Event media table (image/video file associations) |
| `event_chat_records` | Event chat-record table (imported conversations) |
| `analysis_reports` | AI review-report table |

## Design System

### Color system

- Primary: dark slate (professional, calm) — background `bg-slate-900`, cards `bg-slate-800`
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

## Getting Started

### Requirements

- Node.js ≥ 22
- npm ≥ 10

### Install dependencies

```bash
npm install
```

### Configure environment

Copy / edit `.env` as needed; see the "Environment Variables" section below.

### Run the dev environment

A single command starts both the backend (3000) and the frontend (8080):

```bash
npm run dev
```

- Frontend: <http://localhost:8080>
- Backend: <http://localhost:3000>
- API docs (Swagger): <http://localhost:3000/api> (or `/api-json`)
- The Vite dev server proxies `/api` to `http://localhost:3000`

### Build & run in production

```bash
# Build both server (dist/server) and client (dist/client)
npm run build

# Start in production mode (Node runs dist/server/main.js)
npm start
```

### Other scripts

```bash
npm run dev:server     # Backend only (watch mode)
npm run dev:client     # Frontend only (Vite)
npm run type:check     # TypeScript type-check (server + client)
npm run eslint         # Lint
```

## Environment Variables (`.env`)

| Variable | Description | Default |
| --- | --- | --- |
| `LOG_DIR` | Log directory | `./logs` |
| `LOG_REQUEST_BODY` | Log request bodies | `false` |
| `LOG_RESPONSE_BODY` | Log response bodies | `false` |
| `DATABASE_URL` | Local database path (libSQL/SQLite) | `file:./data/app.db` |
| `AI_API_KEY` | LLM API key (OpenAI-compatible); **blank → local structured mock** | empty |
| `AI_BASE_URL` | LLM endpoint | empty |
| `AI_MODEL` | Model name | empty |

## Project Structure

```
ttq-time/
├── client/        # Frontend (React + Vite)
├── server/        # Backend (NestJS)
├── shared/        # Shared code / types (client + server)
├── scripts/       # Helper scripts
├── .githooks/     # Git hooks (pre-commit auto-enabled)
├── .spark/        # Spark project config
├── .env           # Environment variables
├── package.json
└── AGENTS.md      # Project documentation
```

## Code Standards

- Static checks via ESLint + TypeScript-ESLint, formatting via Prettier, styles via Stylelint.
- The repo ships Git hooks; after installing dependencies the `prepare` script automatically sets `core.hooksPath` to `.githooks`.
- Frontend path aliases: `@` / `@client` → `client/src`, `@shared` → `shared`, `@server` → `server`.
