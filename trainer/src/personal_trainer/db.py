from __future__ import annotations

import json
import logging
import os
from dataclasses import asdict
from datetime import date, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import psycopg

from personal_trainer.markdown_io import render_plan_json
from personal_trainer.models import CheckIn, UserProfile, WorkoutPlan

LOGGER = logging.getLogger(__name__)
MIGRATIONS_ROOT = Path(__file__).resolve().parents[3] / "db" / "migrations"
TRAINER_SYNC_TABLES = (
    "workout_plans",
    "check_ins",
    "athlete_profiles",
    "workspaces",
)


def get_database_url() -> str:
    for key in ("TRAINER_DATABASE_URL", "DATABASE_URL"):
        value = os.getenv(key, "").strip()
        if value:
            return value
    return "postgresql://personal_trainer:personal_trainer@localhost:5432/personal_trainer"


def get_prod_database_url() -> str:
    for key in ("TRAINER_PROD_DATABASE_URL", "NEON_DATABASE_URL", "PRODUCTION_DATABASE_URL"):
        value = os.getenv(key, "").strip()
        if value:
            return value
    raise RuntimeError(
        "Missing production database URL. Set TRAINER_PROD_DATABASE_URL or NEON_DATABASE_URL."
    )


def connect(database_url: str | None = None) -> psycopg.Connection:
    import psycopg
    from psycopg.rows import dict_row

    resolved_url = database_url or get_database_url()
    LOGGER.info("Opening PostgreSQL connection")
    return psycopg.connect(resolved_url, row_factory=dict_row)


def run_migrations(database_url: str | None = None) -> int:
    migration_paths = sorted(MIGRATIONS_ROOT.glob("*.sql"))
    if not migration_paths:
        raise RuntimeError(f"No SQL migrations found under {MIGRATIONS_ROOT}")
    applied = 0
    with connect(database_url) as connection:
        with connection.cursor() as cursor:
            for path in migration_paths:
                LOGGER.info("Applying migration %s", path.name)
                cursor.execute(path.read_text(encoding="utf-8"))
                applied += 1
        connection.commit()
    return applied


def slugify_workspace_name(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in value.strip())
    normalized = "-".join(part for part in cleaned.split("-") if part)
    if not normalized:
        raise ValueError("Workspace name must contain at least one alphanumeric character.")
    return normalized


def list_workspaces(database_url: str | None = None) -> list[str]:
    with connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT slug FROM workspaces ORDER BY slug")
            return [str(row["slug"]) for row in cursor.fetchall()]


def create_workspace(slug: str, *, database_url: str | None = None) -> None:
    now = datetime.utcnow()
    with connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO workspaces (slug, created_at, updated_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (slug) DO UPDATE SET updated_at = EXCLUDED.updated_at
                """,
                (slug, now, now),
            )
            cursor.execute(
                """
                INSERT INTO athlete_profiles (
                    workspace_id, name, goal, experience_level, training_days, session_length_minutes,
                    equipment, limitations, preferred_focus, cardio_preference, notes, created_at, updated_at
                )
                SELECT id, %s, '', 'beginner', 3, 45, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'walk', '[]'::jsonb, %s, %s
                FROM workspaces
                WHERE slug = %s
                ON CONFLICT (workspace_id) DO NOTHING
                """,
                (slug.replace("-", " ").title(), now, now, slug),
            )
        connection.commit()


def read_profile(slug: str, *, database_url: str | None = None) -> UserProfile:
    with connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT ap.*
                FROM athlete_profiles ap
                JOIN workspaces w ON w.id = ap.workspace_id
                WHERE w.slug = %s
                """,
                (slug,),
            )
            row = cursor.fetchone()
            if row is None:
                raise RuntimeError(f"Workspace '{slug}' does not have an athlete profile.")
            return _profile_from_row(row)


def upsert_profile(slug: str, profile: UserProfile, *, database_url: str | None = None) -> None:
    create_workspace(slug, database_url=database_url)
    now = datetime.utcnow()
    with connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE athlete_profiles
                SET name = %s,
                    age = %s,
                    sex = %s,
                    height_cm = %s,
                    weight_kg = %s,
                    goal = %s,
                    experience_level = %s,
                    training_days = %s,
                    session_length_minutes = %s,
                    equipment = %s::jsonb,
                    limitations = %s::jsonb,
                    preferred_focus = %s::jsonb,
                    cardio_preference = %s,
                    notes = %s::jsonb,
                    updated_at = %s
                FROM workspaces
                WHERE athlete_profiles.workspace_id = workspaces.id
                  AND workspaces.slug = %s
                """,
                (
                    profile.name,
                    profile.age,
                    profile.sex,
                    profile.height_cm,
                    profile.weight_kg,
                    profile.goal,
                    profile.experience_level,
                    profile.training_days,
                    profile.session_length_minutes,
                    json.dumps(profile.equipment),
                    json.dumps(profile.limitations),
                    json.dumps(profile.preferred_focus),
                    profile.cardio_preference,
                    json.dumps(profile.notes),
                    now,
                    slug,
                ),
            )
        connection.commit()


def list_checkins(slug: str, *, database_url: str | None = None) -> list[CheckIn]:
    with connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT c.*
                FROM check_ins c
                JOIN workspaces w ON w.id = c.workspace_id
                WHERE w.slug = %s
                ORDER BY c.check_in_date ASC, c.created_at ASC
                """,
                (slug,),
            )
            return [_checkin_from_row(row) for row in cursor.fetchall()]


