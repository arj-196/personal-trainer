# Personal Trainer

Personal Trainer generates training plans and recipe recommendations, then exposes them through the web app.

## Language

**Workspace**:
A named personal data folder containing one athlete profile, generated plans, check-ins, and related outputs.
_Avoid_: Account, tenant, project

**Athlete Profile**:
The structured description of the person the trainer is programming for.
_Avoid_: User profile, customer profile

**Workout Plan**:
A generated multi-day training prescription stored as normalized plan data.
_Avoid_: Program, routine

**Workout Day**:
One scheduled training day inside a **Workout Plan**.
_Avoid_: Session, workout

**Workout Session**:
The act of executing one **Workout Day** with timer guidance and completion tracking.
_Avoid_: Plan, workout day

**Workout Session Coach Chat**:
A temporary clarification chat inside a **Workout Session** that answers questions about the selected **Workout Day** without becoming persisted trainer history.
_Avoid_: Check-in, plan review, support ticket

**Workout Block**:
An executable unit inside a **Workout Session**, such as warm-up, exercise, finisher, or recovery.
_Avoid_: Card, item

**Check-in**:
A dated athlete update used by the trainer workflow when generating a future **Workout Plan**.
_Avoid_: Survey, report

**Workout Plan Generation Job**:
A long-running request to create, review, and publish a new **Workout Plan** for a **Workspace**.
_Avoid_: Worker job, workout request, background task

**Active Workspace**:
The **Workspace** the web app currently treats as "mine" for navigation — the last workspace opened in this browser, persisted client-side. Powers the Workout tab and the Home "Today" card.
_Avoid_: Default workspace, current account, selected workspace

**Recipe Workspace**:
The draft state used to collect ingredients, constraints, and mode before recipe recommendations are generated.
_Avoid_: Recipe editor, pantry

**Saved Recipe Snapshot**:
An immutable saved recipe recommendation together with the recipe state that produced it.
_Avoid_: Recipe, favorite

## Relationships

- A **Workspace** has exactly one current **Athlete Profile** and may have many **Check-ins**.
- A **Workspace** may contain one current **Workout Plan**.
- A **Workspace** may have at most one active **Workout Plan Generation Job**.
- A **Workout Plan** contains one or more **Workout Days**.
- A **Workout Session** executes exactly one **Workout Day**.
- A **Workout Day** produces one or more **Workout Blocks** for session execution.
- A **Workout Session Coach Chat** belongs to the active browser execution of one **Workout Session** and is not stored in the database.
- A **Recipe Workspace** may produce many **Saved Recipe Snapshots** over time.
- A browser has at most one **Active Workspace**; it is a client-side navigation concept (localStorage), never stored in the database. Fallback when unset: first workspace alphabetically; with zero workspaces, workspace-scoped tabs show a setup empty state.

## Example dialogue

> **Dev:** "Should mobile edit the **Workout Plan** when a block is marked done?"
> **Domain expert:** "No. Completion belongs to the **Workout Session** on that device; the **Workout Plan** remains the generated prescription."

## Flagged ambiguities

- "web UI" previously referred to all user-facing app code. Resolved: use **web app** for `app_web/` and **shared package** for TypeScript domain logic used by the web app.
- "all my workouts" / "the workout overview screen" have been used informally to mean the **Workspace** page (athlete profile, plan generation, and **Check-ins**). Resolved: this is the **Workspace**, not the **Workout Plan** view (which shows the current plan's **Workout Days**). **Check-ins** live on the **Workspace** page; the **Workout Plan** view links up to its parent **Workspace** so a check-in is reachable from where the plan is read.
