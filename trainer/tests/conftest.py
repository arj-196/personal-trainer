from __future__ import annotations

import pytest


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--run-paid",
        action="store_true",
        default=False,
        help="Run tests that cover hosted-LLM paths and may require paid provider configuration.",
    )


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line(
        "markers",
        "paid_llm: marks tests that exercise paid hosted-LLM trainer paths",
    )


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if config.getoption("--run-paid"):
        return

    skip_paid = pytest.mark.skip(
        reason="Skipped by default to avoid paid LLM test paths. Use --run-paid to include.",
    )
    for item in items:
        if "paid_llm" in item.keywords:
            item.add_marker(skip_paid)
