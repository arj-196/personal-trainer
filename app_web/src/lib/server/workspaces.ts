import { normalizeWorkoutPlan, type UserProfileSummary, type WorkoutPlan } from '@personal-trainer/shared/workout';

import { query, queryOne } from './db';
import { logger } from './logger';

export type AthleteProfileRecord = {
  workspaceSlug: string;
  name: string;
  age: number | null;
  sex: string;
  heightCm: number | null;
  weightKg: number | null;
  goal: string;
  experienceLevel: string;
  trainingDays: number;
  sessionLengthMinutes: number;
  equipment: string[];
  limitations: string[];
  preferredFocus: string[];
  cardioPreference: string;
  notes: string[];
};

export type CheckInRecord = {
  id: string;
  checkInDate: string;
  workoutsCompleted: number;
  workoutsPlanned: number;
  averageDifficulty: number;
  energy: number;
  soreness: number;
  bodyWeightKg: number | null;
  wins: string[];
  struggles: string[];
  notes: string[];
};

export async function listWorkspaces(): Promise<string[]> {
  const rows = await query<{ slug: string }>('SELECT slug FROM workspaces ORDER BY slug');
  return rows.map((row) => row.slug);
}

export async function createWorkspace(slug: string): Promise<void> {
  logger.info('Creating workspace', { slug });
  await query(
    `
    INSERT INTO workspaces (slug)
    VALUES ($1)
    ON CONFLICT (slug) DO NOTHING
    `,
    [slug]
  );
  await query(
    `
    INSERT INTO athlete_profiles (
      workspace_id, name, goal, experience_level, training_days, session_length_minutes,
      equipment, limitations, preferred_focus, cardio_preference, notes
    )
    SELECT id, $2, '', 'beginner', 3, 45, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'walk', '[]'::jsonb
    FROM workspaces
    WHERE slug = $1
    ON CONFLICT (workspace_id) DO NOTHING
    `,
    [slug, prettifyWorkspaceName(slug)]
  );
}

export async function readWorkoutPlan(workspace: string): Promise<WorkoutPlan | null> {
  const row = await queryOne<{ rendered_plan: Record<string, unknown> }>(
    `
    SELECT rendered_plan
    FROM workout_plans wp
    JOIN workspaces w ON w.id = wp.workspace_id
    WHERE w.slug = $1 AND wp.is_current = TRUE
    `,
    [workspace]
  );
  if (!row) {
    return null;
  }
  return normalizeWorkoutPlan(row.rendered_plan);
}

export async function readUserProfileSummary(workspace: string): Promise<UserProfileSummary | null> {
  const row = await queryOne<{ name: string; goal: string }>(
    `
    SELECT ap.name, ap.goal
    FROM athlete_profiles ap
    JOIN workspaces w ON w.id = ap.workspace_id
    WHERE w.slug = $1
    `,
    [workspace]
  );
  return row ? { name: row.name, goal: row.goal || 'Maintenance' } : null;
}

export async function readAthleteProfile(workspace: string): Promise<AthleteProfileRecord | null> {
  const row = await queryOne<Record<string, unknown>>(
    `
    SELECT w.slug AS workspace_slug, ap.*
    FROM athlete_profiles ap
    JOIN workspaces w ON w.id = ap.workspace_id
    WHERE w.slug = $1
    `,
    [workspace]
  );
  if (!row) {
    return null;
  }
  return {
    workspaceSlug: String(row.workspace_slug),
    name: String(row.name ?? ''),
    age: row.age as number | null,
    sex: String(row.sex ?? ''),
    heightCm: row.height_cm as number | null,
    weightKg: row.weight_kg as number | null,
    goal: String(row.goal ?? ''),
    experienceLevel: String(row.experience_level ?? 'beginner'),
    trainingDays: Number(row.training_days ?? 3),
    sessionLengthMinutes: Number(row.session_length_minutes ?? 45),
    equipment: normalizeStringArray(row.equipment),
    limitations: normalizeStringArray(row.limitations),
    preferredFocus: normalizeStringArray(row.preferred_focus),
    cardioPreference: String(row.cardio_preference ?? 'walk'),
    notes: normalizeStringArray(row.notes),
  };
}

