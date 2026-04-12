from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from typing import Any, Callable
from uuid import uuid4

LOGGER = logging.getLogger(__name__)


def start_workflow(workflow_name: str) -> str:
    slug = "".join(char if char.isalnum() else "-" for char in workflow_name.lower())
    slug = "-".join(part for part in slug.split("-") if part)
    if not slug:
        slug = "workflow"
    return f"{slug}-{uuid4().hex}"


@dataclass(frozen=True, slots=True)
class LLMResult:
    response_text: str
    model: str
    trace_id: str
    step_name: str
    raw_provider_response: Any | None
    output: Any


class LLMRunner:
    def __init__(
        self,
        *,
        jsonl_path: Path | None = None,
        langfuse_client: Any | None = None,
    ) -> None:
        self._jsonl_path = jsonl_path
        self._langfuse = langfuse_client if langfuse_client is not None else _build_langfuse_client()

    def run_step(
        self,
        *,
        trace_id: str | None,
        workflow_name: str,
        step_name: str,
        model: str,
        prompt: str,
        execute: Callable[[], Any],
        metadata: dict[str, Any] | None = None,
    ) -> LLMResult:
        resolved_trace_id = trace_id or start_workflow(workflow_name)
        normalized_metadata = metadata or {}
        started_at = datetime.now(timezone.utc)
        start = perf_counter()

        generation = self._start_langfuse_generation(
            trace_id=resolved_trace_id,
            workflow_name=workflow_name,
            step_name=step_name,
            model=model,
            prompt=prompt,
            metadata=normalized_metadata,
        )

        response_text = ""
        raw_provider_response: Any | None = None

        try:
            execute_result = execute()
            output, raw_provider_response = _normalize_execute_result(execute_result)
            response_text = _stringify_output(output)
            duration_ms = int((perf_counter() - start) * 1000)

            self._record_jsonl(
                timestamp=started_at,
                trace_id=resolved_trace_id,
                workflow_name=workflow_name,
                step_name=step_name,
                model=model,
                prompt=prompt,
                response=response_text,
                metadata=normalized_metadata,
                duration_ms=duration_ms,
                success=True,
                error=None,
            )
            self._end_langfuse_generation(generation, output=response_text, error=None)
            LOGGER.info(
                "Completed LLM step '%s' in workflow '%s' with model '%s' (%sms)",
                step_name,
                workflow_name,
                model,
                duration_ms,
            )
            return LLMResult(
                response_text=response_text,
                model=model,
                trace_id=resolved_trace_id,
                step_name=step_name,
                raw_provider_response=raw_provider_response,
                output=output,
            )
        except Exception as error:
            duration_ms = int((perf_counter() - start) * 1000)
            self._record_jsonl(
                timestamp=started_at,
                trace_id=resolved_trace_id,
                workflow_name=workflow_name,
                step_name=step_name,
                model=model,
                prompt=prompt,
                response=response_text,
                metadata=normalized_metadata,
                duration_ms=duration_ms,
                success=False,
                error=str(error),
            )
            self._end_langfuse_generation(generation, output=response_text, error=error)
            LOGGER.exception(
                "LLM step '%s' failed in workflow '%s' with model '%s'",
                step_name,
                workflow_name,
                model,
            )
            raise

    def _record_jsonl(
        self,
        *,
        timestamp: datetime,
        trace_id: str,
        workflow_name: str,
        step_name: str,
        model: str,
        prompt: str,
        response: str,
        metadata: dict[str, Any],
        duration_ms: int,
        success: bool,
        error: str | None,
    ) -> None:
        if self._jsonl_path is None:
            return
        self._jsonl_path.parent.mkdir(parents=True, exist_ok=True)
        record = {
            "timestamp": timestamp.isoformat(),
            "trace_id": trace_id,
            "workflow_name": workflow_name,
            "step_name": step_name,
            "model": model,
            "prompt": prompt,
            "response": response,
            "metadata": metadata,
            "duration_ms": duration_ms,
            "success": success,
            "error": error,
        }
        with self._jsonl_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, default=str) + "\n")

    def _start_langfuse_generation(
        self,
        *,
        trace_id: str,
        workflow_name: str,
        step_name: str,
        model: str,
        prompt: str,
        metadata: dict[str, Any],
    ) -> Any | None:
        if self._langfuse is None:
            return None
        try:
            trace = self._langfuse.trace(
                id=trace_id,
                name=workflow_name,
                metadata=metadata,
            )
            return trace.generation(
                name=step_name,
                model=model,
                input=prompt,
                metadata=metadata,
            )
        except Exception:
            LOGGER.exception("Failed to create Langfuse trace/generation")
            return None

    def _end_langfuse_generation(
        self,
        generation: Any | None,
        *,
        output: str,
        error: Exception | None,
    ) -> None:
        if generation is None:
            return

        if hasattr(generation, "end"):
            try:
                if error is None:
                    generation.end(output=output)
                else:
                    generation.end(output=output, status_message=str(error), level="ERROR")
                return
            except Exception:
                LOGGER.exception("Failed to finalize Langfuse generation")
                return

        if hasattr(generation, "update"):
            try:
                if error is None:
                    generation.update(output=output)
                else:
                    generation.update(output=output, status_message=str(error), level="ERROR")
            except Exception:
                LOGGER.exception("Failed to update Langfuse generation")


def _normalize_execute_result(value: Any) -> tuple[Any, Any | None]:
    if isinstance(value, tuple) and len(value) == 2:
        return value[0], value[1]
    return value, None


def _stringify_output(output: Any) -> str:
    if isinstance(output, str):
        return output
    try:
        return json.dumps(output, indent=2, default=str)
    except TypeError:
        return str(output)


def _build_langfuse_client() -> Any | None:
    if os.getenv("PYTEST_CURRENT_TEST", "").strip():
        LOGGER.info("Langfuse tracing disabled for pytest runtime")
        return None

    public_key = os.getenv("LANGFUSE_PUBLIC_KEY", "").strip()
    secret_key = os.getenv("LANGFUSE_SECRET_KEY", "").strip()
    if not public_key or not secret_key:
        return None

    try:
        from langfuse import Langfuse
    except Exception:
        LOGGER.warning(
            "Langfuse credentials are set but 'langfuse' is not importable; tracing disabled"
        )
        return None

    kwargs: dict[str, Any] = {
        "public_key": public_key,
        "secret_key": secret_key,
    }
    host = os.getenv("LANGFUSE_HOST", "").strip()
    if host:
        kwargs["host"] = host

    try:
        return Langfuse(**kwargs)
    except Exception:
        LOGGER.exception("Failed to initialize Langfuse client; tracing disabled")
        return None
