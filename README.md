# Personal Trainer Monorepo

Personal Trainer is a multi-app repository for generating workout plans, running the Jeff the Cook recipe workspace, and publishing a gym-friendly view of the plan.

The workout planner now uses Ollama and OpenAI-backed trainer agents instead of hardcoded split and exercise rules. The Python app packages the athlete profile, check-in history, and a compact exercise catalog names context into a structured LLM request, then runs a planner-reviewer loop where Arnold Schwarzenegger and Doctor Mike review each draft until approval or max iterations, then writes the resulting week plan to JSON plus Markdown.
Generated plans now include explicit workout timing metadata (active durations, set counts, and rest durations) so the start-workout experience can run a guided timer workflow.
Trainer prompts now live in file-based Jinja templates, and each model call is traced with workspace-scoped JSONL logs plus optional Langfuse integration.

## Apps

- `trainer/`: Python + Poetry trainer engine and CLI
- `frontend/`: Next.js workout and recipe UI
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
- generates `profile.json`, `plan.json`, `plan_review.json`, `profile.md`, `plan.md`, `coach_notes.md`, and check-in templates through Ollama or OpenAI trainer agents
- can generate multiple plans in one run so you can compare model outputs side by side
- maintains the bundled exercise catalog used for planner guidance and exercise image mapping
- publishes a text-only version of the current plan to Apple Notes

See [trainer/README.md](/Users/arjun/Personal/apps/personal_trainer/trainer/README.md).

### Frontend

The frontend reads generated workspace JSON and provides the user-facing app:

- Tailwind CSS utility-first styling on top of Next.js + React
- homepage hub with workout summary and a dedicated Recipes entry point
- read-only workout overview with per-day summaries before the session starts
- single-day workout view with per-device checklist persistence
- fixed start-workout timer panel with set-by-set active/rest pacing
- Jeff the Cook recipe workspace with voice-first draft updates, explicit generation, and saved recipe snapshots


See [frontend/README.md](/Users/arjun/Personal/apps/personal_trainer/frontend/README.md).

## Quick start

### 1. Generate a workspace and plan

```bash
cd trainer
poetry install
# run in a separate terminal if Ollama is not already running
ollama serve
ollama pull gpt-oss:20b
poetry run personal-trainer init albert
poetry run personal-trainer plan albert
poetry run personal-trainer plan albert --ollama-model gpt-oss:20b --openai-model gpt-5.4-mini
```

This creates files under `./workspaces/albert/`.

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
2. Make sure Ollama is running locally for Ollama targets, or set `OPENAI_API_KEY` for OpenAI targets.
3. Generate or refresh the workout plan.
4. If you host the frontend on Vercel, run `poetry run personal-trainer publish-web <workspace>`.
5. Open the frontend to view the current workout or use Jeff the Cook.
6. Optionally publish the current plan to Apple Notes from the trainer app.

## Workspace model

Every user workspace lives in:

```text
workspaces/<workspace-name>/
```

Typical contents:

```text
workspaces/albert/
├── profile.json
├── profile.md
├── plan.json
├── plan.md
├── coach_notes.md
└── checkins/
```

## Notes

- The frontend now owns recipe generation and saved recipe persistence.
- The trainer app is the source of truth for plan generation.
- `plan` and `refresh` use Ollama by default with `gpt-oss:20b`.
- You can compare multiple models in one run with repeated `--ollama-model` and `--openai-model` flags.
- Multi-model runs write separate model-specific plan files directly under `workspaces/<workspace>/`.
- You can override provider settings with `--ollama-base-url`, `--openai-base-url`, `OPENAI_API_KEY`, and the corresponding planner environment variables.
- You can control review loop depth with `--max-review-iterations` or `TRAINER_PLAN_REVIEW_MAX_ITERATIONS` (default `5`).
- Each trainer model call writes a JSONL trace record to `workspaces/<workspace>/.trainer/logs/llm_calls.jsonl`.
- Review loop runs add multiple LLM trace records per generated plan (`planner_initial`, persona reviews, and optional planner revisions).
- Langfuse tracing is optional via `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and optional `LANGFUSE_HOST`.
- Langfuse tracing is automatically disabled during `pytest` runs, while local JSONL trace logging remains enabled where configured.
- The frontend reads generated JSON files rather than parsing Markdown as a data source.
