# Self-Hosted Runner Monitoring Tools

This directory contains comprehensive monitoring tools for your GitHub Actions self-hosted runner. These tools provide real-time visibility into your runner's status, Docker builds, and system health.

## 🛠️ Available Tools

### 1. PowerShell Monitor (Windows)
**File:** `monitor-runner.ps1`

A comprehensive PowerShell script for Windows environments that provides detailed monitoring of your self-hosted runner.

#### Usage:
```powershell
# Basic monitoring dashboard
.\scripts\monitor-runner.ps1

# Continuous monitoring (refresh every 10 seconds)
.\scripts\monitor-runner.ps1 -Continuous -Interval 10

# Docker-only monitoring
.\scripts\monitor-runner.ps1 -DockerOnly

# Runner-only monitoring
.\scripts\monitor-runner.ps1 -RunnerOnly

# Health check only
.\scripts\monitor-runner.ps1 -Health
```

#### Features:
- ✅ System resource monitoring (CPU, Memory, Disk)
- ✅ Network connectivity testing
- ✅ Docker status and build monitoring
- ✅ Runner process monitoring
- ✅ Health check with issue detection
- ✅ Colored output for easy reading
- ✅ Continuous monitoring mode

### 2. Bash Monitor (Linux/macOS)
**File:** `monitor-runner.sh`

A bash script for Linux and macOS environments with the same functionality as the PowerShell version.

#### Usage:
```bash
# Make executable
chmod +x scripts/monitor-runner.sh

# Basic monitoring dashboard
./scripts/monitor-runner.sh

# Continuous monitoring (refresh every 10 seconds)
./scripts/monitor-runner.sh -c -i 10

# Docker-only monitoring
./scripts/monitor-runner.sh -d

# Runner-only monitoring
./scripts/monitor-runner.sh -r

# Health check only
./scripts/monitor-runner.sh -h
```

#### Features:
- ✅ Cross-platform compatibility
- ✅ Same features as PowerShell version
- ✅ Optimized for Linux environments

### 3. Web Dashboard
**File:** `monitor-runner-web.html`

A beautiful web-based dashboard that can be opened in any browser for visual monitoring.

#### Usage:
```bash
# Open in default browser
start scripts/monitor-runner-web.html  # Windows
open scripts/monitor-runner-web.html   # macOS
xdg-open scripts/monitor-runner-web.html  # Linux
```

#### Features:
- 🎨 Beautiful, responsive UI
- 📊 Real-time progress bars
- 🔄 Auto-refresh capability
- 📱 Mobile-friendly design
- 📋 Activity logging
- 🎛️ Interactive controls

## 📊 What Gets Monitored

### System Resources
- **CPU Usage**: Real-time CPU utilization with warning thresholds
- **Memory Usage**: Available and used memory monitoring
- **Disk Space**: Free space monitoring with alerts

### Network Connectivity
- **GitHub.com**: Ensures runner can reach GitHub
- **Docker Hub**: Checks Docker registry connectivity
- **GitHub Container Registry**: Verifies container registry access

### Docker Status
- **Docker Service**: Checks if Docker is running
- **Active Builds**: Shows currently running Docker builds
- **Images**: Lists available cloudless.gr images
- **Build Progress**: Real-time build status

### Runner Status
- **Runner Processes**: Monitors GitHub Actions runner processes
- **Active Jobs**: Shows currently running jobs
- **Service Status**: Checks runner service health

### Health Checks
- **System Health**: Comprehensive health assessment
- **Issue Detection**: Identifies potential problems
- **Recommendations**: Suggests fixes for detected issues

## 🚀 Quick Start

### For Windows Users:
```powershell
# Navigate to your project directory
cd "D:\Nuxt Projects\llm-dev-agent\cloudless.gr"

# Run the monitoring dashboard
.\scripts\monitor-runner.ps1 -Continuous
```

### For Linux/macOS Users:
```bash
# Navigate to your project directory
cd /path/to/your/project

# Make script executable
chmod +x scripts/monitor-runner.sh

# Run the monitoring dashboard
./scripts/monitor-runner.sh -c
```

### For Web Dashboard:
```bash
# Open the web dashboard in your browser
# Windows:
start scripts/monitor-runner-web.html

# macOS:
open scripts/monitor-runner-web.html

# Linux:
xdg-open scripts/monitor-runner-web.html
```

## 🔧 Troubleshooting

### Common Issues:

#### 1. "Docker is not running"
```bash
# Start Docker service
# Windows:
Start-Service docker

# Linux:
sudo systemctl start docker

# macOS:
open -a Docker
```

#### 2. "Runner processes not found"
```bash
# Check if runner is installed and running
# Windows:
Get-Service -Name "*runner*"

# Linux:
sudo systemctl status actions.runner.*
```

#### 3. "Network connectivity issues"
```bash
# Test network connectivity manually
ping github.com
ping registry-1.docker.io
ping ghcr.io
```

### Performance Tips:

1. **Use continuous monitoring sparingly**: Set longer intervals (30+ seconds) to reduce system load
2. **Close web dashboard when not needed**: The web dashboard uses simulated data for demonstration
3. **Monitor during builds**: Use the tools specifically during Docker builds for real-time progress

## 📈 Integration with GitHub Actions

These monitoring tools work alongside your existing GitHub Actions workflow:

1. **During Builds**: Use the monitoring tools to watch Docker build progress
2. **Health Checks**: Run health checks before starting important workflows
3. **Troubleshooting**: Use the tools to diagnose runner issues

### Example Workflow Integration:
```yaml
# Add to your GitHub Actions workflow
- name: Check Runner Health
  run: |
    chmod +x scripts/monitor-runner.sh
    ./scripts/monitor-runner.sh -h
```

## 🎯 Best Practices

1. **Regular Monitoring**: Run health checks weekly
2. **Build Monitoring**: Use continuous monitoring during important builds
3. **Log Analysis**: Check logs when issues are detected
4. **Resource Management**: Monitor system resources to prevent runner overload
5. **Network Monitoring**: Ensure connectivity to all required services

## 🔮 Future Enhancements

Potential improvements for the monitoring tools:

- [ ] Real-time Docker build logs streaming
- [ ] Email/Slack notifications for issues
- [ ] Historical data tracking
- [ ] Performance metrics dashboard
- [ ] Automated issue resolution
- [ ] Integration with monitoring services (Prometheus, Grafana)

## 📞 Support

If you encounter issues with the monitoring tools:

1. Check the troubleshooting section above
2. Verify your runner configuration
3. Ensure Docker is properly installed and running
4. Check network connectivity to required services

For additional help, refer to the main project documentation or create an issue in the repository. 