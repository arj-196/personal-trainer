# Trainer

The trainer app is the trainer engine for the monorepo.

It generates workout plans with Ollama and OpenAI-backed trainer agents, manages workspace files, maintains the bundled exercise catalog, and can publish the current plan to Apple Notes.

## Stack

- Python
- Poetry

## Responsibilities

- create workspaces under `../workspaces/<name>`
- parse `profile.md` and check-in files
- generate `profile.json`, `plan.json`, `plan_review.json`, `plan.md`, and `coach_notes.md` from structured LLM output instead of hardcoded split logic
- create check-in templates on demand with `personal-trainer checkin <workspace>`
- generate explicit workout timing metadata (`activeSeconds`, set counts, and rest durations) in `plan.json` for the start-workout timer flow
- generate side-by-side comparison plans when you request multiple models
- render planner prompts from Jinja templates under `prompts/`
- trace each model call with optional Langfuse instrumentation, including per-run session ids, and local JSONL fallback logs
- publish workspace artifacts to Vercel Blob for the hosted frontend
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
poetry run personal-trainer plan albert --openai-model gpt-5.4-mini
poetry run personal-trainer plan albert --ollama-model gpt-oss:20b --ollama-model qwen3:30b
poetry run personal-trainer plan albert --ollama-model qwen3:30b --openai-model gpt-5.4-mini
poetry run personal-trainer checkin albert
poetry run personal-trainer checkin albert --date 2026-04-12
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
5. Create a weekly check-in file with `personal-trainer checkin <workspace>` and fill it in.
6. Run `plan` again to generate the next plan from the latest check-in file.
7. Optionally publish the workspace to Vercel Blob for the hosted frontend.
8. Optionally publish the plan to Apple Notes.

## Planner

`plan` calls one or more planner models and runs a conversational validation loop per model target:

1. planner drafts a structured plan
2. Arnold Schwarzenegger reviews the draft
3. Doctor Mike reviews the draft
4. planner revises the draft if either reviewer rejects
5. loop repeats until both approve or max iterations is reached

`plan` does not create check-in files. Use `checkin` to create check-in templates.
When check-in files are present under `checkins/`, `plan` picks the latest file by `YYYY-MM-DD-checkin.md` filename.

The app sends:

- the parsed athlete profile
- the latest check-in when present
- a compact bundled exercise catalog name list so the model can prefer known exercise names

Planner and reviewer steps must return structured JSON, which the app validates before writing both JSON data files and Markdown views.
Each step call also writes a trace record to:

```text
../workspaces/<workspace>/.trainer/logs/llm_calls.jsonl
```

Each JSONL record includes timestamp, trace id, session id, workflow, step, model, prompt, response, metadata, duration, success, and error when relevant.
For `plan`, one session id is used per CLI invocation and shared across all model calls in that run (including multi-model comparison mode).

If you pass one model, the trainer writes:

- `profile.json`
- `plan.json`
- `plan_review.json`
- `plan.md`
- `coach_notes.md`

If you pass multiple models, the trainer writes one plan set per model in the workspace root, for example:

```text
../workspaces/albert/
├── profile.json
├── plan-ollama-gpt-oss-20b.md
├── plan-ollama-gpt-oss-20b.json
├── plan_review-ollama-gpt-oss-20b.json
├── coach-notes-ollama-gpt-oss-20b.md
├── plan-openai-gpt-5-4-mini.md
├── plan-openai-gpt-5-4-mini.json
├── plan_review-openai-gpt-5-4-mini.json
└── coach-notes-openai-gpt-5-4-mini.md
```

### Planner options

`plan` accepts:

- repeatable `--ollama-model`
- repeatable `--openai-model`
- `--ollama-base-url` with default `http://localhost:11434`
- `--openai-base-url` with default `https://api.openai.com/v1`
- `--openai-api-key` or `OPENAI_API_KEY` for OpenAI requests
- `--session-id` to pin a Langfuse session id across all model calls in a single command
- `--timeout-seconds` with default `180`
- `--max-review-iterations` with default `5`

### Check-in options

`checkin` accepts:

- optional `--date YYYY-MM-DD` (defaults to today)
- creates `checkins/YYYY-MM-DD-checkin.md`
- fails if that file already exists
- pre-fills planned/completed workouts from `plan.json` day count when available, otherwise `0`

Matching environment variables are also supported:

- `TRAINER_OLLAMA_MODELS`
- `TRAINER_OPENAI_MODELS`
- `TRAINER_OLLAMA_BASE_URL`
- `TRAINER_OLLAMA_TIMEOUT_SECONDS`
- `TRAINER_PLAN_REVIEW_MAX_ITERATIONS`
- `OPENAI_BASE_URL`
- `OPENAI_API_KEY`
- `LANGFUSE_PUBLIC_KEY` (optional)
- `LANGFUSE_SECRET_KEY` (optional)
- `LANGFUSE_HOST` (optional, defaults to Langfuse cloud host)

Langfuse tracing is automatically disabled during `pytest` runs. Local JSONL trace logging still works when `llm_log_path` is configured.

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

`paid_openai` tests are skipped by default so routine runs stay on local/free paths.
To include OpenAI-path tests explicitly:

```bash
cd trainer
poetry run pytest -q --run-paid
```

## Blob publish

To host the frontend on Vercel without relying on local repo files, publish the generated workspace artifacts to Vercel Blob:

```bash
cd trainer
poetry install
poetry run personal-trainer publish-web albert
```

Optional flags:

- `--prefix` to change the blob pathname prefix
- `--access public|private` to match the Blob store access mode

Required environment variables:

- `BLOB_READ_WRITE_TOKEN`
- `TRAINER_BLOB_PREFIX`
- `TRAINER_BLOB_ACCESS`

## Jeff the Cook

Recipe generation no longer lives in the Python trainer module. The Next.js frontend owns Jeff the Cook end to end, including voice interpretation, recommendation generation, and saved recipe snapshots in Vercel Blob.

See `.env.example`.
