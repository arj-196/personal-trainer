# Personal Trainer Monorepo

Personal Trainer now uses PostgreSQL as the source of truth for workout workspaces, athlete profiles, check-ins, workout plans, and saved recipe snapshots.

## Apps

- `trainer/`: Python CLI and HTTP API for database setup, imports, sync, and workout plan generation.
- `app_web/`: Next.js web app for authenticated workspace management, recipe snapshots, and workout viewing.
- `packages/shared/`: shared TypeScript workout and recipe types/helpers.
- `db/migrations/`: SQL-first shared PostgreSQL schema.

## Data Model

- A `Workspace` has exactly one current `Athlete Profile`.
- A `Workspace` has many editable `Check-in` records.
- A `Workspace` has many historical `Workout Plan` records, with one marked current.
- Saved Jeff the Cook recipe snapshots live in PostgreSQL, not Vercel Blob.

## Local Setup

### 1. Start the Docker Compose development stack

Docker Compose runs PostgreSQL, applies SQL migrations, starts the trainer HTTP
API with Uvicorn reload, and starts the Next.js web app in development mode:

```bash
export APP_USERNAME=coach
export APP_PASSWORD=secret
export APP_SESSION_SECRET=change-me
export TRAINER_API_TOKEN=dev-secret
export OPENAI_API_KEY=...

docker compose up --build
```

Open `http://localhost:3000`.

Local source is bind-mounted into the web and trainer containers, so changes in
`app_web/`, `packages/`, `trainer/`, and `db/` are picked up by the running
development services. Dependency directories are kept in Docker volumes so the
container-installed dependencies are not hidden by the bind mount.

Service URLs:

- Web app: `http://localhost:3000`
- Trainer API: `http://localhost:8010`
- PostgreSQL: `localhost:5432`

The Compose stack uses this internal database URL:

```bash
postgresql://personal_trainer:personal_trainer@postgres:5432/personal_trainer
```

Destroy the local database volume when you need a clean database:

```bash
docker compose down -v
```

### Manual development setup

Start only PostgreSQL:

```bash
docker compose up -d postgres
cd trainer
poetry install
poetry run personal-trainer db setup
```

Default local database URL:

```bash
postgresql://personal_trainer:personal_trainer@localhost:5432/personal_trainer
```

### 2. Import existing data

Filesystem workspaces:

```bash
cd trainer
poetry run personal-trainer import-filesystem
```

This imports each filesystem Workspace's Athlete Profile, Check-ins, and current
Workout Plan. Workout Plan import is strict: when plan files are present,
`plan.json` and `plan.md` must both exist, and `plan.md` must match the plan
rendered from `plan.json`'s `rawPlan`.

Saved recipe snapshots exported to JSON:

```bash
poetry run personal-trainer import-blob-recipes --snapshot-export /path/to/recipes.json
```

### 3. Run the web app

Set:

```bash
export DATABASE_URL=postgresql://personal_trainer:personal_trainer@localhost:5432/personal_trainer
export APP_USERNAME=coach
export APP_PASSWORD=secret
export APP_SESSION_SECRET=change-me
```

Then run:

```bash
npm install
npm run dev:web
```

Open `http://localhost:3000`.

### 4. Generate workout plans

Create a workspace, complete the athlete profile in the web app, then generate the first plan from either the Python CLI or the web app.

CLI:

```bash
cd trainer
poetry run personal-trainer plan <workspace>
```

The generated plan is saved to PostgreSQL and automatically becomes the current plan for that workspace.
After the athlete has trained against that plan for the week, add check-ins in the web app to inform future plans.

Web app:

```bash
export TRAINER_API_URL=http://127.0.0.1:8010
export TRAINER_API_TOKEN=dev-secret
export OPENAI_API_KEY=...

cd trainer
export TRAINER_API_TOKEN=dev-secret
export OPENAI_API_KEY=...
poetry run personal-trainer serve --host 127.0.0.1 --port 8010
```

The web app calls the trainer HTTP API through authenticated Next proxy routes.
Workout Plan generation is stored as a Postgres-backed job and the UI polls for
progress while Arnold and Doctor Mike review the plan.
The start workout screen also uses the trainer API for temporary Arnold
Workout Session coach chat answers. Chat turns are kept in browser memory only
and are not stored in PostgreSQL.

## CLI Commands

```bash
personal-trainer init <workspace>
personal-trainer status <workspace>
personal-trainer checkin <workspace>
personal-trainer plan <workspace>
personal-trainer serve

personal-trainer db setup
personal-trainer db setup --prod

personal-trainer import-filesystem
personal-trainer import-blob-recipes --snapshot-export /path/to/file.json

personal-trainer sync pull-prod
personal-trainer sync push-prod
```

## Production

- Web app: Vercel
- Trainer API: separate Python service
- Database: Neon Postgres

Set production env vars:

```bash
PRODUCTION_DATABASE_URL=<neon-connection-string>
APP_USERNAME=<shared-username>
APP_PASSWORD=<shared-password>
APP_SESSION_SECRET=<long-random-secret>
TRAINER_API_URL=<trainer-service-url>
TRAINER_API_TOKEN=<shared-secret>
OPENAI_API_KEY=<openai-key>
TRAINER_CHAT_OPENAI_MODEL=<cheap-chat-model>
```

Apply all SQL migrations to production:

```bash
poetry run personal-trainer db setup --prod
```

### Sync protocol

- Neon is authoritative.
- Pull from Neon before local plan generation:

```bash
poetry run personal-trainer sync pull-prod
```

- Push trainer-domain data back only when intended:

```bash
poetry run personal-trainer sync push-prod
```

`sync push-prod` only targets trainer tables: `workspaces`, `athlete_profiles`, `check_ins`, and `workout_plans`.
Sync restores parent workspace rows before dependent profile, check-in, and workout plan rows.
Structured JSONB fields in those tables are preserved during sync.
