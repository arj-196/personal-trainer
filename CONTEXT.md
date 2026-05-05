# Personal Trainer

Personal Trainer generates training plans and recipe recommendations, then exposes them through web and mobile execution surfaces.

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

**Workout Block**:
An executable unit inside a **Workout Session**, such as warm-up, exercise, finisher, or recovery.
_Avoid_: Card, item

**Check-in**:
A dated athlete update used by the trainer workflow when generating a future **Workout Plan**.
_Avoid_: Survey, report

**Recipe Workspace**:
The draft state used to collect ingredients, constraints, and mode before recipe recommendations are generated.
_Avoid_: Recipe editor, pantry

**Saved Recipe Snapshot**:
An immutable saved recipe recommendation together with the recipe state that produced it.
_Avoid_: Recipe, favorite

## Relationships

- A **Workspace** has exactly one current **Athlete Profile** and may have many **Check-ins**.
- A **Workspace** may contain one current **Workout Plan**.
- A **Workout Plan** contains one or more **Workout Days**.
- A **Workout Session** executes exactly one **Workout Day**.
- A **Workout Day** produces one or more **Workout Blocks** for session execution.
- A **Recipe Workspace** may produce many **Saved Recipe Snapshots** over time.

## Example dialogue

> **Dev:** "Should mobile edit the **Workout Plan** when a block is marked done?"
> **Domain expert:** "No. Completion belongs to the **Workout Session** on that device; the **Workout Plan** remains the generated prescription."

## Flagged ambiguities

- "frontend" previously referred to all user-facing app code. Resolved: use **web app** for `app_web/`, **mobile app** for `app_mobile/`, and **shared package** for platform-neutral domain logic.
