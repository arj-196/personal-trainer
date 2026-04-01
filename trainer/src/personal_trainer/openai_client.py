from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

LOGGER = logging.getLogger(__name__)


class OpenAIError(RuntimeError):
    """Raised when the OpenAI API cannot satisfy a planner request."""


@dataclass(frozen=True, slots=True)
class OpenAIClientConfig:
    api_key: str
    model: str
    base_url: str = "https://api.openai.com/v1"
    timeout_seconds: int = 180
    temperature: float = 0.2


class OpenAIChatClient:
    def __init__(self, config: OpenAIClientConfig) -> None:
        self.config = config

    def chat_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, Any],
    ) -> dict[str, Any]:
        endpoint = f"{self.config.base_url.rstrip('/')}/chat/completions"
        LOGGER.info(
            "Sending OpenAI request to %s using model '%s'",
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
                    "name": "trainer_weekly_plan",
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
            raise OpenAIError(self._format_http_error(error)) from error
        except URLError as error:
            raise OpenAIError(
                f"could not reach OpenAI at {self.config.base_url}: {error.reason}"
            ) from error
        except TimeoutError as error:
            raise OpenAIError(
                f"timed out waiting for OpenAI after {self.config.timeout_seconds} seconds"
            ) from error

        choices = response_payload.get("choices")
        if not isinstance(choices, list) or not choices:
            raise OpenAIError("OpenAI response did not include any completion choices")

        message = choices[0].get("message")
        if not isinstance(message, dict):
            raise OpenAIError("OpenAI response did not include a message payload")

        refusal = message.get("refusal")
        if isinstance(refusal, str) and refusal.strip():
            raise OpenAIError(f"OpenAI refused the request: {refusal.strip()}")

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

        raise OpenAIError("OpenAI response did not include structured JSON content")

    def _parse_json_content(self, content: str) -> dict[str, Any]:
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as error:
            raise OpenAIError(
                "OpenAI returned invalid JSON for the structured plan"
            ) from error
        if not isinstance(parsed, dict):
            raise OpenAIError(
                "OpenAI returned a structured response with the wrong top-level type"
            )
        LOGGER.info("OpenAI response received from model '%s'", self.config.model)
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
        return f"OpenAI request failed with {detail}"