export async function saveAthleteProfile(workspace: string, profile: AthleteProfileRecord): Promise<void> {
  logger.info('Saving athlete profile', { workspace });
  await query(
    `
    UPDATE athlete_profiles
    SET name = $2,
        age = $3,
        sex = $4,
        height_cm = $5,
        weight_kg = $6,
        goal = $7,
        experience_level = $8,
        training_days = $9,
        session_length_minutes = $10,
        equipment = $11::jsonb,
        limitations = $12::jsonb,
        preferred_focus = $13::jsonb,
        cardio_preference = $14,
        notes = $15::jsonb,
        updated_at = NOW()
    FROM workspaces
    WHERE athlete_profiles.workspace_id = workspaces.id
      AND workspaces.slug = $1
    `,
    [
      workspace,
      profile.name,
      profile.age,
      profile.sex,
      profile.heightCm,
      profile.weightKg,
      profile.goal,
      profile.experienceLevel,
      profile.trainingDays,
      profile.sessionLengthMinutes,
      JSON.stringify(profile.equipment),
      JSON.stringify(profile.limitations),
      JSON.stringify(profile.preferredFocus),
      profile.cardioPreference,
      JSON.stringify(profile.notes),
    ]
  );
}

export async function listCheckIns(workspace: string): Promise<CheckInRecord[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT c.*
    FROM check_ins c
    JOIN workspaces w ON w.id = c.workspace_id
    WHERE w.slug = $1
    ORDER BY c.check_in_date DESC
    `,
    [workspace]
  );
  return rows.map((row) => ({
    id: String(row.id),
    checkInDate: String(row.check_in_date),
    workoutsCompleted: Number(row.workouts_completed),
    workoutsPlanned: Number(row.workouts_planned),
    averageDifficulty: Number(row.average_difficulty),
    energy: Number(row.energy),
    soreness: Number(row.soreness),
    bodyWeightKg: row.body_weight_kg as number | null,
    wins: normalizeStringArray(row.wins),
    struggles: normalizeStringArray(row.struggles),
    notes: normalizeStringArray(row.notes),
  }));
}

export async function upsertCheckIn(workspace: string, checkIn: CheckInRecord): Promise<void> {
  logger.info('Saving check-in', { workspace, checkInDate: checkIn.checkInDate });
  await query(
    `
    INSERT INTO check_ins (
      id, workspace_id, check_in_date, workouts_completed, workouts_planned,
      average_difficulty, energy, soreness, body_weight_kg, wins, struggles, notes
    )
    SELECT $2, w.id, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb
    FROM workspaces w
    WHERE w.slug = $1
    ON CONFLICT (workspace_id, check_in_date) DO UPDATE SET
      workouts_completed = EXCLUDED.workouts_completed,
      workouts_planned = EXCLUDED.workouts_planned,
      average_difficulty = EXCLUDED.average_difficulty,
      energy = EXCLUDED.energy,
      soreness = EXCLUDED.soreness,
      body_weight_kg = EXCLUDED.body_weight_kg,
      wins = EXCLUDED.wins,
      struggles = EXCLUDED.struggles,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    `,
    [
      workspace,
      checkIn.id,
      checkIn.checkInDate,
      checkIn.workoutsCompleted,
      checkIn.workoutsPlanned,
      checkIn.averageDifficulty,
      checkIn.energy,
      checkIn.soreness,
      checkIn.bodyWeightKg,
      JSON.stringify(checkIn.wins),
      JSON.stringify(checkIn.struggles),
      JSON.stringify(checkIn.notes),
    ]
  );
}

export function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

export function parseLines(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function prettifyWorkspaceName(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
