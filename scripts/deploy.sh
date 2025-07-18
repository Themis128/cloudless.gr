#!/bin/bash

# Cloudless Docker Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="cloudless"
DOCKER_REGISTRY=${DOCKER_REGISTRY:-"your-registry.com"}
ENVIRONMENT=${1:-"staging"}
VERSION=${2:-"latest"}

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Build Docker image
build_image() {
    log_info "Building Docker image for $ENVIRONMENT..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        docker build -t $APP_NAME:$ENVIRONMENT -t $APP_NAME:$VERSION .
    else
        docker build -t $APP_NAME:$ENVIRONMENT .
    fi
    
    log_success "Docker image built successfully"
}

# Push to registry
push_image() {
    if [ -n "$DOCKER_REGISTRY" ] && [ "$DOCKER_REGISTRY" != "your-registry.com" ]; then
        log_info "Pushing image to registry..."
        
        # Tag for registry
        docker tag $APP_NAME:$ENVIRONMENT $DOCKER_REGISTRY/$APP_NAME:$ENVIRONMENT
        
        if [ "$ENVIRONMENT" = "production" ]; then
            docker tag $APP_NAME:$VERSION $DOCKER_REGISTRY/$APP_NAME:$VERSION
        fi
        
        # Push to registry
        docker push $DOCKER_REGISTRY/$APP_NAME:$ENVIRONMENT
        
        if [ "$ENVIRONMENT" = "production" ]; then
            docker push $DOCKER_REGISTRY/$APP_NAME:$VERSION
        fi
        
        log_success "Image pushed to registry successfully"
    else
        log_warning "Docker registry not configured, skipping push"
    fi
}

# Deploy with Docker Compose
deploy_compose() {
    log_info "Deploying with Docker Compose..."
    
    # Stop existing containers
    docker-compose -f docker-compose.yml down
    
    # Pull latest images if using registry
    if [ -n "$DOCKER_REGISTRY" ] && [ "$DOCKER_REGISTRY" != "your-registry.com" ]; then
        docker-compose -f docker-compose.yml pull
    fi
    
    # Start services
    docker-compose -f docker-compose.yml up -d
    
    log_success "Deployment completed successfully"
}

# Deploy with Docker Compose Production
deploy_production() {
    log_info "Deploying production environment..."
    
    # Stop existing containers
    docker-compose -f docker-compose.prod.yml down
    
    # Pull latest images if using registry
    if [ -n "$DOCKER_REGISTRY" ] && [ "$DOCKER_REGISTRY" != "your-registry.com" ]; then
        docker-compose -f docker-compose.prod.yml pull
    fi
    
    # Start services
    docker-compose -f docker-compose.prod.yml up -d
    
    log_success "Production deployment completed successfully"
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    # Wait for application to start
    sleep 10
    
    # Check if application is responding
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        log_success "Application is healthy"
    else
        log_error "Application health check failed"
        exit 1
    fi
}

# Rollback function
rollback() {
    log_warning "Rolling back to previous version..."
    
    # Stop current containers
    docker-compose -f docker-compose.yml down
    
    # Start previous version (you might want to implement version tracking)
    docker-compose -f docker-compose.yml up -d
    
    log_success "Rollback completed"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up unused Docker resources..."
    
    # Remove unused containers
    docker container prune -f
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    log_success "Cleanup completed"
}

# Main deployment function
main() {
    log_info "Starting deployment for $ENVIRONMENT environment"
    
    # Check prerequisites
    check_docker
    
    # Build image
    build_image
    
    # Push to registry
    push_image
    
    # Deploy based on environment
    if [ "$ENVIRONMENT" = "production" ]; then
        deploy_production
    else
        deploy_compose
    fi
    
    # Health check
    health_check
    
    # Cleanup
    cleanup
    
    log_success "Deployment completed successfully!"
}

# Show usage
usage() {
    echo "Usage: $0 [environment] [version]"
    echo ""
    echo "Environments:"
    echo "  staging     Deploy to staging environment (default)"
    echo "  production  Deploy to production environment"
    echo ""
    echo "Examples:"
    echo "  $0                    # Deploy staging with latest version"
    echo "  $0 production         # Deploy production with latest version"
    echo "  $0 production v1.2.3  # Deploy production with specific version"
    echo ""
    echo "Environment Variables:"
    echo "  DOCKER_REGISTRY       Docker registry URL (optional)"
    echo "  NUXT_PUBLIC_SUPABASE_URL     Supabase URL"
    echo "  NUXT_PUBLIC_SUPABASE_ANON_KEY Supabase anonymous key"
}

# Handle command line arguments
case "${1:-}" in
    -h|--help)
        usage
        exit 0
        ;;
    rollback)
        rollback
        exit 0
        ;;
    cleanup)
        cleanup
        exit 0
        ;;
    staging|production)
        main
        ;;
    *)
        if [ -n "$1" ]; then
            log_error "Unknown environment: $1"
            usage
            exit 1
        else
            main
        fi
        ;;
esac 