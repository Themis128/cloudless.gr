# Docker Image Versioning System

This document explains the Docker image versioning system implemented for the Cloudless LLM Dev Agent project.

## Overview

The versioning system automatically generates multiple Docker image tags based on:
- Package version from `package.json`
- Git commit hash
- Git branch name
- Build timestamp

## Environment Variables Setup

### Using .env File (Recommended)

1. **Copy the example file:**
   ```bash
   cp env.example .env
   ```

2. **Edit .env with your credentials:**
   ```bash
   # Supabase Configuration
   NUXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NUXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   
   # Application Configuration
   NODE_ENV=production
   NITRO_HOST=0.0.0.0
   NITRO_PORT=3000
   NUXT_HOST=0.0.0.0
   NUXT_PORT=3000
   ```

3. **Deploy with .env file:**
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -EnvFile ".env"
   ```

### Using Environment Variables Directly

```bash
docker run -d --name cloudless-prod -p 3000:3000 \
  -e NUXT_PUBLIC_SUPABASE_URL=your-url \
  -e NUXT_PUBLIC_SUPABASE_ANON_KEY=your-key \
  -e SUPABASE_SERVICE_ROLE_KEY=your-service-key \
  cloudlessgr-app:v1.0.0
```

## Version Tags Generated

For each build, the following tags are automatically created:

1. **`cloudlessgr-app:latest`** - Latest version (always points to most recent build)
2. **`cloudlessgr-app:v1.0.0`** - Semantic version tag
3. **`cloudlessgr-app:v1.0.0-abc1234`** - Version with commit hash
4. **`cloudlessgr-app:main`** - Branch name tag
5. **`cloudlessgr-app:main-abc1234`** - Branch with commit hash

## Usage

### Building with Versioning

#### Using npm scripts (Recommended)

```bash
# Linux/macOS
npm run docker:build

# Windows PowerShell
npm run docker:build:win

# With registry prefix
npm run docker:build:registry

# Build and push to registry
npm run docker:build:push
```

#### Using scripts directly

```bash
# Linux/macOS
bash scripts/version.sh

# Windows PowerShell
powershell -ExecutionPolicy Bypass -File scripts/version.ps1
```

### Deployment with Versioning

#### Using the deployment script

```powershell
# Deploy latest version with .env file
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1

# Deploy specific version
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -Version "1.0.0"

# Deploy with build
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -Build

# Deploy to different environment
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -Environment "staging" -Port 3001

# Deploy with custom .env file
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -EnvFile ".env.production"
```

#### Manual deployment

```bash
# Run specific version
docker run -d --name cloudless-prod -p 3000:3000 cloudlessgr-app:v1.0.0

# Run with environment variables
docker run -d --name cloudless-prod -p 3000:3000 \
  -e NUXT_PUBLIC_SUPABASE_URL=your-url \
  -e NUXT_PUBLIC_SUPABASE_ANON_KEY=your-key \
  cloudlessgr-app:v1.0.0

# Run with .env file
docker run -d --name cloudless-prod -p 3000:3000 \
  --env-file .env \
  cloudlessgr-app:v1.0.0
```

## Build Arguments

The Dockerfile accepts the following build arguments:

- `VERSION` - Package version from package.json
- `GIT_COMMIT` - Short git commit hash
- `GIT_BRANCH` - Current git branch name
- `BUILD_DATE` - ISO timestamp of build

## Image Labels

Each image includes OpenContainers Initiative (OCI) labels:

```dockerfile
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
LABEL org.opencontainers.image.source="https://github.com/your-org/cloudless.gr"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.description="Cloudless LLM Dev Agent"
```

## Version Information Files

After building, version information is saved to:

- `.docker-version` - Contains build metadata
- `.deployment-info` - Contains deployment information

## CI/CD Integration

### GitHub Actions

The GitHub Actions workflow automatically:

1. Extracts version information from package.json and git
2. Builds images with multiple tags
3. Pushes to registry (if configured)
4. Creates deployment notifications with version details

### Registry Integration

To use with a Docker registry:

```bash
# Set registry in environment
export DOCKER_REGISTRY="your-registry.com"

# Build with registry prefix
npm run docker:build:registry

# Deploy with registry
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -Registry "your-registry.com"
```

## Version Management

### Rolling Back

To rollback to a previous version:

```bash
# List available versions
docker images cloudlessgr-app

# Rollback to specific version
docker stop cloudless-prod
docker rm cloudless-prod
docker run -d --name cloudless-prod -p 3000:3000 cloudlessgr-app:v0.9.0
```

### Cleanup

```bash
# Clean unused images
npm run docker:clean

# Clean all images (including versioned)
npm run docker:clean:all
```

## Best Practices

1. **Always use versioned tags** for production deployments
2. **Keep `latest` tag** for development and testing
3. **Use semantic versioning** in package.json
4. **Tag releases** in git when deploying to production
5. **Monitor image sizes** and clean up old versions regularly
6. **Use registry** for team collaboration and CI/CD
7. **Use .env files** for environment variables in development
8. **Never commit .env files** to version control (add to .gitignore)

## Troubleshooting

### Common Issues

1. **Version not found**: Ensure package.json has a valid version field
2. **Git information missing**: Ensure you're in a git repository
3. **Build fails**: Check Dockerfile build arguments are properly set
4. **Registry push fails**: Verify registry credentials and permissions
5. **Environment variables not loaded**: Check .env file exists and is properly formatted

### Debug Commands

```bash
# Check image labels
docker inspect cloudlessgr-app:v1.0.0 | grep -A 10 Labels

# View version information
cat .docker-version

# Check build history
docker history cloudlessgr-app:v1.0.0

# Check environment variables in container
docker exec cloudless-prod env

# View container logs
docker logs cloudless-prod
```

## Examples

### Development Workflow

```bash
# 1. Make changes and commit
git add .
git commit -m "Add new feature"
git push

# 2. Build versioned image
npm run docker:build:win

# 3. Test locally with .env file
docker run -d --name cloudless-dev -p 3001:3000 --env-file .env cloudlessgr-app:main-abc1234

# 4. Deploy to staging
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -Environment "staging" -Build
```

### Production Deployment

```bash
# 1. Update version in package.json
# 2. Create git tag
git tag v1.0.0
git push origin v1.0.0

# 3. Deploy to production with .env file
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -Environment "production" -Version "1.0.0" -EnvFile ".env.production"
```

This versioning system ensures traceability, reproducibility, and easy rollback capabilities for your Docker deployments. 