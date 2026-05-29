.PHONY: up down logs migrate seed test lint backup scale ssl-init healthcheck

# Variables
COMPOSE = docker compose
API = apps/api

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f $(s)

migrate:
	$(COMPOSE) exec api uv run alembic upgrade head

seed:
	$(COMPOSE) exec -e PYTHONPATH=/app api uv run python scripts/seed.py

test:
	pnpm turbo test && $(COMPOSE) exec api uv run pytest

lint:
	pnpm turbo lint && $(COMPOSE) exec api uv run ruff check . && uv run ruff format --check .

backup:
	mkdir -p backups
	$(COMPOSE) exec db pg_dump -U $$POSTGRES_USER $$POSTGRES_DB | gzip > backups/sgi_$$(date +%Y%m%d_%H%M%S).sql.gz
	@echo "✓ Backup saved to backups/"

scale:
	$(COMPOSE) up -d --scale api=$(n)

ssl-init:
	$(COMPOSE) run --rm certbot certonly --webroot -w /var/www/certbot -d $(domain)

healthcheck:
	@echo "Checking services..."
	@$(COMPOSE) ps
	@curl -sf http://localhost:8000/health && echo "✓ API OK" || echo "✗ API FAIL"
	@curl -sf http://localhost:3000 && echo "✓ Web OK" || echo "✗ Web FAIL"
