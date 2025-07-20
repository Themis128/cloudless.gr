# �� GitHub Workflows - Complete Testing & CI/CD Suite

This directory contains comprehensive GitHub workflows for the Cloudless Wizard application, covering testing, CI/CD, security, dependency management, and release management.

## 📋 Available Workflows

### 1. **Enhanced CI/CD Pipeline** (`ci-enhanced.yml`)
Advanced CI/CD pipeline with improved error handling, parallel execution, and comprehensive reporting.

**Triggers:**
- Push to `main`, `develop`, `application`, `platform` branches
- Pull requests to main branches
- Automatic skip for documentation-only changes

**Features:**
- ✅ Smart validation and skip logic
- ✅ Parallel code quality checks (Node.js 18 & 20)
- ✅ Comprehensive build validation
- ✅ Automated testing with Playwright
- ✅ Security scanning and vulnerability checks
- ✅ Performance monitoring and bundle size analysis
- ✅ Detailed reporting with PR comments
- ✅ Artifact management and retention

**Jobs:**
- **Validate**: Configuration validation and skip logic
- **Code Quality**: TypeScript, ESLint, Prettier, spell check
- **Build**: Application building with output validation
- **Test**: Playwright test execution
- **Security**: Vulnerability scanning and secrets detection
- **Performance**: Bundle size and performance budget checks
- **Report**: Comprehensive status reporting

---

### 2. **Dependency Management** (`dependency-management.yml`)
Comprehensive dependency management workflow with Dependabot coordination.

**Triggers:**
- Pull requests affecting `package.json`, `package-lock.json`, or `.github/dependabot.yml`
- Manual dispatch with configurable actions

**Features:**
- ✅ Automated dependency auditing
- ✅ Security vulnerability scanning
- ✅ Outdated package detection
- ✅ Automated dependency updates
- ✅ Dependabot PR coordination
- ✅ Dependency cleanup and verification

**Actions:**
- **audit**: Security audit and outdated package check
- **update**: Automated dependency updates with PR creation
- **security-check**: Comprehensive security scanning
- **cleanup**: Dependency cleanup and fresh installation

---

### 3. **Release Management** (`release-management.yml`)
Complete release management workflow with versioning and changelog generation.

**Triggers:**
- Push of version tags (`v*`)
- Manual dispatch with release type selection

**Features:**
- ✅ Automated version bumping (patch/minor/major)
- ✅ Changelog generation from git history
- ✅ GitHub release creation with assets
- ✅ Source and build archive creation
- ✅ Draft and prerelease support
- ✅ Post-release tasks and notifications

**Release Types:**
- **patch**: Bug fixes and minor updates
- **minor**: New features (backward compatible)
- **major**: Breaking changes

---

### 4. **API Testing** (`api-testing.yml`)
Comprehensive testing of all API endpoints and functionality.

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` branch
- Manual dispatch

**Tests:**
- ✅ API Index and documentation endpoints
- ✅ Authentication (login/register)
- ✅ Bot management (CRUD operations)
- ✅ Bot chat functionality
- ✅ Analytics dashboard
- ✅ Webhook registration
- ✅ Error handling and validation

**Node.js Versions:** 18, 20

---

### 5. **LLM & Model Testing** (`llm-model-testing.yml`)
Testing of AI/ML model functionality and LLM integrations.

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` branch
- Manual dispatch

**Tests:**
- ✅ Model creation (text classification, sentiment analysis)
- ✅ Model listing and filtering
- ✅ Model training process
- ✅ Model status monitoring
- ✅ Model predictions
- ✅ Model updates and deletion
- ✅ LLM integration endpoints
- ✅ Error handling

**Node.js Versions:** 18, 20

---

### 6. **Pipeline Testing** (`pipeline-testing.yml`)
Testing of data pipeline functionality and execution.

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` branch
- Manual dispatch

**Tests:**
- ✅ Pipeline creation (data processing, ETL)
- ✅ Pipeline listing and filtering
- ✅ Pipeline execution
- ✅ Pipeline status monitoring
- ✅ Pipeline scheduling
- ✅ Pipeline validation
- ✅ Pipeline cloning and deletion
- ✅ Performance monitoring
- ✅ Error handling

**Node.js Versions:** 18, 20

---

### 7. **Bot Testing** (`bot-testing.yml`)
Comprehensive testing of bot functionality and interactions.

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` branch
- Manual dispatch

**Tests:**
- ✅ Bot creation (customer support, developer assistant, data analyst, content writer)
- ✅ Bot listing and filtering
- ✅ Bot configuration updates
- ✅ Bot activation and deployment
- ✅ Bot chat interactions
- ✅ Conversation history
- ✅ Bot testing functionality
- ✅ Bot cloning and deletion
- ✅ Performance monitoring
- ✅ Error handling

**Node.js Versions:** 18, 20

---

