# Cloudless.gr Docker Makefile
# Comprehensive Docker operations for development and production
# Automatically builds latest images and runs docker-compose with fresh images

.PHONY: help dev prod test db clean logs build rebuild restart stop status \
        build-dev build-prod build-all push-dev push-prod push-all \
        dev-fresh prod-fresh dev-build-fresh prod-build-fresh

# Variables
DOCKER_REGISTRY ?= cloudlessgr
IMAGE_NAME ?= cloudlessgr-app
DEV_IMAGE = $(DOCKER_REGISTRY)/$(IMAGE_NAME)-dev
PROD_IMAGE = $(DOCKER_REGISTRY)/$(IMAGE_NAME)
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "latest")
BUILD_DATE = $(shell date -u +'%Y-%m-%dT%H:%M:%SZ')
GIT_COMMIT = $(shell git rev-parse HEAD 2>/dev/null || echo "unknown")

# Default target
help:
	@echo "Cloudless.gr Docker Commands:"
	@echo ""
	@echo "Image Building:"
	@echo "  make build-dev        - Build development Docker image"
	@echo "  make build-prod       - Build production Docker image"
	@echo "  make build-all        - Build both dev and prod images"
	@echo "  make push-dev         - Push development image to registry"
	@echo "  make push-prod        - Push production image to registry"
	@echo "  make push-all         - Push both images to registry"
	@echo ""
	@echo "Development (with fresh images):"
	@echo "  make dev              - Start development environment"
	@echo "  make dev-fresh        - Build fresh dev image and start"
	@echo "  make dev-build        - Build and start development environment"
	@echo "  make dev-build-fresh  - Build fresh image and start dev"
	@echo "  make dev-logs         - Show development logs"
	@echo "  make dev-stop         - Stop development environment"
	@echo ""
	@echo "Production (with fresh images):"
	@echo "  make prod             - Start production environment"
	@echo "  make prod-fresh       - Build fresh prod image and start"
	@echo "  make prod-build       - Build and start production environment"
	@echo "  make prod-build-fresh - Build fresh image and start prod"
	@echo "  make prod-logs        - Show production logs"
	@echo "  make prod-stop        - Stop production environment"
	@echo ""
	@echo "Testing:"
	@echo "  make test             - Run tests in Docker"
	@echo "  make test-e2e         - Run E2E tests"
	@echo ""
	@echo "Database:"
	@echo "  make db               - Start database services only"
	@echo "  make db-stop          - Stop database services"
	@echo "  make db-reset         - Reset database data"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean            - Clean all containers, volumes, and images"
	@echo "  make logs             - Show all logs"
	@echo "  make status           - Show container status"
	@echo "  make build            - Build all images"
	@echo "  make rebuild          - Rebuild all images (no cache)"
	@echo "  make restart          - Restart all services"

# Image Building Commands
build-dev:
	@echo "Building development Docker image..."
	docker build \
		--file Dockerfile.dev \
		--tag $(DEV_IMAGE):$(VERSION) \
		--tag $(DEV_IMAGE):latest \
		--build-arg VERSION=$(VERSION) \
		--build-arg GIT_COMMIT=$(GIT_COMMIT) \
		--build-arg BUILD_DATE=$(BUILD_DATE) \
		--build-arg NODE_ENV=development \
		--progress=plain \
		.

build-prod:
	@echo "Building production Docker image..."
	docker build \
		--file Dockerfile \
		--target production \
		--tag $(PROD_IMAGE):$(VERSION) \
		--tag $(PROD_IMAGE):latest \
		--build-arg VERSION=$(VERSION) \
		--build-arg GIT_COMMIT=$(GIT_COMMIT) \
		--build-arg BUILD_DATE=$(BUILD_DATE) \
		--build-arg NODE_ENV=production \
		--progress=plain \
		.

build-all: build-dev build-prod
	@echo "All images built successfully!"

# Image Pushing Commands
push-dev:
	@echo "Pushing development image to registry..."
	docker push $(DEV_IMAGE):$(VERSION)
	docker push $(DEV_IMAGE):latest

push-prod:
	@echo "Pushing production image to registry..."
	docker push $(PROD_IMAGE):$(VERSION)
	docker push $(PROD_IMAGE):latest

