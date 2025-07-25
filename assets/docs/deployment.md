# Deployment Guide

Comprehensive guide for deploying the Nuxt.js application to production environments including setup, configuration, monitoring, and maintenance procedures.

## Overview

This guide covers:

- **Production Deployment**: Server setup and application deployment
- **Environment Configuration**: Production environment variables and secrets
- **Database Deployment**: Production database setup and migrations
- **Monitoring & Logging**: Application monitoring and error tracking
- **CI/CD Pipeline**: Automated deployment workflows
- **Scaling & Performance**: Performance optimization and scaling strategies

## Production Architecture

### Recommended Stack

- **Application Server**: Node.js 18+ with PM2
- **Web Server**: Nginx (reverse proxy + static files)
- **Database**: PostgreSQL (production) or SQLite (small deployments)
- **Redis**: Session storage and caching
- **SSL**: Let's Encrypt certificates
- **Monitoring**: PM2, New Relic, or DataDog

### Server Requirements

- **RAM**: Minimum 2GB, Recommended 4GB+
- **CPU**: 2+ cores
- **Storage**: 20GB+ SSD
- **OS**: Ubuntu 20.04+ or CentOS 8+
- **Node.js**: 18.x LTS
- **Database**: PostgreSQL 13+ or SQLite 3.35+

## Environment Setup

### Production Environment Variables

Create a production `.env` file with secure values:

```bash
# Application
NODE_ENV="production"
NUXT_HOST="0.0.0.0"
NUXT_PORT="3000"
BASE_URL="https://yourdomain.com"

# Database (PostgreSQL for production)
DATABASE_URL="postgresql://username:password@localhost:5432/dbname"
DIRECT_URL="postgresql://username:password@localhost:5432/dbname"

# Authentication (Use strong, unique secrets!)
JWT_SECRET="your-production-jwt-secret-256-bits-minimum"
JWT_EXPIRES_IN="7d"
SESSION_SECRET="your-production-session-secret"

# SMTP (Production email service)
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="apikey"
SMTP_PASS="your-sendgrid-api-key"
EMAIL_FROM="noreply@yourdomain.com"
EMAIL_TO="admin@yourdomain.com"

# LLM (Production API keys)
OPENAI_API_KEY="sk-your-production-openai-key"
ANTHROPIC_API_KEY="sk-ant-your-production-anthropic-key"

# Admin (Change default credentials!)
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="your-secure-admin-password"

# Security
CSRF_SECRET="your-csrf-secret-production"
RATE_LIMIT_WINDOW="15"
RATE_LIMIT_MAX="1000"

# Redis (for session storage and caching)
REDIS_URL="redis://localhost:6379"

# Analytics
GOOGLE_ANALYTICS_ID="GA_MEASUREMENT_ID"
PLAUSIBLE_DOMAIN="yourdomain.com"

# Error Tracking
SENTRY_DSN="your-sentry-dsn"
NEW_RELIC_LICENSE_KEY="your-newrelic-key"

# File Storage (if using external storage)
AWS_ACCESS_KEY_ID="your-aws-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret"
AWS_REGION="us-east-1"
AWS_BUCKET="your-s3-bucket"

# CDN
CDN_URL="https://cdn.yourdomain.com"
```

### Secrets Management

Use a secrets management system in production:

```bash
# Using Docker Secrets
echo "your-jwt-secret" | docker secret create jwt_secret -

# Using Kubernetes Secrets
kubectl create secret generic app-secrets \
  --from-literal=jwt-secret="your-jwt-secret" \
  --from-literal=db-password="your-db-password"

# Using HashiCorp Vault
vault kv put secret/app/prod \
  jwt_secret="your-jwt-secret" \
  db_password="your-db-password"
```

## Database Deployment

### PostgreSQL Setup

#### Installation

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create application database and user
sudo -u postgres psql
CREATE DATABASE myapp_production;
CREATE USER myapp_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE myapp_production TO myapp_user;
\q
```

#### Database Configuration

```bash
# Update PostgreSQL configuration
sudo nano /etc/postgresql/13/main/postgresql.conf

# Key settings:
listen_addresses = 'localhost'
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB

# Update authentication
sudo nano /etc/postgresql/13/main/pg_hba.conf

# Add line for application user:
local   myapp_production    myapp_user                      md5
```

### Database Migrations

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# Seed production data (optional)
NODE_ENV=production npx prisma db seed

# Backup script
#!/bin/bash
pg_dump myapp_production > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Application Deployment

### Build Process

```bash
# Install dependencies
npm ci --production=false

