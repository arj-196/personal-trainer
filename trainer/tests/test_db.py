from __future__ import annotations

from datetime import date

import pytest

from personal_trainer import db
from personal_trainer.models import Exercise, UserProfile, WorkoutDay, WorkoutPlan


class _Cursor:
    def __init__(self, fetch_result):
        self.fetch_result = fetch_result
        self.statements: list[str] = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, statement, params=None) -> None:
        self.statements.append(statement)

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
