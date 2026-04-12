from __future__ import annotations

from pathlib import Path

import pytest

from personal_trainer.prompting import PromptManager, PromptManagerError


def test_prompt_manager_renders_weekly_plan_template() -> None:
    base_dir = Path(__file__).resolve().parents[1] / "prompts"
    manager = PromptManager(base_dir)

    prompt = manager.render(
        "trainer/weekly_plan.jinja",
        payload_json='{"today": "2026-04-12"}',
    )

    assert "Create the athlete's best customized workout plan for the next week." in prompt
    assert "Planning context JSON:" in prompt
    assert '{"today": "2026-04-12"}' in prompt


def test_prompt_manager_renders_review_and_revision_templates() -> None:
    base_dir = Path(__file__).resolve().parents[1] / "prompts"
    manager = PromptManager(base_dir)

    review_prompt = manager.render(
        "trainer/plan_review.jinja",
        payload_json='{"persona": "Arnold Schwarzenegger"}',
    )
    revision_prompt = manager.render(
        "trainer/plan_revision.jinja",
        payload_json='{"iteration": 1}',
    )

    assert "Review context JSON:" in review_prompt
    assert '{"persona": "Arnold Schwarzenegger"}' in review_prompt
    assert "Revision context JSON:" in revision_prompt
    assert '{"iteration": 1}' in revision_prompt


def test_prompt_manager_raises_for_missing_template(tmp_path) -> None:
    manager = PromptManager(tmp_path)

    with pytest.raises(PromptManagerError, match="Missing prompt template"):
        manager.render("trainer/missing.jinja", payload_json="{}")
