# PRD: Workout Module

## 1. Overview

The Workout Module is the frontend workout experience inside Personal Trainer. It lets the user:
- select a workspace
- review a generated weekly plan
- open a specific training day
- run a guided, timer-driven session flow
- track completion state per workout block on the current device

The module is driven by pre-generated plan data (`plan.json`) and is intentionally read-only for workout programming.

The primary interaction model is:
- user selects a workspace from the homepage
- user opens workout overview
- user starts a workout day session
- app guides active/rest timing through a compact sticky timer panel
- user checks blocks complete as they finish
- app persists completion state in browser local storage

This is not a planning editor. It is a **session execution workspace** with clear pre-session and in-session modes.

## 2. Product goals

### Goals
- Make it fast to go from workspace selection to active workout execution
- Keep pre-session planning view lightweight and easy to scan
- Provide a focused in-session timer workflow with active/rest cues
- Support warm-up, exercises, finisher, and recovery as first-class workout blocks
- Persist completion state per device without requiring auth
- Work well on mobile with sticky controls and compact card layouts

### Non-goals
- Editing or regenerating workout plans from the frontend
- Multi-user auth and account management
- Cross-device sync for workout completion state
- Historical analytics, streaks, leaderboards, or social features
- Real-time trainer chat
- Replacing the trainer CLI as source of truth

## 3. Primary user

Single personal user running their own generated workspace plan.

There is no auth in MVP.

## 4. Core product principles

1. **Execution-first UI**
   - The module is optimized for running sessions, not authoring plans.

2. **Clear mode separation**
   - Workout overview is read-only and lightweight.
   - Start workout view is action-heavy and timer-guided.

3. **Plan data is source of truth**
   - The frontend displays normalized `plan.json` content.
   - Frontend does not modify training prescriptions.

4. **Mobile-friendly gym ergonomics**
   - Sticky timer panel and large tap targets are mandatory.
   - Completed cards should collapse visually to reduce clutter.

5. **Local persistence over complexity**
   - Completion state is device-local (`localStorage`) and keyed by workspace + day.

## 5. UX summary

## Main screen layout

The module has three primary screens:

1. **Homepage workout hub (`/`)**
   - Workspace picker
   - Current plan summary/meta
   - Primary actions to open overview or start session

2. **Workout overview (`/workout/[workspace]`)**
   - Hero header with plan context
   - Per-day cards showing warm-up, exercise names, optional finisher/recovery
   - Per-day `Start workout` entry

3. **Start workout session (`/workout/[workspace]/start?day=<index>`)**
   - Sticky timer/coach panel
   - Session progress indicator
   - Full workout blocks with check toggles

## Workout overview details

- Each day card must show:
  - day heading
  - warm-up text
  - exercise name list
  - optional finisher text
  - optional recovery text
- Each day card must include a direct CTA to start that specific day.

## Start workout details

- Render ordered blocks for the selected day:
  - Warm-up
  - Exercise blocks (one per exercise)
  - Optional Finisher
  - Optional Recovery
- Sticky top panel must include:
  - current block name
  - countdown timer
  - set indicator for exercise blocks
  - coach mode label (`Exercise`, `Rest`, `Ready`)
  - previous/next block controls
  - start/pause control
- Session section must include:
  - completed/total progress count
  - progress bar
  - workout block cards with completion toggle

## 6. Core user flows

### Flow A: Open workout from homepage
1. User lands on homepage
2. User selects workspace
3. App loads `plan.json` for selected workspace
4. User taps `Open workout`
5. App opens `/workout/[workspace]`

### Flow B: Start day from overview
1. User opens workout overview
2. User reviews day cards
3. User taps `Start workout` on a day
4. App opens `/workout/[workspace]/start?day=<1-based index>`
5. App preloads selected day blocks and existing local completion state

### Flow C: Timer-driven block execution
1. User lands on start view for a day
2. User taps `Start`
3. Timer enters active phase for current block
4. For exercise blocks:
   - transition to rest-between-sets until final set
   - transition to rest-between-exercises after final set when applicable
5. App moves to next block in `idle` after transition rest ends
6. User taps `Start` again to begin next block

### Flow D: Mark completion
1. User checks a block as done
2. Card updates visual done state
3. Completion list persists to local storage
4. Reopening same workspace/day restores completion state

### Flow E: Jump between blocks
1. User taps previous or next in sticky panel
2. App selects target block
3. Timer resets to idle for selected block
4. User starts timing when ready

## 7. Functional requirements

