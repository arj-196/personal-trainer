# Personal Trainer Monorepo

Personal Trainer is a multi-app repository for generating workout plans, browsing the exercise library, and publishing a gym-friendly view of the plan.

## Apps

- `trainer/`: Python + Poetry trainer engine and CLI
- `frontend/`: Next.js workout and exercise library UI
- `workspaces/`: generated user workspaces and plan files

## Repo layout

```text
.
├── trainer/
├── frontend/
├── workspaces/
└── README.md
```

## What each app does

### Trainer

The trainer app owns the trainer workflow:

- creates workspaces under `./workspaces/<name>`
- generates `profile.md`, `plan.md`, `coach_notes.md`, and check-in templates
- maintains the bundled exercise library
- publishes a text-only version of the current plan to Apple Notes

See [trainer/README.md](/Users/arjun/Personal/apps/personal_trainer/trainer/README.md).

### Frontend

The frontend reads the existing workspace and library files and provides two core views:

- current workout view
- exercise library view
- compact, low-scroll layout for workout and library browsing
- optional Vercel Blob-backed hosting mode for internet deployment

See [frontend/README.md](/Users/arjun/Personal/apps/personal_trainer/frontend/README.md).

## Quick start

### 1. Generate a workspace and plan

```bash
cd trainer
poetry install
poetry run personal-trainer init alex
poetry run personal-trainer plan alex
```

This creates files under `./workspaces/alex/`.

### 2. Run the frontend

```bash
cd frontend
npm install
npm test
npm run dev
```

Open `http://localhost:3000`.

## Typical workflow

1. Create or update a workspace from the trainer CLI.
2. Generate or refresh the workout plan.
3. If you host the frontend on Vercel, run `poetry run personal-trainer publish-web <workspace>`.
4. Open the frontend to view the current workout or browse the exercise library.
5. Optionally publish the current plan to Apple Notes from the trainer app.

## Workspace model

Every user workspace lives in:

```text
workspaces/<workspace-name>/
```

Typical contents:

```text
workspaces/alex/
├── profile.md
├── plan.md
├── coach_notes.md
├── checkins/
└── exercise_library/
```

## Notes

- The frontend is currently read-only.
- The trainer app is the source of truth for plan generation.
- The frontend reads from the generated files rather than maintaining a second database.
