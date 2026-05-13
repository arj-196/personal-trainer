from __future__ import annotations

from datetime import date

import pytest

from personal_trainer import db
from personal_trainer.models import Exercise, UserProfile, WorkoutDay, WorkoutPlan


class _Cursor:
    def __init__(self, fetch_result):
        self.fetch_result = fetch_result
        self.statements: list[str] = []
        self.params: list[object | None] = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, statement, params=None) -> None:
        self.statements.append(statement)
        self.params.append(params)

    def fetchone(self):
        return self.fetch_result


class _Connection:
    def __init__(self, cursor: _Cursor):
        self._cursor = cursor
        self.committed = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def cursor(self):
        return self._cursor

    def commit(self) -> None:
        self.committed = True


def _sample_profile() -> UserProfile:
    return UserProfile(name="Jordan", goal="Build muscle")


def _sample_plan() -> WorkoutPlan:
    return WorkoutPlan(
        generated_on=date(2026, 4, 12),
        plan_version=2,
        summary="Simple week.",
        progression_note="Add reps first.",
        days=[
            WorkoutDay(
                day_label="Day 1",
                focus="Full body",
                warmup="Easy bike",
                warmup_active_seconds=300,
                exercises=[
                    Exercise(
                        name="Goblet Squat",
                        prescription="3 x 10",
                        notes="Smooth reps.",
                        sets=3,
                        active_seconds=45,
                        rest_between_sets_seconds=75,
                        rest_between_exercises_seconds=120,
                    )
                ],
                finisher="Bike",
                finisher_active_seconds=180,
                recovery="Stretch",
                recovery_active_seconds=180,
            )
        ],
        next_checkin_prompt="Report recovery.",
    )


def test_get_database_url_ignores_shell_underscore_when_database_url_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("TRAINER_DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("_", "/Users/arjun/.local/bin/poetry")

    assert (
        db.get_database_url()
        == "postgresql://personal_trainer:personal_trainer@localhost:5432/personal_trainer"
    )


def test_get_prod_database_url_ignores_shell_underscore_when_prod_url_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("TRAINER_PROD_DATABASE_URL", raising=False)
    monkeypatch.delenv("NEON_DATABASE_URL", raising=False)
    monkeypatch.delenv("PRODUCTION_DATABASE_URL", raising=False)
    monkeypatch.setenv("_", "/Users/arjun/.local/bin/poetry")

    with pytest.raises(RuntimeError, match="PRODUCTION_DATABASE_URL"):
        db.get_prod_database_url()


def test_replace_table_rows_adapts_json_values_for_psycopg(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from psycopg.types.json import Jsonb

    cursor = _Cursor(fetch_result=None)
    connection = _Connection(cursor)
    monkeypatch.setattr("personal_trainer.db.connect", lambda database_url=None: connection)

    db.replace_table_rows(
        "postgresql://test",
        "athlete_profiles",
        [
            {
                "workspace_id": "workspace-1",
                "equipment": ["dumbbells"],
                "metadata": {"source": "local"},
            }
        ],
    )

    insert_params = cursor.params[-1]
    assert isinstance(insert_params, list)
    assert insert_params[0] == "workspace-1"
    assert isinstance(insert_params[1], Jsonb)
    assert isinstance(insert_params[2], Jsonb)
    assert connection.committed is True


def test_insert_imported_workout_plan_fails_before_current_update_on_conflict(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cursor = _Cursor(fetch_result={"exists": 1})
    connection = _Connection(cursor)
    monkeypatch.setattr(
        "personal_trainer.db.create_workspace",
        lambda slug, database_url=None: None,
    )
    monkeypatch.setattr("personal_trainer.db.connect", lambda database_url=None: connection)

    with pytest.raises(RuntimeError, match="already exists"):
        db.insert_imported_workout_plan(
            "wk_jordan",
            _sample_plan(),
            _sample_profile(),
            database_url="postgresql://test",
        )

    executed_sql = "\n".join(cursor.statements)
    assert "SELECT 1" in executed_sql
    assert "UPDATE workout_plans" not in executed_sql
    assert connection.committed is False