### 7.1 Homepage workout hub
- Must list available workspaces
- Must allow selecting active workspace
- Must show selected plan summary when available
- Must provide actions:
  - `Open workout`
  - `Start session`
- If no workspaces, must show setup guidance
- If workspace has no `plan.json`, must show actionable empty state

### 7.2 Workout overview route
- Must be available at `/workout/[workspace]`
- Must return not-found state for missing plans
- Must show one card per workout day
- Must show warm-up and exercises on each day
- Must conditionally show finisher/recovery only when present
- Must provide per-day deep-link start actions via `?day=<index>`

### 7.3 Start workout route
- Must be available at `/workout/[workspace]/start`
- Must support optional `day` query param as 1-based day index
- Invalid or missing day must fall back to first plan day
- Missing plan or empty days must produce not-found state

### 7.4 Workout block model
- Must derive blocks from one selected day in this order:
  - warm-up
  - each exercise
  - optional finisher
  - optional recovery
- Exercise blocks must include:
  - name
  - prescription
  - notes
  - timing values
  - optional image URL
  - Google Images search name

### 7.5 Timer state machine
- Supported phases:
  - `idle`
  - `active`
  - `rest-between-sets`
  - `rest-between-exercises`
  - `complete`
- Behavior requirements:
  - non-exercise blocks complete after one active phase
  - multi-set exercises auto-cycle active/rest-between-sets
  - post-exercise transition rest uses `restBetweenExercisesSeconds`
  - after transition rest, next block is selected and timer waits in idle
  - start/pause must work without losing phase context

### 7.6 Completion tracking
- Completion state must be keyed by:
  - workspace
  - day heading
- Storage key format:
  - `personal-trainer:workout-progress:<workspace>:<dayHeading>`
- Must support:
  - read
  - write
  - toggle completion
- Malformed stored values must safely fall back to empty state

### 7.7 Workout cards
- Must support two display variants:
  - compact/read-only context
  - start-session context
- In start-session view:
  - completed cards should collapse visually
  - completion toggle must stay available
- Exercise cards should expose Google Images quick-open action

### 7.8 Data source behavior
- Frontend must read workout data from configured source:
  - local workspace files
  - Vercel Blob
- `plan.json` is required input for workout module
- Frontend must not mutate plan data

## 8. Non-functional requirements

- Must be mobile-friendly and reliable in gym usage conditions
- Must keep interaction latency low for timer and toggle actions
- Must degrade gracefully when workspace data is missing
- Must avoid server writes for workout completion state
- Must keep implementation simple and maintainable
- Must support deployment with either local or Blob data mode

## 9. Technical architecture

## Frontend
Use Next.js App Router with TypeScript.

Frontend responsibilities:
- workspace selection and plan summary rendering
- workout overview rendering
- start workout session UI
- timer phase progression in client state
- local completion persistence
- optional image lookup actions

## Backend/API
No dedicated workout-generation API is required for this module.

Server responsibilities for this module are limited to reading and serving existing plan/profile data through existing data access paths.

## Storage
Two read sources are supported for plan data:
- local filesystem (server-side read in local mode)
- Vercel Blob (server-side read in blob mode)

Workout completion state persistence:
- browser `localStorage`
- per device
- non-synced

## 10. Recommended routes

- `GET /`
  - workspace hub and current plan summary

- `GET /workout/[workspace]`
  - read-only workout overview

- `GET /workout/[workspace]/start`
  - start workout page for selected day (`?day=<1-based index>`)

- `GET /api/workspace-images/[workspace]/[...slug]`
  - proxy for workspace image assets when needed

## 11. Data model

```ts
export type WorkoutExercise = {
  name: string;
  prescription: string;
  notes: string;
  sets: number;
  activeSeconds: number;
  restBetweenSetsSeconds: number;
  restBetweenExercisesSeconds: number;
  imageUrl: string | null;
};

export type WorkoutDay = {
  heading: string;
  warmup: string;
  warmupActiveSeconds: number;
  exercises: WorkoutExercise[];
  finisher: string;
  finisherActiveSeconds: number;
  recovery: string;
  recoveryActiveSeconds: number;
};

export type WorkoutPlan = {
  title: string;
  meta: Array<{ label: string; value: string }>;
  summary: string;
  progression: string;
  days: WorkoutDay[];
  nextCheckIn: string;
};

export type WorkoutBlockKind = 'warmup' | 'exercise' | 'finisher' | 'recovery';

export type WorkoutBlock = {
  id: string;
  kind: WorkoutBlockKind;
  name: string;
  prescription: string;
  notes: string;
  activeSeconds: number;
  setCount: number;
  restBetweenSetsSeconds: number | null;
  restBetweenExercisesSeconds: number | null;
  imageUrl: string | null;
  searchName: string | null;
};

export type TimerPhase =
  | 'idle'
  | 'active'
  | 'rest-between-sets'
  | 'rest-between-exercises'
  | 'complete';
```

