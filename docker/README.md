# Docker Configuration

This directory contains all Docker-related configuration files.

## 📁 Files

- `docker-compose.yml` - Production Docker Compose
- `docker-compose.dev.yml` - Development Docker Compose
- `docker-compose.prod.yml` - Production Docker Compose
- `Dockerfile` - Production Dockerfile
- `Dockerfile.dev` - Development Dockerfile
- `.dockerignore` - Docker build exclusions

## 🚀 Quick Start

```bash
# Development
docker-compose -f docker-compose.dev.yml up -d

# Production
docker-compose -f docker-compose.prod.yml up -d
```

## 📚 Documentation

See [../docs/DOCKER-DEV.md](../docs/DOCKER-DEV.md) for detailed development guide.
