CREATE TABLE IF NOT EXISTS workout_plan_generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    current_step TEXT NOT NULL DEFAULT 'queued',
    target_plan_version INTEGER NOT NULL,
    planner_provider TEXT NOT NULL DEFAULT '',
    planner_model TEXT NOT NULL DEFAULT '',
    workout_plan_id UUID REFERENCES workout_plans(id) ON DELETE SET NULL,
    step_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    review_feed JSONB NOT NULL DEFAULT '[]'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS workout_plan_generation_jobs_one_active_idx
    ON workout_plan_generation_jobs(workspace_id)
    WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS workout_plan_generation_jobs_workspace_created_idx
    ON workout_plan_generation_jobs(workspace_id, created_at DESC);
