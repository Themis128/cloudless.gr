# Self-Hosted Runners Setup Guide

## 🎯 Overview

Self-hosted runners provide faster builds, more resources, and cost optimization for your CI/CD pipeline. This guide covers setup, configuration, and best practices.

## 🚀 Benefits

### **Performance Benefits:**
- **Faster builds** (dedicated resources)
- **More CPU/RAM** for heavy workloads
- **Better caching** (persistent storage)
- **Reduced queue times** (no shared resources)

### **Cost Benefits:**
- **Reduced GitHub Actions minutes** usage
- **No per-minute charges** for self-hosted runners
- **Predictable costs** (your infrastructure)

### **Control Benefits:**
- **Custom hardware** specifications
- **Software customization** (specific tools, versions)
- **Network access** to private resources
- **Security control** (data stays on your infrastructure)

## 🏗️ Setup Options

### **Option 1: Docker-Based Runner (Recommended)**

#### **Prerequisites:**
- Docker installed
- 4GB+ RAM available
- 20GB+ disk space
- Stable internet connection

#### **Quick Setup:**
```bash
# Create runner directory
mkdir -p ~/github-runners
cd ~/github-runners

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  github-runner:
    image: myoung34/github-runner:latest
    container_name: github-runner
    restart: unless-stopped
    environment:
      - RUNNER_NAME=cloudless-runner
      - RUNNER_TOKEN=${GITHUB_TOKEN}
      - RUNNER_REPOSITORY_URL=https://github.com/Themis128/cloudless.gr
      - RUNNER_LABELS=linux,docker,self-hosted
      - RUNNER_WORKDIR=/tmp/github-runner
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./runner-data:/data
    ports:
      - "8080:8080"  # Runner status endpoint
EOF

# Start the runner
docker-compose up -d
```

### **Option 2: Native Linux Runner**

#### **Setup Script:**
```bash
#!/bin/bash
# setup-runner.sh

# Configuration
REPO_URL="https://github.com/Themis128/cloudless.gr"
RUNNER_NAME="cloudless-linux-runner"
GITHUB_TOKEN="your-personal-access-token"

# Create runner user
sudo useradd -m -s /bin/bash github-runner
sudo usermod -aG docker github-runner

# Switch to runner user
sudo -u github-runner bash << 'EOF'
cd /home/github-runner

# Download runner
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz

# Extract
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz

# Configure
./config.sh --url $REPO_URL --token $GITHUB_TOKEN --name $RUNNER_NAME --labels "linux,self-hosted" --unattended

# Install service
sudo ./svc.sh install github-runner
sudo ./svc.sh start
EOF
```

### **Option 3: Windows Runner**

#### **PowerShell Setup:**
```powershell
# setup-windows-runner.ps1

# Configuration
$RepoUrl = "https://github.com/Themis128/cloudless.gr"
$RunnerName = "cloudless-windows-runner"
$GitHubToken = "your-personal-access-token"

# Create runner directory
$RunnerDir = "C:\github-runner"
New-Item -ItemType Directory -Path $RunnerDir -Force
Set-Location $RunnerDir

# Download runner
Invoke-WebRequest -Uri "https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-win-x64-2.311.0.zip" -OutFile "actions-runner-win-x64-2.311.0.zip"

# Extract
Expand-Archive -Path "actions-runner-win-x64-2.311.0.zip" -DestinationPath "."

# Configure
.\config.cmd --url $RepoUrl --token $GitHubToken --name $RunnerName --labels "windows,self-hosted" --unattended

# Install service
.\svc.install
.\svc.start
```

## ⚙️ Configuration

### **Runner Labels**

Configure specific labels for job targeting:

```yaml
# In workflow file
jobs:
  build-test:
    runs-on: self-hosted
    strategy:
      matrix:
        runner: [linux, docker, gpu]  # Target specific runners
```

### **Resource Requirements**

#### **Minimum Requirements:**
- **CPU:** 2 cores
- **RAM:** 4GB
- **Storage:** 20GB
- **Network:** Stable internet

#### **Recommended Requirements:**
- **CPU:** 4+ cores
- **RAM:** 8GB+
- **Storage:** 50GB+ SSD
- **Network:** 100Mbps+

### **Environment Setup**

#### **Pre-installed Software:**
```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Build tools
sudo apt-get install -y build-essential git curl wget

# Additional tools
sudo apt-get install -y jq yq docker-compose
```

