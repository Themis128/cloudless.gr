# GitHub Actions CI/CD Setup

This document describes the GitHub Actions workflows configured for the Cloudless.gr project.

## 🔧 Configured Workflows

### 1. SonarQube Cloud Analysis (`sonarcloud.yml`)

- **Trigger**: Push to `application` branch, PRs to `application`
- **Purpose**: Code quality analysis with SonarQube Cloud
- **Features**:
  - ESLint validation
  - TypeScript checking
  - Test execution (if available)
  - SonarCloud scanning with detailed configuration

### 2. CI/CD Pipeline (`ci.yml`)

- **Trigger**: Push to `application`/`main`/`develop`, all PRs
- **Jobs**:
  - **Quality**: ESLint, Prettier, TypeScript checks
  - **Build**: Multi-Node.js version testing (18, 20)
  - **Security**: npm audit, security scanning
  - **Dependencies**: Outdated packages check
  - **Preview Deploy**: PR preview deployment

### 3. Production Deploy (`deploy.yml`)

- **Trigger**: Release publication, manual dispatch
- **Features**:
  - Environment selection (production/staging)
  - Quality gates before deployment
  - Artifact creation and upload
  - Deployment notifications

## 🛠️ VS Code Integration

### GitHub Actions Extension Configuration

The GitHub Actions extension is configured with optimal settings:

```json
{
  "github-actions.workflows.pinned.workflows": [],
  "github-actions.workflows.pinned.refresh.enabled": true,
  "github-actions.workflows.pinned.refresh.interval": 30,
  "github-actions.workflows.pinned.showStatusBarItem": true,
  "github-actions.workflows.pinned.notifications.enabled": true
}
```

### Available VS Code Tasks

- **GitHub Actions: Validate Workflows** - List all workflows
- **GitHub Actions: View Latest Runs** - Show recent runs
- **GitHub Actions: Check Workflow Status** - Monitor CI status
- **Git: Push and Trigger Workflows** - Push and trigger actions
- **Local CI: Run All Checks** - Test locally before pushing

## 📋 Local Development Workflow

### Before Pushing Code

1. **Run Local CI Checks**:

   ```bash
   npm run ci:local
   ```

   Or use VS Code Command Palette: `Tasks: Run Task` → `Local CI: Run All Checks`

2. **Individual Checks**:
   ```bash
   npm run lint        # ESLint
   npm run typecheck   # TypeScript
   npm run build       # Build check
   ```

### Using VS Code Tasks

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type `Tasks: Run Task`
3. Select from available GitHub Actions tasks:
   - Validate workflows
   - View latest runs
   - Check CI status
   - Run local CI

## 🔍 Monitoring Workflows

### In VS Code

- Status bar shows workflow status when enabled
- GitHub Actions panel shows pinned workflows
- Notifications for workflow completion

### Command Line (GitHub CLI required)

```bash
# List workflows
gh workflow list

# View recent runs
gh run list --limit 10

# Check specific workflow
gh run list --workflow=ci.yml
```

## 🚀 Deployment Process

### Automatic (on Release)

1. Create a release on GitHub
2. `deploy.yml` workflow triggers automatically
3. Runs quality checks and builds
4. Creates deployment artifact
5. Sends notifications

### Manual Deployment

1. Go to Actions tab in GitHub
2. Select "Production Deploy" workflow
3. Click "Run workflow"
4. Choose environment (production/staging)
5. Confirm and run

## 📊 Code Quality Integration

### SonarQube Cloud

- Automatic analysis on every push/PR to `application`
- Configured exclusions for build/test directories
- TypeScript and JavaScript analysis
- Security hotspot detection

### Local SonarQube Analysis

```bash
npm run sonar
```

## 🔒 Required Secrets

Ensure these secrets are set in GitHub repository settings:

1. **SONAR_TOKEN** - SonarQube Cloud token
2. **GITHUB_TOKEN** - Automatically provided by GitHub Actions

## 📁 Workflow Files Structure

```
.github/
└── workflows/
    ├── sonarcloud.yml    # SonarQube analysis
    ├── ci.yml           # Main CI/CD pipeline
    └── deploy.yml       # Production deployment
```

## 🎯 Best Practices

1. **Always run local CI before pushing**:

   ```bash
   npm run ci:local
   ```

2. **Use feature branches and PRs**:

   - Create feature branches from `application`
   - Open PRs to trigger CI checks
   - Wait for all checks to pass before merging

3. **Monitor workflow status**:

   - Check VS Code status bar
   - Use GitHub Actions panel
   - Review PR checks before merging

4. **Keep workflows updated**:
   - Update Node.js versions as needed
   - Review and update dependencies
   - Monitor security alerts

## 🐛 Troubleshooting

### Common Issues

1. **Workflow not triggering**:

   - Check branch names in workflow files
   - Ensure proper push to target branches

2. **VS Code extension not working**:

   - Ensure you're signed in to GitHub
   - Check extension settings
   - Reload VS Code if needed

3. **Local CI failing**:
   - Run individual commands to isolate issues
   - Check for uncommitted changes
   - Ensure all dependencies are installed

### Getting Help

1. Check workflow logs in GitHub Actions tab
2. Use VS Code GitHub Actions panel for quick access
3. Run local checks to debug issues before pushing
4. Review this documentation for configuration details

---

_This setup provides a robust CI/CD pipeline with comprehensive code quality checks, automated testing, and streamlined deployment processes._
