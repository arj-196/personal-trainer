# Trainer CLI and HTTP API

The trainer CLI and HTTP API are responsible for workout plan generation and PostgreSQL operations. The database is the source of truth; Markdown workspace files are no longer the operational storage model.

## Requirements

- Python 3.10+
- Poetry
- Local PostgreSQL via Docker Compose or a remote Postgres-compatible database

## Docker Compose Development

From the repository root, run the full local stack:

```bash
export TRAINER_API_TOKEN=dev-secret
export OPENAI_API_KEY=...
docker compose up --build
```

Compose starts PostgreSQL, applies migrations with `personal-trainer db setup`,
and runs this API on `http://localhost:8010` with Uvicorn reload enabled.
Changes under `trainer/` are bind-mounted into the running container. The
service uses the Compose network database URL:

```bash
postgresql://personal_trainer:personal_trainer@postgres:5432/personal_trainer
```

The web app reaches the API at `http://trainer-api:8010` inside the Compose
network.

## Environment

Local database:

```bash
export DATABASE_URL=postgresql://personal_trainer:personal_trainer@localhost:5432/personal_trainer
```

Production sync target:

```bash
export PRODUCTION_DATABASE_URL=<neon-connection-string>
```

Optional model configuration:

```bash
export OPENAI_API_KEY=...
export OPENAI_BASE_URL=https://api.openai.com/v1
export TRAINER_OPENAI_MODEL=gpt-5.4-mini
export TRAINER_CHAT_OPENAI_MODEL=gpt-5.4-mini
export TRAINER_OLLAMA_BASE_URL=http://localhost:11434
export TRAINER_PLAN_REVIEW_MAX_ITERATIONS=5
```

## Database Commands

```bash
poetry run personal-trainer db setup
poetry run personal-trainer db setup --prod
```

`db setup` applies migrations to the local database. `db setup --prod` applies
the same migrations to the database configured by `PRODUCTION_DATABASE_URL`.
Start, stop, and destroy local PostgreSQL with Docker Compose directly from the
repository root.

## Data Migration

Import existing filesystem workspaces:

```bash
poetry run personal-trainer import-filesystem
```

This imports Athlete Profiles, Check-ins, and the current Workout Plan for each
filesystem Workspace. Workout Plan import requires matching `plan.json` and
`plan.md` files; the command reconstructs the plan from `plan.json.rawPlan` and
fails if the rendered Markdown does not match `plan.md`.

Import saved recipe snapshots from a JSON export:

```bash
poetry run personal-trainer import-blob-recipes --snapshot-export /path/to/recipes.json
```

## Workspace Commands

Create a workspace record:

```bash
poetry run personal-trainer init <workspace>
```

Show a workspace summary:

```bash
poetry run personal-trainer status <workspace>
```

Create or update a simple check-in row from the CLI:

```bash
poetry run personal-trainer checkin <workspace> --date 2026-05-13
```

## Plan Generation

Generate and store a new current workout plan:

```bash
poetry run personal-trainer plan <workspace>
```

Useful options:

```bash
--ollama-model <model>
--openai-model <model>
--session-id <id>
--max-review-iterations <count>
```

The command:

- reads the current athlete profile from PostgreSQL
- reads the latest check-in from PostgreSQL
- generates a new workout plan locally
- stores the full normalized plan in PostgreSQL
- marks the new plan as current for the workspace

## HTTP API

Run the trainer service for web-triggered Workout Plan generation:

```bash
export TRAINER_API_TOKEN=dev-secret
export OPENAI_API_KEY=...
poetry run personal-trainer serve --host 127.0.0.1 --port 8010
```

The web app should be configured with:

```bash
export TRAINER_API_URL=http://127.0.0.1:8010
export TRAINER_API_TOKEN=dev-secret
```

Endpoints:

```bash
POST /workspaces/{workspace}/workout-plan-generations
GET /workspaces/{workspace}/workout-plan-generations/active
GET /workout-plan-generations/{job_id}
POST /workspaces/{workspace}/workout-session-chat
```

All endpoints require `Authorization: Bearer <TRAINER_API_TOKEN>`.
Generation jobs are persisted in Postgres. The status response includes
step history and a curated Arnold/Doctor Mike review feed sourced from the
planner review report, without exposing raw prompts.
Workout Session chat loads the current Athlete Profile and selected Workout Day,
returns an Arnold Schwarzenegger coaching answer, and does not persist chat
history.

## Sync Commands

Pull production trainer data into local Postgres:

```bash
poetry run personal-trainer sync pull-prod
```

Push local trainer data back to production:

```bash
poetry run personal-trainer sync push-prod
```

Sync is snapshot-based and currently covers:

- `workspaces`
- `athlete_profiles`
- `check_ins`
- `workout_plans`

Sync restores parent workspace rows before dependent profile, check-in, and workout plan rows.
Structured JSONB fields in these tables are preserved during sync.
