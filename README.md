# Personal Trainer

A Markdown-first personal trainer app. The user interacts with the system through files, not a UI.

## What the first version does

- Creates a user workspace with `profile.md`
- Generates a weekly `plan.md` from that profile
- Writes `coach_notes.md` with concise guidance
- Creates `checkins/*.md` templates for weekly progress updates
- Creates an `exercise_library/` folder with local exercise pictures and reference pages
- Regenerates the plan based on adherence, difficulty, energy, and soreness

## Workflow

1. Initialize a workspace.
2. Fill out `profile.md`.
3. Generate the first plan.
4. Complete a weekly check-in Markdown file.
5. Refresh the plan.

The generated `plan.md` embeds local exercise images and links to the matching reference page in `exercise_library/`.

## Commands

```bash
poetry install
poetry run personal-trainer init sample_workspace
poetry run personal-trainer plan sample_workspace
poetry run personal-trainer status sample_workspace
poetry run personal-trainer refresh sample_workspace sample_workspace/checkins/2026-03-30-checkin.md
```

## Markdown contract

The parser expects predictable sections and bullet formats.

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

## Repository layout

- `src/personal_trainer/`: app code
- `src/personal_trainer/assets/exercise_library/`: bundled exercise images and catalog
- `tests/`: basic tests
- `sample_workspace/`: example Markdown workspace

## Next likely improvements

- exercise libraries by equipment and goal
- mesocycle progression across 4-6 weeks
- nutrition and recovery guidance
- richer symptom handling for injuries and pain
- stronger Markdown validation and error reporting
