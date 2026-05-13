# Web App

The web app is the authenticated interface for managing Personal Trainer data stored in PostgreSQL.

## Features

- shared username/password login backed by env vars and a signed session cookie
- create `Workspace` records
- edit the single current `Athlete Profile` for a workspace
- create and edit `Check-in` records after a current workout plan exists
- view the current `Workout Plan`
- run the Jeff the Cook recipe workflow
- save and delete recipe snapshots in PostgreSQL

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
```

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

- Workout plan generation stays in the Python trainer CLI.
- The web app only displays workout plans already stored in PostgreSQL.
- Vercel Blob is no longer used for trainer or recipe persistence.
