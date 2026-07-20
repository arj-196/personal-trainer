# Claude Design Brief — Personal Trainer App Redesign

## What I want from you

Redesign the complete interface and user experience of my **Personal Trainer** web app. Propose a cohesive design system and full screen designs for every screen listed below. Once I approve a direction, the design will be implemented directly in the existing codebase, so every screen must be practical to build — no speculative features, no screens that don't map to the functionality described here.

## What the app is

Personal Trainer is a personal, single-user fitness app. It has two halves:

1. **Trainer** — an AI coach generates multi-week workout plans for an athlete, and the app guides the athlete through executing each workout day with timers, audio cues, and completion tracking. An AI persona ("Arnold", styled as Arnold Schwarzenegger) answers questions mid-workout.
2. **Jeff the Cook** — a voice-first recipe recommender. The user speaks (or types) the ingredients they have and their constraints; the app generates exactly 3 recipe recommendations, which can be saved as immutable snapshots.

It is used by one person (me), primarily **on a phone during workouts and in the kitchen** — think PWA-style mobile app, thumb-reachable controls, iOS safe-area aware. Desktop is secondary but must work.

## Domain language (use these exact terms in the UI)

- **Workspace** — a named personal data folder containing one athlete profile, plans, and check-ins. (Not "account" or "project".)
- **Athlete Profile** — the structured description of the person being trained.
- **Workout Plan** — a generated multi-day training prescription. (Not "program" or "routine".)
- **Workout Day** — one scheduled training day inside a plan.
- **Workout Session** — the act of executing one Workout Day with timer guidance and completion tracking.
- **Workout Block** — an executable unit inside a session: warm-up, exercise, finisher, or recovery.
- **Check-in** — a dated athlete update (energy, soreness, difficulty, weight, wins/struggles) used to inform the next plan.
- **Workout Plan Generation Job** — a long-running AI job that creates, reviews, and publishes a new plan.
- **Recipe Workspace** — the draft state (ingredients, notes, mode) before recipe recommendations are generated.
- **Saved Recipe Snapshot** — an immutable saved recommendation plus the state that produced it.

Relationships: a Workspace has exactly one current Athlete Profile, many Check-ins, at most one current Workout Plan, and at most one active generation job. A plan contains multiple Workout Days; a session executes exactly one day as a sequence of blocks.

## Screens to design (complete inventory)

### 1. Login
Simple username/password form (shared credentials, no signup). Error banner state.

### 2. Dashboard (`/`)
- Workspace picker (list of workspaces, link into each)
- Current-plan overview card for the active workspace
- Entry point to Jeff the Cook recipes
- Create Workspace form (just a name)
- Sign out

### 3. Workspace page (`/workspace/[slug]`)
- **Athlete Profile editor**: name, goal, age, sex, height, weight, experience level, cardio preference, training days per week, session length minutes; multi-line lists for equipment, limitations, preferred focus, notes.
- **Check-ins**: list of past check-ins (each expandable/editable) + new check-in form. Fields: date, workouts completed/planned, difficulty (1–10), energy (1–10), soreness (1–10), body weight, wins, struggles, notes. Check-ins are only available once a plan exists — design a clear empty/locked state explaining why.
- **Plan generation panel** (see screen 7).

### 4. Workout Plan overview (`/workout/[slug]`)
- Plan title, metadata label/value pairs, summary, progression notes, next check-in guidance.
- One card per Workout Day: heading, warm-up description, exercise names, optional finisher and recovery. Each day has a "Start workout" action.
- Empty state when no plan exists yet (with generate action).

### 5. Workout Session (`/workout/[slug]/start?day=N`) — **the most important screen**
This is used mid-workout, phone in hand, sweaty fingers. It must be glanceable from 1 m away and operable with a thumb.
- Sequence of **Workout Block cards**: kind (warmup / exercise / finisher / recovery — currently color-coded cyan / neutral / amber / violet), name, prescription (e.g. "3×10 @ RPE 7"), notes, optional exercise image, mark-done checkbox. Completed blocks collapse into a compact done state. Auto-scrolls to the current block.
- **Progress header**: completed/total counter + progress bar. Progress persists locally per day.
- **Timer dock** (bottom-fixed, toggleable): current block name, large MM:SS countdown, "Set x/N" for exercises, phase chip — Get ready (3 s buffer) / Exercise / Rest / Ready — with short coach copy ("Push now. Keep form clean."), prev/next block arrows, big play/pause. The timer runs a state machine: active → rest-between-sets → rest-between-exercises → auto-advance to next block, with audio cues. Phases need instantly distinguishable visual states (currently amber/red/cyan).
- **Two floating action buttons**: toggle coach chat, toggle timer dock.
- **Coach chat ("Ask Arnold")**: floating panel; user bubbles + persona replies attributed to Arnold Schwarzenegger; empty-state hint, loading state ("Arnold is answering…"), error with retry; input capped at 800 chars. Chat is ephemeral (browser memory only) — the design can signal that it isn't saved.

