from __future__ import annotations

import json
import re
from dataclasses import asdict
from datetime import date
from pathlib import Path

from personal_trainer.exercise_library import get_reference
from personal_trainer.models import (
    AppState,
    CheckIn,
    UserProfile,
    WorkoutPlan,
    WorkspacePaths,
)

SECTION_PATTERN = re.compile(r"^##\s+(?P<title>.+?)\s*$", re.MULTILINE)
KEY_VALUE_PATTERN = re.compile(r"^-\s+([^:]+):\s*(.+)$")
LIST_ITEM_PATTERN = re.compile(r"^-\s+(.+)$")
PLAN_IMAGE_WIDTH_PX = 240


def workspace_paths(root: Path) -> WorkspacePaths:
    return WorkspacePaths(
        root=root,
        profile=root / "profile.md",
        profile_json=root / "profile.json",
        plan=root / "plan.md",
        plan_json=root / "plan.json",
        coach_notes=root / "coach_notes.md",
        state=root / ".trainer" / "state.json",
        checkins_dir=root / "checkins",
    )


def ensure_workspace(root: Path) -> WorkspacePaths:
    paths = workspace_paths(root)
    paths.root.mkdir(parents=True, exist_ok=True)
    paths.checkins_dir.mkdir(parents=True, exist_ok=True)
    paths.state.parent.mkdir(parents=True, exist_ok=True)
    return paths


def _split_sections(text: str) -> dict[str, str]:
    matches = list(SECTION_PATTERN.finditer(text))
    sections: dict[str, str] = {}
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        sections[match.group("title").strip().lower()] = text[start:end].strip()
    return sections


def _parse_bullets(block: str) -> list[str]:
    items: list[str] = []
    for line in block.splitlines():
        match = LIST_ITEM_PATTERN.match(line.strip())
        if match:
            items.append(match.group(1).strip())
    return items


def _parse_key_values(block: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in block.splitlines():
        match = KEY_VALUE_PATTERN.match(line.strip())
        if match:
            values[match.group(1).strip().lower().replace(" ", "_")] = match.group(
                2
            ).strip()
    return values


def _parse_int(value: str | None, default: int | None = None) -> int | None:
    if value is None or value == "":
        return default
    digits = re.findall(r"\d+", value)
    if not digits:
        return default
    return int(digits[0])


def _parse_float(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    match = re.search(r"\d+(?:\.\d+)?", value)
    if not match:
        return None
    return float(match.group(0))


def load_profile(path: Path) -> UserProfile:
    text = path.read_text(encoding="utf-8")
    sections = _split_sections(text)
    basics = _parse_key_values(sections.get("basics", ""))
    goals = _parse_key_values(sections.get("goals", ""))
    schedule = _parse_key_values(sections.get("schedule", ""))

    return UserProfile(
        name=basics.get("name", "Athlete"),
        age=_parse_int(basics.get("age")),
        sex=basics.get("sex", ""),
        height_cm=_parse_int(basics.get("height_cm")),
        weight_kg=_parse_float(basics.get("weight_kg")),
        goal=goals.get("primary_goal", goals.get("goal", "General fitness")),
        experience_level=goals.get("experience_level", "beginner").lower(),
        training_days=max(2, min(6, _parse_int(schedule.get("days_per_week"), 3) or 3)),
        session_length_minutes=max(
            20, min(120, _parse_int(schedule.get("session_length_minutes"), 45) or 45)
        ),
        equipment=_parse_bullets(sections.get("equipment", "")),
        limitations=_parse_bullets(sections.get("limitations", "")),
        preferred_focus=_parse_bullets(sections.get("preferred_focus", "")),
        cardio_preference=goals.get("cardio_preference", "walk"),
        notes=_parse_bullets(sections.get("notes", "")),
    )


def load_checkin(path: Path) -> CheckIn:
    text = path.read_text(encoding="utf-8")
    sections = _split_sections(text)
    summary = _parse_key_values(sections.get("summary", ""))
    reflections = _parse_key_values(sections.get("reflections", ""))

    raw_date = summary.get("date")
    if not raw_date:
        raise ValueError(
            "Check-in is missing '- Date: YYYY-MM-DD' in the Summary section."
        )

    return CheckIn(
        check_in_date=date.fromisoformat(raw_date),
        workouts_completed=_parse_int(summary.get("workouts_completed"), 0) or 0,
        workouts_planned=_parse_int(summary.get("workouts_planned"), 0) or 0,
        average_difficulty=max(
            1, min(10, _parse_int(summary.get("average_difficulty"), 5) or 5)
        ),
        energy=max(1, min(10, _parse_int(summary.get("energy"), 5) or 5)),
        soreness=max(1, min(10, _parse_int(summary.get("soreness"), 3) or 3)),
        body_weight_kg=_parse_float(summary.get("body_weight_kg")),
        wins=_parse_bullets(sections.get("wins", "")),
        struggles=_parse_bullets(sections.get("struggles", "")),
        notes=_parse_bullets(sections.get("notes", ""))
        + _parse_bullets(sections.get("reflections", "")),
    )


def load_state(path: Path) -> AppState:
    if not path.exists():
        return AppState()
    return AppState.from_dict(json.loads(path.read_text(encoding="utf-8")))


def save_state(path: Path, state: AppState) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state.to_dict(), indent=2), encoding="utf-8")


