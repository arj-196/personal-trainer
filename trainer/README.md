# Trainer

The trainer app is the trainer engine for the monorepo.

It generates workout plans with Ollama and OpenAI-backed trainer agents, manages workspace files, maintains the bundled exercise and recipe libraries, and can publish the current plan to Apple Notes.

## Stack

- Python
- Poetry

## Responsibilities

- create workspaces under `../workspaces/<name>`
- parse `profile.md` and check-in files
- generate `profile.json`, `plan.json`, `plan.md`, `plan.pdf`, and `coach_notes.md` from structured LLM output instead of hardcoded split logic
- render `plan.pdf` with the same document structure as `plan.md`, including embedded exercise images
- generate side-by-side comparison plans when you request multiple models
- sync the exercise library into each workspace
- suggest recipes from pantry ingredients and the user's goal
- publish workspace and library assets to Vercel Blob for the hosted frontend
- publish a text-only workout note to Apple Notes on macOS

## Install

```bash
cd trainer
poetry install
# run in a separate terminal if Ollama is not already running
ollama serve
ollama pull gpt-oss:20b
```

## CLI usage

Workspaces are always resolved under the repo-level `./workspaces` directory.

```bash
poetry run personal-trainer init albert
poetry run personal-trainer plan albert
poetry run personal-trainer plan albert --ollama-model gpt-oss:20b --ollama-model qwen3:30b
poetry run personal-trainer plan albert --ollama-model qwen3:30b --openai-model gpt-5.4-mini
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
3. Start Ollama locally and make sure the chosen model is available, or export `OPENAI_API_KEY` for OpenAI models.
4. Generate the first plan.
5. Add a weekly check-in file in `checkins/`.
6. Refresh the plan.
7. Optionally publish the workspace to Vercel Blob for the hosted frontend.
8. Optionally publish the plan to Apple Notes.

## Planner

`plan` and `refresh` call one or more planner models and ask each one to act like a professional trainer. The app sends:

- the parsed athlete profile
- the latest check-in when present
- the bundled exercise library metadata so the model can prefer linkable exercise names

Each model must return structured JSON, which the app validates before writing both JSON data files and Markdown views.

If you pass one model, the trainer writes:

- `profile.json`
- `plan.json`
- `plan.md`
- `plan.pdf`
- `coach_notes.md`

If you pass multiple models, the trainer writes one plan pair per model in the workspace root, for example:

```text
../workspaces/albert/
├── profile.json
├── plan-ollama-gpt-oss-20b.md
├── plan-ollama-gpt-oss-20b.pdf
├── plan-ollama-gpt-oss-20b.json
├── coach-notes-ollama-gpt-oss-20b.md
├── plan-openai-gpt-5-4-mini.md
├── plan-openai-gpt-5-4-mini.pdf
├── plan-openai-gpt-5-4-mini.json
└── coach-notes-openai-gpt-5-4-mini.md
```

### Planner options

Both `plan` and `refresh` accept:

- repeatable `--ollama-model`
- repeatable `--openai-model`
- `--ollama-base-url` with default `http://localhost:11434`
- `--openai-base-url` with default `https://api.openai.com/v1`
- `--openai-api-key` or `OPENAI_API_KEY` for OpenAI requests
- `--timeout-seconds` with default `180`

Matching environment variables are also supported:

- `TRAINER_OLLAMA_MODELS`
- `TRAINER_OPENAI_MODELS`
- `TRAINER_OLLAMA_BASE_URL`
- `TRAINER_OLLAMA_TIMEOUT_SECONDS`
- `OPENAI_BASE_URL`
- `OPENAI_API_KEY`

### Recommended local models

- `gpt-oss:20b`: default choice for strong local reasoning with moderate hardware requirements
- `gpt-oss:120b`: better ceiling if you have the memory and want higher-quality coaching output
- `qwen3:30b`: worth trying if you want another strong reasoning-oriented local model in the same general class

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
- `scripts/fetch_wger_catalog.py`: fetch a raw `wger` dump into `zsnippets/`
- `scripts/build_exercise_library.py`: build the exercise library catalog from a `wger` dump
- `tests/`: trainer tests

## Exercise catalog conversion

To fetch a fresh raw `wger` dump:

```bash
cd trainer
python scripts/fetch_wger_catalog.py
```

To rebuild the trainer exercise library catalog from a `wger` dump:

```bash
cd trainer
python scripts/build_exercise_library.py \
  ../zsnippets/wger_exercise_catalog.json
```

Notes:

- by default the builder skips exercises that do not include an image URL in the dump
- the resulting catalog stores remote `wger` image URLs instead of downloading local image files
- use `--include-without-images` if you want a fuller catalog and will handle missing images separately

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
