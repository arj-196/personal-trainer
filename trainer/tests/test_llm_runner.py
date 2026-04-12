from __future__ import annotations

import json

import pytest

from personal_trainer.llm import LLMRunner, start_workflow


def test_start_workflow_returns_trace_id() -> None:
    trace_id = start_workflow("weekly_plan_generation")

    assert trace_id.startswith("weekly-plan-generation-")
    assert len(trace_id) > len("weekly-plan-generation-")


def test_runner_success_writes_jsonl_record(tmp_path) -> None:
    log_path = tmp_path / ".trainer" / "logs" / "llm_calls.jsonl"
    runner = LLMRunner(jsonl_path=log_path)

    result = runner.run_step(
        trace_id="trace-123",
        workflow_name="weekly_plan_generation",
        step_name="planner",
        model="gpt-oss:20b",
        prompt="plan this",
        metadata={"provider": "ollama"},
        execute=lambda: {"summary": "ok", "days": [1]},
    )

    assert result.trace_id == "trace-123"
    assert result.model == "gpt-oss:20b"
    assert isinstance(result.output, dict)
    assert log_path.exists()

    records = [
        json.loads(line)
        for line in log_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    assert len(records) == 1
    record = records[0]
    assert record["trace_id"] == "trace-123"
    assert record["workflow_name"] == "weekly_plan_generation"
    assert record["step_name"] == "planner"
    assert record["model"] == "gpt-oss:20b"
    assert record["success"] is True
    assert record["error"] is None


def test_runner_failure_writes_jsonl_record(tmp_path) -> None:
    log_path = tmp_path / ".trainer" / "logs" / "llm_calls.jsonl"
    runner = LLMRunner(jsonl_path=log_path)

    def fail() -> dict[str, object]:
        raise RuntimeError("boom")

    with pytest.raises(RuntimeError, match="boom"):
        runner.run_step(
            trace_id="trace-fail",
            workflow_name="weekly_plan_generation",
            step_name="planner",
            model="gpt-5.4-mini",
            prompt="plan this",
            execute=fail,
        )

    records = [
        json.loads(line)
        for line in log_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    assert len(records) == 1
    record = records[0]
    assert record["trace_id"] == "trace-fail"
    assert record["success"] is False
    assert "boom" in record["error"]


def test_runner_generates_trace_id_when_missing() -> None:
    runner = LLMRunner(jsonl_path=None)

    result = runner.run_step(
        trace_id=None,
        workflow_name="weekly_plan_generation",
        step_name="planner",
        model="gpt-oss:20b",
        prompt="plan this",
        execute=lambda: {"summary": "ok"},
    )

    assert result.trace_id.startswith("weekly-plan-generation-")


def test_runner_without_langfuse_env_still_runs(monkeypatch) -> None:
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_HOST", raising=False)

    runner = LLMRunner(jsonl_path=None)
    result = runner.run_step(
        trace_id="trace-local-only",
        workflow_name="weekly_plan_generation",
        step_name="planner",
        model="gpt-oss:20b",
        prompt="plan this",
        execute=lambda: {"summary": "ok"},
    ) 

    assert result.trace_id == "trace-local-only"


def test_runner_disables_langfuse_automatically_in_pytest(monkeypatch) -> None:
    monkeypatch.setenv("PYTEST_CURRENT_TEST", "trainer/tests/test_llm_runner.py::test")
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "public-test-key")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "secret-test-key")
    monkeypatch.setenv("LANGFUSE_HOST", "https://cloud.langfuse.com")

    runner = LLMRunner(jsonl_path=None)
    assert runner._langfuse is None

    result = runner.run_step(
        trace_id="trace-pytest-no-langfuse",
        workflow_name="weekly_plan_generation",
        step_name="planner",
        model="gpt-oss:20b",
        prompt="plan this",
        execute=lambda: {"summary": "ok"},
    )

    assert result.trace_id == "trace-pytest-no-langfuse"


def test_runner_allows_multi_step_with_shared_trace_id(tmp_path) -> None:
    log_path = tmp_path / ".trainer" / "logs" / "llm_calls.jsonl"
    runner = LLMRunner(jsonl_path=log_path)

    first = runner.run_step(
        trace_id="trace-shared",
        workflow_name="weekly_plan_generation",
        step_name="planner",
        model="gpt-oss:20b",
        prompt="planner prompt",
        execute=lambda: {"summary": "draft"},
    )
    second = runner.run_step(
        trace_id="trace-shared",
        workflow_name="weekly_plan_generation",
        step_name="critic",
        model="gpt-5.4-mini",
        prompt="critic prompt",
        execute=lambda: {"summary": "critique"},
    )

    assert first.trace_id == "trace-shared"
    assert second.trace_id == "trace-shared"

    records = [
        json.loads(line)
        for line in log_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    assert len(records) == 2
    assert records[0]["trace_id"] == "trace-shared"
    assert records[1]["trace_id"] == "trace-shared"