def render_profile_template() -> str:
    return """# Athlete Profile

Fill in the sections below, then run `personal-trainer plan <workspace>`.

## Basics
- Name: Albert
- Age: 34
- Sex: male
- Height cm: 178
- Weight kg: 82

## Goals
- Primary goal: Build muscle and improve conditioning
- Experience level: beginner
- Cardio preference: bike

## Schedule
- Days per week: 4
- Session length minutes: 50

## Equipment
- Dumbbells
- Adjustable bench
- Pull-up bar
- Exercise bike

## Limitations
- Mild left knee irritation with deep knee flexion

## Preferred Focus
- Upper body strength
- Sustainable fat loss
- Better energy during workdays

## Notes
- I usually train before work.
- I prefer simple plans I can repeat for a few weeks.
"""


def render_checkin_template(plan: WorkoutPlan) -> str:
    return f"""# Weekly Check-In

Complete this after finishing your current training week, then run `personal-trainer refresh <workspace> <checkin.md>`.

## Summary
- Date: {date.today().isoformat()}
- Workouts completed: {plan.workouts_per_week}
- Workouts planned: {plan.workouts_per_week}
- Average difficulty (1-10): 6
- Energy (1-10): 7
- Soreness (1-10): 4
- Body weight kg: 

## Wins
- 

## Struggles
- 

## Notes
- 
"""


def render_plan(plan: WorkoutPlan, profile: UserProfile) -> str:
    lines = [
        f"# {profile.name}'s Training Plan",
        "",
        f"- Generated on: {plan.generated_on.isoformat()}",
        f"- Plan version: {plan.plan_version}",
        f"- Generated by: {plan.planner_backend or 'manual'}",
        f"- Goal: {profile.goal}",
        f"- Weekly training days: {plan.workouts_per_week}",
        f"- Target session length: {profile.session_length_minutes} minutes",
        "",
        "## Summary",
        plan.summary,
        "",
        "## Progression",
        plan.progression_note,
        "",
    ]

    for day in plan.days:
        lines.extend(
            [
                f"## {day.day_label}: {day.focus}",
                f"- Warm-up: {day.warmup}",
                "- Main work:",
            ]
        )
        for exercise in day.exercises:
            lines.append(exercise.to_markdown())
            reference = get_reference(exercise.name)
            if reference is not None:
                lines.append(
                    f'<img src="{reference.image_path}" alt="{reference.name}" style="display: block; max-width: {PLAN_IMAGE_WIDTH_PX}px; width: 100%; height: auto;" />'
                )
                lines.append(
                    f"Reference: [{reference.name}]({reference.markdown_path})"
                )
                lines.append("")
        lines.extend(
            [
                f"- Finisher: {day.finisher}",
                f"- Recovery: {day.recovery}",
                "",
            ]
        )

    lines.extend(
        [
            "## Next Check-In",
            plan.next_checkin_prompt,
            "",
        ]
    )
    return "\n".join(lines)


