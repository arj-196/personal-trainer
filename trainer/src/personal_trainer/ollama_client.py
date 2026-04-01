from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

LOGGER = logging.getLogger(__name__)


class OllamaError(RuntimeError):
    """Raised when the local Ollama server cannot satisfy a planner request."""


@dataclass(frozen=True, slots=True)
class OllamaClientConfig:
    base_url: str = "http://localhost:11434"
    model: str = "gpt-oss:20b"
    timeout_seconds: int = 180
    temperature: float = 0.2


class OllamaChatClient:
    def __init__(self, config: OllamaClientConfig) -> None:
        self.config = config

    def chat_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, Any],
    ) -> dict[str, Any]:
        endpoint = f"{self.config.base_url.rstrip('/')}/api/chat"
        LOGGER.info(
            "Sending Ollama request to %s using model '%s'",
            endpoint,
            self.config.model,
        )
        payload = {
            "model": self.config.model,
            "stream": False,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "format": schema,
            "options": {
                "temperature": self.config.temperature,
            },
        }
        request = Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urlopen(request, timeout=self.config.timeout_seconds) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            raise OllamaError(self._format_http_error(error)) from error
        except URLError as error:
            raise OllamaError(
                f"could not reach Ollama at {self.config.base_url}: {error.reason}"
            ) from error
        except TimeoutError as error:
            raise OllamaError(
                f"timed out waiting for Ollama after {self.config.timeout_seconds} seconds"
            ) from error

        if response_payload.get("error"):
            raise OllamaError(str(response_payload["error"]))
        LOGGER.info("Ollama response received from model '%s'", self.config.model)

        message = response_payload.get("message")
        if not isinstance(message, dict):
            raise OllamaError("Ollama response did not include a chat message payload")

        content = message.get("content")
        if isinstance(content, dict):
            return content
        if not isinstance(content, str) or not content.strip():
            raise OllamaError("Ollama response did not include structured JSON content")

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as error:
            raise OllamaError(
                "Ollama returned invalid JSON for the structured plan"
            ) from error
        if not isinstance(parsed, dict):
            raise OllamaError(
                "Ollama returned a structured response with the wrong top-level type"
            )
        return parsed

    def _format_http_error(self, error: HTTPError) -> str:
        body = ""
        try:
            raw_body = error.read().decode("utf-8")
            parsed = json.loads(raw_body)
            if isinstance(parsed, dict) and parsed.get("error"):
                body = str(parsed["error"])
            else:
                body = raw_body.strip()
        except Exception:
            body = ""

        detail = f"HTTP {error.code}"
        if body:
            detail = f"{detail}: {body}"
        return f"Ollama request failed with {detail}"
