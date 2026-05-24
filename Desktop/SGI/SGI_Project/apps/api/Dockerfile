FROM python:3.13-slim

WORKDIR /app

RUN pip install uv

COPY pyproject.toml .
RUN uv sync --no-dev

COPY app/ ./app/
COPY migrations/ ./migrations/
COPY alembic.ini .

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--loop", "uvloop", "--http", "httptools"]
