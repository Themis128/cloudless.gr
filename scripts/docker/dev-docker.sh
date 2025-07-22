#!/bin/bash
# Ultra-Optimized Development Docker Script for Linux
# Fast startup with minimal resource usage

set -e

COMPOSE_FILE="docker-compose.dev.yml"
PROJECT_NAME="cloudlessgr"

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

start_dev_environment() {
    write_status "🚀 Starting ultra-optimized development environment..." "$CYAN"
    
    # Create necessary directories
    mkdir -p logs/dev logs/postgres logs/redis logs/nginx
    
    # Stop any existing containers first
    write_status "🛑 Stopping existing containers..." "$YELLOW"
    docker compose -f $COMPOSE_FILE down --remove-orphans 2>/dev/null || true
    
    # Build with BuildKit for faster builds
    write_status "🔨 Building optimized development image..." "$YELLOW"
    export DOCKER_BUILDKIT=1
    docker compose -f $COMPOSE_FILE build --no-cache --parallel
    
    # Start services
    write_status "⚡ Starting services..." "$YELLOW"
    docker compose -f $COMPOSE_FILE up -d
    
    # Wait for services to be ready
    write_status "⏳ Waiting for services to be ready..." "$YELLOW"
    sleep 10
    
    # Show status
    show_status
    
    # Get the host IP address
    HOST_IP=$(hostname -I | awk '{print $1}')
    
    write_status "✅ Development environment started!" "$GREEN"
    write_status "" 
    write_status "🌐 Access from ANY device on your network:" "$CYAN"
    write_status "   Main Application: http://$HOST_IP:3000" "$CYAN"
    write_status "   Or via localhost: http://localhost:3000" "$CYAN"
    write_status ""
    write_status "🔧 Development Tools:" "$CYAN"
    write_status "   Redis Commander: http://$HOST_IP:8081 (admin/admin)" "$CYAN"
    write_status "   Mailhog: http://$HOST_IP:8025" "$CYAN"
    write_status "   Node.js Debugger: $HOST_IP:9229" "$CYAN"
    write_status ""
    write_status "📊 Monitor with: ./scripts/docker/dev-docker.sh logs" "$CYAN"
}

stop_dev_environment() {
    write_status "🛑 Stopping development environment..." "$YELLOW"
    docker compose -f $COMPOSE_FILE down --remove-orphans
    write_status "✅ Development environment stopped!" "$GREEN"
}

restart_dev_environment() {
    write_status "🔄 Restarting development environment..." "$YELLOW"
    stop_dev_environment
    sleep 2
    start_dev_environment
}

show_logs() {
    write_status "📊 Showing development logs..." "$CYAN"
    docker compose -f $COMPOSE_FILE logs -f --tail=50
}

enter_shell() {
    write_status "🐚 Entering development container shell..." "$CYAN"
    docker compose -f $COMPOSE_FILE exec app-dev sh
}

show_status() {
    write_status "📊 Development environment status:" "$CYAN"
    docker compose -f $COMPOSE_FILE ps
    
    write_status "📈 Container resource usage:" "$CYAN"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
}

build_dev_environment() {
    write_status "🔨 Building development environment..." "$YELLOW"
    export DOCKER_BUILDKIT=1
    docker compose -f $COMPOSE_FILE build --no-cache --parallel
    write_status "✅ Build completed!" "$GREEN"
}

clean_dev_environment() {
    write_status "🧹 Cleaning development environment..." "$YELLOW"
    
    # Stop and remove containers
    docker compose -f $COMPOSE_FILE down --remove-orphans --volumes
    
    # Remove images
    docker rmi cloudlessgr-app-dev:latest 2>/dev/null || true
    
    # Clean up unused resources
    docker system prune -f
    
    write_status "✅ Cleanup completed!" "$GREEN"
}

show_help() {
    echo "Development Docker Script Usage:"
    echo ""
    echo "  ./scripts/docker/dev-docker.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start     Start the development environment (default)"
    echo "  stop      Stop the development environment"
    echo "  restart   Restart the development environment"
    echo "  logs      Show development logs"
    echo "  shell     Enter development container shell"
    echo "  status    Show environment status"
    echo "  build     Build development environment"
    echo "  clean     Clean development environment"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/docker/dev-docker.sh start"
    echo "  ./scripts/docker/dev-docker.sh logs"
    echo "  ./scripts/docker/dev-docker.sh shell"
}

# Main execution
ACTION="${1:-start}"

case "$ACTION" in
    "start")
        start_dev_environment
        ;;
    "stop")
        stop_dev_environment
        ;;
    "restart")
        restart_dev_environment
        ;;
    "logs")
        show_logs
        ;;
    "shell")
        enter_shell
        ;;
    "status")
        show_status
        ;;
    "build")
        build_dev_environment
        ;;
    "clean")
        clean_dev_environment
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    *)
        write_status "❌ Unknown action: $ACTION" "$RED"
        write_status "Available actions: start, stop, restart, logs, shell, status, build, clean, help" "$YELLOW"
        exit 1
        ;;
esac