# Build application
npm run build

# Install only production dependencies
rm -rf node_modules
npm ci --production

# Generate Prisma client for production
npx prisma generate
```

### PM2 Configuration

**Location**: `ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'cloudless-app',
      script: '.output/server/index.mjs',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        NUXT_HOST: '0.0.0.0',
        NUXT_PORT: '3000',
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=2048',
    },
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'https://github.com/username/cloudless.gr.git',
      path: '/var/www/cloudless',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
    },
  },
};
```

### Nginx Configuration

**Location**: `/etc/nginx/sites-available/cloudless`

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Static Files
    location /_nuxt/ {
        alias /var/www/cloudless/current/.output/public/_nuxt/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /assets/ {
        alias /var/www/cloudless/current/.output/public/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API Routes (longer timeout for LLM)
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Application
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Security
    location ~ /\. {
        deny all;
    }

    location ~* \.(env|git)$ {
        deny all;
        return 404;
    }
}
```

### SSL Certificate Setup

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal setup
sudo crontab -e
# Add line:
0 12 * * * /usr/bin/certbot renew --quiet
```

## Docker Deployment

### Dockerfile for Production

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma/ ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install dumb-init for signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nuxt -u 1001

# Copy built application
COPY --from=builder --chown=nuxt:nodejs /app/.output ./
COPY --from=builder --chown=nuxt:nodejs /app/package.json ./

# Install production dependencies
RUN npm ci --production && npm cache clean --force

USER nuxt

EXPOSE 3000

ENV NODE_ENV=production

CMD ["dumb-init", "node", "server/index.mjs"]
```

### Docker Compose for Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/myapp
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - ./uploads:/app/uploads
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - '5432:5432'
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

## CI/CD Pipeline

### GitHub Actions Deployment

**Location**: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:run

      - name: Run E2E tests
        run: npm run e2e:headless

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build
        env:
          NODE_ENV: production

      - name: Deploy to server
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /var/www/cloudless
            git pull origin main
            npm ci
            npm run build
            npx prisma generate
            npx prisma db push
            pm2 reload ecosystem.config.js

      - name: Health check
        run: |
          sleep 30
          curl -f ${{ secrets.PRODUCTION_URL }}/api/health
```

### Deployment Script

**Location**: `scripts/deploy.sh`

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Configuration
APP_DIR="/var/www/cloudless"
SERVICE_NAME="cloudless-app"
BACKUP_DIR="/var/backups/cloudless"

# Create backup
echo "📦 Creating backup..."
mkdir -p $BACKUP_DIR
pg_dump myapp_production > $BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql

# Pull latest code
echo "📥 Pulling latest code..."
cd $APP_DIR
git pull origin main

# Install dependencies
echo "📚 Installing dependencies..."
npm ci --production=false

# Build application
echo "🔨 Building application..."
npm run build

# Install production dependencies only
echo "🧹 Cleaning up dev dependencies..."
rm -rf node_modules
npm ci --production

# Generate Prisma client
echo "🗄️ Updating database client..."
npx prisma generate

# Run database migrations
echo "🗃️ Running database migrations..."
npx prisma db push

# Reload application
echo "🔄 Reloading application..."
pm2 reload $SERVICE_NAME

# Health check
echo "🏥 Running health check..."
sleep 10
if curl -f http://localhost:3000/api/health; then
  echo "✅ Deployment successful!"
else
  echo "❌ Health check failed!"
  exit 1
fi

echo "🎉 Deployment completed successfully!"
```

## Monitoring & Logging

### Application Monitoring

#### PM2 Monitoring

```bash
# Install PM2
npm install -g pm2

# Start application with monitoring
pm2 start ecosystem.config.js

# Monitor logs
pm2 logs cloudless-app

# Monitor performance
pm2 monit

# Save PM2 configuration
pm2 save
pm2 startup
```

#### Health Check Endpoint

```typescript
// server/api/health.ts
export default defineEventHandler(async (event) => {
  try {
    // Check database connection
    const dbStatus = await checkDatabaseConnection();

    // Check Redis connection
    const redisStatus = await checkRedisConnection();

    // Check LLM service
    const llmStatus = await checkLLMService();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version,
      uptime: process.uptime(),
      services: {
        database: dbStatus ? 'healthy' : 'unhealthy',
        redis: redisStatus ? 'healthy' : 'unhealthy',
        llm: llmStatus ? 'healthy' : 'unhealthy',
      },
    };
  } catch (error) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Service unavailable',
    });
  }
});
```

### Error Tracking with Sentry

