# Trainer

The trainer app is the trainer engine for the monorepo.

It generates workout plans, manages workspace files, maintains the bundled exercise and recipe libraries, and can publish the current plan to Apple Notes.

## Stack

- Python
- Poetry

## Responsibilities

- create workspaces under `../workspaces/<name>`
- parse `profile.md` and check-in files
- generate `plan.md` and `coach_notes.md`
- sync the exercise library into each workspace
- suggest recipes from pantry ingredients and the user's goal
- publish workspace and library assets to Vercel Blob for the hosted frontend
- publish a text-only workout note to Apple Notes on macOS

## Install

```bash
cd trainer
poetry install
```

## CLI usage

Workspaces are always resolved under the repo-level `./workspaces` directory.

```bash
poetry run personal-trainer init albert
poetry run personal-trainer plan albert
poetry run personal-trainer refresh albert 2026-03-30-checkin.md
poetry run personal-trainer recipes albert --ingredients "chicken, rice, broccoli"
poetry run personal-trainer status albert
poetry run personal-trainer publish-web albert
poetry run personal-trainer publish-notes albert
```

These commands read and write files in:

```text
../workspaces/albert/
```

## Workflow

1. Initialize a workspace.
2. Fill out `profile.md`.
3. Generate the first plan.
4. Add a weekly check-in file in `checkins/`.
5. Refresh the plan.
6. Optionally publish the workspace to Vercel Blob for the hosted frontend.
7. Optionally publish the plan to Apple Notes.

## Markdown contract

### `profile.md`

Required sections:

- `## Basics`
- `## Goals`
- `## Schedule`
- `## Equipment`
- `## Limitations`
- `## Preferred Focus`
- `## Notes`

Use `- Key: Value` bullets for the first three sections.
Use plain `- item` bullets for list sections.

### `checkin.md`

Required sections:

- `## Summary`
- `## Wins`
- `## Struggles`
- `## Notes`

The `Summary` section must include:

- `- Date: YYYY-MM-DD`
- `- Workouts completed: N`
- `- Workouts planned: N`
- `- Average difficulty (1-10): N`
- `- Energy (1-10): N`
- `- Soreness (1-10): N`

## Important paths

- `src/personal_trainer/`: trainer source
- `templates/`: starter Markdown templates
- `scripts/build_exercise_library.py`: exercise asset rebuild script
- `tests/`: trainer tests

## Testing

```bash
cd trainer
poetry run pytest -q
```

## Blob publish

To host the frontend on Vercel without relying on local repo files, publish the generated workspace and shared exercise library to Vercel Blob:

```bash
cd trainer
poetry install
poetry run personal-trainer publish-web albert
```

Optional flags:

- `--prefix` to change the blob pathname prefix
- `--access public|private` to match the Blob store access mode
- `--skip-library` to upload only the selected workspace

Required environment variables:

- `BLOB_READ_WRITE_TOKEN`
- `TRAINER_BLOB_PREFIX`
- `TRAINER_BLOB_ACCESS`

See `.env.example`.
