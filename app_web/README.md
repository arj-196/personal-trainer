# Web App

The web app is the authenticated interface for managing Personal Trainer data stored in PostgreSQL.

## Features

- shared username/password login backed by env vars and a signed session cookie
- create `Workspace` records
- edit the single current `Athlete Profile` for a workspace
- create and edit `Check-in` records after a current workout plan exists
- create new check-ins with server-generated UUIDs when no existing check-in id is submitted
- view the current `Workout Plan`
- ask temporary Workout Session coach chat questions on the start workout screen
- run the Jeff the Cook recipe workflow
- save and delete recipe snapshots in PostgreSQL
- emit module-scoped server logs such as `app_web.server.workspaces` and `app_web.recipes.service`

## Trainer Workflow

1. Create a workspace.
2. Complete the athlete profile.
3. Generate the first workout plan from the Python CLI.
4. Use check-ins after training to inform later plans.

## Environment

Required:

```bash
DATABASE_URL=postgresql://personal_trainer:personal_trainer@localhost:5432/personal_trainer
APP_USERNAME=coach
APP_PASSWORD=secret
APP_SESSION_SECRET=change-me
TRAINER_API_URL=http://127.0.0.1:8010
TRAINER_API_TOKEN=dev-secret
```

When running through Docker Compose, the app runs with `next dev` and hot
reload. These variables can be exported before startup or left at their
development defaults:

```bash
export APP_USERNAME=coach
export APP_PASSWORD=secret
export APP_SESSION_SECRET=change-me
export TRAINER_API_TOKEN=dev-secret
export OPENAI_API_KEY=...
docker compose up --build
```

Compose serves the app at `http://localhost:3000`, sets `DATABASE_URL` to the
PostgreSQL service, and points `TRAINER_API_URL` at `http://trainer-api:8010`.
Local changes under `app_web/` and `packages/` are bind-mounted into the
container.

## Development

From the repo root:

```bash
npm install
npm run dev:web
```

## Build

```bash
npm run build -w personal-trainer-frontend
```

## Production

Deploy the Next.js app to Vercel and point `DATABASE_URL` at Neon Postgres.

## Notes

- Workout plan generation runs through the Python trainer API when the web app
  is configured with `TRAINER_API_URL` and `TRAINER_API_TOKEN`.
- Workout Session coach chat asks Arnold through the Python trainer API and keeps
  chat turns only in active browser memory.
- The web app only displays workout plans already stored in PostgreSQL.
- Vercel Blob is no longer used for trainer or recipe persistence.
