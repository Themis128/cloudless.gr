# GitHub Actions Workflows

This directory contains all GitHub Actions workflows for the Cloudless.gr project.

## 📋 Available Workflows

### 🚀 Complete CI/CD Pipeline (`complete-pipeline.yml`)
**Main workflow that handles the entire CI/CD process sequentially.**

**Triggers:**
- Push to `main`, `master`, `develop`, `application`, `platform`
- Pull requests to `main`, `develop`, `application`, `platform`
- Tags starting with `v*`
- Manual workflow dispatch

**Phases:**
1. **Validation** - Check configuration and critical files
2. **Dependency Audit** - Security audit of dependencies
3. **Security Scan** - Code and secrets scanning
4. **Code Quality** - Linting and type checking
5. **Build & Test** - Application build and testing
6. **API Testing** - Endpoint testing
7. **Bot Testing** - Bot functionality testing
8. **Pipeline Testing** - Pipeline execution testing
9. **LLM Testing** - Model training and testing
10. **Docker Build** - Container build and test
11. **Deployment** - Staging/Production deployment
12. **Post-Deployment** - Security and monitoring
13. **Summary** - Complete pipeline summary

### 📦 Release Management (`release-management.yml`)
**Handles versioning, changelog generation, and release creation.**

## 🔧 Configuration Files

### Environment Configurations
- `.github/environments/production.yml` - Production environment settings
- `.github/environments/staging.yml` - Staging environment settings

### Reusable Actions
- `.github/actions/cache-config.yml` - Caching configuration for builds

### Helper Scripts
- `.github/scripts/workflow-helpers.sh` - Common workflow functions
- `.github/scripts/custom-secrets-scan.sh` - Custom secrets scanning

## 🚀 Usage

### Automatic Triggers
Workflows run automatically on:
- **Push to `main`/`master`** → Full production deployment
- **Push to `develop`** → Staging deployment
- **Pull requests** → Full testing pipeline
- **Tags** → Production release

### Manual Triggers
You can manually trigger workflows with custom options:

```bash
# Trigger complete pipeline
gh workflow run complete-pipeline.yml

# Trigger with specific environment
gh workflow run complete-pipeline.yml -f environment=production

# Skip tests
gh workflow run complete-pipeline.yml -f skip_tests=true

# Skip deployment
gh workflow run complete-pipeline.yml -f skip_deployment=true
```

## 🔐 Environment Variables

### Required for Production
- `NUXT_PUBLIC_SUPABASE_URL`
- `NUXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

### Optional
- `SENTRY_DSN` - Error tracking
- `SESSION_SECRET` - Session encryption
- `JWT_SECRET` - JWT token signing

## 📊 Monitoring

### Health Checks
- Application health endpoint: `/api/health`
- Docker container health checks
- Database connectivity tests

### Metrics
- Build performance metrics
- Test coverage reports
- Security scan results
- Deployment success rates

## 🛠️ Troubleshooting

### Common Issues

#### Build Failures
1. Check Node.js version compatibility
2. Verify all dependencies are installed
3. Check for TypeScript compilation errors

#### Test Failures
1. Ensure test environment is properly configured
2. Check API endpoints are accessible
3. Verify test data is available

#### Deployment Failures
1. Validate environment variables are set
2. Check Docker image builds successfully
3. Verify target environment is accessible

### Debug Mode
Enable debug logging by setting the secret `ACTIONS_STEP_DEBUG` to `true`.

## 🔄 Workflow Optimization

### Caching Strategy
- Node modules cached between runs
- Docker layers cached for faster builds
- Build artifacts cached for deployment

### Parallel Execution
- Tests run in parallel where possible
- Matrix builds for multiple Node.js versions
- Concurrent job execution for independent tasks

### Resource Optimization
- Use of GitHub-hosted runners
- Efficient Docker layer caching
- Minimal dependency installation

## 📚 Related Documentation

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Nuxt.js Deployment Guide](https://nuxt.com/docs/getting-started/deployment)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Security Best Practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)

## 🤝 Contributing

When modifying workflows:
1. Test changes in a fork first
2. Update documentation
3. Follow the existing patterns
4. Add appropriate error handling
5. Consider backward compatibility

## 📞 Support

For workflow-related issues:
1. Check the troubleshooting section
2. Review workflow logs
3. Create an issue with detailed information
4. Contact the development team 