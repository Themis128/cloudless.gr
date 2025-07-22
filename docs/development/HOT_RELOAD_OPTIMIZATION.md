# Ultra-Optimized Hot Reload Development Guide

## 🚀 Overview

This guide covers the ultra-optimized hot reload configuration for the fastest possible development experience in the Cloudless project.

## ⚡ Key Optimizations

### 1. File Watching Configuration

- **Chokidar Interval**: 100ms (ultra-fast file detection)
- **Watchpack Timeout**: 100ms (minimal aggregation delay)
- **Polling**: Enabled for Docker compatibility
- **Ignored Files**: Comprehensive exclusion of non-essential files

### 2. Vite HMR (Hot Module Replacement)

- **Dedicated HMR Port**: 24678
- **Overlay Disabled**: Cleaner development experience
- **Optimized Dependencies**: Pre-bundled for faster reloads

### 3. Nuxt Development Server

- **Host Binding**: 0.0.0.0 for external access
- **Port**: 3000 (configurable via environment)
- **External IP**: 192.168.0.23:3000

## 🔧 Environment Variables

### Core Development Variables

```bash
# Server Configuration
NODE_ENV=development
NITRO_HOST=0.0.0.0
NITRO_PORT=3000
NUXT_HOST=0.0.0.0
NUXT_PORT=3000
HOST=0.0.0.0

# Ultra-Fast File Watching
CHOKIDAR_USEPOLLING=true
CHOKIDAR_INTERVAL=100
CHOKIDAR_IGNORED="**/node_modules/**,**/.git/**,**/.nuxt/**,**/.output/**,**/dist/**,**/coverage/**,**/tmp/**,**/logs/**,**/*.log"
WATCHPACK_POLLING=true
WATCHPACK_AGGREGATE_TIMEOUT=100
WATCHPACK_POLL=1000

# Vite HMR Configuration
VITE_HMR_PORT=24678
VITE_HMR_HOST=0.0.0.0
VITE_HMR_OVERLAY=false

# Performance Optimizations
NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size --enable-source-maps --inspect=0.0.0.0:9229"
```

## 🐳 Docker Development

### Quick Start Commands

```bash
# Start ultra-optimized development environment
npm run dev:docker:ultra

# View live logs
npm run dev:docker:ultra:logs

# Restart app container
npm run dev:docker:ultra:restart
```

### Manual Docker Commands

```bash
# From project root
cd scripts/docker
docker-compose -f docker-compose.dev.yml --env-file ../../.env up --build -d app-dev redis-dev

# View logs
docker-compose -f docker-compose.dev.yml logs -f app-dev

# Access container shell
docker-compose -f docker-compose.dev.yml exec app-dev sh
```

### Port Mappings

- **Application**: 192.168.0.23:3000
- **Debugger**: 192.168.0.23:9229
- **HMR**: 192.168.0.23:24678
- **PostgreSQL**: 192.168.0.23:5432
- **Redis Commander**: 192.168.0.23:8081
- **Adminer**: 192.168.0.23:8080

## 📁 File Watching Optimization

### Ignored Patterns

The following patterns are ignored for optimal performance:

```
**/node_modules/**
**/.git/**
**/.nuxt/**
**/.output/**
**/dist/**
**/coverage/**
**/.nyc_output/**
**/tmp/**
**/logs/**
**/*.log
**/package-lock.json
**/yarn.lock
**/pnpm-lock.yaml
```

### Watched Directories

- `pages/` - Route components
- `components/` - Vue components
- `composables/` - Composables
- `stores/` - Pinia stores
- `server/` - API routes
- `assets/` - Static assets
- `layouts/` - Layout components

## ⚡ Performance Tips

### 1. Use Ultra-Fast Mode

```bash
# For maximum speed (50ms intervals)
npm run dev:ultra
```

### 2. Optimize Your Editor

- **VS Code**: Enable "Auto Save" with 100ms delay
- **WebStorm**: Enable "Save files on focus change"
- **Vim/Neovim**: Use `autocmd BufWritePost` for auto-save

### 3. File Organization

- Keep frequently changed files in watched directories
- Move large static files to `public/` directory
- Use `.gitignore` patterns for temporary files

### 4. Component Optimization

- Use `<script setup>` for faster compilation
- Minimize dependencies in frequently changed components
- Use dynamic imports for heavy components

## 🔍 Debugging Hot Reload

### Check HMR Status

1. Open browser developer tools
2. Look for HMR connection in console
3. Verify WebSocket connection to port 24678

### Common Issues

#### HMR Not Working

```bash
# Check if HMR port is accessible
curl http://192.168.0.23:24678

# Restart development server
npm run dev:docker:ultra:restart
```

#### Slow File Detection

```bash
# Check file watching logs
docker-compose -f scripts/docker/docker-compose.dev.yml logs app-dev | grep -i watch

# Verify ignored patterns
echo $CHOKIDAR_IGNORED
```

#### Memory Issues

```bash
# Check container memory usage
docker stats cloudlessgr-app-dev

# Increase memory limit if needed
# Edit docker-compose.dev.yml memory limits
```

## 📊 Performance Metrics

### Expected Performance

- **File Change Detection**: < 100ms
- **HMR Update**: < 500ms
- **Full Page Reload**: < 2s
- **Initial Build**: < 30s

### Monitoring

```bash
# Monitor container performance
docker stats cloudlessgr-app-dev cloudlessgr-redis-dev

# Check file watching activity
docker-compose -f scripts/docker/docker-compose.dev.yml exec app-dev ps aux | grep node
```

## 🛠️ Troubleshooting

### Reset Development Environment

```bash
# Clean all containers and volumes
docker-compose -f scripts/docker/docker-compose.dev.yml down -v
docker system prune -f

# Rebuild from scratch
npm run dev:docker:ultra
```

### Clear Caches

```bash
# Clear Nuxt cache
docker-compose -f scripts/docker/docker-compose.dev.yml exec app-dev rm -rf .nuxt

# Clear Vite cache
docker-compose -f scripts/docker/docker-compose.dev.yml exec app-dev rm -rf .vite

# Clear npm cache
docker-compose -f scripts/docker/docker-compose.dev.yml exec app-dev npm cache clean --force
```

### Network Issues

```bash
# Check network connectivity
docker network ls
docker network inspect cloudlessgr_cloudless-dev-network

# Restart network
docker-compose -f scripts/docker/docker-compose.dev.yml down
docker-compose -f scripts/docker/docker-compose.dev.yml up -d
```

## 🎯 Best Practices

1. **Use TypeScript**: Faster type checking in development
2. **Component Composition**: Break down large components
3. **Lazy Loading**: Use dynamic imports for routes
4. **Asset Optimization**: Compress images and use modern formats
5. **Code Splitting**: Use route-based code splitting

## 📚 Additional Resources

- [Nuxt 3 Development Guide](https://nuxt.com/docs/guide/concepts/development)
- [Vite HMR Documentation](https://vitejs.dev/guide/api-hmr.html)
- [Chokidar File Watching](https://github.com/paulmillr/chokidar)
- [Docker Development Best Practices](https://docs.docker.com/develop/dev-best-practices/) 