### 8. **Security Scan** (`security.yml`)
Comprehensive security scanning and vulnerability assessment.

**Triggers:**
- Weekly scheduled scans (Mondays at 2 AM UTC)
- Push to main branches
- Pull requests to main branches
- Manual dispatch with scan type selection

**Scans:**
- ✅ Dependency vulnerability scanning
- ✅ Code security analysis
- ✅ Secrets detection with TruffleHog
- ✅ Container security scanning
- ✅ License compliance checking
- ✅ Dangerous dependency detection

**Scan Types:**
- **all**: Complete security scan
- **dependencies**: Dependency vulnerability scan only
- **code**: Code security analysis only
- **containers**: Container security scan only
- **secrets**: Secrets detection only

---

### 9. **Maintenance** (`maintenance.yml`)
Automated maintenance tasks and cleanup operations.

**Triggers:**
- Weekly scheduled maintenance (Sundays at 3 AM UTC)
- Manual dispatch with task selection

**Tasks:**
- ✅ Dependency updates and PR creation
- ✅ Build artifact cleanup
- ✅ Cache cleanup and optimization
- ✅ Disk usage monitoring
- ✅ Dependency auditing and reporting

**Task Types:**
- **all**: Complete maintenance suite
- **dependencies**: Dependency management only
- **cleanup**: Cleanup operations only
- **audit**: Dependency auditing only

---

### 10. **Test Summary & Report** (`test-summary.yml`)
Generates comprehensive test reports and summaries.

**Triggers:**
- Automatically runs after completion of any test workflow
- Creates detailed test reports
- Uploads test artifacts
- Creates GitHub issues for failed tests
- Comments on pull requests with test results

---

### 11. **Deploy** (`deploy.yml`)
Application deployment workflow for staging and production.

**Triggers:**
- Push to `main`, `develop`, `production`, `application` branches
- Manual dispatch with environment selection

**Environments:**
- **staging**: Automated deployment to staging environment
- **production**: Production deployment with registry push

**Features:**
- ✅ Environment-specific builds
- ✅ Docker image creation and tagging
- ✅ Registry deployment (production)
- ✅ Build artifact management
- ✅ Version tracking and metadata

---

### 12. **Docker** (`docker.yml`)
Docker-specific workflows for container management.

**Features:**
- ✅ Docker image building
- ✅ Container testing
- ✅ Registry management
- ✅ Multi-platform support

## 🚀 How to Use

### Running Workflows Manually

1. **Go to Actions tab** in your GitHub repository
2. **Select the workflow** you want to run
3. **Click "Run workflow"**
4. **Choose branch and parameters** and click "Run workflow"

### Workflow Coordination

The workflows are designed to work together:

1. **Dependabot** creates PRs for dependency updates
2. **Dependency Management** validates and coordinates updates
3. **Enhanced CI** runs comprehensive checks on all changes
4. **Security** scans for vulnerabilities
5. **Testing** validates functionality
6. **Release Management** handles versioning and releases

### Environment Setup

Required secrets for full functionality:

```bash
# Docker Registry (for production deployment)
DOCKER_REGISTRY=your-registry.com
DOCKER_USERNAME=your-username
DOCKER_PASSWORD=your-password

# Supabase (for application builds)
NUXT_PUBLIC_SUPABASE_URL=your-supabase-url
NUXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# GitHub Token (automatically provided)
GITHUB_TOKEN=auto-provided
```

## 📊 Workflow Metrics

### Performance Targets
- **Build Time**: < 5 minutes
- **Test Execution**: < 10 minutes
- **Security Scan**: < 3 minutes
- **Total CI Time**: < 15 minutes

### Quality Gates
- ✅ All tests must pass
- ✅ No security vulnerabilities
- ✅ Code quality checks pass
- ✅ Performance budget met
- ✅ Documentation updated

## 🔧 Configuration

### Workflow Dependencies
- Node.js 18 & 20 support
- npm package management
- Playwright for testing
- Docker for containerization
- GitHub Actions v4

### Artifact Management
- Build artifacts: 7 days retention
- Test results: 30 days retention
- Security reports: 30 days retention
- Release assets: Permanent

## 📈 Monitoring & Reporting

### Automated Reports
- PR status comments
- Release notes generation
- Security vulnerability reports
- Performance metrics
- Test coverage summaries

### Notifications
- PR status updates
- Release notifications
- Security alerts
- Maintenance summaries

## 🛠️ Troubleshooting

### Common Issues
1. **Build Failures**: Check Node.js version compatibility
2. **Test Failures**: Verify test environment setup
3. **Security Issues**: Review vulnerability reports
4. **Performance Issues**: Check bundle size limits

### Debug Mode
Enable debug logging by setting `ACTIONS_STEP_DEBUG=true` in repository secrets.

---

*This workflow suite provides comprehensive CI/CD coverage for the Cloudless Wizard application, ensuring quality, security, and reliability throughout the development lifecycle.* 