```typescript
// plugins/sentry.client.ts
import * as Sentry from '@sentry/nuxt';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  integrations: [new Sentry.BrowserTracing()],
});
```

### Log Management

```bash
# Logrotate configuration
# /etc/logrotate.d/cloudless
/var/www/cloudless/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 deploy deploy
    postrotate
        pm2 reloadLogs
    endscript
}
```

## Security Hardening

### Server Security

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Configure firewall
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
# Set: PasswordAuthentication no
sudo systemctl reload ssh

# Install fail2ban
sudo apt install fail2ban
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Application Security

```typescript
// server/middleware/security.ts
export default defineEventHandler(async (event) => {
  // Security headers
  setHeader(event, 'X-Content-Type-Options', 'nosniff');
  setHeader(event, 'X-Frame-Options', 'DENY');
  setHeader(event, 'X-XSS-Protection', '1; mode=block');
  setHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // CSRF protection
  if (event.node.req.method !== 'GET') {
    const token = getCookie(event, 'csrf-token') || getHeader(event, 'x-csrf-token');
    if (!verifyCSRFToken(token)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Invalid CSRF token',
      });
    }
  }
});
```

## Performance Optimization

### Caching Strategy

```typescript
// server/middleware/cache.ts
const cache = new Map();

export default defineEventHandler(async (event) => {
  const url = event.node.req.url;

  // Cache static API responses
  if (url?.startsWith('/api/projects') && event.node.req.method === 'GET') {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < 300000) {
      // 5 minutes
      return cached.data;
    }

    // Continue to handler, then cache result
    event.context.shouldCache = true;
  }
});
```

### Database Optimization

```sql
-- Create indexes for better performance
CREATE INDEX idx_projects_category ON projects(category);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_featured ON projects(featured);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_contact_submissions_status ON contact_submissions(status);
CREATE INDEX idx_contact_submissions_created_at ON contact_submissions(created_at);
```

## Backup & Recovery

### Automated Backup Script

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/var/backups/cloudless"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
pg_dump myapp_production | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Application backup
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='logs' \
  /var/www/cloudless

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/db_backup_$DATE.sql.gz s3://my-backups/cloudless/
aws s3 cp $BACKUP_DIR/app_backup_$DATE.tar.gz s3://my-backups/cloudless/

# Clean old backups
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
```

### Disaster Recovery Plan

```bash
#!/bin/bash
# restore.sh

BACKUP_FILE=$1
APP_DIR="/var/www/cloudless"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file>"
  exit 1
fi

# Stop application
pm2 stop cloudless-app

# Restore database
echo "Restoring database..."
gunzip -c $BACKUP_FILE | psql myapp_production

# Restart application
pm2 start cloudless-app

echo "Restore completed"
```

## Scaling Considerations

### Horizontal Scaling

```yaml
# docker-compose.scale.yml
version: '3.8'

services:
  app:
    # ... same configuration
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure

  nginx:
    # Load balancer configuration
    volumes:
      - ./nginx-lb.conf:/etc/nginx/nginx.conf
```

### Load Balancer Configuration

```nginx
upstream app_servers {
    server app1:3000;
    server app2:3000;
    server app3:3000;
}

server {
    listen 80;

    location / {
        proxy_pass http://app_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Troubleshooting

### Common Issues

1. **Application Won't Start**

   ```bash
   # Check logs
   pm2 logs cloudless-app

   # Check port availability
   netstat -tlnp | grep :3000

   # Check environment variables
   pm2 env cloudless-app
   ```

2. **Database Connection Issues**

   ```bash
   # Test database connection
   psql -h localhost -U myapp_user -d myapp_production

   # Check PostgreSQL status
   sudo systemctl status postgresql

   # Check connection limits
   sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
   ```

3. **High Memory Usage**

   ```bash
   # Monitor memory usage
   pm2 monit

   # Restart application
   pm2 restart cloudless-app

   # Check for memory leaks
   node --inspect server/index.mjs
   ```

### Performance Monitoring

```bash
# Install monitoring tools
sudo apt install htop iotop nethogs

# Monitor system resources
htop
iotop -o
nethogs

# Monitor application performance
pm2 show cloudless-app
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/
```

## Related Documentation

- [Development Setup](development-setup.md) - Local development environment
- [API Reference](api-reference.md) - API endpoint documentation
- [Testing Guide](testing-complete.md) - Testing procedures
- [LLM Integration](llm-integration.md) - LLM service configuration

---

**Last Updated**: December 2024
**Deployment Version**: 1.0.0
