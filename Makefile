.PHONY: start stop download-from-prod \
	test test-shared test-web dev-web \
	db-up db-setup db-down db-destroy

start: db-up db-setup download-from-prod

stop: db-destroy

download-from-prod:
	(cd trainer && set -a && . ./.env.local && set +a && poetry run personal-trainer sync pull-prod)

# Tests
test:
	npm run test --workspaces --if-present

test-shared:
	npm run test -w @personal-trainer/shared

test-web:
	npm run test -w personal-trainer-frontend

# Dev
dev-web:
	npm run dev -w personal-trainer-frontend

# Database
db-up:
	docker compose up -d

db-setup:
	(cd trainer && poetry run trainer db setup)

db-down:
	docker compose down

db-destroy:
	docker compose down -v
