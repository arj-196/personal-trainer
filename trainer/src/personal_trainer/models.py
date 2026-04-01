from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class UserProfile:
    name: str
    age: int | None = None
    sex: str = ""
    height_cm: int | None = None
    weight_kg: float | None = None
    goal: str = ""
    experience_level: str = "beginner"
    training_days: int = 3
    session_length_minutes: int = 45
    equipment: list[str] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)
    preferred_focus: list[str] = field(default_factory=list)
    cardio_preference: str = "walk"
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class CheckIn:
    check_in_date: date
    workouts_completed: int
    workouts_planned: int
    average_difficulty: int
    energy: int
    soreness: int
    body_weight_kg: float | None = None
    wins: list[str] = field(default_factory=list)
    struggles: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def adherence_ratio(self) -> float:
        if self.workouts_planned <= 0:
            return 0.0
        return self.workouts_completed / self.workouts_planned


@dataclass(slots=True)
class Exercise:
    name: str
    prescription: str
    notes: str

    def to_markdown(self) -> str:
        return f"- **{self.name}**: {self.prescription}. {self.notes}".strip()


@dataclass(slots=True)
class WorkoutDay:
    day_label: str
    focus: str
    warmup: str
    exercises: list[Exercise]
    finisher: str
    recovery: str


@dataclass(slots=True)
class WorkoutPlan:
    generated_on: date
    plan_version: int
    summary: str
    progression_note: str
    days: list[WorkoutDay]
    next_checkin_prompt: str
    planner_backend: str = ""
    coach_notes_focus: list[str] = field(default_factory=list)
    coach_notes_cautions: list[str] = field(default_factory=list)

    @property
    def workouts_per_week(self) -> int:
        return len(self.days)


@dataclass(slots=True)
class AppState:
    plan_version: int = 0
    generated_plans: int = 0
    last_check_in: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "AppState":
        return cls(
            plan_version=int(value.get("plan_version", 0)),
            generated_plans=int(value.get("generated_plans", 0)),
            last_check_in=value.get("last_check_in"),
        )


@dataclass(slots=True)
class WorkspacePaths:
    root: Path
    profile: Path
    profile_json: Path
    plan: Path
    plan_json: Path
    coach_notes: Path
    state: Path
    checkins_dir: Path
