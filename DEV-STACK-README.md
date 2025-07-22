# 🚀 Cloudless Development Stack

A comprehensive, containerized development environment for the Cloudless LLM Dev Agent platform.

## 📋 What's Included

Your development stack includes:

### 🏗️ Core Application
- **Nuxt.js 3** - Main application with hot reloading
- **Node.js Debugger** - Remote debugging on port 9229
- **Nuxt DevTools** - Development tools on port 24678

### 🗄️ Database & Cache
- **PostgreSQL 16** - Primary database with sample data
- **Redis 7** - Caching and session storage
- **Redis Commander** - Web-based Redis management tool

### 🔧 Development Tools
- **Mailhog** - Email testing and debugging
- **Nginx** - Development proxy and load balancer
- **Health Checks** - Monitoring endpoints for all services

### 📊 Monitoring & Debugging
- Container health monitoring
- Centralized logging
- Performance metrics
- Database query monitoring

## 🚀 Quick Start

### Prerequisites

Ensure you have installed:
- Docker Desktop or Docker Engine
- Docker Compose v2.0+
- Git

### 1. Start Development Environment

```bash
# Start the entire development stack
./scripts/docker/dev-docker.sh start

# Or use the npm script
npm run dev:docker
```

### 2. Access Your Services

Once started, access your services at:

| Service | URL | Credentials |
|---------|-----|-------------|
| 🌐 **Main App** | http://localhost:3000 | - |
| 🔧 **Redis Commander** | http://localhost:8081 | admin/admin |
| 📧 **Mailhog** | http://localhost:8025 | - |
| 🐛 **Node Debugger** | http://localhost:9229 | - |
| 🏥 **Health Check** | http://localhost:3000/api/health | - |

### 3. Database Connection

Connect to your PostgreSQL database:
```bash
Host: localhost
Port: 5432
Database: cloudless_dev
Username: cloudless
Password: development
```

Or use the connection string:
```
postgresql://cloudless:development@localhost:5432/cloudless_dev
```

## 🛠️ Development Commands

### Basic Operations
```bash
# Start development environment
./scripts/docker/dev-docker.sh start

# Stop development environment  
./scripts/docker/dev-docker.sh stop

# Restart development environment
./scripts/docker/dev-docker.sh restart

# View logs (all services)
./scripts/docker/dev-docker.sh logs

# Enter app container shell
./scripts/docker/dev-docker.sh shell

# Check status of all services
./scripts/docker/dev-docker.sh status
```

### Advanced Operations
```bash
# Rebuild containers (after dependency changes)
./scripts/docker/dev-docker.sh build

# Clean everything (containers, volumes, images)
./scripts/docker/dev-docker.sh clean

# Show help
./scripts/docker/dev-docker.sh help
```

### NPM Scripts Integration
```bash
# These npm scripts use the development stack
npm run dev:docker          # Start development
npm run dev:docker:build     # Build containers
npm run dev:docker:down      # Stop development
npm run dev:docker:logs      # View logs
npm run dev:docker:shell     # Enter shell
npm run dev:docker:restart   # Restart
npm run dev:docker:clean     # Clean up
npm run dev:docker:status    # Show status
```

## 🔧 Configuration

### Environment Variables

The development stack uses `.env.dev` for configuration:

```bash
# Copy and customize the development environment
cp .env.dev .env.dev.local

# Edit with your actual values
nano .env.dev.local
```

**Important Variables to Configure:**
```env
# Supabase (replace with your development project)
NUXT_PUBLIC_SUPABASE_URL=https://your-dev-project.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-dev-service-role-key

# External APIs (use development keys)
OPENAI_API_KEY=your-dev-openai-key
ANTHROPIC_API_KEY=your-dev-anthropic-key
```

### Database Schema

The development database comes pre-configured with:
- ✅ User management tables
- ✅ Project and pipeline tables  
- ✅ AI model configuration tables
- ✅ Analytics dashboard tables
- ✅ Execution logging tables
- ✅ Sample development data

### Hot Reloading

