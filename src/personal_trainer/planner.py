from __future__ import annotations

from datetime import date

from personal_trainer.models import (
    CheckIn,
    Exercise,
    UserProfile,
    WorkoutDay,
    WorkoutPlan,
)

DAY_NAMES = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6"]


def build_plan(
    profile: UserProfile, plan_version: int, checkin: CheckIn | None = None
) -> WorkoutPlan:
    template = _select_split(profile.training_days)
    training_bias = _training_bias(profile, checkin)
    volume_adjustment = _volume_adjustment(checkin)

    days: list[WorkoutDay] = []
    for index, focus in enumerate(template):
        exercises = _exercise_block(focus, profile, training_bias, volume_adjustment)
        days.append(
            WorkoutDay(
                day_label=DAY_NAMES[index],
                focus=focus,
                warmup=_warmup_for_focus(focus, profile),
                exercises=exercises,
                finisher=_finisher_for_focus(focus, profile),
                recovery=_recovery_note(profile, checkin),
            )
        )

    summary = _build_summary(profile, checkin, volume_adjustment)
    progression = _build_progression(profile, checkin, volume_adjustment)
    next_checkin_prompt = "At the end of the week, record adherence, average difficulty, energy, soreness, and any pain changes."

    return WorkoutPlan(
        generated_on=date.today(),
        plan_version=plan_version,
        summary=summary,
        progression_note=progression,
        days=days,
        next_checkin_prompt=next_checkin_prompt,
    )


def _select_split(training_days: int) -> list[str]:
    if training_days <= 2:
        return ["Full Body A", "Full Body B"]
    if training_days == 3:
        return ["Full Body Strength", "Upper Push + Pull", "Lower Body + Conditioning"]
    if training_days == 4:
        return [
            "Upper Strength",
            "Lower Strength",
            "Upper Hypertrophy",
            "Lower + Conditioning",
        ]
    if training_days == 5:
        return [
            "Upper Strength",
            "Lower Strength",
            "Push Hypertrophy",
            "Pull Hypertrophy",
            "Lower + Conditioning",
        ]
    return [
        "Push Strength",
        "Pull Strength",
        "Lower Strength",
        "Push Volume",
        "Pull Volume",
        "Lower + Conditioning",
    ]


def _training_bias(profile: UserProfile, checkin: CheckIn | None) -> str:
    focus_text = " ".join(profile.preferred_focus).lower()
    goal_text = profile.goal.lower()
    if "muscle" in goal_text or "hypertrophy" in focus_text:
        return "hypertrophy"
    if "fat" in goal_text or "conditioning" in goal_text:
        return "conditioning"
    if "strength" in goal_text:
        return "strength"
    if checkin and checkin.energy <= 4:
        return "recovery"
    return "balanced"


def _volume_adjustment(checkin: CheckIn | None) -> int:
    if checkin is None:
        return 0
    adherence = checkin.adherence_ratio()
    if adherence < 0.6 or checkin.energy <= 4 or checkin.soreness >= 8:
        return -1
    if adherence >= 0.9 and checkin.average_difficulty <= 6 and checkin.energy >= 7:
        return 1
    return 0