## 12. Local persistence design

Use one localStorage record per workspace/day pair.

Key pattern:
```txt
personal-trainer:workout-progress:<workspace>:<dayHeading>
```

Value shape:
```ts
string[] // completed block ids
```

Rules:
- writes happen after completion state changes
- invalid JSON or wrong value shape resolves to empty list
- no cross-device sync guarantees

## 13. Plan normalization defaults

When reading plans, frontend normalization should enforce safe defaults for timing fields if missing/invalid:
- `warmupActiveSeconds`: 300
- exercise `sets`: 3
- exercise `activeSeconds`: 45
- exercise `restBetweenSetsSeconds`: 90
- exercise `restBetweenExercisesSeconds`: 120
- `finisherActiveSeconds`: 300
- `recoveryActiveSeconds`: 300

Only valid absolute HTTP(S) `imageUrl` values should be used; otherwise `null`.

## 14. Timer validation rules

Before each phase transition, state must remain coherent:
- set index cannot exceed set count
- countdown values must be non-negative
- transitions must respect block boundaries
- phase must resolve to `complete` at last block end

If any transition input is inconsistent, app should return to a safe idle/waiting behavior rather than crash.

## 15. Session interpretation rules

The session panel copy/mode must map directly to timer phase:
- `active` -> mode `Exercise` with push cue
- `rest-between-sets` or `rest-between-exercises` -> mode `Rest` with recovery cue
- `idle`/`complete` -> mode `Ready` with explicit start cue

Set indicator appears only for exercise blocks.

## 16. UI component plan

Recommended component structure:

```txt
app/
  page.tsx
  workout/
    [workspace]/
      page.tsx
      start/page.tsx
  api/
    workspace-images/
      [workspace]/[...slug]/route.ts

src/components/
  StartWorkoutView.tsx
  WorkoutBlockCard.tsx

src/lib/
  trainer-data.ts
  workout-helpers.ts
  workout-progress.ts
  workout-timer-state.ts
```

## 17. UX behavior requirements

- Homepage must make workout entry obvious and low-friction
- Overview must stay concise and scannable
- Start view must prioritize timer readability and one-handed use
- Completed cards should visually de-emphasize to reduce in-session clutter
- Progress count and bar must reflect completed block ids in real time
- Day-specific deep links should land on the correct day consistently

## 18. Error handling

Handle these cases gracefully:

### Missing workspace plan
- show not-found/empty state
- keep navigation path back to dashboard

### Empty workout days
- show not-found for start route
- avoid rendering broken timer state

### Malformed local completion payload
- ignore malformed payload
- reset to empty completion list

### Missing/invalid image URL
- show non-image fallback card art
- keep session interactions unaffected

## 19. Implementation notes for Loveable

### Build priorities
Implement in this order:

1. Homepage workout entry and workspace selection surface
2. Workout overview cards with per-day start actions
3. Start workout sticky timer panel
4. Block card rendering for warm-up/exercise/finisher/recovery
5. Timer phase transitions and start/pause behavior
6. Completion toggles with local persistence
7. Progress indicator updates and completed-card collapse behavior

### Important constraints
- Keep workout module read-only against plan data
- Preserve explicit pre-session vs in-session mode separation
- Do not introduce auth as a dependency
- Do not require backend writes for completion state
- Keep mobile layout quality at parity with desktop

### Success criteria
The module is successful when:
- user can pick workspace and open workout flows quickly
- overview clearly shows each day and what it contains
- user can run one day via guided timer phases
- completion state persists per workspace/day on device
- session UI remains clear and usable during active training

## 20. Optional stretch goals

Not required for current behavior, but future-friendly:
- explicit rest skip control
- haptic/audio cues for phase transitions
- per-block notes logging
- per-day completion timestamps
- optional cloud sync for progress

## 21. Final instruction to Loveable

Design the Workout Module as a stylish execution-focused UI around the current flow:

1. homepage workout hub
2. workout overview by day
3. start workout session with sticky guided timer

Keep the experience frontend-only and read-only for plan content.

The in-session hierarchy must prioritize:
1. current block + timer
2. start/pause and block navigation controls
3. progress visibility
4. block-level completion actions

Do not convert this into a planning editor or chat-first interface.
