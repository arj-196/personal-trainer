# Frontend

The frontend is a Next.js app for viewing trainer data that already exists in the repo.

## Stack

- Next.js
- React
- TypeScript

## Current features

- use the homepage as the hub for both workout and recipe flows
- switch between generated workspaces
- view a high-level workout summary on the homepage instead of the full exercise list
- open a larger read-only workout focus view
- start a single-day workout session from a specific workout day with a persistent per-device checklist
- browse the exercise library with images and coaching cues
- suggest recipes from pantry ingredients and the active training goal
- open Google Images for each exercise card when you need a quick visual lookup
- use compact icon actions on read-only workout cards and expanded actions in the start-workout flow
- collapse completed workout cards in the start-workout flow so finished exercises take much less space
- render warm-up, finisher, and recovery as full workout blocks inside the workout flows
- read data from either local repo files or Vercel Blob storage
- show the current git commit id in the homepage header
- optionally show a homepage debug panel with the current commit hash and environment variables

## Install

```bash
cd frontend
npm install
```

## Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
```

## Docker

Build the frontend container from `frontend/`:

```bash
docker build -t personal-trainer-frontend .
```

Run it locally:

```bash
docker run --rm -p 3000:3000 \
  -e TRAINER_DATA_SOURCE=blob \
  -e TRAINER_BLOB_ACCESS=private \
  -e TRAINER_BLOB_PREFIX=personal-trainer \
  -e BLOB_READ_WRITE_TOKEN=your-token \
  personal-trainer-frontend
```

For local file mode, replace `TRAINER_DATA_SOURCE=blob` with `TRAINER_DATA_SOURCE=local`.

## Test

```bash
npm test
```

Vitest uses [`vitest.config.ts`](/Users/arjun/Personal/apps/personal_trainer/frontend/vitest.config.ts) for Node-based unit tests and `@/*` path alias resolution.

## Environment

The frontend supports two data sources:

- `TRAINER_DATA_SOURCE=local` for local repo files
- `TRAINER_DATA_SOURCE=blob` for Vercel Blob-backed deployments

Relevant variables:

- `TRAINER_DATA_SOURCE`
- `TRAINER_BLOB_ACCESS`
- `TRAINER_BLOB_PREFIX`
- `BLOB_READ_WRITE_TOKEN`
- `DEBUG=true` to show the homepage debug panel

See `.env.example`.

## Deploy to Vercel

1. Create a Vercel project for `frontend/`.
2. Set the project Root Directory to `frontend`.
3. Create a Vercel Blob store and attach it to the same Vercel project.
4. Set the frontend environment variables from `.env.example`.
5. Publish workout/library data from the trainer app with:

```bash
cd trainer
poetry install
poetry run personal-trainer publish-web wk_arj
```

6. Deploy the frontend.

After every `plan` or `refresh`, run `publish-web` again so Blob stays in sync with the latest workspace files.

## Local Vercel Build

To test the Vercel build locally from `frontend/`:

```bash
vercel pull --yes --environment preview
vercel build --yes
```

`vercel pull` creates the local `.vercel/` project settings files used by the CLI. Those files are machine-local and should not be committed.

## Data sources

In `local` mode the frontend reads directly from repo files on the server side:

- `../workspaces/<name>/plan.json`
- `../workspaces/<name>/profile.json`
- `../trainer/src/personal_trainer/assets/exercise_library/catalog.json`
- workout reference markdown from the workspace
- remote `wger` image URLs directly from the plan and shared exercise catalog

In `blob` mode the frontend reads the same logical data from Vercel Blob:

- `personal-trainer/workspaces/<name>/...`
- `personal-trainer/exercise-library/catalog.json`

## Routes

- `/`: homepage hub with workout summary plus a dedicated Recipes feature entry point
- `/workspace/[workspace]`: read-only workout focus view for one workspace
- `/workspace/[workspace]/start`: single-day workout page for one selected workout day, with completion checklist state saved in browser local storage
- `/recipes`: pantry-based, goal-aware recipe suggestions
- `/library`: exercise library

## Notes

- The workout checklist state is browser-local and does not sync across devices.
- The start workout route accepts `?day=<1-based index>` so each workout day card can open its own fixed session view.
- The frontend is read-only with the exception of browser-local workout progress state.
- Plan generation still happens in the trainer CLI.
- A workspace must exist in the selected data source before the frontend can display it.
