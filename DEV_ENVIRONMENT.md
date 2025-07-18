# 🚀 Cloudless.gr Development Environment

Your development environment is now optimized for maximum productivity! Here's everything you need to know.

## 🎯 Quick Start

```bash
# Start the development environment
npm run dev:docker:build

# View logs
npm run dev:docker:logs

# Stop the environment
npm run dev:docker:down
```

## 🌐 Access Points

| Service             | URL                                 | Description                      |
| ------------------- | ----------------------------------- | -------------------------------- |
| **Main App**        | http://192.168.0.23:3000            | Your Nuxt.js application         |
| **Health Check**    | http://192.168.0.23:3000/api/health | Application health status        |
| **Redis Commander** | http://192.168.0.23:8081            | Redis management interface       |
| **PostgreSQL**      | 192.168.0.23:5432                   | Database (if enabled)            |
| **Adminer**         | http://192.168.0.23:8080            | Database management (if enabled) |
| **Mailhog**         | http://192.168.0.23:8025            | Email testing (if enabled)       |

## 🔧 Development Features

### ✅ Hot Reloading

- **File Changes**: Edit any file and see instant updates
- **Volume Mounts**: Local files are synced with container
- **Node Modules**: Preserved in container for performance

### 🐛 Debugging

- **VS Code**: Use "Debug Docker Container" configuration
- **Chrome DevTools**: Connect to `192.168.0.23:9229`
- **Node Inspector**: Full debugging capabilities

### 📊 Monitoring

- **Health Checks**: All services monitored automatically
- **Logs**: Real-time container logs
- **Redis**: Persistent data between restarts

## 🛠️ Available Commands

```bash
# Development
npm run dev:docker:build    # Build and start containers
npm run dev:docker:up       # Start existing containers
npm run dev:docker:down     # Stop all containers
npm run dev:docker:logs     # View application logs
npm run dev:docker:restart  # Restart application container

# Database (optional)
npm run dev:docker:db       # Start with PostgreSQL
npm run dev:docker:email    # Start with Mailhog

# Maintenance
npm run dev:docker:clean    # Remove containers and volumes
npm run dev:docker:rebuild  # Full rebuild from scratch
```

## 🔍 Debugging Guide

### VS Code Debugging

1. Open VS Code
2. Go to Run & Debug (Ctrl+Shift+D)
3. Select "Debug Docker Container"
4. Set breakpoints in your code
5. Start debugging!

### Chrome DevTools

1. Open Chrome DevTools (F12)
2. Click the green Node.js icon
3. Connect to `192.168.0.23:9229`
4. Debug your application

### Container Logs

```bash
# View all logs
docker logs cloudlessgr-app-dev

# Follow logs in real-time
docker logs -f cloudlessgr-app-dev

# View specific service logs
docker logs cloudlessgr-redis-dev
```

## 🗄️ Database Services

### Redis (Always Running)

- **Purpose**: Caching, sessions, rate limiting
- **Data**: Persistent between restarts
- **Management**: http://192.168.0.23:8081
- **Credentials**: admin / admin

### PostgreSQL (Optional)

```bash
# Enable PostgreSQL
npm run dev:docker:db

# Access via Adminer
# URL: http://192.168.0.23:8080
# Server: postgres-dev
# Username: cloudless
# Password: development
# Database: cloudless_dev
```

## 📧 Email Testing (Optional)

```bash
# Enable Mailhog for email testing
npm run dev:docker:email

# Access Mailhog UI
# URL: http://192.168.0.23:8025
```

## 🔧 Environment Variables

Key environment variables for development:

```bash
NODE_ENV=development          # Development mode
NITRO_DEBUG=1                 # Enable Nitro debugging
DEBUG=*                       # Enable all debug logs
TZ=Europe/Athens             # Consistent timezone
CHOKIDAR_USEPOLLING=true     # File watching in Docker
WATCHPACK_POLLING=true       # Webpack file watching
```

## 🚨 Troubleshooting

### Container Won't Start

```bash
# Check container status
docker ps -a

# View detailed logs
docker logs cloudlessgr-app-dev

# Rebuild from scratch
npm run dev:docker:rebuild
```

### Hot Reload Not Working

```bash
# Check volume mounts
docker inspect cloudlessgr-app-dev

# Restart the container
npm run dev:docker:restart
```

### Debugger Not Connecting

1. Ensure port 9229 is not blocked
2. Check firewall settings
3. Verify VS Code configuration
4. Try Chrome DevTools instead

### Permission Issues

```bash
# Fix file permissions
sudo chown -R $USER:$USER .

# Rebuild container
npm run dev:docker:rebuild
```

## 📈 Performance Tips

1. **Use Volume Mounts**: Local development with container performance
2. **Preserve node_modules**: Avoid overwriting with host files
3. **Cache Volumes**: npm and Nuxt caches are persisted
4. **Health Checks**: Faster container startup detection
5. **Resource Limits**: Redis limited to 128MB for development

## 🔄 Continuous Development

Your environment is designed for continuous development:

- **Auto-restart**: Containers restart on failure
- **Health monitoring**: Services are checked every 10s
- **Persistent data**: Redis and database data survives restarts
- **Hot reloading**: Instant feedback on code changes
- **Debugging ready**: Full debugging capabilities out of the box

## 🎉 You're All Set!

Your development environment is now:

- ✅ **Optimized** for maximum productivity
- ✅ **Debuggable** with full IDE integration
- ✅ **Persistent** with data survival
- ✅ **Network accessible** from any device
- ✅ **Production-like** with proper health checks

Happy coding! 🚀
