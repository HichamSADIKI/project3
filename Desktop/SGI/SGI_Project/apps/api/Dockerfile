FROM python:3.13-slim

WORKDIR /app

RUN pip install uv

# System deps for Playwright/Chromium + ffmpeg (génération vidéo scénarios)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpangocairo-1.0-0 libgtk-3-0 libx11-xcb1 \
    wget ca-certificates fonts-liberation ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN uv sync --no-dev

# Install Playwright + Chromium browser binary
RUN uv run playwright install chromium

COPY app/ ./app/
COPY migrations/ ./migrations/
COPY scripts/ ./scripts/
COPY alembic.ini .
# Fixtures pytest partagées (db_session, client, seed_admin…). Sans ce fichier,
# `pytest` dans le conteneur échoue avec « fixture not found » sur toute la
# suite d'intégration.
COPY conftest.py .

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--loop", "uvloop", "--http", "httptools"]
