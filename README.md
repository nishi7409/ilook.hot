# ilook.hot

> you want to look hot. abs, a PR, feeling great in your own skin — you define it. we help you get there.

A fitness tracking PWA — workout programs, calorie logging, progressive overload tracking — all in one place. No app store required. Install directly from your browser on iPhone or Android.

**Live:** [ilook.hot](https://ilook.hot) · **Self-hostable** · **100% open source**

---

## Why this exists

Self-hostable fitness apps do exist — [wger](https://wger.de) is probably the most well-known — but I couldn't find one with a UI I actually wanted to use every day. Good enough to work isn't the same as good enough to stick with. So I built what I wanted.

The majority of this app was vibe coded with [Claude Code](https://claude.ai/code). I'm a software engineer by trade and didn't feel like writing all of this from scratch after a full day of work. That said, I designed the entire architecture — data models, scheduling logic, component structure, SSR setup, tech stack decisions. Not completely hands off, I just didn't want to go through the trouble of typing it all out.

---

## Features

- **Program builder** — design your split (push/pull/legs, upper/lower, 5/3/1, whatever), name each day, add exercises with sets/reps
- **Schedule view** — drag training days onto a calendar, set recurrence (every N days/weeks/months), preview before saving
- **iCal sync** — unique per-user subscription URL; add your schedule to Google Calendar, Apple Calendar, or any iCal app
- **Calorie tracking** — powered by Open Food Facts + USDA database, full macro breakdown
- **Workout tracking** — log sets/reps/weight, track progressive overload
- **PWA** — installable on iPhone (Safari → Add to Home Screen) and Android (Chrome → Install app), works offline

---

## Tech stack

| Layer | Choice |
|---|---|
| | **Frontend** |
| Framework | Angular 21 (standalone components, SSR) |
| Styling | Tailwind CSS v4 |
| Calendar | angular-calendar |
| Icons | ng-icons + Heroicons |
| Charts | Apache ECharts (ngx-echarts) |
| Date utils | date-fns |
| State | Angular Signals |
| Rendering | Angular SSR (@angular/ssr) |
| | **Backend** |
| API | Hono (TypeScript-native, runs on Node) |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Auth | Lucia v3 (session cookies, argon2 passwords) |
| | **Infrastructure** |
| Containerization | Docker Compose (postgres + api + web + nginx) |

---

## Getting started

### Prerequisites

- Node.js 20+
- npm 11+
- Docker Desktop (for PostgreSQL)

### First-time setup

```bash
# 1. Start the database
docker compose up postgres -d

# 2. Install API dependencies and run migrations
cd api && npm install && npm run db:migrate && cd ..

# 3. Install frontend dependencies
npm install
```

### Development

Two terminals:

```bash
# Terminal 1 — API (port 3000)
cd api && npm run dev

# Terminal 2 — Angular (port 4200)
npm start
```

App runs at `http://localhost:4200`. Angular proxies `/api` and `/calendar` to the API automatically. Hot reloads on file changes.

### Production (Docker)

```bash
docker compose up --build
```

App runs at `http://localhost:80`. Includes postgres, API, Angular SSR, and nginx reverse proxy — all wired together.

### Tests

```bash
npm test
```

---

## Self-hosting

No need to clone the repo. Download the two files you need and start:

```bash
# 1. Download the prod compose file and nginx config
curl -O https://raw.githubusercontent.com/nishi7409/ilook.hot/main/docker-compose.prod.yml
curl -O https://raw.githubusercontent.com/nishi7409/ilook.hot/main/nginx.conf

# 2. Start everything (pulls pre-built images from GitHub Container Registry)
docker compose -f docker-compose.prod.yml up -d
```

App runs at `http://localhost:80`.

**Environment variables** (optional — set in a `.env` file next to the compose file):

```env
POSTGRES_PASSWORD=change_me   # default: ilook_secret
PORT=80                        # host port nginx binds to
```

The iCal subscription URL is domain-dynamic — it reads `document.location.origin` at runtime so it works on any domain automatically.

Pre-built images are published to [GitHub Container Registry](https://github.com/nishi7409/ilook.hot/pkgs/container/ilook.hot-api) on every release. Pin a specific version by replacing `latest` with a version tag (e.g. `v1.0.0`) in `docker-compose.prod.yml`.

---

## Project structure

```
src/
├── app/
│   ├── components/       # Shared components (auth modal, nav, etc.)
│   ├── models/           # TypeScript interfaces (Program, Exercise, etc.)
│   ├── pages/
│   │   ├── landing/      # Marketing homepage
│   │   ├── programs/     # Program builder + schedule calendar
│   │   ├── workouts/     # Workout logging
│   │   ├── calories/     # Calorie tracking
│   │   └── dashboard/    # Overview
│   └── services/         # ProgramService, etc.
└── styles.css            # Global styles + Tailwind + calendar overrides
```

---

## Contributing

Contributions welcome. This is a passion project — the roadmap includes body measurements, sleep tracking, progress photos, and social features. If you want to help shape it, open a PR or an issue.

[github.com/nishi7409/ilook.hot](https://github.com/nishi7409/ilook.hot)

---

## License

MIT
