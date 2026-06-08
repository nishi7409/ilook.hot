<p align="center">
  <img src="public/logo.png" alt="ilook.hot" width="260">
</p>

<p align="center">
  <strong>you want to look hot.</strong> abs, a PR, feeling great in your own skin — you define it. we help you get there.
</p>

<p align="center">
  <a href="https://ilook.hot">ilook.hot</a> · Self-hostable · 100% open source · PWA
</p>

---

A fitness tracking PWA — workout programs, calorie logging, barcode food scanning, progressive overload tracking, progress photos, nutrition analytics — all in one place. No app store required. Install directly from your browser on iPhone or Android.

## Why this exists

Self-hostable fitness apps do exist — [wger](https://wger.de) is probably the most well-known — but I couldn't find one with a UI I actually wanted to use every day. Good enough to work isn't the same as good enough to stick with. So I built what I wanted.

The majority of this app was vibe coded with [Claude Code](https://claude.ai/code). I'm a software engineer by trade and didn't feel like writing all of this from scratch after a full day of work. That said, I designed the entire architecture — data models, scheduling logic, component structure, SSR setup, tech stack decisions. Not completely hands off, I just didn't want to go through the trouble of typing it all out.

---

## Features

### Training
- **Program builder** — design your split (push/pull/legs, upper/lower, 5/3/1, whatever), name each day, add exercises with sets/reps. 7 built-in templates to get started.
- **Schedule view** — drag training days onto a calendar, set recurrence (every N days/weeks/months), preview before saving
- **iCal sync** — unique per-user subscription URL; add your schedule to Google Calendar, Apple Calendar, or any iCal app
- **Workout tracking** — log sets/reps/weight during your session, track progressive overload, auto-detect personal records
- **Rest timer** — configurable countdown timer between sets during active workouts
- **Exercise demo links** — top exercises link to free [ExRx.net](https://exrx.net) demonstrations

### Nutrition
- **Calorie tracking** — continuous food log with full macro breakdown (protein, carbs, fat)
- **Food search** — powered by [Open Food Facts](https://openfoodfacts.org) + [USDA FoodData Central](https://fdc.nal.usda.gov/) — no paywall, no upsells
- **Barcode scanner** — scan a product barcode with your camera; auto-looks up nutrition data and logs it instantly (native BarcodeDetector on Android/iOS, zxing fallback on desktop)
- **Meal type tagging** — categorize entries as breakfast, lunch, dinner, or snack
- **Nutrition trends** — calorie trend line chart, stacked macro area chart, period averages, and protein streak counter (7d / 30d / 90d views)
- **Water intake** — daily water goal with quick-add buttons, tracks progress on the dashboard

### Analytics
- **Dashboard** — today's workout, calorie ring, macro progress bars, 7-day calorie trend, top exercise progression chart
- **Estimated 1RM** — Epley formula calculations for each exercise with trend indicators
- **Volume tracking** — volume per muscle group over time (12-week stacked bar chart)
- **Training heatmap** — 365-day GitHub-style contribution grid showing workout frequency
- **Workout streaks** — current streak, longest streak, weekly consistency

### Body & Progress
- **Progress photos** — upload front/side/back photos, gallery view grouped by date, side-by-side comparison with weight tracking
- **Data export** — download all your data as JSON (programs, workouts, nutrition, photos) or workouts as CSV

### App
- **PWA** — installable on iPhone (Safari → Add to Home Screen) and Android (Chrome → Install app), works offline
- **Theme** — dark, light, or system (auto-detects OS preference, updates live)
- **Landing page stats** — shows GitHub stars, forks, and total users (cached, refreshes every 15 minutes)

---

## Tech stack

| Layer | Choice |
|---|---|
| | **Frontend** |
| Framework | Angular 20 (standalone components, signals, SSR) |
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
| Food data | Open Food Facts API + USDA FoodData Central API |
| | **Infrastructure** |
| Containerization | Docker Compose (postgres + api + web + nginx) |
| CI/CD | GitHub Actions → GHCR (auto-release on merge to master) |

---

## Getting started

### Prerequisites

- Node.js 20+
- npm 11+
- Docker Desktop (for PostgreSQL)

### First-time setup

```bash
# 1. Clone the repo
git clone https://github.com/nishi7409/ilook.hot.git
cd ilook.hot

# 2. Copy the example env file
cp .env.example .env

# 3. Start the database
docker compose up postgres -d

# 4. Install API dependencies and run migrations
cd api && npm install && npm run db:migrate && cd ..

# 5. Install frontend dependencies
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

## Environment variables

### API server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgresql://ilook:***@localhost:5432/ilook` | PostgreSQL connection string |
| `PORT` | No | `3000` | Port the API server listens on |
| `NODE_ENV` | No | `development` | Set to `production` for secure cookies and optimized builds |
| `ALLOWED_ORIGINS` | No | `http://localhost:4200,http://localhost:4000` | Comma-separated list of allowed CORS origins. Set this to your domain in production (e.g. `https://ilook.hot`) |
| `USDA_API_KEY` | No | `DEMO_KEY` | [USDA FoodData Central API key](https://fdc.nal.usda.gov/api-key-signup.html). The demo key works but has lower rate limits. Free to register. |

### Docker Compose (self-hosting)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_PASSWORD` | No | `ilook_secret` | Password for the PostgreSQL database. **Change this in production.** |
| `PORT` | No | `80` | Host port that nginx binds to |

Set these in a `.env` file next to your `docker-compose.prod.yml`:

```env
POSTGRES_PASSWORD=your_secure_password_here
PORT=80
ALLOWED_ORIGINS=https://yourdomain.com
USDA_API_KEY=your_key_here
```

> **Note:** The `DATABASE_URL` inside the Docker network is pre-configured in the compose file and uses the internal `postgres` hostname. You don't need to set it manually unless you're using an external database.

---

## Self-hosting

No need to clone the repo. Download the two files you need and start:

```bash
# 1. Download the prod compose file and nginx config
curl -O https://raw.githubusercontent.com/nishi7409/ilook.hot/master/docker-compose.prod.yml
curl -O https://raw.githubusercontent.com/nishi7409/ilook.hot/master/nginx.conf

# 2. (Optional) Create a .env file
cat > .env << EOF
POSTGRES_PASSWORD=change_me_to_something_secure
ALLOWED_ORIGINS=https://yourdomain.com
EOF

# 3. Start everything (pulls pre-built images from GitHub Container Registry)
docker compose -f docker-compose.prod.yml up -d
```

App runs at `http://localhost:80`.

The iCal subscription URL is domain-dynamic — it reads `document.location.origin` at runtime so it works on any domain automatically.

Pre-built images are published to [GitHub Container Registry](https://github.com/nishi7409/ilook.hot/pkgs/container/ilook.hot-api) on every release. Pin a specific version by replacing `latest` with a version tag (e.g. `v0.0.12`) in `docker-compose.prod.yml`.

### Updating

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Database migrations run automatically on API startup — no manual migration step needed.

### Cutting a release

Releases are automatic. Every merge to `master` triggers GitHub Actions to:
1. Auto-increment the version tag (`v0.0.x`)
2. Build and push Docker images to GHCR
3. Create a GitHub Release with auto-generated notes

No manual tagging needed.

---

## API reference

All endpoints are prefixed with `/api` except the calendar feed.

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| **Auth** | | | |
| `POST` | `/api/auth/signup` | No | Create account |
| `POST` | `/api/auth/signin` | No | Sign in (rate limited: 10/15min per IP) |
| `POST` | `/api/auth/signout` | Yes | Sign out |
| `GET` | `/api/auth/me` | No | Get current user or `null` |
| **Programs** | | | |
| `GET` | `/api/programs` | Yes | List all programs with days & exercises |
| `POST` | `/api/programs` | Yes | Create blank program |
| `GET` | `/api/programs/templates` | Yes | List program templates |
| `POST` | `/api/programs/from-template` | Yes | Create from template |
| `POST` | `/api/programs/:id/duplicate` | Yes | Deep-copy a program |
| `PATCH` | `/api/programs/:id` | Yes | Update program |
| `DELETE` | `/api/programs/:id` | Yes | Delete program |
| `POST` | `/api/programs/:id/activate` | Yes | Set as active program |
| `POST` | `/api/programs/:id/days` | Yes | Add day |
| `PATCH` | `/api/programs/:id/days/:dayId` | Yes | Update day |
| `DELETE` | `/api/programs/:id/days/:dayId` | Yes | Delete day |
| `POST` | `/api/programs/:id/days/:dayId/exercises` | Yes | Add exercise to day |
| `PATCH` | `/api/programs/:id/days/:dayId/exercises/:exId` | Yes | Update exercise |
| `DELETE` | `/api/programs/:id/days/:dayId/exercises/:exId` | Yes | Remove exercise |
| **Schedules** | | | |
| `GET` | `/api/schedules` | Yes | List all schedules |
| `POST` | `/api/schedules` | Yes | Upsert schedules for a program |
| `DELETE` | `/api/schedules/:id` | Yes | Delete schedule |
| **Workouts** | | | |
| `GET` | `/api/workouts?page=&limit=` | Yes | List sessions (paginated) |
| `GET` | `/api/workouts/active` | Yes | Get active (incomplete) session |
| `GET` | `/api/workouts/analytics` | Yes | 1RM estimates, volume, heatmap, streaks |
| `GET` | `/api/workouts/history/:exerciseId` | Yes | Weight history for an exercise |
| `POST` | `/api/workouts` | Yes | Start a workout session |
| `PATCH` | `/api/workouts/:id/finish` | Yes | Finish session |
| `DELETE` | `/api/workouts/:id` | Yes | Discard session |
| `POST` | `/api/workouts/:sessionId/exercises/:exId/sets` | Yes | Log a set |
| **Nutrition** | | | |
| `GET` | `/api/nutrition/log?date=` | Yes | Food log for a date |
| `POST` | `/api/nutrition/log` | Yes | Add food entry |
| `DELETE` | `/api/nutrition/log/:id` | Yes | Delete food entry |
| `GET` | `/api/nutrition/weekly` | Yes | Last 7 days calorie totals |
| `GET` | `/api/nutrition/history?days=` | Yes | Daily macro totals for N days |
| `GET` | `/api/nutrition/goals` | Yes | Get nutrition goals |
| `PUT` | `/api/nutrition/goals` | Yes | Update nutrition goals |
| `GET` | `/api/nutrition/search?q=` | Yes | Search food (Open Food Facts + USDA) |
| **Water** | | | |
| `GET` | `/api/water?date=` | Yes | Water entries + total for a date |
| `POST` | `/api/water` | Yes | Add water entry |
| `DELETE` | `/api/water/:id` | Yes | Delete water entry |
| `GET` | `/api/water/goal` | Yes | Get daily water goal |
| `PUT` | `/api/water/goal` | Yes | Update daily water goal |
| **Photos** | | | |
| `GET` | `/api/photos?startDate=&endDate=` | Yes | List progress photos |
| `GET` | `/api/photos/timeline` | Yes | Dates with photo counts |
| `GET` | `/api/photos/:id` | Yes | Get single photo |
| `POST` | `/api/photos/upload` | Yes | Upload photo (multipart, max 10MB) |
| `DELETE` | `/api/photos/:id` | Yes | Delete photo + file |
| **Export** | | | |
| `GET` | `/api/export` | Yes | Full JSON data export |
| **Exercises** | | | |
| `GET` | `/api/exercises` | No | Exercise library (427 exercises) |
| **Calendar** | | | |
| `GET` | `/calendar/user/:hash` | No | iCal feed (hash-based, no auth) |
| **Stats** | | | |
| `GET` | `/api/stats` | No | GitHub stars, forks, user count (cached) |
| **Health** | | | |
| `GET` | `/api/health` | No | Health check |

---

## Database

12 tables managed by Drizzle ORM. Migrations run automatically on API startup.

| Table | Description |
|-------|-------------|
| `users` | Accounts (email, hashed password, calendar hash) |
| `sessions` | Lucia auth sessions |
| `programs` | Workout programs |
| `program_days` | Days within a program |
| `program_day_exercises` | Exercises assigned to program days |
| `day_schedules` | Recurrence rules for scheduling |
| `exercises` | Exercise reference library (427 seeded entries) |
| `workout_sessions` | Logged workout instances |
| `workout_session_exercises` | Exercises within a workout session |
| `workout_sets` | Individual sets logged |
| `nutrition_logs` | Food log entries |
| `nutrition_goals` | Daily macro targets per user |
| `progress_photos` | Progress photo metadata |
| `water_logs` | Water intake entries |
| `water_goals` | Daily water goals per user |

All user-owned tables cascade on delete. Dropping a user removes everything.

---

## Project structure

```
src/
├── app/
│   ├── components/       # Shared (auth modal, app shell)
│   ├── models/           # TypeScript interfaces
│   ├── pages/
│   │   ├── landing/      # Marketing homepage + live stats
│   │   ├── dashboard/    # Overview, streaks, 1RM, heatmap
│   │   ├── programs/     # Program builder + schedule calendar
│   │   ├── workouts/     # Workout logging + rest timer + PRs
│   │   ├── calories/     # Calorie tracking + barcode + trends
│   │   ├── photos/       # Progress photos + comparison
│   │   └── settings/     # Goals, theme, data export
│   └── services/         # Angular services (auth, program, workout, nutrition, etc.)
└── styles.css            # Global styles + Tailwind + calendar overrides

api/
├── src/
│   ├── routes/           # Hono route handlers
│   │   ├── auth.ts       # Signup, signin, signout (rate limited)
│   │   ├── programs.ts   # CRUD for programs, days, exercises
│   │   ├── schedules.ts  # Calendar scheduling rules
│   │   ├── workouts.ts   # Session logging + analytics
│   │   ├── nutrition.ts  # Food log + search + history
│   │   ├── water.ts      # Water intake tracking
│   │   ├── photos.ts     # Progress photo uploads
│   │   ├── exercises.ts  # Exercise library
│   │   ├── calendar.ts   # iCal feed
│   │   ├── export.ts     # Full data export
│   │   └── stats.ts      # Landing page stats
│   ├── data/             # Seed data (exercises, program templates)
│   ├── db/               # Drizzle schema + connection + migrations
│   ├── auth/             # Lucia configuration
│   └── middleware/        # Auth middleware
└── drizzle/              # SQL migration files
```

---

## Roadmap

- [ ] Body measurements tracking
- [ ] Sleep tracking
- [ ] Social features (public profiles, program sharing)
- [ ] PWA push notifications for workout reminders
- [ ] Saved meals / recipe builder
- [ ] Onboarding wizard

Want to help? Contributions are welcome — open a PR or an issue.

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Follow the conventions in `AGENTS.md` (Angular 20 standalone components, signals, OnPush, etc.)
4. Make sure TypeScript compiles clean (`npx tsc --noEmit`)
5. Open a PR against `master`

See `AGENTS.md` for detailed coding standards.

---

## License

MIT
