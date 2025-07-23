# Docker Setup Guide for Cloudless.gr

This guide explains how to use Docker for both development and production environments.

## 🚀 Quick Start

### Development Environment

```bash
# Copy environment variables
cp env.example .env

# Start development environment with hot-reload
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f app

# Access services
# - App: http://localhost:3000
# - Mailhog: http://localhost:8025
# - Adminer: http://localhost:8080
# - Redis Commander: http://localhost:8081
```

### Production Environment

```bash
# Build production image
docker-compose -f docker-compose.prod.yml build

# Start production services
docker-compose -f docker-compose.prod.yml up -d

# With monitoring stack
docker-compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d
```

## 📁 File Structure

```
.
├── Dockerfile                    # Multi-stage Dockerfile (dev & prod)
├── docker-compose.dev.yml        # Development configuration
├── docker-compose.prod.yml       # Production configuration
├── docker-compose.monitoring.yml # Monitoring stack
├── env.example                   # Environment variables template
└── monitoring/                   # Monitoring configurations
    ├── prometheus/
    ├── grafana/
    └── ...
```

## 🔧 Development Features

### Hot Reload
The development setup includes full hot-reload support:
- Source code is mounted as a volume
- HMR (Hot Module Replacement) is enabled
- Changes are reflected immediately without rebuilding

### Debugging
- Node.js debugger available on port 9229
- Connect with VS Code or Chrome DevTools
- Debug configuration included

### Development Services
- **PostgreSQL**: Local database instance
- **Redis**: Caching and session storage
- **Mailhog**: Email testing (SMTP: 1025, UI: 8025)
- **Adminer**: Database management UI
- **Redis Commander**: Redis management UI

## 🏭 Production Features

### Optimizations
- Multi-stage build for minimal image size
- Production dependencies only
- Node.js memory optimizations
- Security hardening (non-root user)
- Health checks configured

### Environment Variables
All sensitive data is loaded from environment variables:
```bash
# Required variables
NUXT_PUBLIC_SUPABASE_URL
NUXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
REDIS_URL
SESSION_SECRET
JWT_SECRET
```

## 🐳 Docker Commands

### Development
```bash
# Start services
docker-compose -f docker-compose.dev.yml up -d

# Stop services
docker-compose -f docker-compose.dev.yml down

# Rebuild after dependency changes
docker-compose -f docker-compose.dev.yml build --no-cache app

# View logs
docker-compose -f docker-compose.dev.yml logs -f app

# Execute commands in container
docker-compose -f docker-compose.dev.yml exec app pnpm run test

# Clean up everything
docker-compose -f docker-compose.dev.yml down -v --remove-orphans
```

### Production
```bash
# Build production image
docker build -t cloudlessgr-app:latest --target production .

# Run with specific version
docker build -t cloudlessgr-app:v1.0.0 \
  --build-arg VERSION=v1.0.0 \
  --build-arg GIT_COMMIT=$(git rev-parse HEAD) \
  --build-arg BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  --target production .

# Start production stack
docker-compose -f docker-compose.prod.yml up -d

# Scale application
docker-compose -f docker-compose.prod.yml up -d --scale app=3
```

## 📊 Monitoring

### Available Services
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001
- **Jaeger**: http://localhost:16686
- **Sentry**: http://localhost:9000

### Metrics Collected
- System metrics (CPU, Memory, Disk)
- Container metrics
- Application metrics
- Database metrics
- Redis metrics

### Alerts Configured
- High memory usage (>85%)
- JavaScript heap memory (>85%)
- Service downtime
- High response times
- Database connection limits

## 🔍 Troubleshooting

### Memory Issues
If you encounter heap out of memory errors:
1. Check NODE_OPTIONS in docker-compose files
2. Increase --max-old-space-size value
3. Monitor with `docker stats`

### Hot Reload Not Working
1. Ensure volumes are mounted correctly
2. Check NUXT_HMR_HOST and NUXT_HMR_PORT
3. Verify port 24678 is accessible

### Database Connection Issues
1. Check DATABASE_URL format
2. Ensure postgres service is healthy
3. Verify network connectivity

## 🔐 Security Best Practices

1. **Never commit .env files**
2. **Use secrets management in production**
3. **Regularly update base images**
4. **Run containers as non-root user**
5. **Limit container resources**
6. **Use read-only filesystems where possible**

## 🚢 Deployment

### Using Docker Swarm
```bash
docker stack deploy -c docker-compose.prod.yml cloudless
```

### Using Kubernetes
Convert docker-compose to K8s manifests:
```bash
kompose convert -f docker-compose.prod.yml
```

### CI/CD Integration
The Dockerfile accepts build arguments for versioning:
- VERSION: Application version
- GIT_COMMIT: Git commit hash
- BUILD_DATE: Build timestamp

These can be set in your CI/CD pipeline for proper image tagging and tracking. 