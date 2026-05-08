# Personal Trainer Monorepo

Personal Trainer is a multi-app repository for generating workout plans, running the Jeff the Cook recipe workspace, and publishing a gym-friendly view of the plan.

The workout planner now uses Ollama and OpenAI-backed trainer agents instead of hardcoded split and exercise rules. The Python app packages the athlete profile, check-in history, and a compact exercise catalog names context into a structured LLM request, then runs a planner-reviewer loop where Arnold Schwarzenegger and Doctor Mike review each draft until approval or max iterations, then writes the resulting week plan to JSON plus Markdown.
Generated plans now include explicit workout timing metadata (active durations, set counts, and rest durations) so the start-workout experience can run a guided timer workflow.
Trainer prompts now live in file-based Jinja templates, and each model call is traced with workspace-scoped JSONL logs plus optional Langfuse integration.

## Apps

- `trainer/`: Python + Poetry trainer engine and CLI
- `app_web/`: Next.js workout and recipe UI plus mobile read API
- `app_mobile/`: Expo React Native workout app
- `packages/shared/`: shared TypeScript domain logic for web and mobile
- `workspaces/`: generated user workspaces and plan files

## Repo layout

```text
.
├── trainer/
├── app_web/
├── app_mobile/
├── packages/
├── workspaces/
└── README.md
```

## What each app does

### Trainer

The trainer app owns the trainer workflow:

- creates workspaces under `./workspaces/<name>`
- generates `profile.json`, `plan.json`, `plan_review.json`, `profile.md`, `plan.md`, and `coach_notes.md` through Ollama or OpenAI trainer agents
- creates check-in templates with a dedicated command: `personal-trainer checkin <workspace>`
- can generate multiple plans in one run so you can compare model outputs side by side
- maintains the bundled exercise catalog used for planner guidance and exercise image mapping
- publishes a text-only version of the current plan to Apple Notes

See [trainer/README.md](/Users/arjun/Personal/apps/personal_trainer/trainer/README.md).

### Web app

The web app reads generated workspace JSON and provides the browser-facing app:

- Tailwind CSS utility-first styling on top of Next.js + React
- homepage hub with workout summary and a dedicated Recipes entry point
- read-only workout overview with per-day summaries before the session starts
- single-day workout view with per-device checklist persistence
- fixed start-workout timer panel with set-by-set active/rest pacing
- Jeff the Cook recipe workspace with voice-first draft updates, explicit generation, measured ingredient lists, and saved recipe snapshots
- read-only mobile API routes under `/api/mobile/...` for the Expo app


See [app_web/README.md](/Users/arjun/Personal/apps/personal_trainer/app_web/README.md).

### Mobile app

The mobile app is an Expo React Native app focused on workout execution:

- loads workspace, profile, and plan data from the web app mobile API
- shows a native workspace hub and workout overview
- runs the same shared timer state machine as the web start-workout flow
- persists completion progress locally on the device

See [app_mobile/README.md](/Users/arjun/Personal/apps/personal_trainer/app_mobile/README.md).

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

### 2. Install JavaScript workspaces

```bash
npm install
npm test
```

The web workspace explicitly lists `@tailwindcss/oxide-linux-x64-gnu` as an optional dependency so Linux Vercel builds do not miss Tailwind's native binding when npm installs from the monorepo workspace lockfile generated on macOS.

### 3. Run the web app

```bash
npm run dev:web
```

Open `http://localhost:3000`.

To build the web app Docker image from the monorepo root:

```bash
docker build -f app_web/Dockerfile -t personal-trainer-frontend .
```

### 4. Run the mobile app

```bash
EXPO_PUBLIC_TRAINER_API_BASE_URL=http://localhost:3000 npm run dev:mobile
```

Set `EXPO_PUBLIC_TRAINER_API_TOKEN` too if the web app has `TRAINER_MOBILE_API_TOKEN` configured.

### 5. Deploy the mobile app to iPhone with TestFlight

The Expo app in `app_mobile/` is configured for native iPhone builds with EAS and does not require Expo Go.

Prerequisites:

- paid Apple Developer account
- App Store Connect app for bundle ID `com.arjun.personaltrainer`
- production mobile API available at `https://personal-trainer-orpin.vercel.app/`

Run the EAS setup and release commands from `app_mobile/`:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --latest
```

For internal device testing before TestFlight release, build the preview profile instead:

```bash
npx eas-cli@latest build --platform ios --profile preview
```

Local mobile development should still point to `http://localhost:3000`, but preview and production EAS builds use the public Vercel backend configured in `eas.json`.

## Typical workflow

1. Create or update a workspace from the trainer CLI.
2. Make sure Ollama is running locally for Ollama targets, or set `OPENAI_API_KEY` for OpenAI targets.
3. Generate the workout plan with `poetry run personal-trainer plan <workspace>`.
4. Create check-ins with `poetry run personal-trainer checkin <workspace>`, fill them manually, then run `plan` again.
5. If you host the web app on Vercel, run `poetry run personal-trainer publish-web <workspace>`.
6. Open the web app to view the current workout or use Jeff the Cook.
7. Open the mobile app locally or install the TestFlight build to run a native workout session from the same published plan.
8. Optionally publish the current plan to Apple Notes from the trainer app.

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

- The web app now owns recipe generation and saved recipe persistence.
- The trainer app is the source of truth for plan generation.
- `plan` uses Ollama by default with `gpt-oss:20b`.
- `plan` automatically uses the latest `checkins/YYYY-MM-DD-checkin.md` file when present.
- `checkin` is the only command that creates check-in templates.
- You can compare multiple models in one run with repeated `--ollama-model` and `--openai-model` flags.
- Multi-model runs write separate model-specific plan files directly under `workspaces/<workspace>/`.
- You can override provider settings with `--ollama-base-url`, `--openai-base-url`, `OPENAI_API_KEY`, and the corresponding planner environment variables.
- You can control review loop depth with `--max-review-iterations` or `TRAINER_PLAN_REVIEW_MAX_ITERATIONS` (default `5`).
- Each trainer model call writes a JSONL trace record to `workspaces/<workspace>/.trainer/logs/llm_calls.jsonl`.
- Review loop runs add multiple LLM trace records per generated plan (`planner_initial`, persona reviews, and optional planner revisions).
- Langfuse tracing is optional via `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and optional `LANGFUSE_HOST`.
- Langfuse tracing is automatically disabled during `pytest` runs, while local JSONL trace logging remains enabled where configured.
- The web and mobile apps share workout and recipe domain helpers from `packages/shared`.
- Jeff the Cook recommendations now require measured ingredient lines and validate that every used/extra ingredient is listed.
- The web app reads generated JSON files rather than parsing Markdown as a data source.
- The mobile app reads plans through the web app mobile API and stores completion state locally.
