#!/bin/bash

set -e

echo "🔍 Starting comprehensive integration test debug..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

print_error() {
    echo -e "${RED}$1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "❌ Not in project root directory"
    exit 1
fi

print_status "📋 Environment check..."
echo "Current directory: $(pwd)"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

# Check if .output exists
if [ ! -d ".output" ]; then
    print_error "❌ .output directory not found. Run 'npm run build' first."
    exit 1
fi

# Check if server file exists
if [ ! -f ".output/server/index.mjs" ]; then
    print_error "❌ Server file not found: .output/server/index.mjs"
    exit 1
fi

print_success "✅ Server file found: .output/server/index.mjs"

# Set environment variables with fallbacks
export NODE_ENV=production
export NUXT_HOST=0.0.0.0
export NUXT_PORT=3000
export NUXT_PUBLIC_SUPABASE_URL=${NUXT_PUBLIC_SUPABASE_URL:-"https://test.supabase.co"}
export NUXT_PUBLIC_SUPABASE_ANON_KEY=${NUXT_PUBLIC_SUPABASE_ANON_KEY:-"test-key-123456789"}

print_status "🔧 Environment variables set:"
echo "  NODE_ENV: $NODE_ENV"
echo "  NUXT_HOST: $NUXT_HOST"
echo "  NUXT_PORT: $NUXT_PORT"
echo "  NUXT_PUBLIC_SUPABASE_URL: $NUXT_PUBLIC_SUPABASE_URL"
echo "  NUXT_PUBLIC_SUPABASE_ANON_KEY: ${NUXT_PUBLIC_SUPABASE_ANON_KEY:0:10}..."

# Check if port is available
if lsof -Pi :$NUXT_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_warning "⚠️  Port $NUXT_PORT is already in use"
    lsof -Pi :$NUXT_PORT -sTCP:LISTEN
fi

# Test 1: Direct Node.js execution with verbose output
print_status "🧪 Test 1: Direct Node.js execution with verbose output..."
echo "Running: node --trace-warnings .output/server/index.mjs"

# Create a temporary log file
LOG_FILE=$(mktemp)
echo "Log file: $LOG_FILE"

# Run server with detailed output
timeout 30s node --trace-warnings .output/server/index.mjs > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# Wait a moment for startup
sleep 2

# Check if process is still running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    print_error "❌ Server process died immediately"
    echo "=== Server Output ==="
    cat "$LOG_FILE"
    echo "===================="
    rm -f "$LOG_FILE"
    exit 1
fi

print_success "✅ Server process started (PID: $SERVER_PID)"

# Wait for server to be ready
print_status "⏳ Waiting for server to be ready..."
for i in {1..10}; do
    if curl -s http://localhost:$NUXT_PORT >/dev/null 2>&1; then
        print_success "✅ Server is responding on port $NUXT_PORT"
        break
    fi
    echo "  Attempt $i/10..."
    sleep 1
done

# Test server response
if curl -s http://localhost:$NUXT_PORT >/dev/null 2>&1; then
    print_success "✅ Server is working correctly!"
    
    # Test specific endpoints
    print_status "🧪 Testing endpoints..."
    
    # Test health endpoint
    if curl -s http://localhost:$NUXT_PORT/api/health >/dev/null 2>&1; then
        print_success "✅ Health endpoint responding"
    else
        print_warning "⚠️  Health endpoint not responding"
    fi
    
    # Test root endpoint
    RESPONSE=$(curl -s -w "%{http_code}" http://localhost:$NUXT_PORT -o /dev/null)
    if [ "$RESPONSE" = "200" ]; then
        print_success "✅ Root endpoint responding with 200"
    else
        print_warning "⚠️  Root endpoint responding with $RESPONSE"
    fi
    
else
    print_error "❌ Server is not responding"
    echo "=== Server Output ==="
    cat "$LOG_FILE"
    echo "===================="
fi

# Cleanup
print_status "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null || true
rm -f "$LOG_FILE"

print_success "🎉 Integration test debug completed!" 