push-all: push-dev push-prod
	@echo "All images pushed successfully!"

# Development commands (with fresh image building)
dev: build-dev
	@echo "Starting development environment with latest image..."
	docker-compose -f docker-compose.dev.yml --env-file .env up -d

dev-fresh: build-dev
	@echo "Starting development environment with fresh image..."
	docker-compose -f docker-compose.dev.yml --env-file .env up -d --force-recreate

dev-build: build-dev
	@echo "Building and starting development environment..."
	docker-compose -f docker-compose.dev.yml --env-file .env up -d --build

dev-build-fresh: build-dev
	@echo "Building fresh image and starting development environment..."
	docker-compose -f docker-compose.dev.yml --env-file .env up -d --build --force-recreate

dev-logs:
	docker-compose -f docker-compose.dev.yml logs -f

dev-stop:
	docker-compose -f docker-compose.dev.yml down

# Production commands (with fresh image building)
prod: build-prod
	@echo "Starting production environment with latest image..."
	docker-compose -f docker-compose.yml --env-file .env up -d

prod-fresh: build-prod
	@echo "Starting production environment with fresh image..."
	docker-compose -f docker-compose.yml --env-file .env up -d --force-recreate

prod-build: build-prod
	@echo "Building and starting production environment..."
	docker-compose -f docker-compose.yml --env-file .env up -d --build

prod-build-fresh: build-prod
	@echo "Building fresh image and starting production environment..."
	docker-compose -f docker-compose.yml --env-file .env up -d --build --force-recreate

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
	@echo "Cleaning all containers, volumes, and images..."
	docker-compose -f docker-compose.dev.yml -f docker-compose.yml -f docker-compose.test.yml -f docker-compose.database.yml down -v
	docker system prune -f
	docker volume prune -f
	docker image prune -f
	@echo "Cleanup completed!"

logs:
	docker-compose -f docker-compose.dev.yml -f docker-compose.yml -f docker-compose.test.yml -f docker-compose.database.yml logs -f

status:
	docker-compose -f docker-compose.dev.yml -f docker-compose.yml -f docker-compose.test.yml -f docker-compose.database.yml ps

build: build-all

rebuild:
	@echo "Rebuilding all images without cache..."
	docker build --no-cache --file Dockerfile.dev --tag $(DEV_IMAGE):$(VERSION) --tag $(DEV_IMAGE):latest .
	docker build --no-cache --file Dockerfile --target production --tag $(PROD_IMAGE):$(VERSION) --tag $(PROD_IMAGE):latest .

restart:
	docker-compose -f docker-compose.dev.yml -f docker-compose.yml -f docker-compose.test.yml -f docker-compose.database.yml restart

# Quick access commands
up: dev
down: dev-stop
start: dev
stop: dev-stop

# Additional utility commands
images:
	@echo "Listing all project images:"
	docker images | grep -E "(cloudlessgr|$(IMAGE_NAME))"

clean-images:
	@echo "Removing all project images..."
	docker rmi $(shell docker images -q | grep -E "(cloudlessgr|$(IMAGE_NAME))") 2>/dev/null || true

inspect-dev:
	docker inspect $(DEV_IMAGE):latest

inspect-prod:
	docker inspect $(PROD_IMAGE):latest

# Health check commands
health-dev:
	@echo "Checking development environment health..."
	docker-compose -f docker-compose.dev.yml ps
	@echo "Testing application health..."
	curl -f http://localhost:3000/api/health || echo "Health check failed"

health-prod:
	@echo "Checking production environment health..."
	docker-compose -f docker-compose.yml ps
	@echo "Testing application health..."
	curl -f http://localhost:3000/api/health || echo "Health check failed"

# Backup and restore commands
backup-db:
	@echo "Creating database backup..."
	docker-compose -f docker-compose.database.yml exec postgres pg_dump -U cloudless cloudless_dev > backup_$(shell date +%Y%m%d_%H%M%S).sql

restore-db:
	@echo "Restoring database from backup..."
	@read -p "Enter backup file name: " backup_file; \
	docker-compose -f docker-compose.database.yml exec -T postgres psql -U cloudless cloudless_dev < $$backup_file
