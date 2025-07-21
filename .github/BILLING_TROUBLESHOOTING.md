# 🔧 GitHub Actions Billing Troubleshooting Guide

## 🚨 **Error: "Recent account payments have failed or your spending limit needs to be increased"**

This error occurs when your GitHub account has billing issues or you've exceeded your GitHub Actions usage limits.

## 🔍 **Immediate Solutions**

### **1. Check GitHub Billing Status**

#### **For Personal Accounts:**
1. Go to [GitHub Settings > Billing & plans](https://github.com/settings/billing)
2. Check your current plan and usage
3. Verify payment method is valid
4. Check if you've exceeded free tier limits

#### **For Organization Accounts:**
1. Go to [Organization Settings > Billing & plans](https://github.com/organizations/[org-name]/settings/billing)
2. Check organization billing status
3. Verify payment method
4. Review spending limits

### **2. GitHub Actions Free Tier Limits**

| Account Type | Free Minutes/Month | Additional Cost |
|--------------|-------------------|-----------------|
| Public Repos | Unlimited | Free |
| Private Repos (Free) | 2,000 minutes | $0.008/minute |
| Private Repos (Pro) | 3,000 minutes | $0.008/minute |
| Private Repos (Team) | 3,000 minutes | $0.008/minute |
| Private Repos (Enterprise) | 50,000 minutes | $0.008/minute |

### **3. Quick Fixes**

#### **Option A: Update Billing Information**
```bash
# Check your current usage
gh api /user/settings/billing/actions

# Update payment method via GitHub web interface
# Settings > Billing & plans > Payment method
```

#### **Option B: Increase Spending Limit**
1. Go to GitHub Settings > Billing & plans
2. Click "Actions and Packages"
3. Set spending limit to desired amount
4. Add payment method if needed

#### **Option C: Switch to Self-Hosted Runners (Recommended)**

## 🚀 **Self-Hosted Runner Solution**

### **Benefits of Self-Hosted Runners:**
- ✅ **No billing limits** - Use your own infrastructure
- ✅ **Faster execution** - No queue waiting
- ✅ **Custom environment** - Full control over setup
- ✅ **Cost effective** - Use existing servers
- ✅ **Better security** - Keep sensitive data on-premises

### **1. Set Up Self-Hosted Runner**

#### **On Your Development Machine:**
```bash
# Download and configure runner
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz

# Configure runner
./config.sh --url https://github.com/themis128/cloudless.gr --token YOUR_TOKEN

# Install as service
sudo ./svc.sh install
sudo ./svc.sh start
```

#### **Using Docker (Recommended):**
```bash
# Use the existing Docker setup
docker-compose -f docker-compose.runner.yml up -d
```

### **2. Use Self-Hosted Workflow**

I've created a self-hosted workflow that bypasses billing issues:

```yaml
# .github/workflows/self-hosted-runner.yml
runs-on: [self-hosted, containerized, dev]
```

**Features:**
- ✅ All jobs run on self-hosted runners
- ✅ No GitHub-hosted runner usage
- ✅ Enhanced Docker build fixes
- ✅ Optimized caching
- ✅ Full CI/CD pipeline

### **3. Activate Self-Hosted Workflow**

```bash
# Rename to make it the main workflow
mv .github/workflows/self-hosted-runner.yml .github/workflows/complete-pipeline.yml
```

## 💰 **Cost Optimization Strategies**

### **1. Optimize Workflow Efficiency**

#### **Reduce Build Time:**
```yaml
# Use caching effectively
- name: Cache node_modules
  uses: actions/cache@v4
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

#### **Skip Unnecessary Jobs:**
```yaml
# Skip CI for documentation changes
- name: Check for skip patterns
  run: |
    if [[ "${{ github.event.head_commit.message }}" =~ ^docs? ]]; then
      echo "Skipping CI for documentation changes"
      exit 0
    fi
```

### **2. Use Conditional Execution**

```yaml
# Only run expensive jobs when needed
integration-tests:
  if: |
    github.event_name == 'pull_request' ||
    github.ref == 'refs/heads/main' ||
    github.event.inputs.run_tests == 'true'
```

### **3. Optimize Docker Builds**

```yaml
# Use multi-stage builds
# Cache Docker layers
# Use .dockerignore effectively
```

## 🔧 **Alternative Solutions**

### **1. Use GitHub-Hosted Runners Selectively**

```yaml
# Only use GitHub-hosted runners for critical jobs
critical-security-scan:
  runs-on: ubuntu-latest  # GitHub-hosted
  if: github.event_name == 'pull_request'

build-and-test:
  runs-on: [self-hosted, containerized, dev]  # Self-hosted
```

### **2. Hybrid Approach**

```yaml
# Use GitHub-hosted for quick jobs, self-hosted for heavy jobs
lint-and-test:
  runs-on: ubuntu-latest  # Quick jobs on GitHub-hosted

docker-build:
  runs-on: [self-hosted, containerized, dev]  # Heavy jobs on self-hosted
```

### **3. Local Development Workflow**

```bash
# Run CI locally to avoid GitHub Actions costs
npm run ci:local
npm run test:local
npm run build:local
```

## 📊 **Monitoring and Alerts**

### **1. Set Up Usage Alerts**

```yaml
# GitHub Settings > Billing & plans > Actions and Packages
# Set spending limit alerts at 80%, 90%, 100%
```

### **2. Monitor Runner Health**

```bash
# Check runner status
gh api /repos/themis128/cloudless.gr/actions/runners

# Monitor runner logs
docker logs cloudless-github-runner
```

### **3. Cost Tracking**

```bash
# Track GitHub Actions usage
gh api /user/settings/billing/actions

# Monitor self-hosted runner performance
docker stats cloudless-github-runner
```

## 🛠️ **Troubleshooting Steps**

### **1. Immediate Actions**

1. **Check Billing Status:**
   ```bash
   # Verify account status
   gh auth status
   gh api /user/settings/billing/actions
   ```

2. **Update Payment Method:**
   - Go to GitHub Settings > Billing & plans
   - Update payment information
   - Verify billing address

3. **Increase Spending Limit:**
   - Set appropriate spending limit
   - Add payment method if needed

### **2. Long-term Solutions**

1. **Switch to Self-Hosted Runners:**
   ```bash
   # Use the provided self-hosted workflow
   cp .github/workflows/self-hosted-runner.yml .github/workflows/complete-pipeline.yml
   ```

2. **Optimize Workflow Efficiency:**
   - Implement better caching
   - Skip unnecessary jobs
   - Use conditional execution

3. **Consider Alternative CI/CD:**
   - GitLab CI/CD
   - Jenkins
   - Azure DevOps
   - CircleCI

## 🎯 **Recommended Action Plan**

### **Immediate (Today):**
1. ✅ Check GitHub billing status
2. ✅ Update payment method if needed
3. ✅ Switch to self-hosted workflow

### **Short-term (This Week):**
1. ✅ Set up self-hosted runner monitoring
2. ✅ Optimize workflow efficiency
3. ✅ Set up usage alerts

### **Long-term (This Month):**
1. ✅ Evaluate CI/CD alternatives
2. ✅ Implement cost optimization strategies
3. ✅ Set up comprehensive monitoring

## 📞 **Support Resources**

### **GitHub Support:**
- [GitHub Actions Billing](https://docs.github.com/en/billing/managing-billing-for-github-actions)
- [Self-hosted Runners](https://docs.github.com/en/actions/hosting-your-own-runners)
- [GitHub Support](https://support.github.com/)

### **Community Resources:**
- [GitHub Community](https://github.community/)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/github-actions)
- [Reddit r/github](https://www.reddit.com/r/github/)

---

**🎉 With self-hosted runners, you'll have unlimited CI/CD without billing concerns!** 