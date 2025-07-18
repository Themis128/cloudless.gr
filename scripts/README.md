# Scripts Directory

This directory contains automation and utility scripts for the Cloudless project.

## 📁 Scripts

### 🐳 Docker Scripts

- `dev-docker.ps1` - PowerShell script for Docker development environment management
- `deploy.ps1` - PowerShell deployment script
- `deploy.sh` - Bash deployment script
- `test-deployment.ps1` - PowerShell test deployment script
- `test-deployment.sh` - Bash test deployment script
- `version.ps1` - PowerShell version management script
- `version.sh` - Bash version management script

### 🔧 Utility Scripts

- `backup.sh` - Database backup script

## 🚀 Usage

### Docker Development

```powershell
# Start development environment
powershell -ExecutionPolicy Bypass -File scripts/dev-docker.ps1 start

# Stop development environment
powershell -ExecutionPolicy Bypass -File scripts/dev-docker.ps1 stop
```

### Deployment

```powershell
# Deploy using PowerShell
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1

# Deploy using Bash
bash scripts/deploy.sh
```

## 📚 Documentation

See [../docs/DOCKER-DEV.md](../docs/DOCKER-DEV.md) for detailed usage instructions.
