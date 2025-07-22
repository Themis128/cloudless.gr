# 🐳 Docker Development Setup for Cloudless.gr

This document describes the Docker development environment for Cloudless.gr, optimized for fast development, debugging, and monitoring.

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running
- PowerShell (for Windows) or Bash (for Linux/Mac)
- Node.js 20+ (for local development without Docker)

### Start Development Environment
```powershell
# Using the PowerShell script (recommended)
.\docker.ps1 dev

# Or using Docker Compose directly
docker-compose -f docker-compose.dev.yml up -d
```

### Access Services
- **Main App**: http://localhost:3000
- **Redis Commander**: http://localhost:8081 (admin/admin)
- **pgAdmin**: http://localhost:8080 (admin/admin) - if using database profile
- **MailHog**: http://localhost:8025 - if using email profile

## 📁 Docker Files Structure

```
cloudless.gr/
├── Dockerfile.dev          # Development container
├── Dockerfile              # Production container
├── docker-compose.dev.yml  # Development services
├── docker-compose.yml      # Production services
├── docker-compose.override.yml # Local overrides
├── docker.ps1              # PowerShell management script
├── .dockerignore           # Build exclusions
└── DOCKER_README.md        # This file
```

## 🔧 Development Features

### Enhanced Development Dockerfile (`Dockerfile.dev`)
- **Node.js 20 Alpine** - Latest LTS with minimal footprint
- **Development Tools** - vim, htop, procps for debugging
- **Global Packages** - nodemon, @nuxt/cli, typescript, ts-node
- **Optimized Caching** - Better layer caching for faster rebuilds
- **Non-root User** - Security best practices
- **Health Checks** - Container health monitoring

### Development Services (`docker-compose.dev.yml`)

#### 🖥️ App Development Container (`app-dev`)
- **Ultra-fast Hot Reload** - 50ms file watching intervals
- **Vite Optimizations** - Instant HMR with optimized dependencies
- **Node.js Debugging** - Remote debugging on port 9229
- **Resource Limits** - 4GB RAM, 3 CPU cores for optimal performance
- **Volume Mounts** - Live code editing with cache optimization
- **Environment Variables** - Flexible configuration with fallbacks

#### 🗄️ Redis Development (`redis-dev`)
- **Memory Optimized** - 128MB limit for development
- **Performance Tuning** - Disabled persistence for speed
- **Monitoring** - Keyspace notifications and slow query logging
- **Health Checks** - Automatic health monitoring

#### 🖥️ Redis Commander (`redis-commander`)
- **Web UI** - Visual Redis management
- **Authentication** - admin/admin credentials
- **Real-time Monitoring** - Live key inspection and management

#### 🗄️ PostgreSQL Development (`postgres-dev`)
- **Profile-based** - Only starts with `--profile database`
- **Performance Tuned** - Optimized for development workloads
- **Health Checks** - Database readiness monitoring

#### 🖥️ pgAdmin (`pgadmin`)
- **Web UI** - PostgreSQL management interface
- **Profile-based** - Only starts with `--profile database`
- **Authentication** - admin/admin credentials

#### 📧 MailHog (`mailhog`)
- **Email Testing** - SMTP server for development
- **Web UI** - Email inspection interface
- **Profile-based** - Only starts with `--profile email`

## 🛠️ Management Commands

### PowerShell Script (`docker.ps1`)
```powershell
# Start development environment
.\docker.ps1 dev

# View logs
.\docker.ps1 logs
.\docker.ps1 logs app-dev

# Open shell in container
.\docker.ps1 shell app-dev

# Check status
.\docker.ps1 status

# Restart services
.\docker.ps1 restart

# Stop environment
.\docker.ps1 stop

# Rebuild containers
.\docker.ps1 build

# Clean up resources
.\docker.ps1 clean

# Show help
.\docker.ps1 help
```

### Direct Docker Compose Commands
```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# Start with database profile
docker-compose -f docker-compose.dev.yml --profile database up -d

# Start with email profile
docker-compose -f docker-compose.dev.yml --profile email up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# View specific service logs
docker-compose -f docker-compose.dev.yml logs -f app-dev

# Execute commands in container
docker-compose -f docker-compose.dev.yml exec app-dev /bin/bash

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Rebuild containers
docker-compose -f docker-compose.dev.yml build --no-cache
```

## 🔄 Development Workflow

### 1. Local Development (No Redis)
```bash
# Create .env file with SKIP_REDIS=true
echo "SKIP_REDIS=true" > .env

# Start local development server
npm run dev
```

### 2. Docker Development (With Redis)
```powershell
# Start Docker environment
.\docker.ps1 dev

# Access app at http://localhost:3000
# Access Redis UI at http://localhost:8081
```

