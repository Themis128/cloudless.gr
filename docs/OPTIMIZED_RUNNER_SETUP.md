# 🚀 Optimized Self-Hosted GitHub Actions Runner Setup

This guide covers the optimized setup and configuration of the self-hosted GitHub Actions runner for the Cloudless.gr project.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Setup](#quick-setup)
- [Advanced Configuration](#advanced-configuration)
- [Performance Optimizations](#performance-optimizations)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The optimized self-hosted runner provides:

- ✅ **No Billing Limits** - Runs on your local machine
- ✅ **Enhanced Performance** - Optimized caching and resource management
- ✅ **Better Reliability** - Improved error handling and health checks
- ✅ **Resource Efficiency** - Smart cache management and cleanup
- ✅ **Easy Monitoring** - Built-in monitoring and metrics

## 🔧 Prerequisites

### Required Software

1. **Docker Desktop** (Windows)
   - Version 20.10 or higher
   - WSL 2 backend enabled
   - At least 4GB RAM allocated

2. **PowerShell 7+**
   - Windows PowerShell 7 or higher
   - Execution policy set to allow scripts

3. **GitHub Token**
   - Personal Access Token with `actions` permission
   - Repository access to `Themis128/cloudless.gr`

### System Requirements

- **CPU**: 2+ cores recommended
- **RAM**: 4GB+ available for Docker
- **Storage**: 10GB+ free space for cache
- **Network**: Stable internet connection

## 🚀 Quick Setup

### 1. Set GitHub Token

```powershell
$env:GITHUB_TOKEN = "your-github-token-here"
```

### 2. Run Optimized Setup

```powershell
.\scripts\setup-runner-optimized.ps1
```

### 3. Verify Installation

```powershell
.\scripts\monitor-runner.ps1 -Action status
```

## ⚙️ Advanced Configuration

### Docker Compose Configuration

The optimized runner uses `docker-compose.runner.optimized.yml` with:

```yaml
# Key optimizations
environment:
  - NODE_OPTIONS=--max-old-space-size=4096
  - NPM_CONFIG_CACHE=/cache/npm
  - DOCKER_BUILDKIT=1
  - BUILDKIT_INLINE_CACHE=1

# Resource limits
deploy:
  resources:
    limits:
      memory: 4G
      cpus: '2.0'
    reservations:
      memory: 1G
      cpus: '0.5'

# Performance optimizations
tmpfs:
  - /tmp:size=1G
  - /var/tmp:size=1G
```

### Cache Structure

```
runner-cache/
├── npm/          # NPM package cache
├── docker/       # Docker layer cache
├── nuxt/         # Nuxt.js build cache
├── playwright/   # Playwright browser cache
└── build/        # Build artifacts cache
```

## ⚡ Performance Optimizations

### 1. Cache Management

**Check cache status:**
```powershell
.\scripts\manage-runner-cache.ps1 -Action status
```

**Clean old cache:**
```powershell
.\scripts\manage-runner-cache.ps1 -Action clean -DaysToKeep 7
```

**Optimize cache:**
```powershell
.\scripts\manage-runner-cache.ps1 -Action optimize
```

### 2. Resource Optimization

**Memory Management:**
- Node.js heap size: 4GB
- Docker memory limit: 4GB
- Temporary filesystems: 1GB each

**CPU Optimization:**
- Docker CPU limit: 2 cores
- BuildKit parallel builds enabled
- NPM offline mode enabled

### 3. Network Optimization

**Docker BuildKit:**
- Inline cache enabled
- Parallel layer builds
- Optimized registry access

**NPM Configuration:**
- Offline mode preferred
- Cache verification enabled
- Reduced logging level

## 📊 Monitoring and Maintenance

### Health Monitoring

**Quick health check:**
```powershell
.\scripts\monitor-runner.ps1 -Action health
```

**Performance metrics:**
```powershell
.\scripts\monitor-runner.ps1 -Action performance
```

**Real-time monitoring:**
```powershell
.\scripts\monitor-runner.ps1 -Action watch
```

### Log Management

**View recent logs:**
```powershell
.\scripts\monitor-runner.ps1 -Action logs
```

**Log rotation:**
- Automatic log rotation (20MB max, 5 files)
- Compressed log storage
- Structured JSON logging

### Cache Maintenance

**Automatic cleanup:**
- Old files removed after 7 days
- Empty directories cleaned
- Large files compressed

**Manual maintenance:**
```powershell
# Backup cache
.\scripts\manage-runner-cache.ps1 -Action backup

# Restore cache
.\scripts\manage-runner-cache.ps1 -Action restore

# Full optimization
.\scripts\manage-runner-cache.ps1 -Action optimize
```

## 🔧 Management Commands

### Runner Control

```powershell
# Start runner
docker-compose -f docker-compose.runner.optimized.yml up -d

# Stop runner
docker-compose -f docker-compose.runner.optimized.yml down

# Restart runner
docker-compose -f docker-compose.runner.optimized.yml restart

# View logs
docker logs -f cloudless-github-runner-optimized
```

### Health Checks

```powershell
# Container status
docker ps --filter name=cloudless-github-runner

# Health endpoint
curl http://localhost:8080/health

# Resource usage
docker stats cloudless-github-runner-optimized
```

### Cache Management

```powershell
# Cache status
.\scripts\manage-runner-cache.ps1 status

# Clean cache
.\scripts\manage-runner-cache.ps1 clean -Force

# Optimize cache
.\scripts\manage-runner-cache.ps1 optimize
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Runner Not Starting

**Symptoms:**
- Container fails to start
- Health check fails
- Port 8080 not accessible

**Solutions:**
```powershell
# Check Docker status
docker version

# Check port availability
netstat -an | findstr :8080

# Restart Docker Desktop
# Re-run setup script
.\scripts\setup-runner-optimized.ps1 -ForceReinstall
```

#### 2. High Resource Usage

**Symptoms:**
- High CPU/memory usage
- Slow build times
- System unresponsive

**Solutions:**
```powershell
# Check resource usage
.\scripts\monitor-runner.ps1 performance

# Clean cache
.\scripts\manage-runner-cache.ps1 clean

# Restart runner
docker-compose -f docker-compose.runner.optimized.yml restart
```

#### 3. Cache Issues

**Symptoms:**
- Build failures
- Slow dependency installation
- Disk space issues

**Solutions:**
```powershell
# Check cache status
.\scripts\manage-runner-cache.ps1 status

# Optimize cache
.\scripts\manage-runner-cache.ps1 optimize

# Clear cache (if needed)
Remove-Item -Recurse -Force .\runner-cache\*
```

#### 4. Network Issues

**Symptoms:**
- GitHub API failures
- Docker pull failures
- Timeout errors

**Solutions:**
```powershell
# Test network connectivity
Test-NetConnection github.com -Port 443

# Check DNS
nslookup github.com

# Restart network services
# Check firewall settings
```

### Debug Mode

Enable debug logging:

```powershell
# Set debug environment
$env:ACTIONS_STEP_DEBUG = "true"
$env:ACTIONS_RUNNER_DEBUG = "true"

# Restart runner
docker-compose -f docker-compose.runner.optimized.yml restart

# View debug logs
docker logs -f cloudless-github-runner-optimized
```

### Performance Tuning

#### For High-Performance Systems

```powershell
# Increase resource limits
.\scripts\setup-runner-optimized.ps1 -MemoryLimit 8 -CpuLimit 4

# Optimize cache settings
.\scripts\manage-runner-cache.ps1 optimize
```

#### For Limited Resources

```powershell
# Reduce resource limits
.\scripts\setup-runner-optimized.ps1 -MemoryLimit 2 -CpuLimit 1

# Enable aggressive cache cleanup
.\scripts\manage-runner-cache.ps1 clean -DaysToKeep 3
```

## 📈 Performance Benchmarks

### Expected Performance

- **Build Time**: 30-50% faster than GitHub-hosted runners
- **Cache Hit Rate**: 80-90% for subsequent builds
- **Resource Usage**: 2-4GB RAM, 1-2 CPU cores
- **Startup Time**: 10-30 seconds

### Monitoring Metrics

Key metrics to monitor:

- **Health Score**: Should be 100%
- **Cache Hit Rate**: Target 80%+
- **Build Time**: Monitor for regressions
- **Resource Usage**: Stay within limits

## 🔄 Updates and Maintenance

### Regular Maintenance

**Daily:**
- Check runner health
- Monitor resource usage

**Weekly:**
- Clean old cache files
- Update runner if needed
- Review logs for issues

**Monthly:**
- Full cache optimization
- Performance review
- Update documentation

### Updating the Runner

```powershell
# Stop current runner
docker-compose -f docker-compose.runner.optimized.yml down

# Update configuration
git pull origin main

# Restart with new configuration
.\scripts\setup-runner-optimized.ps1 -ForceReinstall
```

## 📞 Support

For issues and questions:

1. Check this documentation
2. Review troubleshooting section
3. Check GitHub Actions logs
4. Monitor runner health
5. Contact development team

## 🎯 Best Practices

1. **Regular Monitoring**: Use monitoring scripts daily
2. **Cache Management**: Clean cache weekly
3. **Resource Limits**: Stay within allocated resources
4. **Health Checks**: Monitor health score regularly
5. **Backup Strategy**: Backup cache before major changes
6. **Documentation**: Keep configuration documented
7. **Testing**: Test changes in staging first

---

**Last Updated**: $(Get-Date -Format "yyyy-MM-dd")
**Version**: 1.0.0
**Maintainer**: Development Team 