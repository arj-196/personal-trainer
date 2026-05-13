# Personal Trainer Monorepo

Personal Trainer now uses PostgreSQL as the source of truth for workout workspaces, athlete profiles, check-ins, workout plans, and saved recipe snapshots.

## Apps

- `trainer/`: Python CLI for database setup, imports, sync, and local workout plan generation.
- `app_web/`: Next.js web app for authenticated workspace management, recipe snapshots, and workout viewing.
- `packages/shared/`: shared TypeScript workout and recipe types/helpers.
- `db/migrations/`: SQL-first shared PostgreSQL schema.

## Data Model

- A `Workspace` has exactly one current `Athlete Profile`.
- A `Workspace` has many editable `Check-in` records.
- A `Workspace` has many historical `Workout Plan` records, with one marked current.
- Saved Jeff the Cook recipe snapshots live in PostgreSQL, not Vercel Blob.

## Local Setup

### 1. Start PostgreSQL

```bash
npm run db:up
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

### 4. Generate workout plans locally

The web app does not generate workout plans. Create a workspace, complete the athlete profile in the web app, then generate the first plan from the Python CLI:

```bash
cd trainer
poetry run personal-trainer plan <workspace>
```

The generated plan is saved to PostgreSQL and automatically becomes the current plan for that workspace.
After the athlete has trained against that plan for the week, add check-ins in the web app to inform future plans.

## CLI Commands

```bash
personal-trainer init <workspace>
personal-trainer status <workspace>
personal-trainer checkin <workspace>
personal-trainer plan <workspace>

personal-trainer db up
personal-trainer db down
personal-trainer db destroy
personal-trainer db setup

personal-trainer import-filesystem
personal-trainer import-blob-recipes --snapshot-export /path/to/file.json

personal-trainer sync pull-prod
personal-trainer sync push-prod
```

## Production

- Web app: Vercel
- Database: Neon Postgres

Set production env vars:

```bash
DATABASE_URL=<neon-connection-string>
APP_USERNAME=<shared-username>
APP_PASSWORD=<shared-password>
APP_SESSION_SECRET=<long-random-secret>
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
