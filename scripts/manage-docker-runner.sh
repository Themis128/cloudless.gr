#!/bin/bash

# Docker Runner Management Script
# This script helps manage the GitHub Actions self-hosted runner in Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.runner.yml"
RUNNER_SERVICE="github-runner"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Function to check if compose file exists
check_compose_file() {
    if [ ! -f "$COMPOSE_FILE" ]; then
        print_error "Compose file $COMPOSE_FILE not found."
        print_status "Please run the setup script first or check the file path."
        exit 1
    fi
}

# Function to start the runner
start_runner() {
    print_status "Starting GitHub Actions runner..."
    check_docker
    check_compose_file
    
    # Create necessary directories
    mkdir -p runner-data runner-cache runner-logs
    
    # Start the runner
    docker-compose -f "$COMPOSE_FILE" up -d "$RUNNER_SERVICE"
    
    # Wait for runner to start
    print_status "Waiting for runner to start..."
    sleep 10
    
    # Check status
    if docker-compose -f "$COMPOSE_FILE" ps "$RUNNER_SERVICE" | grep -q "Up"; then
        print_success "Runner started successfully"
        show_status
    else
        print_error "Failed to start runner"
        docker-compose -f "$COMPOSE_FILE" logs "$RUNNER_SERVICE"
        exit 1
    fi
}

# Function to stop the runner
stop_runner() {
    print_status "Stopping GitHub Actions runner..."
    check_docker
    check_compose_file
    
    docker-compose -f "$COMPOSE_FILE" stop "$RUNNER_SERVICE"
    print_success "Runner stopped"
}

# Function to restart the runner
restart_runner() {
    print_status "Restarting GitHub Actions runner..."
    stop_runner
    sleep 2
    start_runner
}

# Function to show runner status
show_status() {
    print_status "GitHub Actions Runner Status:"
    echo "=================================="
    
    # Check if runner container is running
    if docker-compose -f "$COMPOSE_FILE" ps "$RUNNER_SERVICE" | grep -q "Up"; then
        print_success "✅ Runner container is running"
        
        # Show container details
        echo ""
        echo "Container Details:"
        docker-compose -f "$COMPOSE_FILE" ps "$RUNNER_SERVICE"
        
        # Show recent logs
        echo ""
        echo "Recent Logs:"
        docker-compose -f "$COMPOSE_FILE" logs --tail=10 "$RUNNER_SERVICE"
        
        # Show health check
        echo ""
        echo "Health Check:"
        if curl -s http://localhost:8080/health >/dev/null 2>&1; then
            print_success "✅ Health check passed"
        else
            print_warning "⚠️ Health check failed"
        fi
        
    else
        print_error "❌ Runner container is not running"
    fi
    
    # Show resource usage
    echo ""
    echo "Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" "$RUNNER_SERVICE" 2>/dev/null || echo "Unable to get resource stats"
}

# Function to view logs
view_logs() {
    print_status "Showing runner logs..."
    check_docker
    check_compose_file
    
    docker-compose -f "$COMPOSE_FILE" logs -f "$RUNNER_SERVICE"
}

# Function to clean up
cleanup() {
    print_status "Cleaning up runner..."
    check_docker
    check_compose_file
    
    # Stop and remove containers
    docker-compose -f "$COMPOSE_FILE" down
    
    # Remove volumes (optional)
    read -p "Do you want to remove runner data volumes? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose -f "$COMPOSE_FILE" down -v
        rm -rf runner-data runner-cache runner-logs
        print_success "Runner data cleaned up"
    fi
    
    print_success "Cleanup completed"
}

# Function to update runner
update_runner() {
    print_status "Updating GitHub Actions runner..."
    check_docker
    check_compose_file
    
    # Pull latest image
    docker-compose -f "$COMPOSE_FILE" pull "$RUNNER_SERVICE"
    
    # Restart with new image
    restart_runner
    
    print_success "Runner updated successfully"
}

# Function to show help
show_help() {
    echo "🐳 Docker GitHub Actions Runner Management"
    echo "=========================================="
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start the GitHub Actions runner"
    echo "  stop      Stop the GitHub Actions runner"
    echo "  restart   Restart the GitHub Actions runner"
    echo "  status    Show runner status and logs"
    echo "  logs      View runner logs (follow mode)"
    echo "  update    Update runner to latest version"
    echo "  cleanup   Stop and clean up runner data"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start      # Start the runner"
    echo "  $0 status     # Check runner status"
    echo "  $0 logs       # View live logs"
    echo ""
    echo "Environment Variables:"
    echo "  GITHUB_TOKEN  GitHub Personal Access Token (required)"
    echo "  COMPOSE_FILE  Docker Compose file path (default: docker-compose.runner.yml)"
}

# Function to check GitHub token
check_github_token() {
    if [ -z "$GITHUB_TOKEN" ]; then
        print_error "GITHUB_TOKEN environment variable is not set"
        echo "Please set your GitHub Personal Access Token:"
        echo "export GITHUB_TOKEN=your_token_here"
        exit 1
    fi
}

# Main execution
main() {
    case "${1:-help}" in
        start)
            check_github_token
            start_runner
            ;;
        stop)
            stop_runner
            ;;
        restart)
            check_github_token
            restart_runner
            ;;
        status)
            show_status
            ;;
        logs)
            view_logs
            ;;
        update)
            check_github_token
            update_runner
            ;;
        cleanup)
            cleanup
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@" 