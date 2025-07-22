# Production Environment Setup with GitHub Secrets

This guide explains how to set up production environment variables using GitHub secrets for secure deployment of the Cloudless application.

## Overview

The production environment uses GitHub secrets to securely store sensitive configuration values like API keys and database credentials. This ensures that sensitive data is never exposed in the codebase or logs.

## Required GitHub Secrets

### Application Configuration

- `NODE_ENV` - Production environment setting
- `NUXT_HOST` - Host configuration (0.0.0.0)
- `NUXT_PORT` - Port configuration (3000)

### Database Configuration

- `DATABASE_URL` - Production database connection string

### Redis Configuration

- `REDIS_URL` - Production Redis connection string
- `REDIS_MAX_MEMORY` - Redis max memory limit (e.g., 256mb)
- `REDIS_PASSWORD` - Redis password for production

### External API Keys

- `OPENAI_API_KEY` - Your OpenAI API key
- `ANTHROPIC_API_KEY` - Your Anthropic API key

### Security

- `SESSION_SECRET` - Random session secret for production
- `JWT_SECRET` - Random JWT secret for production

### Monitoring

- `SENTRY_DSN` - Your Sentry DSN for error tracking

### Docker Configuration

- `DOCKER_REGISTRY` - Your Docker registry URL (optional)
- `IMAGE_TAG` - Docker image tag (e.g., latest, v1.0.0)

## Setup Instructions

### 1. Automated Setup (Recommended)

Use the provided PowerShell script to set up all required secrets:

```powershell
# Run the setup script
.\scripts\setup-github-secrets-production.ps1

# Or with specific repository details
.\scripts\setup-github-secrets-production.ps1 -RepoOwner "your-username" -RepoName "cloudless.gr"
```

The script will:

- Check if GitHub CLI is installed and authenticated
- Display current secrets status
- Guide you through setting up missing secrets
- Provide sample workflow configuration

### 2. Manual Setup

If you prefer to set up secrets manually:

1. Go to your GitHub repository
2. Navigate to Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Add each required secret with its corresponding value

### 3. Generate Secure Secrets

For security-related secrets, generate secure random strings:

```bash
# Generate session secret
openssl rand -base64 32

# Generate JWT secret
openssl rand -base64 64
```

## Production Deployment

### GitHub Actions Workflow

The `.github/workflows/deploy-production.yml` workflow automatically:

1. Builds the Docker image with production configuration
2. Pushes the image to GitHub Container Registry
3. Creates a production environment file from secrets
4. Provides deployment instructions

### Manual Deployment Steps

1. **Set up production server environment:**

   ```bash
   # Copy the production environment file
   scp .env.production user@your-server:/path/to/app/

   # Or create it manually on the server
   nano .env.production
   ```

2. **Deploy using Docker Compose:**

   ```bash
   # Pull the latest image
   docker pull ghcr.io/your-username/cloudless.gr:latest

   # Start production containers
   docker-compose -f docker-compose.prod.yml up -d

   # Check container status
   docker-compose -f docker-compose.prod.yml ps
   ```

3. **Verify deployment:**

   ```bash
   # Check application health
   curl http://your-domain/api/health

   # Check container logs
   docker-compose -f docker-compose.prod.yml logs app
   ```

## Environment File Structure

The production environment file (`.env.production`) contains:

```bash
# Application Configuration
NODE_ENV=production
NITRO_HOST=0.0.0.0
NITRO_PORT=3000
NUXT_HOST=0.0.0.0
NUXT_PORT=3000

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database

# Redis Configuration
REDIS_URL=redis://username:password@host:port
REDIS_MAX_MEMORY=256mb
REDIS_PASSWORD=your-redis-password

# External API Keys
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# Security
SESSION_SECRET=your-session-secret
JWT_SECRET=your-jwt-secret

# Monitoring
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=info

# Docker Configuration
DOCKER_REGISTRY=ghcr.io
IMAGE_TAG=latest
APP_PORT=3000

# Nginx Configuration
NGINX_PORT=80
NGINX_SSL_PORT=443

# Application Metadata
APP_VERSION=1.0.0
GIT_COMMIT=abc123
BUILD_DATE=2024-01-01T00:00:00Z
```

## Security Best Practices

1. **Never commit secrets to version control**
   - Use `.gitignore` to exclude `.env` files
   - Use GitHub secrets for all sensitive data

2. **Rotate secrets regularly**
   - Update API keys periodically
   - Regenerate session and JWT secrets

3. **Use least privilege principle**
   - Only grant necessary permissions to API keys
   - Use separate keys for different environments

4. **Monitor secret usage**
   - Set up alerts for unusual API usage
   - Monitor application logs for errors

5. **Backup secrets securely**
   - Store backup copies in a secure location
   - Use encrypted storage for backup files

## Troubleshooting

### Common Issues

1. **Missing environment variables:**

   ```bash
   # Check if all required variables are set
   docker-compose -f docker-compose.prod.yml config
   ```

2. **Database connection issues:**

   ```bash
   # Test database connection
   npx prisma db push
   ```

3. **Redis connection issues:**

   ```bash
   # Test Redis connection
   redis-cli -h your-redis-host -p 6379 -a your-password ping
   ```

4. **Container health check failures:**

   ```bash
   # Check container logs
   docker-compose -f docker-compose.prod.yml logs app

   # Check health endpoint
   curl http://localhost:3000/api/health
   ```

### Debug Commands

```bash
# Check environment variables in container
docker exec cloudlessgr-app-prod env | grep -E "(DATABASE|REDIS)"

# Check application logs
docker-compose -f docker-compose.prod.yml logs -f app

# Check container status
docker-compose -f docker-compose.prod.yml ps

# Restart containers
docker-compose -f docker-compose.prod.yml restart
```

## Monitoring and Maintenance

1. **Set up monitoring:**
   - Configure Sentry for error tracking
   - Set up application performance monitoring
   - Monitor resource usage

2. **Regular maintenance:**
   - Update dependencies regularly
   - Monitor security advisories
   - Backup data regularly

3. **Health checks:**
   - Monitor application health endpoint
   - Set up automated health checks
   - Configure alerts for failures

## Support

If you encounter issues with the production setup:

1. Check the troubleshooting section above
2. Review the application logs
3. Verify all environment variables are set correctly
4. Test individual services (database, Redis, etc.)
5. Check the GitHub Actions workflow logs

For additional help, refer to the main documentation or create an issue in the repository.