def render_profile_json(profile: UserProfile) -> str:
    payload = {
        "name": profile.name,
        "goal": profile.goal,
        "experienceLevel": profile.experience_level,
        "trainingDays": profile.training_days,
        "sessionLengthMinutes": profile.session_length_minutes,
        "equipment": list(profile.equipment),
        "limitations": list(profile.limitations),
        "preferredFocus": list(profile.preferred_focus),
        "cardioPreference": profile.cardio_preference,
    }
    return json.dumps(payload, indent=2)


def render_plan_json(plan: WorkoutPlan, profile: UserProfile) -> str:
    payload = {
        "title": f"{profile.name}'s Training Plan",
        "meta": [
            {"label": "Generated on", "value": plan.generated_on.isoformat()},
            {"label": "Plan version", "value": str(plan.plan_version)},
            {"label": "Generated by", "value": plan.planner_backend or "manual"},
            {"label": "Goal", "value": profile.goal},
            {"label": "Weekly training days", "value": str(plan.workouts_per_week)},
            {
                "label": "Target session length",
                "value": f"{profile.session_length_minutes} minutes",
            },
        ],
        "summary": plan.summary,
        "progression": plan.progression_note,
        "days": [
            {
                "heading": f"{day.day_label}: {day.focus}",
                "warmup": day.warmup,
                "warmupActiveSeconds": day.warmup_active_seconds,
                "exercises": [
                    {
                        "name": exercise.name,
                        "prescription": exercise.prescription,
                        "notes": exercise.notes,
                        "sets": exercise.sets,
                        "activeSeconds": exercise.active_seconds,
                        "restBetweenSetsSeconds": exercise.rest_between_sets_seconds,
                        "restBetweenExercisesSeconds": exercise.rest_between_exercises_seconds,
                        "tempoLabel": exercise.tempo_label,
                        "imageUrl": (
                            reference.image_path if reference is not None else None
                        ),
                        "referencePath": (
                            reference.markdown_path if reference is not None else None
                        ),
                    }
                    for exercise in day.exercises
                    for reference in [get_reference(exercise.name)]
                ],
                "finisher": day.finisher,
                "finisherActiveSeconds": day.finisher_active_seconds,
                "recovery": day.recovery,
                "recoveryActiveSeconds": day.recovery_active_seconds,
            }
            for day in plan.days
        ],
        "nextCheckIn": plan.next_checkin_prompt,
        "rawPlan": asdict(plan),
    }
    return json.dumps(payload, indent=2, default=str)


def render_coach_notes(
    plan: WorkoutPlan, profile: UserProfile, checkin: CheckIn | None = None
) -> str:
    focus_items = plan.coach_notes_focus or [
        "Execute the week with consistent effort and clean technique.",
        "Log any exercise swaps, pain signals, or unusual fatigue in the next check-in.",
    ]
    lines = [
        "# Coach Notes",
        "",
        f"Athlete: {profile.name}",
        f"Current goal: {profile.goal}",
        f"Current plan version: {plan.plan_version}",
        f"Planner backend: {plan.planner_backend or 'not recorded'}",
        "",
        "## What To Focus On",
        "",
    ]
    lines.extend(f"- {item}" for item in focus_items)
    lines.append("")
    if plan.coach_notes_cautions:
        lines.append("## Cautions")
        lines.extend(f"- {item}" for item in plan.coach_notes_cautions)
        lines.append("")
    if checkin is not None:
        lines.extend(
            [
                "## Latest Check-In Read",
                f"- Date: {checkin.check_in_date.isoformat()}",
                f"- Adherence: {checkin.workouts_completed}/{checkin.workouts_planned}",
                f"- Difficulty / Energy / Soreness: {checkin.average_difficulty}/{checkin.energy}/{checkin.soreness}",
                f"- Wins: {', '.join(checkin.wins) if checkin.wins else 'none logged'}",
                f"- Struggles: {', '.join(checkin.struggles) if checkin.struggles else 'none logged'}",
                "",
            ]
        )
    lines.extend(
        [
            "## Next Action",
            "- Follow the plan for one week.",
            f"- {plan.next_checkin_prompt}",
            "- Regenerate the plan with `personal-trainer refresh`.",
            "",
        ]
    )
    return "\n".join(lines)
