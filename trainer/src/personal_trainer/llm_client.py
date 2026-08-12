from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

LOGGER = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"


class LlmError(RuntimeError):
    """Raised when the LLM provider cannot satisfy a planner request."""


@dataclass(frozen=True, slots=True)
class LlmClientConfig:
    api_key: str
    model: str
    base_url: str = DEFAULT_BASE_URL
    timeout_seconds: int = 180
    temperature: float = 0.2


class LlmChatClient:
    """Chat client for any OpenAI-compatible endpoint (OpenRouter by default)."""

    def __init__(self, config: LlmClientConfig) -> None:
        self.config = config

    def chat_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, Any],
        schema_name: str = "trainer_weekly_plan",
    ) -> dict[str, Any]:
        endpoint = f"{self.config.base_url.rstrip('/')}/chat/completions"
        LOGGER.info(
            "Sending LLM request to %s using model '%s'",
            endpoint,
            self.config.model,
        )
        payload = {
            "model": self.config.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": self.config.temperature,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "strict": True,
                    "schema": schema,
                },
            },
        }
        request = Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.config.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=self.config.timeout_seconds) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            raise LlmError(self._format_http_error(error)) from error
        except URLError as error:
            raise LlmError(
                f"could not reach the LLM provider at {self.config.base_url}: {error.reason}"
            ) from error
        except TimeoutError as error:
            raise LlmError(
                f"timed out waiting for the LLM provider after {self.config.timeout_seconds} seconds"
            ) from error

        self._log_usage(response_payload)

        choices = response_payload.get("choices")
        if not isinstance(choices, list) or not choices:
            raise LlmError("LLM response did not include any completion choices")

        message = choices[0].get("message")
        if not isinstance(message, dict):
            raise LlmError("LLM response did not include a message payload")

        refusal = message.get("refusal")
        if isinstance(refusal, str) and refusal.strip():
            raise LlmError(f"LLM refused the request: {refusal.strip()}")

        content = message.get("content")
        if isinstance(content, str) and content.strip():
            return self._parse_json_content(content)
        if isinstance(content, list):
            for item in content:
                if not isinstance(item, dict):
                    continue
                if item.get("type") != "text":
                    continue
                text = item.get("text")
                if isinstance(text, str) and text.strip():
                    return self._parse_json_content(text)

        raise LlmError("LLM response did not include structured JSON content")

    def _log_usage(self, response_payload: dict[str, Any]) -> None:
        usage = response_payload.get("usage")
        if not isinstance(usage, dict):
            return
        LOGGER.info(
            "LLM usage for model '%s': prompt_tokens=%s completion_tokens=%s total_tokens=%s",
            self.config.model,
            usage.get("prompt_tokens"),
            usage.get("completion_tokens"),
            usage.get("total_tokens"),
        )

    def _parse_json_content(self, content: str) -> dict[str, Any]:
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as error:
            raise LlmError(
                "LLM returned invalid JSON for the structured plan"
            ) from error
        if not isinstance(parsed, dict):
            raise LlmError(
                "LLM returned a structured response with the wrong top-level type"
            )
        LOGGER.info("LLM response received from model '%s'", self.config.model)
        return parsed

    def _format_http_error(self, error: HTTPError) -> str:
        body = ""
        try:
            raw_body = error.read().decode("utf-8")
            parsed = json.loads(raw_body)
            if isinstance(parsed, dict):
                if isinstance(parsed.get("error"), dict):
                    body = str(parsed["error"].get("message", "")).strip()
                elif parsed.get("error"):
                    body = str(parsed["error"]).strip()
                else:
                    body = raw_body.strip()
            else:
                body = raw_body.strip()
        except Exception:
            body = ""

        detail = f"HTTP {error.code}"
        if body:
            detail = f"{detail}: {body}"
        return f"LLM request failed with {detail}"