## 🔧 Workflow Integration

### **Updated Workflow Configuration:**

```yaml
# .github/workflows/complete-pipeline.yml
jobs:
  build-test:
    name: 🏗️ Build & Test
    runs-on: self-hosted  # Use self-hosted runner
    needs: [validate, code-quality]
    if: needs.validate.outputs.should-skip != 'true'
    
  docker-build-test:
    name: 🐳 Docker Build & Test
    runs-on: self-hosted  # Use self-hosted runner
    needs: [validate, build-test]
    if: needs.validate.outputs.should-skip != 'true'
```

### **Runner Selection Strategy:**

```yaml
jobs:
  # Heavy builds on self-hosted
  build-test:
    runs-on: self-hosted
    
  # Light tests on GitHub-hosted
  unit-tests:
    runs-on: ubuntu-latest
    
  # Docker builds on self-hosted
  docker-build:
    runs-on: self-hosted
```

## 🛡️ Security Best Practices

### **Network Security:**
- **Firewall rules** for runner access
- **VPN** for secure communication
- **Private network** isolation

### **Access Control:**
- **Dedicated user** for runner
- **Limited permissions** (principle of least privilege)
- **Regular token rotation**

### **Data Protection:**
- **Ephemeral workspaces** (clean after each job)
- **No persistent secrets** storage
- **Encrypted communication**

## 📊 Monitoring & Maintenance

### **Health Checks:**
```bash
# Check runner status
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/Themis128/cloudless.gr/actions/runners

# Monitor resource usage
docker stats github-runner
```

### **Logs & Debugging:**
```bash
# View runner logs
docker logs github-runner

# Check runner configuration
cat /home/github-runner/.runner
```

### **Maintenance Tasks:**
- **Weekly:** Update runner software
- **Monthly:** Rotate access tokens
- **Quarterly:** Review security settings

## 💰 Cost Analysis

### **GitHub Actions Pricing:**
- **Public repos:** Free (unlimited minutes)
- **Private repos:** $0.008 per minute (Linux), $0.016 per minute (Windows)

### **Self-Hosted Savings:**
- **No per-minute charges**
- **Only infrastructure costs**
- **Predictable monthly costs**

### **Example Cost Comparison:**
```
GitHub Actions (1000 minutes/month):
- Linux: $8.00/month
- Windows: $16.00/month

Self-Hosted Runner:
- Infrastructure: $20-50/month
- Unlimited minutes: $0
- Total: $20-50/month
```

## 🚀 Advanced Features

### **Auto-scaling:**
```yaml
# Scale runners based on queue
runners:
  min: 1
  max: 5
  scale-up-threshold: 2
  scale-down-threshold: 0
```

### **Custom Images:**
```dockerfile
# Dockerfile for custom runner image
FROM myoung34/github-runner:latest

# Install custom tools
RUN apt-get update && apt-get install -y \
    nodejs \
    docker.io \
    build-essential

# Configure environment
ENV NODE_ENV=production
```

### **Multi-platform Support:**
```yaml
jobs:
  build-linux:
    runs-on: self-hosted-linux
    
  build-windows:
    runs-on: self-hosted-windows
    
  build-macos:
    runs-on: self-hosted-macos
```

## 🔄 Migration Strategy

### **Phase 1: Setup & Testing**
1. Set up self-hosted runner
2. Test with non-critical jobs
3. Validate performance improvements

### **Phase 2: Gradual Migration**
1. Move heavy build jobs to self-hosted
2. Keep light jobs on GitHub-hosted
3. Monitor performance and costs

### **Phase 3: Full Migration**
1. Move all jobs to self-hosted
2. Optimize runner configuration
3. Implement auto-scaling

## 📞 Support & Troubleshooting

### **Common Issues:**
- **Runner not connecting:** Check token and network
- **Build failures:** Verify pre-installed software
- **Performance issues:** Monitor resource usage

### **Useful Commands:**
```bash
# Restart runner
docker-compose restart github-runner

# Update runner
docker-compose pull github-runner

# Check status
docker-compose ps github-runner
```

### **Resources:**
- [GitHub Actions Runner Documentation](https://docs.github.com/en/actions/hosting-your-own-runners)
- [Runner Installation Guide](https://docs.github.com/en/actions/hosting-your-own-runners/installing-self-hosted-runners)
- [Runner Configuration](https://docs.github.com/en/actions/hosting-your-own-runners/configuring-the-runner) 