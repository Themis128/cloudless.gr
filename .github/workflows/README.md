# 🚀 GitHub Actions Workflows - Refactored

This directory contains the refactored GitHub Actions workflows for the Cloudless.gr project, designed with modularity, reusability, and maintainability in mind.

## 📋 Workflow Architecture

### 🏗️ **Reusable Components**
- **`reusable/ci-base.yml`** - Base CI workflow with validation, dependencies, security, and build
- **`reusable/deploy.yml`** - Reusable deployment workflow with Docker build and health checks

### 🚀 **Main Workflows**
- **`ci-cd.yml`** - Complete CI/CD pipeline using reusable components
- **`release.yml`** - Release management with versioning and deployment
- **`test.yml`** - Quick testing for development and PRs

## 🔄 **Workflow Overview**

### 🚀 **CI/CD Pipeline** (`ci-cd.yml`)
**Main workflow that orchestrates the entire CI/CD process using reusable components.**

**Triggers:**
- Push to `main`, `master`, `develop`, `application`, `platform`
- Pull requests to `main`, `develop`, `application`, `platform`
- Tags starting with `v*`
- Manual workflow dispatch

**Phases:**
1. **🔄 CI Pipeline** - Uses reusable `ci-base.yml`
   - Validation & Configuration
   - Dependency Management
   - Security & Quality Checks
   - Build & Test
2. **🚀 Deployment** - Uses reusable `deploy.yml`
   - Docker Build
   - Environment Deployment
   - Health Checks
   - Post-Deployment Validation
3. **🔄 Integration Tests** - Production-specific testing
4. **📋 Final Summary** - Complete pipeline summary

### 🚀 **Release Management** (`release.yml`)
**Handles versioning, changelog generation, and production releases.**

**Triggers:**
- Push tags starting with `v*`
- Manual workflow dispatch

**Features:**
- **📦 Version Management** - Automatic version bumping
- **🚀 Create Release** - GitHub release creation
- **🚀 Deploy Release** - Production deployment
- **📢 Notifications** - Release notifications
- **📋 Release Summary** - Complete release summary

### 🧪 **Quick Test** (`test.yml`)
**Fast testing workflow for development and pull requests.**

**Triggers:**
- Pull requests to main branches
- Manual workflow dispatch

**Test Types:**
- **all** - Run all tests
- **unit** - Unit tests only
- **integration** - Integration tests only
- **lint** - Linting only
- **type-check** - TypeScript checking only

## 🔧 **Reusable Components**

### **CI Base Workflow** (`reusable/ci-base.yml`)
**Reusable CI workflow that can be called by other workflows.**

**Inputs:**
- `environment` - Deployment environment (default: staging)
- `skip_tests` - Skip testing phases (default: false)
- `skip_deployment` - Skip deployment phase (default: false)
- `force_rebuild` - Force rebuild all caches (default: false)
- `runner_type` - Type of runner to use (default: self-hosted)

**Jobs:**
- **🔍 Validate Configuration** - Check configuration and changes
- **📦 Dependency Management** - Install and audit dependencies
- **🛡️ Security & Quality** - Linting, type checking, security scans
- **🏗️ Build & Test** - Application build and testing
- **📋 Pipeline Summary** - CI phase summary

### **Deployment Workflow** (`reusable/deploy.yml`)
**Reusable deployment workflow with Docker and health checks.**

**Inputs:**
- `environment` - Deployment environment (required)
- `docker_image` - Docker image to deploy (optional)
- `skip_docker` - Skip Docker build (default: false)
- `health_check_url` - Health check URL (optional)

**Jobs:**
- **🐳 Build Docker Image** - Multi-platform Docker build
- **🚀 Deploy to Environment** - Environment-specific deployment
- **📊 Post-Deployment Checks** - Validation and health checks
- **📋 Deployment Summary** - Deployment phase summary

## 🚀 **Usage**

### **Automatic Triggers**
Workflows run automatically on:
- **Push to `main`/`master`** → Full production deployment
- **Push to `develop`** → Staging deployment
- **Pull requests** → Quick testing
- **Tags** → Production release

### **Manual Triggers**

