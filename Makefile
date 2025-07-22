# Cloudless.gr Docker Makefile
# Common Docker operations for development and production

.PHONY: help dev prod test db clean logs build rebuild restart stop status

# Default target
help:
	@echo "Cloudless.gr Docker Commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development environment"
	@echo "  make dev-build    - Build and start development environment"
	@echo "  make dev-logs     - Show development logs"
	@echo "  make dev-stop     - Stop development environment"
	@echo ""
	@echo "Production:"
	@echo "  make prod         - Start production environment"
	@echo "  make prod-build   - Build and start production environment"
	@echo "  make prod-logs    - Show production logs"
	@echo "  make prod-stop    - Stop production environment"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run tests in Docker"
	@echo "  make test-e2e     - Run E2E tests"
	@echo ""
	@echo "Database:"
	@echo "  make db           - Start database services only"
	@echo "  make db-stop      - Stop database services"
	@echo "  make db-reset     - Reset database data"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean        - Clean all containers and volumes"
	@echo "  make logs         - Show all logs"
	@echo "  make status       - Show container status"
	@echo "  make build        - Build all images"
	@echo "  make rebuild      - Rebuild all images"
	@echo "  make restart      - Restart all services"

# Development commands
dev:
	docker-compose -f docker-compose.dev.yml --env-file .env up -d

dev-build:
	docker-compose -f docker-compose.dev.yml --env-file .env up -d --build

dev-logs:
	docker-compose -f docker-compose.dev.yml logs -f

dev-stop:
	docker-compose -f docker-compose.dev.yml down

# Production commands
prod:
	docker-compose -f docker-compose.yml --env-file .env up -d

prod-build:
	docker-compose -f docker-compose.yml --env-file .env up -d --build

prod-logs:
	docker-compose -f docker-compose.yml logs -f

prod-stop:
	docker-compose -f docker-compose.yml down

# Testing commands
test:
	docker-compose -f docker-compose.test.yml --env-file .env up --build --abort-on-container-exit

test-e2e:
	docker-compose -f docker-compose.test.yml --env-file .env up playwright --build --abort-on-container-exit

# Database commands
db:
	docker-compose -f docker-compose.database.yml --env-file .env up -d

db-stop:
	docker-compose -f docker-compose.database.yml down

db-reset:
	docker-compose -f docker-compose.database.yml down -v
	docker-compose -f docker-compose.database.yml --env-file .env up -d

# Utility commands
clean:
	docker-compose -f docker-compose.dev.yml -f docker-compose.yml -f docker-compose.test.yml -f docker-compose.database.yml down -v
	docker system prune -f
	docker volume prune -f

logs:
	docker-compose -f docker-compose.dev.yml -f docker-compose.yml -f docker-compose.test.yml -f docker-compose.database.yml logs -f

status:
	docker-compose -f docker-compose.dev.yml -f docker-compose.yml -f docker-compose.test.yml -f docker-compose.database.yml ps

build:
	docker-compose -f docker-compose.dev.yml -f docker-compose.yml -f docker-compose.test.yml build

rebuild:
	docker-compose -f docker-compose.dev.yml -f docker-compose.yml -f docker-compose.test.yml build --no-cache

restart:
	docker-compose -f docker-compose.dev.yml -f docker-compose.yml -f docker-compose.test.yml -f docker-compose.database.yml restart

# Quick access commands
up: dev
down: dev-stop
start: dev
stop: dev-stop 