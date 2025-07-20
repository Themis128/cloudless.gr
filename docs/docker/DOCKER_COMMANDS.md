# 🐳 Docker Commands Quick Reference

## ❌ **Don't Use These (They Don't Work):**

```bash
docker compose stop          # ❌ Uses wrong compose file
docker compose restart       # ❌ Uses wrong compose file
docker compose up           # ❌ Uses wrong compose file
```

## ✅ **Use These Instead:**

### **Option 1: Use the Management Script (Recommended)**

```bash
# Development Environment
.\scripts\docker-manage.ps1 dev build    # Build and start
.\scripts\docker-manage.ps1 dev stop     # Stop containers
.\scripts\docker-manage.ps1 dev start    # Start containers
.\scripts\docker-manage.ps1 dev restart  # Restart containers
.\scripts\docker-manage.ps1 dev logs     # View logs
.\scripts\docker-manage.ps1 dev status   # Check status
.\scripts\docker-manage.ps1 dev down     # Stop and remove

# Production Environment
.\scripts\docker-manage.ps1 prod build   # Build and start
.\scripts\docker-manage.ps1 prod stop    # Stop containers
```

### **Option 2: Specify the Compose File**

```bash
# Development Environment
docker compose -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.dev.yml stop
docker compose -f docker-compose.dev.yml restart
docker compose -f docker-compose.dev.yml logs -f
docker compose -f docker-compose.dev.yml ps

# Production Environment
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml stop
```

### **Option 3: Use npm Scripts**

```bash
npm run dev:docker:build     # Build and start dev
npm run dev:docker:down      # Stop dev containers
npm run dev:docker:logs      # View dev logs
npm run dev:docker:restart   # Restart dev containers
```

## 🎯 **Why This Happens:**

The default `docker-compose.yml` file is a **generic template** that doesn't have the specific service configurations for your development environment. When you run `docker compose` without specifying a file, it tries to use this default file, which causes errors.

## 🚀 **Best Practice:**

**Always use the management script** for consistency:

```bash
.\scripts\docker-manage.ps1 dev build
```

This script:

- ✅ Uses the correct compose file automatically
- ✅ Provides helpful feedback
- ✅ Handles both dev and prod environments
- ✅ Shows clear error messages

## 🔧 **Available Commands:**

| Command       | Description                             |
| ------------- | --------------------------------------- |
| `dev build`   | Build and start development environment |
| `dev stop`    | Stop development containers             |
| `dev start`   | Start existing development containers   |
| `dev restart` | Restart development containers          |
| `dev logs`    | View development logs                   |
| `dev status`  | Check development container status      |
| `dev down`    | Stop and remove development containers  |
| `dev clean`   | Remove containers and volumes           |
| `prod build`  | Build and start production environment  |
| `help`        | Show help message                       |

## 🎉 **Your Environment is Ready!**

- **Main App**: http://192.168.0.23:3000
- **Redis Commander**: http://192.168.0.23:8081 (admin/admin)
- **Health Check**: http://192.168.0.23:3000/api/health
