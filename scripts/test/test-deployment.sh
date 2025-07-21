#!/bin/bash

# Test Deployment Script for Cloudless
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="cloudless"
TEST_IP="192.168.0.23"
TEST_PORT="3000"
TEST_URL="http://$TEST_IP:$TEST_PORT"

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

# Build and start the application
deploy_app() {
    log_info "Building and starting the application..."
    
    # Stop any existing containers
    docker-compose down 2>/dev/null || true
    
    # Build and start
    docker-compose up -d --build
    
    log_success "Application deployed successfully"
}

# Wait for application to start
wait_for_app() {
    log_info "Waiting for application to start..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f "$TEST_URL" > /dev/null 2>&1; then
            log_success "Application is responding at $TEST_URL"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts - Application not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log_error "Application failed to start within expected time"
    return 1
}

# Test application functionality
test_app() {
    log_info "Testing application functionality..."
    
    # Test basic connectivity
    if curl -f "$TEST_URL" > /dev/null 2>&1; then
        log_success "✓ Basic connectivity test passed"
    else
        log_error "✗ Basic connectivity test failed"
        return 1
    fi
    
    # Test health endpoint (if available)
    if curl -f "$TEST_URL/health" > /dev/null 2>&1; then
        log_success "✓ Health endpoint test passed"
    else
        log_warning "⚠ Health endpoint not available (this is normal for basic setup)"
    fi
    
    # Test API endpoint (if available)
    if curl -f "$TEST_URL/api" > /dev/null 2>&1; then
        log_success "✓ API endpoint test passed"
    else
        log_warning "⚠ API endpoint not available (this is normal for basic setup)"
    fi
    
    return 0
}

# Show container status
show_status() {
    log_info "Container Status:"
    docker-compose ps
    
    log_info "Application URLs:"
    echo "  Local: http://localhost:3000"
    echo "  Network: $TEST_URL"
    
    log_info "Container Logs (last 10 lines):"
    docker-compose logs --tail=10 app
}

# Cleanup function
cleanup() {
    log_info "Cleaning up test deployment..."
    docker-compose down
    log_success "Cleanup completed"
}

# Main test function
main() {
    log_info "Starting Docker deployment test..."
    
    # Check prerequisites
    check_docker
    
    # Deploy application
    deploy_app
    
    # Wait for application to start
    if wait_for_app; then
        # Test functionality
        if test_app; then
            log_success "All tests passed! 🎉"
            show_status
        else
            log_error "Some tests failed"
            show_status
            exit 1
        fi
    else
        log_error "Application failed to start"
        show_status
        exit 1
    fi
}

# Show usage
usage() {
    echo "Usage: $0 [option]"
    echo ""
    echo "Options:"
    echo "  test       Run deployment test (default)"
    echo "  status     Show current status"
    echo "  logs       Show application logs"
    echo "  cleanup    Stop and remove containers"
    echo "  -h, --help Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  TEST_IP     IP address to test (default: 192.168.0.23)"
    echo "  TEST_PORT   Port to test (default: 3000)"
}

# Handle command line arguments
case "${1:-test}" in
    -h|--help)
        usage
        exit 0
        ;;
    test)
        main
        ;;
    status)
        show_status
        ;;
    logs)
        docker-compose logs -f app
        ;;
    cleanup)
        cleanup
        ;;
    *)
        log_error "Unknown option: $1"
        usage
        exit 1
        ;;
esac 