# Docker Container Connection with Supabase - Troubleshooting Guide

## 🚨 Common Issues and Solutions

### 1. **Environment Variables Not Set**

**Problem**: Container can't connect to Supabase because environment variables are missing.

**Symptoms**:

- Health check shows `"supabase": "not_configured"`
- Container logs show "Supabase not configured"
- Application fails to authenticate users

**Solution**:

```bash
# 1. Copy the Docker environment template
cp docker.env.example .env

# 2. Edit .env file with your Supabase credentials
NUXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 2. **Environment Variables Not Passed to Container**

**Problem**: Environment variables exist in `.env` but aren't available inside the container.

**Symptoms**:

- Environment variables show as "missing" in health check
- Container can't access Supabase credentials

**Solution**:

```yaml
# In docker-compose.yml, ensure environment variables are explicitly passed:
environment:
  - NUXT_PUBLIC_SUPABASE_URL=${NUXT_PUBLIC_SUPABASE_URL}
  - NUXT_PUBLIC_SUPABASE_ANON_KEY=${NUXT_PUBLIC_SUPABASE_ANON_KEY}
  - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
```

### 3. **Network Connectivity Issues**

**Problem**: Container can't reach Supabase due to network restrictions.

**Symptoms**:

- Connection timeouts
- Network errors in logs
- Supabase health check fails

**Solution**:

```bash
# Test network connectivity from container
docker exec cloudlessgr-app ping your-project.supabase.co

# Check if container can reach external services
docker exec cloudlessgr-app curl -I https://your-project.supabase.co
```

### 4. **DNS Resolution Issues**

**Problem**: Container can't resolve Supabase domain names.

**Symptoms**:

- DNS resolution errors
- "Host not found" errors

**Solution**:

```bash
# Add DNS configuration to docker-compose.yml
services:
  app:
    dns:
      - 8.8.8.8
      - 8.8.4.4
```

## 🔧 Quick Fix Commands

### **Step 1: Validate Environment**

```bash
# Windows PowerShell
.\scripts\docker-debug.ps1

# Linux/Mac
./scripts/docker-debug.sh
```

### **Step 2: Restart Container with Fresh Environment**

```bash
# Stop and remove existing container
docker-compose down

# Rebuild with fresh environment
docker-compose build --no-cache

# Start with new environment
docker-compose up -d
```

### **Step 3: Check Health Status**

```bash
# Get detailed health check
curl http://localhost:3000/api/health | jq '.'

# Check container logs
docker logs cloudlessgr-app --tail 50
```

## 📋 Environment Configuration Checklist

### **Required Environment Variables**

- [ ] `NUXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- [ ] `NUXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (optional)

### **Docker-Specific Variables**

- [ ] `NODE_ENV=production` - Set to production for Docker
- [ ] `NITRO_HOST=0.0.0.0` - Bind to all interfaces
- [ ] `NITRO_PORT=3000` - Application port
- [ ] `NUXT_HOST=0.0.0.0` - Nuxt host binding
- [ ] `NUXT_PORT=3000` - Nuxt port

## 🐳 Docker Configuration Files

### **docker-compose.yml** (Production)

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - NUXT_PUBLIC_SUPABASE_URL=${NUXT_PUBLIC_SUPABASE_URL}
      - NUXT_PUBLIC_SUPABASE_ANON_KEY=${NUXT_PUBLIC_SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    env_file:
      - .env
```

### **Dockerfile** (Production)

```dockerfile
# Environment validation
RUN echo '#!/bin/sh\n\
echo "🔍 Validating environment variables..."\n\
if [ -z "$NUXT_PUBLIC_SUPABASE_URL" ]; then\n\
  echo "❌ NUXT_PUBLIC_SUPABASE_URL is not set"\n\
  exit 1\n\
fi\n\
if [ -z "$NUXT_PUBLIC_SUPABASE_ANON_KEY" ]; then\n\
  echo "❌ NUXT_PUBLIC_SUPABASE_ANON_KEY is not set"\n\
  exit 1\n\
fi\n\
echo "✅ Environment variables validated"\n\
' > /app/validate-env.sh && chmod +x /app/validate-env.sh

# Start with validation
CMD ["sh", "-c", "/app/validate-env.sh && node start-server.js"]
```

### **docker-compose.dev.yml** (Development)

```yaml
services:
  app-dev:
    build:
      context: .
      dockerfile: Dockerfile.dev
      target: dev
    environment:
      # Development-specific overrides
      NODE_ENV: development
      NITRO_HOST: 0.0.0.0
      NITRO_PORT: 3000
      NUXT_HOST: 0.0.0.0
      NUXT_PORT: 3000
      # Ensure Supabase environment variables are passed through
      NUXT_PUBLIC_SUPABASE_URL: ${NUXT_PUBLIC_SUPABASE_URL}
      NUXT_PUBLIC_SUPABASE_ANON_KEY: ${NUXT_PUBLIC_SUPABASE_ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
    env_file:
      - .env
```

### **Dockerfile.dev** (Development)

