from __future__ import annotations

from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined, TemplateNotFound


class PromptManagerError(RuntimeError):
    """Raised when prompt templates cannot be loaded or rendered."""


class PromptManager:
    def __init__(self, base_dir: str | Path = "prompts") -> None:
        root = Path(base_dir)
        if not root.is_absolute():
            root = Path(__file__).resolve().parents[3] / root
        self._base_dir = root
        self._environment = Environment(
            loader=FileSystemLoader(str(self._base_dir)),
            undefined=StrictUndefined,
            autoescape=False,
        )

    def render(self, template_name: str, **kwargs) -> str:
        try:
            template = self._environment.get_template(template_name)
        except TemplateNotFound as error:
            raise PromptManagerError(
                f"Missing prompt template '{template_name}' in {self._base_dir}"
            ) from error
        return template.render(**kwargs)
