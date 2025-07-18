# Docker Best Practices & Environment Management

This document outlines the best practices implemented for Docker containerization and environment variable management in the Cloudless LLM Dev Agent project.

## 🏗️ Architecture Overview

### Development Environment (`docker-compose.dev.yml`)

- **Purpose**: Local development with hot reloading
- **Features**:
  - Source code mounting for live updates
  - Development tools (Redis Commander, Adminer, Mailhog)
  - Debugging support
  - Optional database and email testing

### Production Environment (`docker-compose.prod.yml`)

- **Purpose**: Production deployments with security and scalability
- **Features**:
  - Environment variables from GitHub secrets
  - Resource limits and health checks
  - Optional Nginx reverse proxy
  - External service integration

## 🔐 Environment Variable Management

### Development (.env file)

For local development, create a `.env` file based on `env.example`:

```bash
cp env.example .env
```

### Production (GitHub Secrets)

All production environment variables are stored in GitHub repository secrets:

#### Required Secrets

```yaml
# Supabase Configuration
NUXT_PUBLIC_SUPABASE_URL: https://your-project.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY: your-anon-key
SUPABASE_SERVICE_ROLE_KEY: your-service-role-key

# Database Configuration
DATABASE_URL: postgresql://username:password@host:port/database

# Redis Configuration
REDIS_URL: redis://username:password@host:port
REDIS_PASSWORD: your-redis-password

# External API Keys
OPENAI_API_KEY: your-openai-key
ANTHROPIC_API_KEY: your-anthropic-key

# Security
SESSION_SECRET: your-session-secret
JWT_SECRET: your-jwt-secret

# Docker Registry
DOCKER_REGISTRY: your-registry.com
DOCKER_USERNAME: your-username
DOCKER_PASSWORD: your-password

# Monitoring
SENTRY_DSN: your-sentry-dsn
```

#### Optional Secrets

```yaml
# Application Configuration
LOG_LEVEL: info
APP_PORT: 3000

# Nginx Configuration
NGINX_PORT: 80
NGINX_SSL_PORT: 443

# Redis Configuration
REDIS_MAX_MEMORY: 256mb
```

## 🚀 Deployment Workflow

### GitHub Actions Pipeline

1. **Build Stage**
   - Install dependencies
   - Build application with production environment variables
   - Create Docker images with versioning

2. **Deploy Stage**
   - Push images to Docker registry
   - Deploy infrastructure using Docker Compose
   - Set environment variables from GitHub secrets

### Environment-Specific Deployments

#### Staging

- Triggered on `develop` branch
- Uses staging environment secrets
- Deploys to staging infrastructure

#### Production

- Triggered on `main` or `production` branch
- Uses production environment secrets
- Includes infrastructure deployment

## 🛠️ Development Commands

### Starting Development Environment

```bash
# Start all services
./scripts/dev-docker.ps1 start

# Start with database
./scripts/dev-docker.ps1 start database

# Start with email testing
./scripts/dev-docker.ps1 start email

# Start with debugging
./scripts/dev-docker.ps1 debug
```

### Management Commands

```bash
# View logs
./scripts/dev-docker.ps1 logs

# Access container shell
./scripts/dev-docker.ps1 shell

# Run tests
./scripts/dev-docker.ps1 test

# Lint code
./scripts/dev-docker.ps1 lint

# Format code
./scripts/dev-docker.ps1 format

# Check status
./scripts/dev-docker.ps1 status

# Stop environment
./scripts/dev-docker.ps1 stop

# Clean environment
./scripts/dev-docker.ps1 clean
```

## 🔒 Security Best Practices

### Container Security

- **Non-root users**: All containers run as non-root users
- **Resource limits**: CPU and memory limits defined
- **Health checks**: All services include health checks
- **Network isolation**: Separate networks for dev and prod

### Environment Variables

- **No hardcoded secrets**: All secrets come from environment variables
- **GitHub secrets**: Production secrets stored in GitHub repository secrets
- **Environment separation**: Different secrets for staging and production
- **Secret rotation**: Regular secret rotation recommended

### Network Security

- **Internal communication**: Services communicate via internal Docker networks
- **Port exposure**: Minimal port exposure (only necessary ports)
- **SSL/TLS**: Production deployments support SSL termination

## 📊 Monitoring & Logging

### Health Checks

All services include health checks:

```yaml
healthcheck:
  test:
    [
      'CMD',
      'wget',
      '--no-verbose',
      '--tries=1',
      '--spider',
      'http://localhost:3000/api/health',
    ]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 60s
```

### Logging

- **Structured logging**: Application logs in structured format
- **Log levels**: Configurable log levels via `LOG_LEVEL`
- **Log persistence**: Logs mounted to host for persistence
- **External monitoring**: Sentry integration for error tracking

## 🔧 Configuration Management

### Environment-Specific Configs

- **Development**: Uses `.env` file with development defaults
- **Production**: Uses GitHub secrets with production values
- **Staging**: Uses staging-specific secrets

### Service Dependencies

```yaml
depends_on:
  redis-dev:
    condition: service_healthy
  postgres-dev:
    condition: service_healthy
```

### Resource Management

```yaml
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '0.5'
    reservations:
      memory: 512M
      cpus: '0.25'
```

## 🚨 Troubleshooting

### Common Issues

#### Port Conflicts

If you encounter port conflicts:

```bash
# Check what's using the port
netstat -ano | findstr :3000

# Stop conflicting services
./scripts/dev-docker.ps1 stop
```

#### Environment Variables

If environment variables aren't loading:

```bash
# Check .env file exists
ls -la .env

# Verify environment variables
docker-compose -f docker-compose.dev.yml config
```

#### Container Health

Check container health:

```bash
# View container status
./scripts/dev-docker.ps1 status

# Check logs
./scripts/dev-docker.ps1 logs
```

## 📝 Best Practices Summary

1. **Environment Separation**: Clear separation between development and production
2. **Secret Management**: All secrets stored in GitHub secrets
3. **Security First**: Non-root containers, resource limits, health checks
4. **Monitoring**: Comprehensive health checks and logging
5. **Documentation**: Clear documentation and examples
6. **Automation**: Automated deployment pipeline
7. **Versioning**: Proper Docker image versioning
8. **Resource Management**: Defined resource limits and reservations

## 🔄 Continuous Improvement

- Regular security updates for base images
- Performance monitoring and optimization
- Automated testing in CI/CD pipeline
- Regular backup and disaster recovery testing
- Documentation updates with new features