def latest_checkin(slug: str, *, database_url: str | None = None) -> CheckIn | None:
    history = list_checkins(slug, database_url=database_url)
    return history[-1] if history else None


def upsert_checkin(slug: str, checkin: CheckIn, *, database_url: str | None = None) -> None:
    create_workspace(slug, database_url=database_url)
    now = datetime.utcnow()
    with connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO check_ins (
                    workspace_id, check_in_date, workouts_completed, workouts_planned, average_difficulty,
                    energy, soreness, body_weight_kg, wins, struggles, notes, created_at, updated_at
                )
                SELECT w.id, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s
                FROM workspaces w
                WHERE w.slug = %s
                ON CONFLICT (workspace_id, check_in_date)
                DO UPDATE SET workouts_completed = EXCLUDED.workouts_completed,
                              workouts_planned = EXCLUDED.workouts_planned,
                              average_difficulty = EXCLUDED.average_difficulty,
                              energy = EXCLUDED.energy,
                              soreness = EXCLUDED.soreness,
                              body_weight_kg = EXCLUDED.body_weight_kg,
                              wins = EXCLUDED.wins,
                              struggles = EXCLUDED.struggles,
                              notes = EXCLUDED.notes,
                              updated_at = EXCLUDED.updated_at
                """,
                (
                    checkin.check_in_date,
                    checkin.workouts_completed,
                    checkin.workouts_planned,
                    checkin.average_difficulty,
                    checkin.energy,
                    checkin.soreness,
                    checkin.body_weight_kg,
                    json.dumps(checkin.wins),
                    json.dumps(checkin.struggles),
                    json.dumps(checkin.notes),
                    now,
                    now,
                    slug,
                ),
            )
        connection.commit()


def next_plan_version(slug: str, *, database_url: str | None = None) -> int:
    with connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT COALESCE(MAX(plan_version), 0) AS current_version
                FROM workout_plans wp
                JOIN workspaces w ON w.id = wp.workspace_id
                WHERE w.slug = %s
                """,
                (slug,),
            )
            row = cursor.fetchone()
            return int(row["current_version"]) + 1 if row else 1