```dockerfile
# Environment validation for development
RUN echo '#!/bin/sh\n\
echo "🔍 Validating development environment variables..."\n\
if [ -z "$NUXT_PUBLIC_SUPABASE_URL" ]; then\n\
  echo "❌ NUXT_PUBLIC_SUPABASE_URL is not set"\n\
  echo "⚠️ Supabase connection will not work in development"\n\
  echo "ℹ️ Set NUXT_PUBLIC_SUPABASE_URL in your .env file"\n\
fi\n\
if [ -z "$NUXT_PUBLIC_SUPABASE_ANON_KEY" ]; then\n\
  echo "❌ NUXT_PUBLIC_SUPABASE_ANON_KEY is not set"\n\
  echo "⚠️ Supabase connection will not work in development"\n\
  echo "ℹ️ Set NUXT_PUBLIC_SUPABASE_ANON_KEY in your .env file"\n\
fi\n\
if [ -n "$NUXT_PUBLIC_SUPABASE_URL" ] && [ -n "$NUXT_PUBLIC_SUPABASE_ANON_KEY" ]; then\n\
  echo "✅ Supabase environment variables configured"\n\
else\n\
  echo "⚠️ Supabase not fully configured - some features may not work"\n\
fi\n\
echo "🚀 Starting development server..."\n\
' > /app/validate-dev-env.sh && chmod +x /app/validate-dev-env.sh

# Start with validation and development server
CMD ["sh", "-c", "/app/validate-dev-env.sh && npm run dev"]
```

## 🔍 Debugging Commands

### **Check Environment Variables in Container**

```bash
# List all environment variables
docker exec cloudlessgr-app env | grep SUPABASE

# Check specific variables
docker exec cloudlessgr-app sh -c 'echo "URL: $NUXT_PUBLIC_SUPABASE_URL"'
docker exec cloudlessgr-app sh -c 'echo "KEY: $NUXT_PUBLIC_SUPABASE_ANON_KEY"'
```

### **Test Supabase Connection from Container**

```bash
# Test connection directly
docker exec cloudlessgr-app node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NUXT_PUBLIC_SUPABASE_URL, process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY);
supabase.rpc('version').then(console.log).catch(console.error);
"
```

### **Check Network Connectivity**

```bash
# Test DNS resolution
docker exec cloudlessgr-app nslookup your-project.supabase.co

# Test HTTP connectivity
docker exec cloudlessgr-app curl -I https://your-project.supabase.co

# Test port connectivity
docker exec cloudlessgr-app telnet your-project.supabase.co 443
```

## 🚀 Deployment Checklist

### **Before Deployment**

- [ ] Environment variables are set in `.env`
- [ ] Supabase project is active and accessible
- [ ] Network allows outbound HTTPS connections
- [ ] Docker has sufficient resources (2GB RAM, 1 CPU)

### **During Deployment**

- [ ] Container builds successfully
- [ ] Environment validation passes
- [ ] Health check returns 200 status
- [ ] Supabase connection test passes

### **After Deployment**

- [ ] Application responds to requests
- [ ] User authentication works
- [ ] Database operations succeed
- [ ] Logs show no connection errors

## 🆘 Emergency Fixes

### **Quick Environment Fix**

```bash
# Stop container
docker-compose down

# Set environment variables directly
export NUXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
export NUXT_PUBLIC_SUPABASE_ANON_KEY="your-key"

# Start with environment
docker-compose up -d
```

### **Network Fix**

```bash
# Add to docker-compose.yml
services:
  app:
    network_mode: "host"  # Use host networking (Linux only)
    # OR
    extra_hosts:
      - "host.docker.internal:host-gateway"  # Docker Desktop
```

### **DNS Fix**

```bash
# Add to docker-compose.yml
services:
  app:
    dns:
      - 8.8.8.8
      - 1.1.1.1
```

## 📞 Support

If you're still experiencing issues:

1. **Run the debug script**: `.\scripts\docker-debug.ps1`
2. **Check the logs**: `docker logs cloudlessgr-app`
3. **Verify Supabase**: Test connection from host machine
4. **Check network**: Ensure no firewall blocking outbound HTTPS

## 🔄 Common Workflows

### **Development Setup**

```bash
# Option 1: Automated Development Setup
.\scripts\setup-dev-docker-supabase.ps1

# Option 2: Manual Development Setup
# 1. Copy development environment template
cp docker.dev.env.example .env

# 2. Configure Supabase credentials
# Edit .env file

# 3. Start development environment
docker-compose -f docker-compose.dev.yml up -d

# 4. Run debug script
.\scripts\docker-debug.ps1
```

### **Development with Additional Services**

```bash
# Development with local PostgreSQL
.\scripts\setup-dev-docker-supabase.ps1 -WithDatabase

# Development with email testing (Mailhog)
.\scripts\setup-dev-docker-supabase.ps1 -WithEmail

# Development with Redis management
.\scripts\setup-dev-docker-supabase.ps1 -WithRedis

# Development with all services
.\scripts\setup-dev-docker-supabase.ps1 -WithDatabase -WithEmail -WithRedis
```

### **Production Deployment**

```bash
# 1. Set production environment variables
# Use GitHub secrets or environment variables

# 2. Build and deploy
docker-compose -f docker-compose.prod.yml up -d

# 3. Verify deployment
curl http://localhost:3000/api/health

# 4. Check logs
docker logs cloudlessgr-app
```

### **Troubleshooting Workflow**

```bash
# 1. Run debug script
.\scripts\docker-debug.ps1

# 2. Check specific issues
docker exec cloudlessgr-app env | grep SUPABASE

# 3. Test connectivity
docker exec cloudlessgr-app curl -I https://your-project.supabase.co

# 4. Restart if needed
docker-compose down && docker-compose up -d
```
