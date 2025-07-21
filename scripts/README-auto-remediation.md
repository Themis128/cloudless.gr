# Auto-Remediation System

This system automatically fixes common issues detected by the monitoring dashboard, providing intelligent remediation for your self-hosted runner.

## 🚨 Issues Automatically Fixed

### Critical Issues (Auto-Remediated)
- **High CPU Usage** (>80%) - Kills runaway processes, restarts Docker
- **High Memory Usage** (>80%) - Cleans Docker images, restarts runner services
- **High Disk Usage** (>80%) - Cleans Docker cache, volumes, npm cache, temp files
- **Docker Service Stopped** - Starts and enables Docker service
- **Runner Service Stopped** - Starts GitHub Actions runner
- **Network Connectivity Issues** - Flushes DNS, resets network adapters

### Warning Issues (Remediated with --Force)
- **Elevated CPU Usage** (>60%) - Process monitoring and cleanup
- **Memory Usage Above 70%** - Memory optimization
- **Disk Usage Elevated** (>60%) - Cache cleanup
- **Docker Cache Needs Cleanup** - Docker system pruning
- **High System Temperature** - Load reduction

## 📁 Files

- `auto-remediation.ps1` - PowerShell remediation script (Windows)
- `auto-remediation.sh` - Bash remediation script (Linux/macOS)
- `auto-remediation-launcher.ps1` - Smart launcher that monitors logs and triggers remediation

## 🚀 Quick Start

### Windows (PowerShell)

```powershell
# Check current system health and remediate if needed
.\scripts\auto-remediation.ps1

# Dry run (see what would be fixed without making changes)
.\scripts\auto-remediation.ps1 -DryRun

# Force mode (aggressive remediation including warnings)
.\scripts\auto-remediation.ps1 -Force

# Monitor dashboard logs and auto-remediate
.\scripts\auto-remediation-launcher.ps1 -Continuous -Interval 30
```

### Linux/macOS (Bash)

```bash
# Make script executable
chmod +x scripts/auto-remediation.sh

# Check current system health and remediate if needed
./scripts/auto-remediation.sh

# Dry run (see what would be fixed without making changes)
./scripts/auto-remediation.sh --dry-run

# Force mode (aggressive remediation including warnings)
./scripts/auto-remediation.sh --force

# Monitor dashboard logs and auto-remediate
./scripts/auto-remediation-launcher.ps1 -Continuous -Interval 30
```

## 🔧 Manual Remediation Commands

### High CPU Usage
```bash
# Check top processes
top -bn1 | head -10

# Kill high CPU processes (Linux)
pkill -f process_name

# Restart Docker
sudo systemctl restart docker
```

### High Memory Usage
```bash
# Check memory usage
free -h

# Clean Docker images
docker image prune -a -f

# Restart runner service
sudo systemctl restart actions.runner.*
```

### High Disk Usage
```bash
# Check disk usage
df -h

# Clean Docker system
docker system prune -f

# Clean Docker volumes
docker volume prune -f

# Clean npm cache
npm cache clean --force

# Clean old logs (Linux)
sudo journalctl --vacuum-time=7d
```

### Docker Issues
```bash
# Start Docker service
sudo systemctl start docker

# Enable Docker auto-start
sudo systemctl enable docker

# Clean all Docker resources
docker system prune -a -f
```

### Network Issues
```bash
# Test connectivity
ping -c 3 8.8.8.8
ping -c 3 github.com

# Flush DNS cache (Linux)
sudo systemd-resolve --flush-caches

# Flush DNS cache (Windows)
ipconfig /flushdns
```

## 🤖 Smart Launcher Features

The `auto-remediation-launcher.ps1` provides intelligent monitoring:

### Automatic Detection
- **Parses dashboard logs** for ERROR and WARNING entries
- **Identifies critical issues** requiring immediate action
- **Monitors continuously** for new issues
- **Smart filtering** to avoid false positives

### Usage Examples

```powershell
# Single check of current issues
.\scripts\auto-remediation-launcher.ps1

# Continuous monitoring (check every 30 seconds)
.\scripts\auto-remediation-launcher.ps1 -Continuous -Interval 30

# Force mode (remediate warnings too)
.\scripts\auto-remediation-launcher.ps1 -Force -Continuous

# Dry run mode (see what would be fixed)
.\scripts\auto-remediation-launcher.ps1 -DryRun -Continuous

# Monitor specific log file
.\scripts\auto-remediation-launcher.ps1 -LogFile "path/to/logs.txt"
```

## ⚙️ Configuration Options

