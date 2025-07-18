# 🚀 Development Environment Setup

This guide covers the enhanced development environment for the Cloudless LLM Dev Agent project.

## 📋 Prerequisites

- Docker Desktop (Windows/Mac/Linux)
- PowerShell 5.1+ (Windows)
- VS Code (recommended)

## 🛠️ Quick Start

### 1. Start Basic Development Environment

```powershell
.\scripts\dev-docker.ps1 start
```

### 2. Start with Database Support

```powershell
.\scripts\dev-docker.ps1 start database
```

### 3. Start with Email Testing

```powershell
.\scripts\dev-docker.ps1 start email
```

## 🎯 Available Commands

| Command   | Description                              |
| --------- | ---------------------------------------- |
| `start`   | Start development environment            |
| `stop`    | Stop development environment             |
| `restart` | Restart development environment          |
| `logs`    | View container logs                      |
| `shell`   | Enter container shell                    |
| `build`   | Rebuild development image                |
| `clean`   | Clean up containers and images           |
| `status`  | Show container status and resource usage |
| `debug`   | Start with debugging enabled             |
| `test`    | Run tests in container                   |
| `lint`    | Run linting in container                 |
| `format`  | Format code in container                 |
| `db`      | Start with database services             |
| `email`   | Start with email testing                 |
| `tools`   | Show available development tools         |

## 🔧 Development Tools

### Application Access

- **Main App**: http://localhost:3000
- **Node.js Debugger**: localhost:9229
- **Redis Commander**: http://localhost:8081
- **Adminer (Database)**: http://localhost:8080
- **Mailhog (Email)**: http://localhost:8025

### VS Code Integration

#### Debugging Setup

1. Open VS Code
2. Go to Run and Debug (Ctrl+Shift+D)
3. Select "Debug Nuxt App (Docker)"
4. Set breakpoints in your code
5. Start debugging

#### Launch Configuration

The `.vscode/launch.json` file includes:

- **Debug Nuxt App (Docker)**: Attach to running container
- **Debug Nuxt App (Local)**: Run locally for comparison

## 🗄️ Database Development

### PostgreSQL (Optional)

```powershell
.\scripts\dev-docker.ps1 start database
```

**Connection Details:**

- Host: localhost
- Port: 5432
- Database: cloudless_dev
- Username: cloudless
- Password: development

### Redis (Always Available)

- Host: localhost
- Port: 6379
- No authentication required (dev only)

## 📧 Email Testing

### Mailhog Setup

```powershell
.\scripts\dev-docker.ps1 start email
```

**Features:**

- SMTP Server: localhost:1025
- Web UI: http://localhost:8025
- Captures all outgoing emails
- No emails sent to real addresses

## 🐛 Debugging

### Node.js Debugging

1. Start with debug mode:

   ```powershell
   .\scripts\dev-docker.ps1 debug
   ```

2. Attach VS Code debugger to localhost:9229

3. Set breakpoints and debug your application

### Container Debugging

```powershell
# Enter container shell
.\scripts\dev-docker.ps1 shell

# View logs
.\scripts\dev-docker.ps1 logs

# Check status
.\scripts\dev-docker.ps1 status
```

## 🧪 Testing & Quality

### Run Tests

```powershell
.\scripts\dev-docker.ps1 test
```

### Code Linting

```powershell
.\scripts\dev-docker.ps1 lint
```

### Code Formatting

```powershell
.\scripts\dev-docker.ps1 format
```

## 📁 Project Structure

```
cloudless.gr/
├── scripts/
│   └── dev-docker.ps1          # Development script
├── docker-compose.dev.yml      # Development services
├── Dockerfile.dev              # Development container
├── .vscode/
│   └── launch.json             # VS Code debugging
├── logs/                       # Application logs
├── tmp/                        # Temporary files
└── uploads/                    # File uploads
```

## 🔄 Hot Reloading

The development environment includes:

- **File Watching**: Automatic reload on file changes
- **Volume Mounting**: Source code mounted for live updates
- **Node Modules**: Cached in container for performance

## 🚨 Troubleshooting

### Common Issues

1. **Port Already in Use**

   ```powershell
   # Stop all containers
   .\scripts\dev-docker.ps1 stop

   # Clean up
   .\scripts\dev-docker.ps1 clean
   ```

2. **Container Won't Start**

   ```powershell
   # Rebuild image
   .\scripts\dev-docker.ps1 build

   # Check logs
   .\scripts\dev-docker.ps1 logs
   ```

3. **Permission Issues**
   ```powershell
   # Run PowerShell as Administrator
   # Or check Docker Desktop permissions
   ```

### Reset Development Environment

```powershell
# Complete cleanup
.\scripts\dev-docker.ps1 clean
docker system prune -a -f
```

## 📊 Monitoring

### Container Status

```powershell
.\scripts\dev-docker.ps1 status
```

### Resource Usage

The status command shows:

- Container status
- CPU usage
- Memory usage
- Network I/O
- Disk I/O

## 🔐 Environment Variables

Create a `.env` file in the project root:

```env
# Supabase Configuration
NUXT_PUBLIC_SUPABASE_URL=your_supabase_url
NUXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Development Settings
NODE_ENV=development
DEBUG=*
```

## 🎉 Next Steps

1. **Start Development**: `.\scripts\dev-docker.ps1 start`
2. **Open VS Code**: Configure debugging
3. **Begin Coding**: Make changes and see live updates
4. **Test Features**: Use the provided tools and services

Happy coding! 🚀
