#!/bin/bash

# Docker Build Helper Script
# Prevents hanging builds and provides better debugging

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BUILD_TIMEOUT=1800  # 30 minutes
TEST_TIMEOUT=300    # 5 minutes
DOCKERFILE=${1:-"scripts/docker/Dockerfile"}
TARGET=${2:-"runner"}
TAG=${3:-"test"}

echo -e "${BLUE}🐳 Docker Build Helper${NC}"
echo "=========================="
echo "Dockerfile: $DOCKERFILE"
echo "Target: $TARGET"
echo "Tag: $TAG"
echo "Build timeout: ${BUILD_TIMEOUT}s"
echo ""

# Function to cleanup Docker resources
cleanup_docker() {
    echo -e "${YELLOW}🧹 Cleaning up Docker resources...${NC}"
    
    # Stop all running containers
    echo "Stopping containers..."
    docker ps -q | xargs -r docker stop || true
    
    # Remove stopped containers
    echo "Removing containers..."
    docker ps -aq | xargs -r docker rm -f || true
    
    # Remove dangling images
    echo "Removing dangling images..."
    docker image prune -f || true
    
    # Remove unused volumes
    echo "Removing unused volumes..."
    docker volume prune -f || true
    
    # Remove unused networks
    echo "Removing unused networks..."
    docker network prune -f || true
    
    echo -e "${GREEN}✅ Cleanup completed${NC}"
}

# Function to check Docker daemon health
check_docker_health() {
    echo -e "${BLUE}🔍 Checking Docker daemon health...${NC}"
    
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker daemon is not responding${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Docker daemon is healthy${NC}"
    
    # Check available resources
    echo "Available disk space:"
    df -h . | tail -1
    
    echo "Available memory:"
    free -h | head -2 | tail -1
    
    echo "Docker system info:"
    docker system df
}

# Function to build Docker image with timeout and monitoring
build_docker_image() {
    echo -e "${BLUE}🏗️ Building Docker image...${NC}"
    
    # Check if Dockerfile exists
    if [ ! -f "$DOCKERFILE" ]; then
        echo -e "${RED}❌ Dockerfile not found: $DOCKERFILE${NC}"
        exit 1
    fi
    
    # Build with timeout and monitoring
    echo "Starting build with timeout ${BUILD_TIMEOUT}s..."
    
    # Use timeout command to prevent hanging
    timeout $BUILD_TIMEOUT docker build \
        --file "$DOCKERFILE" \
        --target "$TARGET" \
        --tag "cloudlessgr-app:$TAG" \
        --build-arg NODE_ENV=production \
        --build-arg BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
        --build-arg GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown") \
        --build-arg APP_VERSION=$(git describe --tags 2>/dev/null || echo "dev") \
        --progress=plain \
        --no-cache \
        . || {
            echo -e "${RED}❌ Docker build failed or timed out!${NC}"
            echo "Checking for issues..."
            
            # Check if it was a timeout
            if [ $? -eq 124 ]; then
                echo -e "${YELLOW}⚠️ Build timed out after ${BUILD_TIMEOUT}s${NC}"
            fi
            
            # Check Docker daemon status
            echo "Docker daemon status:"
            docker system df || echo "Cannot check Docker system"
            
            # Check for hanging processes
            echo "Docker processes:"
            ps aux | grep docker || echo "No docker processes found"
            
            # Check Docker logs
            echo "Docker logs (last 20 lines):"
            journalctl -u docker --no-pager -n 20 2>/dev/null || echo "Cannot access Docker logs"
            
            exit 1
        }
    
    echo -e "${GREEN}✅ Docker build completed successfully${NC}"
    
    # Show build results
    echo "Built image info:"
    docker images "cloudlessgr-app:$TAG" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
}

# Function to test Docker image
test_docker_image() {
    echo -e "${BLUE}🧪 Testing Docker image...${NC}"
    
    # Test with timeout
    echo "Running tests with timeout ${TEST_TIMEOUT}s..."
    
    timeout $TEST_TIMEOUT docker run --rm "cloudlessgr-app:$TAG" npm test || {
        echo -e "${YELLOW}⚠️ Docker tests failed or timed out, but continuing...${NC}"
    }
    
    echo -e "${GREEN}✅ Docker tests completed${NC}"
}

# Function to show build summary
show_summary() {
    echo -e "${BLUE}📊 Build Summary${NC}"
    echo "=================="
    echo "Dockerfile: $DOCKERFILE"
    echo "Target: $TARGET"
    echo "Tag: $TAG"
    echo "Build time: $(date)"
    echo ""
    echo "Image details:"
    docker images "cloudlessgr-app:$TAG" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    echo ""
    echo -e "${GREEN}🎉 Build process completed!${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}🚀 Starting Docker build process...${NC}"
    
    # Pre-build cleanup
    cleanup_docker
    
    # Check Docker health
    check_docker_health
    
    # Build image
    build_docker_image
    
    # Test image
    test_docker_image
    
    # Post-build cleanup
    cleanup_docker
    
    # Show summary
    show_summary
}

# Handle script arguments
case "${1:-}" in
    "cleanup")
        cleanup_docker
        ;;
    "health")
        check_docker_health
        ;;
    "build")
        build_docker_image
        ;;
    "test")
        test_docker_image
        ;;
    "help"|"-h"|"--help")
        echo "Docker Build Helper"
        echo ""
        echo "Usage: $0 [command] [dockerfile] [target] [tag]"
        echo ""
        echo "Commands:"
        echo "  cleanup  - Clean up Docker resources"
        echo "  health   - Check Docker daemon health"
        echo "  build    - Build Docker image only"
        echo "  test     - Test Docker image only"
        echo "  help     - Show this help"
        echo ""
        echo "Examples:"
        echo "  $0                                    # Full build process"
        echo "  $0 cleanup                           # Clean up only"
        echo "  $0 build Dockerfile.dev dev dev      # Build with custom params"
        echo ""
        ;;
    *)
        main
        ;;
esac 