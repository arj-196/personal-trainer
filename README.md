# Personal Trainer Monorepo

Personal Trainer is a multi-app repository for generating workout plans, browsing the exercise library, running the Jeff the Cook recipe workspace, and publishing a gym-friendly view of the plan.

The workout planner now uses Ollama and OpenAI-backed trainer agents instead of hardcoded split and exercise rules. The Python app packages the athlete profile, check-in history, and exercise library context into a structured LLM request, then writes the resulting week plan to JSON plus Markdown.

## Apps

- `trainer/`: Python + Poetry trainer engine and CLI
- `frontend/`: Next.js workout and exercise library UI
- `workspaces/`: generated user workspaces and plan files

## Repo layout

```text
.
├── jeff_the_cook_prd.md
├── jeff_the_cook.png
├── trainer/
├── frontend/
├── workspaces/
└── README.md
```

## Product docs

- `jeff_the_cook_prd.md`: product requirements for the Jeff the Cook recipe workspace
- `jeff_the_cook.png`: UI mockup for the recipe workspace

## What each app does

### Trainer

The trainer app owns the trainer workflow:

- creates workspaces under `./workspaces/<name>`
- generates `profile.json`, `plan.json`, `profile.md`, `plan.md`, `plan.pdf`, `coach_notes.md`, and check-in templates through Ollama or OpenAI trainer agents
- can generate multiple plans in one run so you can compare model outputs side by side
- maintains the bundled exercise library
- publishes a text-only version of the current plan to Apple Notes

See [trainer/README.md](/Users/arjun/Personal/apps/personal_trainer/trainer/README.md).

### Frontend

The frontend reads generated workspace JSON plus library assets and provides the user-facing app:

- homepage hub with workout summary and a dedicated Recipes entry point
- read-only workout overview with per-day summaries before the session starts
- single-day workout view with per-device checklist persistence
- exercise library view
- Jeff the Cook recipe workspace with voice-first draft updates, explicit generation, and saved recipe snapshots
- explicit page-to-page navigation through the homepage instead of a persistent bottom nav
- Google Images lookups for each exercise card
- detailed exercise cards reserved for the start-workout view
- completed exercises collapse in the start-workout view to reduce distraction
- finisher and recovery rendered as workout blocks instead of labels
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
5. Open the frontend to view the current workout, browse the exercise library, or use Jeff the Cook.
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

- The frontend now owns recipe generation and saved recipe persistence.
- The trainer app is the source of truth for plan generation.
- Every generated plan also writes a PDF copy so it is easier to view offline on a phone.
- `plan` and `refresh` use Ollama by default with `gpt-oss:20b`.
- You can compare multiple models in one run with repeated `--ollama-model` and `--openai-model` flags.
- Multi-model runs write separate model-specific plan files directly under `workspaces/<workspace>/`.
- You can override provider settings with `--ollama-base-url`, `--openai-base-url`, `OPENAI_API_KEY`, and the corresponding planner environment variables.
- The frontend reads generated JSON files rather than parsing Markdown as a data source.