### PowerShell Script Parameters
- `-DryRun` - Show what would be fixed without making changes
- `-Force` - Aggressive remediation including warnings
- `-MaxRetries` - Number of retry attempts (default: 3)

### Launcher Parameters
- `-DryRun` - Dry run mode
- `-Force` - Force mode for warnings
- `-Continuous` - Continuous monitoring mode
- `-Interval` - Check interval in seconds (default: 30)
- `-LogFile` - Path to log file (default: monitor-runner-web.html)

## 🔒 Security Considerations

### Admin Privileges Required
Some operations require elevated privileges:
- **Service management** (start/stop/restart)
- **Network configuration** (DNS flush, adapter reset)
- **System cleanup** (temp files, logs)

### Safe Mode
- **Dry run mode** shows what would be fixed without making changes
- **Non-destructive operations** by default
- **Force mode** required for aggressive cleanup

## 📊 Monitoring Integration

### Dashboard Integration
The auto-remediation system integrates with the monitoring dashboard:

1. **Dashboard detects issues** and logs them with solutions
2. **Launcher monitors logs** for new ERROR/WARNING entries
3. **Automatic remediation** triggered for critical issues
4. **Post-remediation health check** confirms fixes

### Log Parsing
The launcher intelligently parses dashboard logs:
- **Extracts timestamps** for issue tracking
- **Identifies issue types** (ERROR vs WARNING)
- **Matches solution patterns** for appropriate remediation
- **Tracks issue history** to avoid duplicate remediation

## 🚨 Emergency Procedures

### If Auto-Remediation Fails
```powershell
# Stop all remediation processes
Get-Process | Where-Object { $_.ProcessName -like "*remediation*" } | Stop-Process -Force

# Manual system check
.\scripts\auto-remediation.ps1 -DryRun

# Safe mode remediation
.\scripts\auto-remediation.ps1 -DryRun -Force
```

### Manual Recovery Commands
```bash
# Emergency Docker restart
sudo systemctl stop docker
sudo systemctl start docker

# Emergency runner restart
sudo systemctl stop actions.runner.*
sudo systemctl start actions.runner.*

# Emergency system cleanup
sudo docker system prune -a -f
sudo journalctl --vacuum-time=1d
```

## 📈 Performance Impact

### Resource Usage
- **CPU**: Minimal (<1% during monitoring)
- **Memory**: Low (<50MB for launcher)
- **Disk**: Minimal (log parsing only)
- **Network**: None (local operations only)

### Optimization Tips
- **Adjust check interval** based on system load
- **Use dry run mode** for testing
- **Monitor launcher logs** for performance
- **Schedule during low-usage periods**

## 🔄 Continuous Integration

### GitHub Actions Integration
Add to your workflow for automated remediation:

```yaml
- name: Auto-Remediation
  run: |
    if [ "$RUNNER_OS" == "Windows" ]; then
      .\scripts\auto-remediation.ps1 -DryRun
    else
      ./scripts/auto-remediation.sh --dry-run
    fi
```

### Cron Job Setup (Linux)
```bash
# Add to crontab for regular checks
*/5 * * * * /path/to/scripts/auto-remediation.sh --dry-run
```

## 🎯 Best Practices

1. **Start with dry run** to understand what will be fixed
2. **Monitor launcher output** for unexpected behavior
3. **Use force mode sparingly** to avoid disrupting services
4. **Keep scripts updated** with latest fixes
5. **Test in staging environment** before production
6. **Document custom remediation** for your specific setup

## 🆘 Troubleshooting

### Common Issues

**Script not found**
```bash
# Check file permissions
ls -la scripts/auto-remediation.sh
chmod +x scripts/auto-remediation.sh
```

**Permission denied**
```bash
# Run with sudo (Linux)
sudo ./scripts/auto-remediation.sh

# Run as Administrator (Windows)
# Right-click PowerShell -> Run as Administrator
```

**Docker not accessible**
```bash
# Add user to docker group (Linux)
sudo usermod -aG docker $USER
newgrp docker
```

**Launcher not detecting issues**
```powershell
# Check log file path
Test-Path "scripts/monitor-runner-web.html"

# Verify log format
Get-Content "scripts/monitor-runner-web.html" | Select-String "ERROR|WARNING"
```

## 📞 Support

For issues with the auto-remediation system:

1. **Check the logs** for detailed error messages
2. **Run in dry run mode** to see what would be fixed
3. **Review system health** before and after remediation
4. **Check permissions** for admin-required operations
5. **Verify dependencies** (Docker, systemctl, etc.)

The auto-remediation system is designed to be safe and non-destructive, but always test in a staging environment first! 