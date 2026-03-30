# Frontend

The frontend is a Next.js app for viewing trainer data that already exists in the repo.

## Stack

- Next.js
- React
- TypeScript

## Current features

- view the current workout plan
- switch between generated workspaces
- open a larger workout focus view
- browse the exercise library with images and coaching cues
- denser layout with reduced vertical scrolling on dashboard and library views

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

## Test

```bash
npm test
```

## Data sources

The frontend reads directly from repo files on the server side:

- `../workspaces/<name>/plan.md`
- `../trainer/src/personal_trainer/assets/exercise_library/catalog.json`
- workspace and library image files served through Next route handlers

## Routes

- `/`: workout dashboard
- `/workspace/[workspace]`: larger workout view for one workspace
- `/library`: exercise library

## Notes

- The frontend is currently read-only.
- Plan generation still happens in the trainer CLI.
- A workspace must exist before the frontend can display it.