#### **CI/CD Pipeline**
```bash
# Trigger complete pipeline
gh workflow run ci-cd.yml

# Trigger with specific environment
gh workflow run ci-cd.yml -f environment=production

# Skip tests
gh workflow run ci-cd.yml -f skip_tests=true

# Skip deployment
gh workflow run ci-cd.yml -f skip_deployment=true

# Force rebuild
gh workflow run ci-cd.yml -f force_rebuild=true
```

#### **Release Management**
```bash
# Create patch release
gh workflow run release.yml -f release_type=patch

# Create minor release
gh workflow run release.yml -f release_type=minor

# Create major release
gh workflow run release.yml -f release_type=major

# Create prerelease
gh workflow run release.yml -f release_type=patch -f prerelease=true

# Create draft release
gh workflow run release.yml -f release_type=patch -f draft=true
```

#### **Quick Testing**
```bash
# Run all tests
gh workflow run test.yml

# Run specific test type
gh workflow run test.yml -f test_type=unit
gh workflow run test.yml -f test_type=lint
gh workflow run test.yml -f test_type=type-check
```

## 🔐 **Environment Variables**

### **Required for Production**
- `NUXT_PUBLIC_SUPABASE_URL`
- `NUXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

### **Optional**
- `SENTRY_DSN` - Error tracking
- `SESSION_SECRET` - Session encryption
- `JWT_SECRET` - JWT token signing

## 📊 **Monitoring & Health Checks**

### **Health Check Endpoints**
- **Production:** `https://cloudless.gr/api/health`
- **Staging:** `https://staging.cloudless.gr/api/health`

### **Metrics & Monitoring**
- Build performance metrics
- Test coverage reports
- Security scan results
- Deployment success rates
- Release tracking

## 🛠️ **Troubleshooting**

### **Common Issues**

#### **Build Failures**
1. Check Node.js version compatibility
2. Verify all dependencies are installed
3. Check for TypeScript compilation errors
4. Review build logs for specific errors

#### **Test Failures**
1. Ensure test environment is properly configured
2. Check API endpoints are accessible
3. Verify test data is available
4. Review test logs for specific failures

#### **Deployment Failures**
1. Validate environment variables are set
2. Check Docker image builds successfully
3. Verify target environment is accessible
4. Review deployment logs for specific errors

#### **Release Failures**
1. Check version bumping logic
2. Verify GitHub token permissions
3. Ensure production environment is configured
4. Review release creation logs

### **Debug Mode**
Enable debug logging by setting the secret `ACTIONS_STEP_DEBUG` to `true`.

## 🔄 **Workflow Optimization**

### **Caching Strategy**
- Node modules cached between runs
- Docker layers cached for faster builds
- Build artifacts cached for deployment
- Optimized cache keys for better hit rates

### **Parallel Execution**
- Tests run in parallel where possible
- Independent jobs run concurrently
- Optimized job dependencies

### **Resource Optimization**
- Use of self-hosted runners for better performance
- Efficient Docker layer caching
- Minimal dependency installation
- Optimized build processes

## 📚 **Migration Guide**

### **From Old Workflows**
The old workflows have been refactored into the new modular structure:

| Old Workflow | New Workflow | Notes |
|--------------|--------------|-------|
| `complete-pipeline-optimized.yml` | `ci-cd.yml` | Uses reusable components |
| `self-hosted-local-runner.yml` | `ci-cd.yml` | Consolidated into main pipeline |
| `release-management-local-runner.yml` | `release.yml` | Streamlined release process |
| `native-runner-optimized.yml` | `test.yml` | Quick testing for development |

### **Benefits of Refactoring**
- **🔄 Reusability** - Common patterns extracted into reusable workflows
- **📦 Modularity** - Clear separation of concerns
- **🛠️ Maintainability** - Easier to update and debug
- **⚡ Performance** - Optimized caching and parallel execution
- **📋 Clarity** - Better documentation and structure

## 🤝 **Contributing**

When modifying workflows:
1. **Test changes** in a fork first
2. **Update documentation** to reflect changes
3. **Follow existing patterns** for consistency
4. **Add appropriate error handling**
5. **Consider backward compatibility**
6. **Use reusable components** when possible

## 📞 **Support**

For workflow-related issues:
1. Check the troubleshooting section
2. Review workflow logs
3. Create an issue with detailed information
4. Contact the development team

## 🔗 **Related Documentation**

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Reusable Workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows)
- [Nuxt.js Deployment Guide](https://nuxt.com/docs/getting-started/deployment)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Security Best Practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions) 