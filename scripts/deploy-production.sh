#!/bin/bash
# Production Deployment Script
# Uses environment variables from GitHub secrets or .env file
# Configured for network access

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

write_status() {
    local message="$1"
    local color="${2:-$GREEN}"
    echo -e "${color}[$(date +'%H:%M:%S')] $message${NC}"
}

check_requirements() {
    write_status "🔍 Checking requirements..." "$CYAN"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        write_status "❌ Docker is required but not installed" "$RED"
        exit 1
    fi
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        write_status "❌ Docker Compose v2 is required" "$RED"
        exit 1
    fi
    
    write_status "✅ Requirements check passed" "$GREEN"
}

load_environment() {
    write_status "🔧 Loading environment configuration..." "$CYAN"
    
    # Check if .env.prod exists
    if [[ -f ".env.prod" ]]; then
        write_status "📄 Loading .env.prod file..." "$YELLOW"
        export $(grep -v '^#' .env.prod | xargs)
    fi
    
    # Check required environment variables
    REQUIRED_VARS=(
        "NUXT_PUBLIC_SUPABASE_URL"
        "NUXT_PUBLIC_SUPABASE_ANON_KEY"
        "SUPABASE_SERVICE_ROLE_KEY"
        "SESSION_SECRET"
        "JWT_SECRET"
    )
    
    MISSING_VARS=()
    for var in "${REQUIRED_VARS[@]}"; do
        if [[ -z "${!var}" ]]; then
            MISSING_VARS+=("$var")
        fi
    done
    
    if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
        write_status "❌ Missing required environment variables:" "$RED"
        for var in "${MISSING_VARS[@]}"; do
            echo "   - $var"
        done
        write_status "💡 Set these in GitHub secrets or .env.prod file" "$YELLOW"
        exit 1
    fi
    
    write_status "✅ Environment variables loaded" "$GREEN"
}

build_application() {
    write_status "🏗️ Building application..." "$CYAN"
    
    # Set build metadata
    export VERSION=${VERSION:-$(date +%Y%m%d-%H%M%S)}
    export GIT_COMMIT=${GIT_COMMIT:-$(git rev-parse HEAD 2>/dev/null || echo "unknown")}
    export GIT_BRANCH=${GIT_BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")}
    export BUILD_DATE=${BUILD_DATE:-$(date -u +'%Y-%m-%dT%H:%M:%SZ')}
    
    write_status "📋 Build metadata:" "$CYAN"
    echo "   Version: $VERSION"
    echo "   Commit: $GIT_COMMIT"
    echo "   Branch: $GIT_BRANCH"
    echo "   Build Date: $BUILD_DATE"
    
    # Build Docker image
    write_status "🐳 Building Docker image..." "$YELLOW"
    docker build -f scripts/docker/Dockerfile \
        --build-arg VERSION="$VERSION" \
        --build-arg GIT_COMMIT="$GIT_COMMIT" \
        --build-arg GIT_BRANCH="$GIT_BRANCH" \
        --build-arg BUILD_DATE="$BUILD_DATE" \
        -t cloudlessgr-app:$VERSION \
        -t cloudlessgr-app:latest .
    
    write_status "✅ Application built successfully" "$GREEN"
}

deploy_production() {
    write_status "🚀 Deploying to production..." "$CYAN"
    
    # Create necessary directories
    mkdir -p logs/prod logs/nginx-prod logs/postgres-prod logs/redis-prod uploads
    
    # Stop existing containers
    write_status "🛑 Stopping existing containers..." "$YELLOW"
    docker compose -f docker-compose.prod.yml down --remove-orphans || true
    
    # Start production services
    write_status "⚡ Starting production services..." "$YELLOW"
    docker compose -f docker-compose.prod.yml up -d
    
    # Wait for services to be ready
    write_status "⏳ Waiting for services to be ready..." "$YELLOW"
    sleep 30
    
    # Health check
    write_status "🏥 Performing health check..." "$YELLOW"
    if curl -f http://localhost:3000/api/health &>/dev/null; then
        write_status "✅ Health check passed" "$GREEN"
    else
        write_status "❌ Health check failed" "$RED"
        write_status "📊 Checking container logs..." "$YELLOW"
        docker compose -f docker-compose.prod.yml logs --tail=50
        exit 1
    fi
    
    write_status "✅ Production deployment successful!" "$GREEN"
}

show_deployment_info() {
    # Get the host IP address
    HOST_IP=$(hostname -I | awk '{print $1}')
    
    write_status "🎉 Deployment Complete!" "$GREEN"
    write_status "" 
    write_status "🌐 Production Access URLs:" "$CYAN"
    write_status "   Main Application: http://$HOST_IP:3000" "$CYAN"
    write_status "   Health Check: http://$HOST_IP:3000/api/health" "$CYAN"
    write_status "   Or via localhost: http://localhost:3000" "$CYAN"
    write_status ""
    write_status "📊 Management Commands:" "$CYAN"
    write_status "   View logs: docker compose -f docker-compose.prod.yml logs -f" "$CYAN"
    write_status "   Check status: docker compose -f docker-compose.prod.yml ps" "$CYAN"
    write_status "   Stop services: docker compose -f docker-compose.prod.yml down" "$CYAN"
    write_status ""
    write_status "🔧 Configuration:" "$CYAN"
    write_status "   Version: $VERSION" "$CYAN"
    write_status "   Environment: production" "$CYAN"
    write_status "   Network Access: Enabled (0.0.0.0:3000)" "$CYAN"
}

cleanup_old_images() {
    write_status "🧹 Cleaning up old Docker images..." "$YELLOW"
    
    # Keep last 3 versions
    docker images cloudlessgr-app --format "table {{.Tag}}\t{{.ID}}" | \
    grep -v "latest\|production" | \
    tail -n +4 | \
    awk '{print $2}' | \
    xargs -r docker rmi || true
    
    # Clean up unused resources
    docker system prune -f
    
    write_status "✅ Cleanup completed" "$GREEN"
}

# Main execution
ACTION="${1:-deploy}"

case "$ACTION" in
    "deploy")
        check_requirements
        load_environment
        build_application
        deploy_production
        show_deployment_info
        cleanup_old_images
        ;;
    "stop")
        write_status "🛑 Stopping production services..." "$YELLOW"
        docker compose -f docker-compose.prod.yml down --remove-orphans
        write_status "✅ Production services stopped" "$GREEN"
        ;;
    "logs")
        docker compose -f docker-compose.prod.yml logs -f --tail=50
        ;;
    "status")
        docker compose -f docker-compose.prod.yml ps
        ;;
    "health")
        if curl -f http://localhost:3000/api/health; then
            write_status "✅ Health check passed" "$GREEN"
        else
            write_status "❌ Health check failed" "$RED"
            exit 1
        fi
        ;;
    "help"|"--help"|"-h")
        echo "Production Deployment Script Usage:"
        echo ""
        echo "  ./scripts/deploy-production.sh [command]"
        echo ""
        echo "Commands:"
        echo "  deploy    Deploy to production (default)"
        echo "  stop      Stop production services"
        echo "  logs      Show production logs"
        echo "  status    Show service status"
        echo "  health    Check application health"
        echo "  help      Show this help message"
        ;;
    *)
        write_status "❌ Unknown action: $ACTION" "$RED"
        write_status "Available actions: deploy, stop, logs, status, health, help" "$YELLOW"
        exit 1
        ;;
esac