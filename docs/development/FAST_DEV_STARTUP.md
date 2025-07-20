# ⚡ Fast Development Startup Guide

## 🚀 Quick Start Commands

### First Time Setup (Full Build)

```powershell
# Full build and start (takes 2-3 minutes)
.\scripts\dev-docker.ps1 -Build
```

### Subsequent Starts (Fast Mode)

```powershell
# Fast start using existing image (takes 10-20 seconds)
.\scripts\dev-docker.ps1 -Fast
```

### With Additional Services

```powershell
# Fast start with database
.\scripts\dev-docker.ps1 -Fast -Database

# Fast start with email testing
.\scripts\dev-docker.ps1 -Fast -Email
```

## 📊 Performance Comparison

| Command                           | Build Time | Startup Time | Total Time |
| --------------------------------- | ---------- | ------------ | ---------- |
| `.\scripts\dev-docker.ps1 -Build` | 2-3 min    | 15-20 sec    | 2-3 min    |
| `.\scripts\dev-docker.ps1 -Fast`  | 0 sec      | 10-20 sec    | 10-20 sec  |
| `.\scripts\dev-docker.ps1`        | 2-3 min    | 15-20 sec    | 2-3 min    |

## 🔧 Build Optimization Tips

### 1. **Use Fast Mode for Daily Development**

```powershell
# After initial build, always use fast mode
.\scripts\dev-docker.ps1 -Fast
```

### 2. **Rebuild Only When Needed**

```powershell
# Rebuild when you change dependencies
.\scripts\dev-docker.ps1 -Build

# Rebuild when you change Dockerfile
.\scripts\dev-docker.ps1 -Clean -Build
```

### 3. **Monitor Build Progress**

```powershell
# View build logs
.\scripts\dev-docker.ps1 -Logs

# Check container status
docker ps
```

## 🐳 Docker Build Optimizations

### BuildKit Features

- **Parallel builds** for faster compilation
- **Cache mounts** for npm dependencies
- **Layer caching** to avoid rebuilding unchanged layers

### Volume Optimizations

- **Cached mounts** for better performance
- **Excluded directories** from mounting
- **Named cache volumes** for persistent caching

### Resource Limits

- **Memory limits** to prevent OOM issues
- **CPU limits** for better performance
- **Health checks** with optimized intervals

## 🚨 Troubleshooting

### Slow Builds

```powershell
# Clean everything and rebuild
.\scripts\dev-docker.ps1 -Clean
.\scripts\dev-docker.ps1 -Build
```

### Build Failures

```powershell
# Check Docker logs
docker logs cloudlessgr-app-dev

# Restart Docker Desktop
# Then try again
.\scripts\dev-docker.ps1 -Build
```

### Memory Issues

```powershell
# Check resource usage
docker stats

# Increase Docker Desktop memory limit
# Restart Docker Desktop
```

## 📈 Performance Monitoring

### Check Build Cache

```bash
# View build cache usage
docker builder du

# Prune build cache if needed
docker builder prune
```

### Monitor Container Performance

```bash
# Real-time container stats
docker stats

# Check container logs
docker logs -f cloudlessgr-app-dev
```

## 🎯 Best Practices

1. **Always use `-Fast` for daily development**
2. **Only rebuild when dependencies change**
3. **Keep Docker Desktop running**
4. **Monitor resource usage**
5. **Clean up regularly**

## 🔄 Development Workflow

### Daily Development

```powershell
# Start development environment
.\scripts\dev-docker.ps1 -Fast

# Make code changes (hot reload works)
# View logs if needed
.\scripts\dev-docker.ps1 -Logs

# Stop when done
.\scripts\dev-docker.ps1 -Stop
```

### When Dependencies Change

```powershell
# Rebuild with new dependencies
.\scripts\dev-docker.ps1 -Build
```

### When Dockerfile Changes

```powershell
# Clean and rebuild
.\scripts\dev-docker.ps1 -Clean -Build
```

## 📞 Quick Reference

| Command                           | Purpose           | Speed   |
| --------------------------------- | ----------------- | ------- |
| `.\scripts\dev-docker.ps1 -Fast`  | Daily development | ⚡ Fast |
| `.\scripts\dev-docker.ps1 -Build` | Full rebuild      | 🐌 Slow |
| `.\scripts\dev-docker.ps1 -Logs`  | View logs         | ⚡ Fast |
| `.\scripts\dev-docker.ps1 -Stop`  | Stop containers   | ⚡ Fast |
| `.\scripts\dev-docker.ps1 -Clean` | Clean everything  | 🐌 Slow |

---

**Pro Tip**: After the initial build, always use `-Fast` for the fastest development experience! 🚀
