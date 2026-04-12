# Codex task: implement prompt templates and lightweight LLM tracing

## Goal
Refactor the app so prompt text lives in Jinja2 template files, not inline Python strings, and add lightweight tracing for LLM executions, including multi-step multi-model workflows.

## Working style
Inspect the relevant code first, then make the smallest complete change.
Do not introduce heavy frameworks.
Preserve existing behavior unless a change is required for the refactor.

## Implement

### 1) Prompt templates
Create a file-based prompt system using Jinja2.

Add a directory like:

```text
prompts/
  trainer/
    weekly_plan.jinja
```

Move the current inline prompt text from the existing trainer prompt builder into `prompts/trainer/weekly_plan.jinja`.

Keep templates mostly text-only.
Do data shaping and JSON serialization in Python.

The template should render a variable named `payload_json`, for example:

```jinja
Create the athlete's best customized workout plan for the next week.

Use the profile and latest check-in to choose the split, exercise selection, volume, intensity, and recovery emphasis. There are no hardcoded split rules outside your judgment.

Important requirements:
- Keep `day_label` in the form `Day 1`, `Day 2`, and so on.
- Prefer exercise names from the provided exercise catalog when they fit, because the app can map those names to known exercise images.
- You may use an exercise not in the catalog when it is clearly better for the athlete.
- Match the athlete's available training days and session length unless the recovery picture strongly justifies fewer sessions.
- Keep `summary`, `progression_note`, `warmup`, `finisher`, `recovery`, and `next_checkin_prompt` concise and practical.
- Each exercise needs a compact `prescription` string, for example `4 sets x 6-8 reps @ RPE 7`.
- Add timing values as integer seconds.
- For each day include `warmup_active_seconds`, `finisher_active_seconds`, and `recovery_active_seconds`.
- For each exercise include: `sets`, `active_seconds` (per-set work duration), `rest_between_sets_seconds`, and `rest_between_exercises_seconds`.
- Keep timing realistic for the athlete's target session length.
- `coach_notes_focus` should contain the main coaching priorities for the week.
- `coach_notes_cautions` should call out pain, recovery, or execution risks only when relevant.

Planning context JSON:
{{ payload_json }}
```

### 2) Prompt manager
Add a lightweight prompt manager, for example in `prompting/manager.py`.

Requirements:
- load templates from `prompts/`
- render by template name
- fail clearly if a template is missing

Suggested interface:

```python
class PromptManager:
    def __init__(self, base_dir: str = "prompts"):
        ...

    def render(self, template_name: str, **kwargs) -> str:
        ...
```

### 3) Refactor current prompt builder
Refactor the existing `_build_user_prompt(request: TrainerPlanRequest) -> str` so it:
- still builds the same payload structure
- serializes the payload with `json.dumps(payload, indent=2, default=str)`
- renders the template via `PromptManager`
- returns the rendered prompt

Keep the payload construction logic in Python.
Do not keep the full prompt text inline after the refactor.

### 4) Add an LLM runner
Add a small wrapper for model execution, for example in `llm/runner.py`.

Requirements:
- one method for running a single model step
- accepts a workflow name, step name, model name, prompt, optional trace id, optional metadata
- returns a structured result
- logs execution locally
- integrates with Langfuse when configured
- handles errors cleanly

Suggested interface:

```python
class LLMRunner:
    def run_step(
        self,
        *,
        trace_id: str | None,
        workflow_name: str,
        step_name: str,
        model: str,
        prompt: str,
        metadata: dict | None = None,
    ) -> LLMResult:
        ...
```

`LLMResult` should include at least:
- response text
- model
- trace_id
- step_name
- raw provider response if available

### 5) Langfuse integration
Add minimal Langfuse support.

Requirements:
- initialize from environment variables
- create one trace per workflow
- create one generation or span per model call
- attach prompt input and response output
- capture errors
- if Langfuse is not configured, the app must still work

Treat Langfuse as optional, not required.

### 6) JSONL fallback logging
Add local JSONL logging to something like:

```text
logs/llm_calls.jsonl
```

Write one record per model call.

Each record should include:
- timestamp
- trace_id
- workflow_name
- step_name
- model
- prompt
- response
- metadata
- duration_ms
- success
- error, if any

Ensure the log directory is created automatically.

### 7) Multi-step workflow support
Design the runner so this is straightforward:

```python
trace_id = start_workflow("weekly_plan_generation")

plan = runner.run_step(
    trace_id=trace_id,
    workflow_name="weekly_plan_generation",
    step_name="planner",
    model="...",
    prompt=planner_prompt,
)

critique = runner.run_step(
    trace_id=trace_id,
    workflow_name="weekly_plan_generation",
    step_name="critic",
    model="...",
    prompt=critic_prompt,
)

final = runner.run_step(
    trace_id=trace_id,
    workflow_name="weekly_plan_generation",
    step_name="refiner",
    model="...",
    prompt=refiner_prompt,
)
```

Do not build a full agent framework.
Just provide clean primitives for this pattern.

## Constraints
- Use plain Python, Jinja2, Langfuse, and standard library logging/file IO.
- Do not add LangChain, Semantic Kernel, or similar heavy abstractions.
- Keep the implementation small and readable.
- Preserve current functionality.

## Files to inspect first
Inspect the existing prompt builder, current LLM call path, config handling, and test structure before editing.

## Deliverable
Make the smallest complete implementation that includes:
- prompt template file(s)
- prompt manager
- refactor of the existing inline prompt builder
- LLM runner or equivalent traced wrapper
- optional Langfuse integration
- JSONL logging
- config/dependency updates
- tests

## Acceptance criteria
The task is complete when all of the following are true:

- The trainer prompt text is no longer embedded inline in the prompt builder.
- The trainer prompt lives under `prompts/`.
- Rendering the template produces equivalent output to the previous implementation.
- There is a reusable prompt manager abstraction.
- There is a reusable traced runner for LLM calls.
- Multiple steps can share one trace id.
- Langfuse works when configured.
- The app still works when Langfuse is absent.
- Each model call writes a JSONL record.
- Tests cover prompt rendering and critical tracing/logging behavior.

## Verification
After implementing:
- run the relevant test suite
- add or update tests for template rendering
- verify a rendered prompt still contains the expected instruction text and serialized payload
- verify one model call writes a JSONL record
- verify a multi-step flow can reuse the same trace id
- verify the app still works without Langfuse credentials

## Return
Return:
- summary of changes
- files changed
- new environment variables
- follow-up risks or recommendations
