# Trainer CLI

The trainer CLI is responsible for local workout plan generation and PostgreSQL operations. The database is the source of truth; Markdown workspace files are no longer the operational storage model.

## Requirements

- Python 3.10+
- Poetry
- Local PostgreSQL via Docker Compose or a remote Postgres-compatible database

## Environment

Local database:

```bash
export TRAINER_DATABASE_URL=postgresql://personal_trainer:personal_trainer@localhost:5432/personal_trainer
```

Production sync target:

```bash
export TRAINER_PROD_DATABASE_URL=<neon-connection-string>
```

Optional model configuration:

```bash
export OPENAI_API_KEY=...
export OPENAI_BASE_URL=https://api.openai.com/v1
export TRAINER_OLLAMA_BASE_URL=http://localhost:11434
export TRAINER_PLAN_REVIEW_MAX_ITERATIONS=5
```

## Database Commands

```bash
poetry run personal-trainer db up
poetry run personal-trainer db down
poetry run personal-trainer db destroy
poetry run personal-trainer db setup
```

## Data Migration

Import existing filesystem workspaces:

```bash
poetry run personal-trainer import-filesystem
```

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
