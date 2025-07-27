#!/bin/bash
# Enhanced startup script for Cloudless.gr application
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Trap for cleanup on exit
cleanup() {
    log "Shutting down Cloudless.gr application..."
    exit 0
}

trap cleanup SIGTERM SIGINT

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for service to be ready
wait_for_service() {
    local service_name=$1
    local service_url=$2
    local max_attempts=${3:-30}
    local attempt=1

    log "Waiting for $service_name to be ready..."

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$service_url" >/dev/null 2>&1; then
            success "$service_name is ready!"
            return 0
        fi

        warning "Attempt $attempt/$max_attempts: $service_name not ready yet, waiting 5 seconds..."
        sleep 5
        attempt=$((attempt + 1))
    done

    error "$service_name failed to start within expected time"
    return 1
}

# Function to check system resources
check_system_resources() {
    log "Checking system resources..."

    # Check available memory
    local available_mem=$(free -m | awk 'NR==2{printf "%.0f", $7*100/$2}')
    if [ "$available_mem" -lt 20 ]; then
        warning "Low memory available: ${available_mem}%"
    else
        success "Memory available: ${available_mem}%"
    fi

    # Check disk space
    local disk_usage=$(df /app | awk 'NR==2{printf "%.0f", $5}')
    if [ "$disk_usage" -gt 90 ]; then
        warning "High disk usage: ${disk_usage}%"
    else
        success "Disk usage: ${disk_usage}%"
    fi
}

# Function to optimize Node.js settings
optimize_node_settings() {
    log "Optimizing Node.js settings..."

    # Set environment variables for optimal performance
    export NODE_ENV=development
    export NITRO_HOST=0.0.0.0
    export NITRO_PORT=3000
    export NUXT_HOST=0.0.0.0
    export NUXT_PORT=3000
    export HOST=0.0.0.0

    # Node.js optimizations
    export NODE_OPTIONS="--max-old-space-size=4096 --enable-source-maps --experimental-loader"

    # File watching optimizations
    export CHOKIDAR_USEPOLLING=true
    export CHOKIDAR_INTERVAL=50
    export WATCHPACK_POLLING=true
    export WATCHPACK_AGGREGATE_TIMEOUT=50

    # Vite optimizations
    export VITE_HMR_PORT=24678
    export VITE_HMR_HOST=0.0.0.0
    export VITE_HMR_OVERLAY=false
    export VITE_OPTIMIZE_DEPS_INCLUDE="vuetify,echarts,vue-echarts,@mdi/font"
    export VITE_OPTIMIZE_DEPS_EXCLUDE="vue-demi"

    # Development optimizations
    export NUXT_TELEMETRY_DISABLED=1
    export NITRO_PRESET=node
    export NITRO_COMPRESSION=false
    export NITRO_MINIFY=false

    success "Node.js settings optimized"
}

# Function to install dependencies
install_dependencies() {
    log "Installing dependencies..."

    if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
        log "Installing npm dependencies..."
        npm ci --prefer-offline --no-audit --silent
        success "Dependencies installed successfully"
    else
        success "Dependencies already installed, skipping..."
    fi
}

# Function to prepare the application
prepare_application() {
    log "Preparing Nuxt application..."

    # Generate Prisma client
    if command_exists npx; then
        log "Generating Prisma client..."
        npx prisma generate --silent
        success "Prisma client generated"
    fi

    # Prepare Nuxt
    log "Preparing Nuxt application..."
    npx nuxt prepare --silent
    success "Nuxt application prepared"
}

# Function to start the development server
start_development_server() {
    log "Starting development server..."

    echo ""
    echo "🚀 Cloudless.gr Development Server"
    echo "=================================="
    echo "   📱 Main app: http://localhost:3000"
    echo "   🔥 HMR: http://localhost:24678"
    echo "   🏥 Health: http://localhost:3000/api/health/simple"
    echo "   📊 Metrics: http://localhost:9323"
    echo "   🛠️  DevTools: Shift + Alt + D in browser"
    echo ""

    # Start the development server
    exec npm run dev
}

# Main startup sequence
main() {
    log "🚀 Starting Cloudless.gr application..."

    # Check system resources
    check_system_resources

    # Optimize Node.js settings
    optimize_node_settings

    # Install dependencies
    install_dependencies

    # Prepare application
    prepare_application

    # Wait for database and Redis (if needed)
    if [ "${WAIT_FOR_SERVICES:-true}" = "true" ]; then
        wait_for_service "PostgreSQL" "http://postgres-dev:5432" 30 || true
        wait_for_service "Redis" "http://redis-dev:6379" 30 || true
    fi

    # Start development server
    start_development_server
}

# Run main function
main "$@"
