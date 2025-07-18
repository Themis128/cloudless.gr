# GitHub Actions Workflows

This repository contains a comprehensive set of GitHub Actions workflows for CI/CD, security, maintenance, and releases.

## 📋 Workflow Overview

### 🔄 CI/CD Pipeline (`ci.yml`)
**Triggers:** Push to `main`, `develop`, `application` branches; Pull requests
**Purpose:** Continuous integration and quality assurance

**Jobs:**
- **Lint & Type Check**: ESLint, TypeScript validation, Prettier formatting
- **Build Test**: Application build verification across Node.js versions
- **Security Check**: npm audit and vulnerability scanning
- **Dependency Check**: Outdated package detection
- **E2E Tests**: Playwright end-to-end testing
- **Accessibility Test**: WCAG compliance testing
- **Performance Test**: Bundle size analysis
- **Integration Test**: Server startup and connectivity testing
- **Preview Deploy**: PR preview with status comments
- **Test Summary**: Comprehensive test results summary

### 🚀 Deployment (`deploy.yml`)
**Triggers:** Push to `main`, `production` branches; Manual dispatch
**Purpose:** Automated deployment to staging and production

**Jobs:**
- **Deploy to Staging**: Automatic deployment from `develop` branch
- **Deploy to Production**: Manual or automatic deployment from `main`/`production`

**Features:**
- Environment-specific deployments
- Build artifact uploads
- Deployment notifications
- Manual trigger with environment selection

### 🔒 Security Scan (`security.yml`)
**Triggers:** Weekly schedule, push to `main`/`develop`, PRs, manual dispatch
**Purpose:** Comprehensive security scanning

**Jobs:**
- **Dependency Vulnerability Scan**: npm audit, audit-ci, outdated packages
- **Code Security Scan**: ESLint security rules, secret detection
- **Container Security Scan**: Trivy vulnerability scanning (if Dockerfile exists)
- **Secrets Detection**: TruffleHog for credential scanning
- **Security Summary**: Consolidated security report

### 🔧 Maintenance (`maintenance.yml`)
**Triggers:** Weekly schedule (Sundays), manual dispatch
**Purpose:** Automated maintenance tasks

**Jobs:**
- **Update Dependencies**: Automated dependency updates with PR creation
- **Cleanup**: Build artifact cleanup, disk usage optimization
- **Audit Dependencies**: Security audits and license checks
- **Maintenance Summary**: Task completion summary

### 🏷️ Release (`release.yml`)
**Triggers:** Git tags (`v*`), manual dispatch
**Purpose:** Automated versioning and releases

**Jobs:**
- **Create Release**: Version bumping and GitHub release creation
- **Build and Upload**: Release asset creation and upload
- **Tag Release**: Tag-based release automation
- **Notify Release**: Release completion notifications

## 🛠️ Setup Instructions

### 1. Repository Settings
Enable GitHub Actions in your repository settings:
```
Settings > Actions > General > Actions permissions > Allow all actions and reusable workflows
```

### 2. Environment Setup
Create environments for deployment:
```
Settings > Environments > New environment
```
- Create `staging` environment
- Create `production` environment with protection rules

### 3. Secrets Configuration
Add required secrets in repository settings:
```
Settings > Secrets and variables > Actions
```

**Required Secrets:**
- `GITHUB_TOKEN` (automatically provided)
- `NODE_ENV` (optional, for environment-specific builds)
- Deployment platform secrets (Vercel, Netlify, etc.)

### 4. Branch Protection
Set up branch protection rules:
```
Settings > Branches > Add rule
```
- Require status checks to pass
- Require branches to be up to date
- Require pull request reviews

## 📊 Workflow Features

### ✅ Quality Assurance
- **Automated Testing**: Unit, integration, and E2E tests
- **Code Quality**: ESLint, Prettier, TypeScript validation
- **Security**: Vulnerability scanning, secret detection
- **Performance**: Bundle size analysis, performance monitoring

### 🔄 Continuous Integration
- **Parallel Jobs**: Fast feedback with parallel execution
- **Caching**: npm cache optimization for faster builds
- **Matrix Testing**: Multi-version Node.js testing
- **Artifact Management**: Build artifact storage and retrieval

### 🚀 Continuous Deployment
- **Environment Management**: Staging and production environments
- **Rollback Capability**: Easy rollback to previous versions
- **Deployment Notifications**: Slack, email, or GitHub notifications
- **Manual Triggers**: On-demand deployment with environment selection

### 🔒 Security
- **Automated Scanning**: Weekly security scans
- **Vulnerability Detection**: Real-time vulnerability alerts
- **Secret Management**: Credential scanning and protection
- **Compliance**: License and dependency compliance checks

### 🔧 Maintenance
- **Automated Updates**: Dependency update automation
- **Cleanup Tasks**: Build artifact and cache cleanup
- **Health Monitoring**: Repository health checks
- **Scheduled Maintenance**: Weekly maintenance windows

## 🎯 Usage Examples

### Manual Deployment
1. Go to Actions tab
2. Select "Deploy" workflow
3. Click "Run workflow"
4. Choose environment (staging/production)
5. Click "Run workflow"

### Manual Release
1. Go to Actions tab
2. Select "Release" workflow
3. Click "Run workflow"
4. Enter version and release type
5. Click "Run workflow"

### Security Scan
1. Go to Actions tab
2. Select "Security Scan" workflow
3. Click "Run workflow"
4. Review results in Security tab

### Maintenance Tasks
1. Go to Actions tab
2. Select "Maintenance" workflow
3. Click "Run workflow"
4. Choose maintenance task
5. Review generated PRs

## 📈 Monitoring and Alerts

### Workflow Status
- Monitor workflow runs in the Actions tab
- Set up branch protection for required status checks
- Configure notifications for workflow failures

### Security Alerts
- Review security scan results in the Security tab
- Set up Dependabot alerts for vulnerability notifications
- Monitor secret scanning results

### Performance Metrics
- Track build times and success rates
- Monitor bundle size changes
- Review deployment frequency and success rates

## 🔧 Customization

### Environment Variables
Add environment-specific variables in workflow files:
```yaml
env:
  NODE_VERSION: '20'
  NODE_ENV: 'production'
```

### Job Dependencies
Configure job dependencies for sequential execution:
```yaml
needs: [lint-and-check, build-test]
```

### Conditional Execution
Use conditions for selective job execution:
```yaml
if: github.ref == 'refs/heads/main'
```

### Custom Actions
Integrate with external services:
- Vercel deployment
- Netlify deployment
- Slack notifications
- Email alerts

## 🚨 Troubleshooting

### Common Issues
1. **Build Failures**: Check Node.js version compatibility
2. **Test Failures**: Review test logs and update tests
3. **Deployment Issues**: Verify environment secrets and permissions
4. **Security Alerts**: Address vulnerability reports promptly

### Debug Steps
1. Check workflow logs in Actions tab
2. Review job-specific error messages
3. Verify repository settings and permissions
4. Test workflows locally when possible

### Support
- Review GitHub Actions documentation
- Check workflow syntax with GitHub's linter
- Use GitHub's workflow debug mode for detailed logging

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Nuxt 3 Deployment Guide](https://nuxt.com/docs/getting-started/deployment)
- [Vuetify Documentation](https://vuetifyjs.com/)
- [Playwright Testing](https://playwright.dev/)
- [ESLint Configuration](https://eslint.org/docs/user-guide/configuring)
- [Prettier Configuration](https://prettier.io/docs/en/configuration.html) 