The development environment supports:
- ✅ **Vue/Nuxt files** - Instant hot reloading
- ✅ **TypeScript files** - Automatic compilation
- ✅ **CSS/SCSS files** - Live style updates
- ✅ **Server API routes** - Auto-restart on changes
- ✅ **Environment variables** - Restart required

## 🐛 Debugging

### Node.js Debugging
1. Debugger runs on `localhost:9229`
2. Use VS Code, Chrome DevTools, or your preferred debugger
3. Attach to the running process

### VS Code Configuration
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "attach",
  "name": "Attach to Docker",
  "remoteRoot": "/app",
  "localRoot": "${workspaceFolder}",
  "port": 9229,
  "host": "localhost"
}
```

### Database Debugging
```bash
# Connect to PostgreSQL directly
docker compose -f docker-compose.dev.yml exec postgres-dev psql -U cloudless -d cloudless_dev

# View database logs
docker compose -f docker-compose.dev.yml logs postgres-dev
```

### Redis Debugging
- Use Redis Commander at http://localhost:8081
- Or connect via CLI: `docker compose -f docker-compose.dev.yml exec redis-dev redis-cli -a development`

## 📊 Monitoring

### Health Checks
- **App Health**: http://localhost:3000/api/health
- **Container Status**: `./scripts/docker/dev-docker.sh status`
- **Resource Usage**: Included in status command

### Logs
```bash
# All services
./scripts/docker/dev-docker.sh logs

# Specific service
docker compose -f docker-compose.dev.yml logs -f app-dev
docker compose -f docker-compose.dev.yml logs -f postgres-dev  
docker compose -f docker-compose.dev.yml logs -f redis-dev
```

## 🔄 Development Workflow

### 1. Daily Development
```bash
# Morning: Start your development environment
./scripts/docker/dev-docker.sh start

# Work on your code with hot reloading
# All changes are automatically reflected

# Evening: Stop the environment
./scripts/docker/dev-docker.sh stop
```

### 2. After Package Changes
```bash
# Rebuild when package.json changes
./scripts/docker/dev-docker.sh build
./scripts/docker/dev-docker.sh restart
```

### 3. Database Changes
```bash
# Apply new migrations or schema changes
./scripts/docker/dev-docker.sh shell
# Inside container: run your migration commands

# Or reset database with clean
./scripts/docker/dev-docker.sh clean
./scripts/docker/dev-docker.sh start
```

## 🚨 Troubleshooting

### Common Issues

**Port Conflicts:**
```bash
# Check what's using your ports
sudo lsof -i :3000
sudo lsof -i :5432
sudo lsof -i :6379

# Stop conflicting services
sudo systemctl stop postgresql
sudo systemctl stop redis
```

**Container Won't Start:**
```bash
# Check container logs
./scripts/docker/dev-docker.sh logs

# Rebuild from scratch
./scripts/docker/dev-docker.sh clean
./scripts/docker/dev-docker.sh start
```

**Hot Reloading Not Working:**
```bash
# Restart the development container
docker compose -f docker-compose.dev.yml restart app-dev

# Or full restart
./scripts/docker/dev-docker.sh restart
```

**Database Connection Issues:**
```bash
# Check PostgreSQL is running
docker compose -f docker-compose.dev.yml ps postgres-dev

# Check database logs
docker compose -f docker-compose.dev.yml logs postgres-dev

# Reset database
docker compose -f docker-compose.dev.yml down -v
./scripts/docker/dev-docker.sh start
```

### Getting Help

**Check Service Status:**
```bash
./scripts/docker/dev-docker.sh status
```

**View All Logs:**
```bash
./scripts/docker/dev-docker.sh logs
```

**Reset Everything:**
```bash
./scripts/docker/dev-docker.sh clean
./scripts/docker/dev-docker.sh start
```

## 🎯 Next Steps

1. **Configure Environment**: Update `.env.dev` with your API keys
2. **Start Developing**: Run `./scripts/docker/dev-docker.sh start`
3. **Check Health**: Visit http://localhost:3000/api/health
4. **Explore Tools**: Check out Redis Commander and Mailhog
5. **Begin Coding**: Your changes will hot-reload automatically!

---

**Happy Coding! 🚀**

For more help, see the main [README.md](./README.md) or check the [docs/](./docs/) directory.