def _exercise_block(
    focus: str, profile: UserProfile, bias: str, volume_adjustment: int
) -> list[Exercise]:
    lower_care = any("knee" in item.lower() for item in profile.limitations)
    dumbbells = any("dumbbell" in item.lower() for item in profile.equipment)
    pullup_bar = any(
        "pull-up" in item.lower() or "pull up" in item.lower()
        for item in profile.equipment
    )

    base_sets = 3 + volume_adjustment
    main_sets = max(2, min(5, base_sets + (1 if bias == "strength" else 0)))
    accessory_sets = max(2, min(4, base_sets))
    rep_range = "5-8" if bias == "strength" else "8-12"
    accessory_reps = "10-15" if bias != "strength" else "8-12"

    if (
        focus.startswith("Upper")
        or focus.startswith("Push")
        or focus.startswith("Pull")
    ):
        vertical_pull = "Pull-Ups" if pullup_bar else "1-Arm Dumbbell Row"
        main_press = "Dumbbell Bench Press" if dumbbells else "Push-Up"
        secondary_press = (
            "Seated Dumbbell Shoulder Press" if dumbbells else "Pike Push-Up"
        )
        return [
            Exercise(main_press, main_sets, rep_range, "Stop 1-2 reps before failure."),
            Exercise(vertical_pull, main_sets, rep_range, "Use controlled eccentrics."),
            Exercise(
                secondary_press, accessory_sets, accessory_reps, "Keep ribcage stacked."
            ),
            Exercise(
                "Chest-Supported Rear Delt Raise",
                accessory_sets,
                accessory_reps,
                "Light and strict.",
            ),
            Exercise(
                "Plank", 3, "30-45 sec", "Brace hard and breathe through the hold."
            ),
        ]

    squat_pattern = (
        "Squat to Bench"
        if lower_care
        else ("Goblet Squat" if dumbbells else "Bodyweight Squat")
    )
    hinge_pattern = "Dumbbell Romanian Deadlift" if dumbbells else "Hip Hinge"
    split_squat = "Lunge" if not lower_care else "Low Step-Up"
    return [
        Exercise(
            squat_pattern, main_sets, rep_range, "Use a pain-free range of motion."
        ),
        Exercise(
            hinge_pattern,
            main_sets,
            rep_range,
            "Keep tension in hamstrings and glutes.",
        ),
        Exercise(
            split_squat, accessory_sets, accessory_reps, "Drive through the whole foot."
        ),
        Exercise(
            "Glute Bridge",
            accessory_sets,
            accessory_reps,
            "Pause one second at the top.",
        ),
        Exercise(
            "Side Plank",
            3,
            "20-30 sec / side",
            "Keep hips stacked and breathe behind the brace.",
        ),
    ]


def _warmup_for_focus(focus: str, profile: UserProfile) -> str:
    if "Lower" in focus:
        return "5 minutes easy cardio, then hip mobility, bodyweight squats, and glute activation."
    return "5 minutes easy cardio, then shoulder circles, band pull-aparts or arm swings, and ramp-up sets."


def _finisher_for_focus(focus: str, profile: UserProfile) -> str:
    cardio = profile.cardio_preference.lower()
    if cardio == "bike":
        finisher = (
            "8-12 minutes on the bike with alternating easy and moderate intervals."
        )
    elif cardio == "run":
        finisher = "6-10 minutes of easy aerobic running, nasal-breathing pace."
    else:
        finisher = "8-12 minutes brisk walking or carries to finish the session."
    if "Conditioning" in focus:
        return "12-15 minutes steady aerobic work at conversational pace."
    return finisher


def _recovery_note(profile: UserProfile, checkin: CheckIn | None) -> str:
    if checkin and checkin.soreness >= 7:
        return "Add 10 minutes of light walking and keep the next day easy."
    if profile.limitations:
        return "Monitor symptoms closely and stop any movement that causes sharp pain."
    return "Aim for 7+ hours of sleep and a short walk on non-training days."


def _build_summary(
    profile: UserProfile, checkin: CheckIn | None, volume_adjustment: int
) -> str:
    opening = f"This plan is built around {profile.training_days} weekly sessions to support the goal of {profile.goal.lower()}."
    if checkin is None:
        return (
            opening
            + " Start conservatively, learn the movements, and keep one or two reps in reserve on most sets."
        )
    if volume_adjustment > 0:
        return (
            opening
            + " Recent check-ins show strong recovery and adherence, so weekly volume is slightly increased."
        )
    if volume_adjustment < 0:
        return (
            opening
            + " Recent check-ins show fatigue or inconsistency, so volume is reduced to restore momentum."
        )
    return (
        opening
        + " Weekly volume is held steady while technique and consistency improve."
    )


def _build_progression(
    profile: UserProfile, checkin: CheckIn | None, volume_adjustment: int
) -> str:
    if checkin is None:
        return "When you complete all prescribed reps with solid form, add 1-2 reps next week or a small load increase."
    if volume_adjustment > 0:
        return "Add load first on the main lifts. If load is fixed, add one rep to each work set before adding another set."
    if volume_adjustment < 0:
        return "Keep loads stable this week. Focus on cleaner reps, shorter sessions, and leaving more reps in reserve."
    return "Progress one variable at a time: load, reps, or session quality, but not all three at once."
