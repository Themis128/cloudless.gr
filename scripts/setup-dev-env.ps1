# Setup Development Environment Script
# Creates proper .env file for development with Prisma configuration

Write-Host "🔧 Setting up development environment..." -ForegroundColor Green

# Check if .env file exists
if (Test-Path ".env") {
    Write-Host "⚠️  .env file already exists. Creating backup..." -ForegroundColor Yellow
    Copy-Item ".env" ".env.backup.$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')"
}

# Create .env file with development configuration
$envContent = @"
# Development Environment Variables for Cloudless.gr
# This file contains development defaults - do not use in production

# =============================================================================
# APPLICATION CONFIGURATION
# =============================================================================
NODE_ENV=development
NITRO_HOST=0.0.0.0
NITRO_PORT=3000
NUXT_HOST=0.0.0.0
NUXT_PORT=3000

# =============================================================================
# DATABASE CONFIGURATION (PRISMA)
# =============================================================================
POSTGRES_DB=cloudless_dev
POSTGRES_USER=cloudless
POSTGRES_PASSWORD=development
DATABASE_URL=postgresql://cloudless:development@postgres-dev:5432/cloudless_dev
PRISMA_DATABASE_URL=postgresql://cloudless:development@postgres-dev:5432/cloudless_dev

# =============================================================================
# REDIS CONFIGURATION
# =============================================================================
REDIS_PASSWORD=development
REDIS_URL=redis://redis-dev:6379
REDIS_MAX_MEMORY=256mb

# =============================================================================
# REDIS COMMANDER (Development Tool)
# =============================================================================
REDIS_COMMANDER_USER=admin
REDIS_COMMANDER_PASSWORD=admin

# =============================================================================
# EXTERNAL API KEYS (Development defaults)
# =============================================================================
OPENAI_API_KEY=disabled
ANTHROPIC_API_KEY=disabled

# =============================================================================
# MONITORING AND LOGGING
# =============================================================================
SENTRY_DSN=disabled
LOG_LEVEL=debug

# =============================================================================
# SECURITY (Development defaults - change for production)
# =============================================================================
SESSION_SECRET=dev-session-secret-change-in-production
JWT_SECRET=dev-jwt-secret-change-in-production

# =============================================================================
# DOCKER CONFIGURATION
# =============================================================================
DOCKER_REGISTRY=ghcr.io
IMAGE_TAG=latest
APP_PORT=3000

# =============================================================================
# NGINX CONFIGURATION (Production)
# =============================================================================
NGINX_PORT=80
NGINX_SSL_PORT=443

# =============================================================================
# APPLICATION METADATA
# =============================================================================
APP_VERSION=1.0.0
GIT_COMMIT=unknown
BUILD_DATE=unknown
"@

# Write the content to .env file
$envContent | Out-File -FilePath ".env" -Encoding UTF8

Write-Host "✅ Development environment file created: .env" -ForegroundColor Green
Write-Host "📝 Environment variables configured for Prisma database" -ForegroundColor Cyan
Write-Host "🚫 Supabase references removed" -ForegroundColor Yellow

# Show summary
Write-Host "`n📋 Environment Summary:" -ForegroundColor Cyan
Write-Host "  Database: PostgreSQL with Prisma" -ForegroundColor Gray
Write-Host "  Redis: Local development instance" -ForegroundColor Gray
Write-Host "  API Keys: Disabled for development" -ForegroundColor Gray
Write-Host "  Security: Development defaults" -ForegroundColor Gray

Write-Host "`n🚀 Ready to run: .\scripts\docker\quick-dev-rebuild.ps1" -ForegroundColor Green
