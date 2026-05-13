CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS athlete_profiles (
    workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    age INTEGER,
    sex TEXT NOT NULL DEFAULT '',
    height_cm INTEGER,
    weight_kg DOUBLE PRECISION,
    goal TEXT NOT NULL DEFAULT '',
    experience_level TEXT NOT NULL DEFAULT 'beginner',
    training_days INTEGER NOT NULL DEFAULT 3,
    session_length_minutes INTEGER NOT NULL DEFAULT 45,
    equipment JSONB NOT NULL DEFAULT '[]'::jsonb,
    limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
    preferred_focus JSONB NOT NULL DEFAULT '[]'::jsonb,
    cardio_preference TEXT NOT NULL DEFAULT 'walk',
    notes JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL,
    workouts_completed INTEGER NOT NULL,
    workouts_planned INTEGER NOT NULL,
    average_difficulty INTEGER NOT NULL,
    energy INTEGER NOT NULL,
    soreness INTEGER NOT NULL,
    body_weight_kg DOUBLE PRECISION,
    wins JSONB NOT NULL DEFAULT '[]'::jsonb,
    struggles JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS check_ins_workspace_date_idx
    ON check_ins(workspace_id, check_in_date);

CREATE TABLE IF NOT EXISTS workout_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    plan_version INTEGER NOT NULL,
    generated_on DATE NOT NULL,
    planner_backend TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL,
    progression_note TEXT NOT NULL,
    next_checkin_prompt TEXT NOT NULL,
    coach_notes_focus JSONB NOT NULL DEFAULT '[]'::jsonb,
    coach_notes_cautions JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_plan JSONB NOT NULL,
    rendered_plan JSONB NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS workout_plans_workspace_version_idx
    ON workout_plans(workspace_id, plan_version);

CREATE UNIQUE INDEX IF NOT EXISTS workout_plans_one_current_idx
    ON workout_plans(workspace_id)
    WHERE is_current;

CREATE TABLE IF NOT EXISTS recipe_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE DEFAULT 'default',
    draft JSONB NOT NULL,
    committed JSONB,
    has_pending_changes BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_recipe_snapshots (
    id TEXT PRIMARY KEY,
    saved_at TIMESTAMPTZ NOT NULL,
    recipe_workspace_id UUID REFERENCES recipe_workspaces(id) ON DELETE SET NULL,
    recipe_state JSONB NOT NULL,
    recommendation JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saved_recipe_snapshots_saved_at_idx
    ON saved_recipe_snapshots(saved_at DESC);
