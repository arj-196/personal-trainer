# Personal Trainer Monorepo

Personal Trainer uses PostgreSQL as the source of truth for workout workspaces,
athlete profiles, check-ins, workout plans, and saved recipe snapshots.

## Apps

- `trainer/`: Python CLI and HTTP API for database setup, imports, sync, and workout plan generation.
- `app_web/`: Next.js web app for authenticated workspace management, recipe snapshots, and workout viewing.
- `packages/shared/`: shared TypeScript workout and recipe types/helpers.
- `db/migrations/`: SQL-first shared PostgreSQL schema.

See app-specific docs for details:

- [`trainer/README.md`](./trainer/README.md)
- [`app_web/README.md`](./app_web/README.md)

## Local Setup

Docker Compose runs PostgreSQL, applies SQL migrations, starts the Trainer API,
and starts the Next.js web app:

```bash
export APP_USERNAME=coach
export APP_PASSWORD=secret
export APP_SESSION_SECRET=change-me
export TRAINER_API_TOKEN=dev-secret
export OPENAI_API_KEY=...

docker compose up --build
```

Service URLs:

- Web app: `http://localhost:3000`
- Trainer API: `http://localhost:8010`
- PostgreSQL: `localhost:5432`

Destroy the local database volume when you need a clean database:

```bash
docker compose down -v
```

## Production

- Web app: Vercel
- Trainer API: VPS-hosted Docker service deployed by GitHub Actions
- Database: Neon Postgres

Deployment details live in the app READMEs.
