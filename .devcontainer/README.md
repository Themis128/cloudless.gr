# Cloudless.gr Dev Container

This Dev Container configuration provides a complete development environment for the Cloudless.gr project in Cursor.

## 🚀 Quick Start

1. **Open in Cursor**: Open the project folder in Cursor
2. **Reopen in Container**: When prompted, click "Reopen in Container"
3. **Wait for Setup**: The container will build and install dependencies
4. **Start Development**: Your app will be available at http://localhost:3000

## 🛠️ What's Included

### **Development Environment**
- **Node.js 20** with all necessary build tools
- **TypeScript** support with IntelliSense
- **Vue.js** and **Nuxt.js** extensions
- **ESLint** and **Prettier** for code quality
- **Docker** integration

### **Services**
- **Nuxt.js App** (port 3000) - Main application
- **Redis** (port 6379) - Cache and session storage
- **Redis Commander** (port 8081) - Redis management UI
- **PostgreSQL** (port 5432) - Database (optional)

### **VS Code Extensions**
- TypeScript and JavaScript support
- Vue.js language support
- Tailwind CSS IntelliSense
- ESLint and Prettier
- Docker integration
- Path Intellisense
- Auto Rename Tag

## 🔧 Configuration

### **Port Forwarding**
- `3000` - Nuxt.js application
- `9229` - Node.js debugger
- `24678` - Vite HMR (Hot Module Replacement)
- `8081` - Redis Commander
- `6379` - Redis
- `5432` - PostgreSQL

### **Environment Variables**
The container automatically loads environment variables from your `.env` file:
- Supabase configuration
- API keys (OpenAI, Anthropic)
- Database and Redis URLs
- Security secrets

## 🐛 Troubleshooting

### **Container Build Issues**
```bash
# Rebuild the container
# In Cursor: Command Palette > Dev Containers: Rebuild Container
```

### **Port Conflicts**
If ports are already in use:
1. Stop other Docker containers: `docker stop $(docker ps -q)`
2. Or change ports in `.devcontainer/docker-compose.yml`

### **Extension Issues**
If extensions fail to install:
1. Check the extension compatibility
2. Rebuild the container
3. Install extensions manually in the container

### **Performance Issues**
- The container uses volume mounts for better performance
- Node modules are cached in a Docker volume
- File watching is optimized for Docker environments

## 🔄 Development Workflow

1. **Start Development**:
   ```bash
   npm run dev
   ```

2. **Access Services**:
   - App: http://localhost:3000
   - Redis Commander: http://localhost:8081 (admin/admin)

3. **Debug**:
   - Use the integrated debugger on port 9229
   - Set breakpoints in TypeScript/Vue files

4. **Database** (optional):
   ```bash
   # Start PostgreSQL
   docker-compose --profile database up postgres-dev
   ```

## 📁 File Structure

```
.devcontainer/
├── devcontainer.json    # Dev Container configuration
├── docker-compose.yml   # Services configuration
└── README.md           # This file
```

## 🎯 Benefits

- **Consistent Environment**: Same setup across all developers
- **Isolation**: No conflicts with local system dependencies
- **Performance**: Optimized for Docker with volume mounts
- **Debugging**: Full debugging support with source maps
- **Hot Reload**: Fast development with Vite HMR

## 🔗 Related Files

- `Dockerfile.dev` - Development Docker image
- `docker-compose.dev.yml` - Local development services
- `.env` - Environment variables
- `package.json` - Node.js dependencies

## 🆘 Support

If you encounter issues:
1. Check the Cursor Dev Container documentation
2. Verify Docker is running
3. Check port availability
4. Rebuild the container if needed 