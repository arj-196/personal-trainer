from __future__ import annotations

import click
import pytest

from personal_trainer.cli import _find_latest_checkin


def test_find_latest_checkin_uses_filename_date_and_ignores_non_matching(tmp_path) -> None:
    workspace = tmp_path / "workspace"
    checkins = workspace / "checkins"
    checkins.mkdir(parents=True)

    older = checkins / "2026-04-01-checkin.md"
    older.write_text(
        """# Weekly Check-In

## Summary
- Date: 2026-04-01
- Workouts completed: 3
- Workouts planned: 3
- Average difficulty (1-10): 6
- Energy (1-10): 7
- Soreness (1-10): 4
- Body weight kg: 80.0

## Wins
- Good consistency.

## Struggles
- None.

## Notes
- Felt good.
""",
        encoding="utf-8",
    )
    latest = checkins / "2026-04-12-checkin.md"
    latest.write_text(
        """# Weekly Check-In

## Summary
- Date: 2026-04-12
- Workouts completed: 2
- Workouts planned: 3
- Average difficulty (1-10): 7
- Energy (1-10): 6
- Soreness (1-10): 5
- Body weight kg: 79.8

## Wins
- Stayed focused.

## Struggles
- Missed one day.

## Notes
- Recovering okay.
""",
        encoding="utf-8",
    )
    (checkins / "README.md").write_text("not a checkin", encoding="utf-8")
    (checkins / "2026-04-13-checkin.txt").write_text("wrong extension", encoding="utf-8")

    resolved = _find_latest_checkin(workspace)

    assert resolved is not None
    checkin, path = resolved
    assert path == latest
    assert checkin.check_in_date.isoformat() == "2026-04-12"


def test_find_latest_checkin_raises_for_invalid_latest_file(tmp_path) -> None:
    workspace = tmp_path / "workspace"
    checkins = workspace / "checkins"
    checkins.mkdir(parents=True)

    (checkins / "2026-04-01-checkin.md").write_text(
        """# Weekly Check-In

## Summary
- Date: 2026-04-01
- Workouts completed: 3
- Workouts planned: 3
- Average difficulty (1-10): 6
- Energy (1-10): 7
- Soreness (1-10): 4

## Wins
- Consistent.

## Struggles
- None.

## Notes
- All good.
""",
        encoding="utf-8",
    )
    invalid_latest = checkins / "2026-04-12-checkin.md"
    invalid_latest.write_text(
        """# Weekly Check-In

## Summary
- Workouts completed: 2
- Workouts planned: 3
- Average difficulty (1-10): 8
- Energy (1-10): 5
- Soreness (1-10): 7

## Wins
- Kept moving.

## Struggles
- Fatigue.

## Notes
- Date is intentionally missing.
""",
        encoding="utf-8",
    )

    with pytest.raises(click.ClickException, match="Latest check-in"):
        _find_latest_checkin(workspace)