### 3. Database Development
```powershell
# Start with database services
docker-compose -f docker-compose.dev.yml --profile database up -d

# Access pgAdmin at http://localhost:8080
```

### 4. Email Testing
```powershell
# Start with email services
docker-compose -f docker-compose.dev.yml --profile email up -d

# Access MailHog at http://localhost:8025
```

## ⚡ Performance Optimizations

### File Watching
- **Chokidar Polling** - 50ms intervals for instant file detection
- **Watchpack Optimization** - Aggregated file watching
- **Ignored Patterns** - Excludes build artifacts and caches

### Vite Hot Module Replacement
- **HMR Port** - 24678 for Vite HMR
- **Optimized Dependencies** - Pre-bundled heavy packages
- **Instant Reload** - Sub-second reload times

### Caching Strategy
- **Volume Caches** - npm, nuxt, vite, esbuild, typescript caches
- **Layer Caching** - Optimized Docker layer ordering
- **Build Caching** - Persistent build artifacts

### Resource Allocation
- **Memory Limits** - 4GB for app, 256MB for Redis
- **CPU Limits** - 3 cores for app, 0.25 for Redis
- **Shared Memory** - 512MB for better performance

## 🔍 Debugging Features

### Node.js Debugging
```bash
# Debug port is exposed on 9229
# Connect your IDE to localhost:9229
```

### Container Debugging
```powershell
# Open shell in app container
.\docker.ps1 shell app-dev

# View real-time logs
.\docker.ps1 logs app-dev
```

### Redis Debugging
```bash
# Access Redis CLI
docker-compose -f docker-compose.dev.yml exec redis-dev redis-cli

# Monitor Redis commands
docker-compose -f docker-compose.dev.yml exec redis-dev redis-cli monitor
```

## 🧹 Maintenance

### Clean Up Resources
```powershell
# Clean unused resources
.\docker.ps1 clean

# Force clean everything
.\docker.ps1 clean -Force
```

### Rebuild Containers
```powershell
# Rebuild all containers
.\docker.ps1 build

# Rebuild specific service
docker-compose -f docker-compose.dev.yml build app-dev
```

### Reset Data
```bash
# Reset all data (WARNING: Destructive)
docker-compose -f docker-compose.dev.yml down -v
docker volume prune -f
```

## 🔧 Configuration

### Environment Variables
The Docker setup uses environment variables with sensible defaults:

```env
# Core settings
NODE_ENV=development
NITRO_HOST=0.0.0.0
NITRO_PORT=3000

# Redis settings
REDIS_URL=redis://redis-dev:6379
REDIS_MAX_MEMORY=256mb

# Database settings
DATABASE_URL=postgresql://cloudless:development@postgres-dev:5432/cloudless_dev

# Supabase settings
NUXT_PUBLIC_SUPABASE_URL=your-supabase-url
NUXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key

# API keys
OPENAI_API_KEY=disabled
ANTHROPIC_API_KEY=your-anthropic-key
```

### Profiles
Use Docker Compose profiles to start specific service groups:

- **Default**: app-dev, redis-dev, redis-commander
- **Database**: + postgres-dev, pgadmin
- **Email**: + mailhog

## 🚨 Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check what's using port 3000
netstat -ano | findstr :3000

# Use different ports in docker-compose.dev.yml
ports:
  - "3001:3000"  # Use port 3001 instead
```

#### Memory Issues
```bash
# Increase Docker Desktop memory limit
# Docker Desktop > Settings > Resources > Memory: 8GB+
```

#### File Permission Issues
```bash
# Fix file permissions in container
docker-compose -f docker-compose.dev.yml exec app-dev chown -R nuxtjs:nodejs /app
```

#### Slow File Watching
```bash
# Check if file watching is working
docker-compose -f docker-compose.dev.yml exec app-dev ls -la /app

# Verify volume mounts
docker-compose -f docker-compose.dev.yml exec app-dev mount
```

### Performance Issues

#### Slow Builds
```bash
# Clear all caches
docker system prune -a -f
docker volume prune -f

# Rebuild without cache
docker-compose -f docker-compose.dev.yml build --no-cache
```

#### High Memory Usage
```bash
# Check container resource usage
docker stats

# Adjust resource limits in docker-compose.dev.yml
deploy:
  resources:
    limits:
      memory: 2G  # Reduce from 4G
```

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nuxt.js Docker Guide](https://nuxt.com/docs/guide/deployment/docker)
- [Redis Documentation](https://redis.io/documentation)
- [PostgreSQL Docker](https://hub.docker.com/_/postgres)

## 🤝 Contributing

When contributing to the Docker setup:

1. Test changes with both local and Docker development
2. Update this README for any new features
3. Ensure backward compatibility
4. Add appropriate health checks for new services
5. Optimize for development performance

---

**Happy Coding! 🚀** 