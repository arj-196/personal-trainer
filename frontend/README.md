# Frontend

The frontend is a Next.js app for the workout UI and Jeff the Cook recipe workspace.

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS (utility-first styling)

## Current features

- use the homepage as the hub for both workout and recipe flows
- switch between generated workspaces
- view a high-level workout summary on the homepage instead of the full exercise list
- open a larger read-only workout focus view
- start a single-day workout session from a specific workout day with a persistent per-device checklist
- use a compact fixed stopwatch panel in the start-workout session with active/rest coaching cues
- use Jeff the Cook as a voice-first recipe workspace with draft review before generation
- save immutable recipe snapshots to Vercel Blob and reopen or delete them later
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

Tailwind is integrated through `postcss.config.mjs` using `@tailwindcss/postcss`.

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
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_RECIPE_MODEL`
- `OPENAI_TRANSCRIPTION_MODEL`
- `DEBUG=true` to show the homepage debug panel

See `.env.example`.

## Deploy to Vercel

1. Create a Vercel project for `frontend/`.
2. Set the project Root Directory to `frontend`.
3. Create a Vercel Blob store and attach it to the same Vercel project.
4. Set the frontend environment variables from `.env.example`.
5. Publish workout data from the trainer app with:

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
- workout reference markdown from the workspace
- remote `wger` image URLs directly from the plan

In `blob` mode the frontend reads the same logical data from Vercel Blob:

- `personal-trainer/workspaces/<name>/...`
- `personal-trainer/saved-recipes/YYYY/MM/recipe_<id>.json`

## Routes

- `/`: homepage hub with workout summary plus a dedicated Recipes feature entry point
- `/workout/[workspace]`: read-only workout overview with day summaries and exercise titles for one workspace
- `/workout/[workspace]/start`: single-day workout page for one selected workout day, with completion checklist state saved in browser local storage
- `/recipes`: Jeff the Cook recipe workspace with voice input, draft review, and explicit generation
- `/saved-recipes`: saved recipe snapshot list
- `/saved-recipes/[id]`: saved recipe snapshot detail
- `/debug`: direct-entry diagnostics page for validating production feature implementations (currently mic capture + playback)

## Notes

- The workout checklist state is browser-local and does not sync across devices.
- The start workout route accepts `?day=<1-based index>` so each workout day card can open its own fixed session view.
- Start workout uses timing fields from `plan.json` (`warmupActiveSeconds`, `activeSeconds`, `restBetweenSetsSeconds`, `restBetweenExercisesSeconds`) and falls back to safe defaults for older plans.
- Within an exercise, the timer runs continuously (active set -> rest -> next set) after a single Start tap; the next exercise still starts manually.
- The frontend is read-only for workout data, but Jeff the Cook can save immutable recipe snapshots to Blob.
- Jeff the Cook interpretation requests use strict JSON schema with nullable patch fields so `gpt-5.4-mini` accepts the payload while still returning partial state updates.
- Jeff the Cook microphone uploads now preserve browser-native audio MIME/container and extension (including iPhone/WebKit `audio/mp4`/`.m4a`) instead of forcing `.webm`.
- `/debug` is intentionally unlinked from the homepage and is meant for manual device verification workflows.
- Plan generation still happens in the trainer CLI.
- A workspace must exist in the selected data source before the frontend can display it.
- Styling is utility-first with Tailwind classes directly in route/component JSX.
- `app/globals.css` is intentionally minimal and limited to base resets and shared global defaults.
- Responsive behavior is mobile-first; baseline styles target small screens and scale up with `sm`/`md`/`lg` classes.
- Root layout sets `suppressHydrationWarning` on `<html>` and `<body>` to avoid false-positive warnings when mobile Chrome injects temporary attributes before React hydration.
