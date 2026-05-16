FROM python:3.12-slim AS base

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VERSION=2.2.1 \
    POETRY_VIRTUALENVS_CREATE=false \
    PYTHONPATH=/app/trainer/src

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl build-essential \
    && pip install "poetry==${POETRY_VERSION}" \
    && apt-get purge -y --auto-remove curl \
    && rm -rf /var/lib/apt/lists/*

COPY trainer ./trainer
COPY db ./db

WORKDIR /app/trainer

FROM base AS dev

RUN poetry install --with dev --no-interaction --no-ansi

EXPOSE 8010

CMD ["personal-trainer", "serve", "--host", "0.0.0.0", "--port", "8010", "--reload"]

FROM base AS production

RUN poetry install --only main --no-interaction --no-ansi

EXPOSE 8010

CMD ["personal-trainer", "serve", "--host", "0.0.0.0", "--port", "8010"]