def save_workout_plan(
    slug: str,
    plan: WorkoutPlan,
    profile: UserProfile,
    *,
    database_url: str | None = None,
) -> None:
    create_workspace(slug, database_url=database_url)
    rendered_plan = json.loads(render_plan_json(plan, profile))
    raw_plan = asdict(plan)
    now = datetime.utcnow()
    with connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE workout_plans
                SET is_current = FALSE,
                    updated_at = %s
                FROM workspaces
                WHERE workout_plans.workspace_id = workspaces.id
                  AND workspaces.slug = %s
                  AND workout_plans.is_current = TRUE
                """,
                (now, slug),
            )
            cursor.execute(
                """
                INSERT INTO workout_plans (
                    workspace_id, plan_version, generated_on, planner_backend, summary, progression_note,
                    next_checkin_prompt, coach_notes_focus, coach_notes_cautions, raw_plan, rendered_plan,
                    is_current, created_at, updated_at
                )
                SELECT w.id, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, TRUE, %s, %s
                FROM workspaces w
                WHERE w.slug = %s
                """,
                (
                    plan.plan_version,
                    plan.generated_on,
                    plan.planner_backend,
                    plan.summary,
                    plan.progression_note,
                    plan.next_checkin_prompt,
                    json.dumps(plan.coach_notes_focus),
                    json.dumps(plan.coach_notes_cautions),
                    json.dumps(raw_plan, default=str),
                    json.dumps(rendered_plan),
                    now,
                    now,
                    slug,
                ),
            )
        connection.commit()


def insert_imported_workout_plan(
    slug: str,
    plan: WorkoutPlan,
    profile: UserProfile,
    *,
    database_url: str | None = None,
) -> None:
    create_workspace(slug, database_url=database_url)
    rendered_plan = json.loads(render_plan_json(plan, profile))
    raw_plan = asdict(plan)
    now = datetime.utcnow()
    with connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT 1
                FROM workout_plans wp
                JOIN workspaces w ON w.id = wp.workspace_id
                WHERE w.slug = %s
                  AND wp.plan_version = %s
                """,
                (slug, plan.plan_version),
            )
            if cursor.fetchone() is not None:
                raise RuntimeError(
                    f"Workout Plan version {plan.plan_version} already exists "
                    f"for workspace '{slug}'."
                )

            cursor.execute(
                """
                UPDATE workout_plans
                SET is_current = FALSE,
                    updated_at = %s
                FROM workspaces
                WHERE workout_plans.workspace_id = workspaces.id
                  AND workspaces.slug = %s
                  AND workout_plans.is_current = TRUE
                """,
                (now, slug),
            )
            cursor.execute(
                """
                INSERT INTO workout_plans (
                    workspace_id, plan_version, generated_on, planner_backend, summary, progression_note,
                    next_checkin_prompt, coach_notes_focus, coach_notes_cautions, raw_plan, rendered_plan,
                    is_current, created_at, updated_at
                )
                SELECT w.id, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, TRUE, %s, %s
                FROM workspaces w
                WHERE w.slug = %s
                """,
                (
                    plan.plan_version,
                    plan.generated_on,
                    plan.planner_backend,
                    plan.summary,
                    plan.progression_note,
                    plan.next_checkin_prompt,
                    json.dumps(plan.coach_notes_focus),
                    json.dumps(plan.coach_notes_cautions),
                    json.dumps(raw_plan, default=str),
                    json.dumps(rendered_plan),
                    now,
                    now,
                    slug,
                ),
            )
        connection.commit()


def export_table_rows(database_url: str, table_name: str) -> list[dict[str, Any]]:
    with connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT * FROM {table_name}")
            rows = cursor.fetchall()
            return [dict(row) for row in rows]


def replace_table_rows(
    database_url: str, table_name: str, rows: list[dict[str, Any]], *, truncate: bool = True
) -> None:
    with connect(database_url) as connection:
        with connection.cursor() as cursor:
            if truncate:
                cursor.execute(f"DELETE FROM {table_name}")
            if not rows:
                connection.commit()
                return

            columns = list(rows[0].keys())
            placeholders = ", ".join(["%s"] * len(columns))
            column_list = ", ".join(columns)
            update_list = ", ".join(
                f"{column} = EXCLUDED.{column}" for column in columns if column != "id"
            )
            primary_key = "id" if "id" in columns else columns[0]
            for row in rows:
                values = [row[column] for column in columns]
                cursor.execute(
                    f"""
                    INSERT INTO {table_name} ({column_list})
                    VALUES ({placeholders})
                    ON CONFLICT ({primary_key}) DO UPDATE
                    SET {update_list}
                    """,
                    values,
                )
        connection.commit()


def sync_tables(source_database_url: str, target_database_url: str, table_names: tuple[str, ...]) -> None:
    for table_name in table_names:
        rows = export_table_rows(source_database_url, table_name)
        LOGGER.info("Synchronizing %s rows into %s", len(rows), table_name)
        replace_table_rows(target_database_url, table_name, rows)


def _profile_from_row(row: dict[str, Any]) -> UserProfile:
    return UserProfile(
        name=str(row["name"]),
        age=row["age"],
        sex=str(row["sex"]),
        height_cm=row["height_cm"],
        weight_kg=row["weight_kg"],
        goal=str(row["goal"]),
        experience_level=str(row["experience_level"]),
        training_days=int(row["training_days"]),
        session_length_minutes=int(row["session_length_minutes"]),
        equipment=list(row["equipment"]),
        limitations=list(row["limitations"]),
        preferred_focus=list(row["preferred_focus"]),
        cardio_preference=str(row["cardio_preference"]),
        notes=list(row["notes"]),
    )


def _checkin_from_row(row: dict[str, Any]) -> CheckIn:
    check_in_date = row["check_in_date"]
    if isinstance(check_in_date, datetime):
        check_in_date = check_in_date.date()
    return CheckIn(
        check_in_date=check_in_date,
        workouts_completed=int(row["workouts_completed"]),
        workouts_planned=int(row["workouts_planned"]),
        average_difficulty=int(row["average_difficulty"]),
        energy=int(row["energy"]),
        soreness=int(row["soreness"]),
        body_weight_kg=row["body_weight_kg"],
        wins=list(row["wins"]),
        struggles=list(row["struggles"]),
        notes=list(row["notes"]),
    )
