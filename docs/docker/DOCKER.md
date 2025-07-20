# Docker Deployment Guide

This guide covers Docker deployment for the Cloudless Nuxt 3 application, including development, staging, and production environments.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Docker Images](#docker-images)
- [Docker Compose](#docker-compose)
- [Deployment Scripts](#deployment-scripts)
- [Environment Configuration](#environment-configuration)
- [Production Deployment](#production-deployment)
- [Monitoring & Logging](#monitoring--logging)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)

## 🚀 Quick Start

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB RAM available

### Development Environment
```bash
# Clone the repository
git clone <repository-url>
cd cloudless.gr

# Start development environment
docker-compose --profile development up -d

# Access the application
open http://localhost:3000
```

### Production Environment
```bash
# Deploy to production
./scripts/deploy.sh production

# Or use Docker Compose directly
docker-compose -f docker-compose.prod.yml up -d
```

## 🐳 Docker Images

### Production Image (`Dockerfile`)
Multi-stage build optimized for production:

```dockerfile
# Build stage
FROM node:20-alpine AS builder
# ... build process

# Production stage
FROM node:20-alpine AS runner
# ... minimal runtime
```

**Features:**
- Multi-stage build for smaller image size
- Non-root user for security
- Optimized for production performance
- Health check integration

### Development Image (`Dockerfile.dev`)
Single-stage build for development:

```dockerfile
FROM node:20-alpine
# ... development setup with hot reload
```

**Features:**
- Hot reload support
- Development dependencies included
- Volume mounting for live code changes

## 🐙 Docker Compose

### Basic Configuration (`docker-compose.yml`)
```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:3000/health"]
```

### Production Configuration (`docker-compose.prod.yml`)
```yaml
services:
  app:
    build: .
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
    # ... production optimizations

  nginx:
    image: nginx:alpine
    # ... reverse proxy configuration

  redis:
    image: redis:7-alpine
    # ... caching layer
```

## 📜 Deployment Scripts

### Main Deployment Script (`scripts/deploy.sh`)
```bash
# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production
./scripts/deploy.sh production v1.2.3

# Rollback
./scripts/deploy.sh rollback

# Cleanup
./scripts/deploy.sh cleanup
```

**Features:**
- Environment-specific deployments
- Docker registry integration
- Health checks
- Automatic cleanup
- Rollback capability

### Database Backup Script (`scripts/backup.sh`)
```bash
# Create backup
./scripts/backup.sh backup

# List backups
./scripts/backup.sh list

# Verify backups
./scripts/backup.sh verify

# Clean old backups
./scripts/backup.sh cleanup
```

## ⚙️ Environment Configuration

### Environment Variables
Create `.env` file for your environment:

```env
# Application
NODE_ENV=production
NUXT_HOST=0.0.0.0
NUXT_PORT=3000

# Supabase
NUXT_PUBLIC_SUPABASE_URL=your-supabase-url
NUXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key

# Database (if using PostgreSQL)
POSTGRES_PASSWORD=your-secure-password

# Docker Registry
DOCKER_REGISTRY=your-registry.com
DOCKER_USERNAME=your-username
DOCKER_PASSWORD=your-password

# Monitoring
GRAFANA_PASSWORD=your-grafana-password
```

### SSL Configuration
For HTTPS support, place SSL certificates in `nginx/ssl/`:

```bash
# Generate self-signed certificate (development)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem

# Or use Let's Encrypt certificates (production)
```

## 🏭 Production Deployment

### 1. Prepare Environment
```bash
# Set up environment variables
cp .env.example .env
# Edit .env with your production values

# Create necessary directories
mkdir -p logs backups uploads nginx/ssl
```

### 2. Deploy Application
```bash
# Deploy with monitoring
docker-compose -f docker-compose.prod.yml --profile monitoring up -d

# Or use deployment script
./scripts/deploy.sh production
```

### 3. Verify Deployment
```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# Check application health
curl http://localhost/health

# View logs
docker-compose -f docker-compose.prod.yml logs -f app
```

### 4. Scale Application
```bash
# Scale application containers
docker-compose -f docker-compose.prod.yml up -d --scale app=3
```

## 📊 Monitoring & Logging

### Prometheus Configuration
```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'cloudless-app'
    static_configs:
      - targets: ['app:3000']
```

### Grafana Dashboards
Access Grafana at `http://localhost:3001`:
- Username: `admin`
- Password: Set via `GRAFANA_PASSWORD` environment variable

### Log Management
```bash
# View application logs
docker-compose logs -f app

# View nginx logs
docker-compose logs -f nginx

# View all logs
docker-compose logs -f

# Export logs
docker-compose logs app > app.log
```

## 💾 Backup & Recovery

### Automated Backups
```bash
# Run backup manually
docker-compose -f docker-compose.prod.yml run --rm backup

# Schedule daily backups (cron)
0 2 * * * cd /path/to/cloudless && docker-compose -f docker-compose.prod.yml run --rm backup
```

### Database Recovery
```bash
# Restore from backup
gunzip -c backups/cloudless_backup_20231201_120000.sql.gz | \
  docker-compose -f docker-compose.prod.yml exec -T postgres psql -U cloudless_user -d cloudless
```

### Volume Backups
```bash
# Backup volumes
docker run --rm -v cloudless_postgres_data:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres_data_$(date +%Y%m%d).tar.gz -C /data .

# Restore volumes
docker run --rm -v cloudless_postgres_data:/data -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/postgres_data_20231201.tar.gz -C /data
```

## 🔧 Troubleshooting

### Common Issues

#### Container Won't Start
```bash
# Check container logs
docker-compose logs app

# Check resource usage
docker stats

# Verify environment variables
docker-compose config
```

#### Application Not Responding
```bash
# Check health status
curl http://localhost:3000/health

# Check container status
docker-compose ps

# Restart application
docker-compose restart app
```

#### Database Connection Issues
```bash
# Check database container
docker-compose logs postgres

# Test database connection
docker-compose exec postgres psql -U cloudless_user -d cloudless -c "SELECT 1;"
```

#### SSL Certificate Issues
```bash
# Check nginx configuration
docker-compose exec nginx nginx -t

# Reload nginx configuration
docker-compose exec nginx nginx -s reload
```

### Performance Optimization

#### Resource Limits
```yaml
# docker-compose.prod.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 512M
          cpus: '0.25'
```

#### Caching Strategy
```yaml
# Redis configuration
redis:
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

#### Nginx Optimization
```nginx
# nginx/nginx.conf
gzip on;
gzip_comp_level 6;
client_max_body_size 100M;
```

## 🔒 Security Considerations

### Container Security
- Non-root user in production containers
- Read-only filesystem where possible
- Resource limits to prevent DoS
- Regular security updates

### Network Security
- Internal Docker networks
- Firewall rules for external access
- SSL/TLS encryption
- Rate limiting

### Data Security
- Encrypted volumes for sensitive data
- Regular backups with encryption
- Secure environment variable management
- Access control and logging

## 📚 Additional Resources

### Useful Commands
```bash
# View running containers
docker ps

# Execute commands in container
docker-compose exec app sh

# View resource usage
docker stats

# Clean up unused resources
docker system prune -a

# Update images
docker-compose pull

# Rebuild images
docker-compose build --no-cache
```

### Monitoring Commands
```bash
# Check application metrics
curl http://localhost:3000/metrics

# Monitor logs in real-time
docker-compose logs -f --tail=100

# Check disk usage
docker system df
```

### Maintenance Commands
```bash
# Update all images
docker-compose pull && docker-compose up -d

# Backup before update
./scripts/backup.sh backup

# Rollback if needed
./scripts/deploy.sh rollback
```

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review container logs: `docker-compose logs`
3. Verify configuration: `docker-compose config`
4. Check GitHub Issues for known problems
5. Create a new issue with detailed information

---

**Note:** This Docker setup is optimized for self-hosted deployments. For cloud deployments, consider using managed container services like AWS ECS, Google Cloud Run, or Azure Container Instances. 