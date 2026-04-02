# Personal Trainer Monorepo

Personal Trainer is a multi-app repository for generating workout plans, browsing the exercise library, suggesting recipes from pantry ingredients, and publishing a gym-friendly view of the plan.

The workout planner now uses Ollama and OpenAI-backed trainer agents instead of hardcoded split and exercise rules. The Python app packages the athlete profile, check-in history, and exercise library context into a structured LLM request, then writes the resulting week plan to JSON plus Markdown.

## Apps

- `trainer/`: Python + Poetry trainer engine and CLI
- `frontend/`: Next.js workout and exercise library UI
- `workspaces/`: generated user workspaces and plan files

## Repo layout

```text
.
├── RECIPE_SUGGESTION_PRD.md
├── trainer/
├── frontend/
├── workspaces/
└── README.md
```

## Product docs

- `RECIPE_SUGGESTION_PRD.md`: product requirements for pantry-based, goal-aware recipe suggestions

## What each app does

### Trainer

The trainer app owns the trainer workflow:

- creates workspaces under `./workspaces/<name>`
- generates `profile.json`, `plan.json`, `profile.md`, `plan.md`, `plan.pdf`, `coach_notes.md`, and check-in templates through Ollama or OpenAI trainer agents
- can generate multiple plans in one run so you can compare model outputs side by side
- maintains the bundled exercise and recipe libraries
- suggests recipes from pantry ingredients and the user's goal
- publishes a text-only version of the current plan to Apple Notes

See [trainer/README.md](/Users/arjun/Personal/apps/personal_trainer/trainer/README.md).

### Frontend

The frontend reads generated workspace JSON plus library assets and provides two core views:

- current workout view
- exercise library view
- recipe suggestions based on pantry ingredients and the active goal
- compact, low-scroll layout for workout and library browsing
- homepage header shows the current git commit id
- optional Vercel Blob-backed hosting mode for internet deployment
- optional `DEBUG=true` homepage debug panel for runtime inspection

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
5. Open the frontend to view the current workout, browse the exercise library, or get recipe suggestions.
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
├── plan.pdf
├── coach_notes.md
├── checkins/
└── exercise_library/
```

## Notes

- The frontend is currently read-only.
- The trainer app is the source of truth for plan generation.
- Every generated plan also writes a PDF copy so it is easier to view offline on a phone.
- `plan` and `refresh` use Ollama by default with `gpt-oss:20b`.
- You can compare multiple models in one run with repeated `--ollama-model` and `--openai-model` flags.
- Multi-model runs write separate model-specific plan files directly under `workspaces/<workspace>/`.
- You can override provider settings with `--ollama-base-url`, `--openai-base-url`, `OPENAI_API_KEY`, and the corresponding planner environment variables.
- The frontend reads generated JSON files rather than parsing Markdown as a data source.