### 6. Jeff the Cook (`/recipes`)
- **Draft area**: Ingredients list and Notes (both editable text), and a Mode selector with three options: Strict (only my ingredients) / Hybrid / Anything.
- **Big mic button** (currently bottom-center): record voice → transcription → interpretation updates the draft, with visible status stages ("Transcribing…", "Interpreting…") and an explanation of what changed.
- **Generate Recipes** action → exactly 3 recommendation cards. Each expands to: title, summary, rationale, total minutes, measured ingredient lines, ingredient chips grouped as available-used / available-unused / extra-needed, numbered steps, Save button.
- A "Pending changes" vs "Recommendations synced" indicator showing whether the draft matches the current recommendations.

### 7. Plan Generation Job status (embedded panel on screens 3 & 4)
- Generate button → live job status polled every 2 s: version, status pill (queued / running / succeeded / failed), current step, recent step history (with per-step status), and an **AI review feed** (reviewer name, iteration, status, reasoning summary, blocking issues, suggested changes). Auto-reveals the new plan on success. This is a rich long-running-process UI — make waiting feel informative, not broken.

### 8. Saved Recipes (`/saved-recipes` and `/saved-recipes/[id]`)
- List of snapshots (title, summary, saved timestamp) with open/delete.
- Detail view: immutable snapshot — recipe plus the frozen ingredients/notes/mode that produced it. Delete needs a confirmation affordance (currently deletes instantly — a known flaw).

## Current visual identity (starting point, not a constraint)

- Coral/salmon primary accent (#ff6359, gradient #ff6a60 → #ff7f5d), near-black ink (#17181c), cyan secondary, warm off-white layered-gradient background.
- Frosted-glass cards (white/80 + backdrop blur, ~1.75 rem radius), pill buttons with hover lift.
- Headings in Avenir Next Condensed, body Avenir Next — system fonts only, so non-Apple devices silently fall back to Arial Narrow (a problem: pick real, loadable web fonts).
- Light mode only. The session screen, timer dock, and chat header use dark surfaces.

You may evolve or replace this identity. Keep the feel energetic and athletic rather than clinical/corporate, and keep the recipe half feeling like the same product as the trainer half.

## Known UX problems the redesign must fix

1. **No global navigation.** Every page hand-rolls its own header and back-links; the trainer and recipe halves are only connected by promo cards. Design a coherent navigation model (mobile-first — e.g. bottom tab bar or equivalent) that unifies Dashboard / Workout / Recipes / Saved Recipes.
2. **No design system.** Styles are copy-pasted string constants across pages and have drifted. Deliver real tokens: color scales, type scale, spacing, radii, component states.
3. **Weak loading and progress states.** Recipe generation, transcription, and plan generation show only text strings. Design proper skeletons/spinners/progress affordances, especially for the multi-minute plan generation job.
4. **Undiscoverable double-click-to-edit** on the recipe draft fields — terrible on touch. Replace with an obvious edit affordance.
5. **Destructive delete without confirmation** on saved recipes.
6. **Confusing gating** of check-ins behind plan existence — needs a self-explanatory locked/empty state.
7. **Error states** are plain red boxes; retry exists only in chat. Standardize error + retry patterns.
8. Empty states generally (new workspace, no plan, no check-ins, no saved recipes, empty chat) need intentional design.

## Hard constraints for implementability

- **Stack**: Next.js 16 App Router, React 19, **Tailwind CSS v4** (CSS-first config), no component library, inline SVG icons (an icon set suggestion is welcome). Design tokens should be expressible as Tailwind v4 CSS variables/theme.
- **Mobile-first**, iOS safe-area aware (bottom docks and FABs must respect `safe-area-inset-bottom`). Must also work at desktop widths (~max-w-6xl shells today).
- Web fonts must be freely available (e.g. Google Fonts) and loadable via `next/font`.
- Light mode is required; a dark mode is a welcome bonus, and the Workout Session screen may remain dark-themed by design.
- Keep the data shapes as-is: don't design UI that requires data the app doesn't have (listed above per screen).
- Single shared login — no user avatars, profiles menus, or multi-user features.

## Deliverables

1. A design system: palette, typography (with real font choices), spacing/radius scale, and core components (buttons, cards, inputs, pills/status chips, chat bubbles, progress bar, timer dock, FABs, nav).
2. High-fidelity mobile designs for all 8 screens above, plus desktop layouts for Dashboard, Workspace, Plan overview, and Jeff the Cook.
3. Key states per screen: empty, loading, error, and — for the session screen — the timer phases (get-ready / exercise / rest / complete) and completed-block states.
4. The navigation model connecting everything.

Prioritize the Workout Session screen and Jeff the Cook — they are the two screens used most, both in "hands busy" contexts.
