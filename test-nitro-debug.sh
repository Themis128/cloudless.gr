#!/bin/bash

# Comprehensive Nitro Server Debug Script
set -e

echo "🔍 Comprehensive Nitro Server Debug"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
export NITRO_HOST=0.0.0.0
export NITRO_PORT=3000
export NITRO_LOG_LEVEL=debug
export NUXT_PUBLIC_SUPABASE_URL=${NUXT_PUBLIC_SUPABASE_URL:-"https://test.supabase.co"}
export NUXT_PUBLIC_SUPABASE_ANON_KEY=${NUXT_PUBLIC_SUPABASE_ANON_KEY:-"test-key-123456789"}

print_status "🔧 Environment variables set:"
echo "  NODE_ENV: $NODE_ENV"
echo "  NITRO_HOST: $NITRO_HOST"
echo "  NITRO_PORT: $NITRO_PORT"
echo "  NITRO_LOG_LEVEL: $NITRO_LOG_LEVEL"
echo "  NUXT_PUBLIC_SUPABASE_URL: $NUXT_PUBLIC_SUPABASE_URL"
echo "  NUXT_PUBLIC_SUPABASE_ANON_KEY: ${NUXT_PUBLIC_SUPABASE_ANON_KEY:0:10}..."

# Check file permissions and dependencies
print_status "🔍 Checking file permissions and dependencies..."
echo "Server file permissions:"
ls -la .output/server/index.mjs
echo "Node modules (first 10):"
ls -la .output/server/node_modules | head -10
echo "Package.json exists: $(test -f .output/server/package.json && echo 'Yes' || echo 'No')"

# Check for critical dependencies
print_status "🔍 Checking critical dependencies..."
if [ -f ".output/server/package.json" ]; then
    echo "Critical dependencies check:"
    if grep -q '"h3"' .output/server/package.json; then
        print_success "✅ h3 found"
    else
        print_error "❌ h3 missing"
    fi
    
    if grep -q '"nitro"' .output/server/package.json; then
        print_success "✅ nitro found"
    else
        print_error "❌ nitro missing"
    fi
    
    if grep -q '"vue"' .output/server/package.json; then
        print_success "✅ vue found"
    else
        print_error "❌ vue missing"
    fi
fi

# Test 1: Syntax check
print_status "🧪 Test 1: Syntax check..."
if node --check .output/server/index.mjs 2>/dev/null; then
    print_success "✅ Syntax check passed"
else
    print_error "❌ Syntax check failed"
    node --check .output/server/index.mjs
fi

# Test 2: Module loading test
print_status "🧪 Test 2: Module loading test..."
if timeout 10s node --input-type=module --trace-warnings .output/server/index.mjs > /dev/null 2>&1; then
    print_success "✅ Module loading test passed"
else
    print_error "❌ Module loading test failed"
    echo "Trying with more verbose output..."
    timeout 10s node --input-type=module --trace-warnings --trace-uncaught .output/server/index.mjs 2>&1 || true
fi

# Test 3: Direct execution with full error capture
print_status "🧪 Test 3: Direct execution with full error capture..."
echo "Running: node --trace-warnings --trace-uncaught .output/server/index.mjs"

# Create a temporary log file
LOG_FILE=$(mktemp)
echo "Log file: $LOG_FILE"

# Run server with detailed output
timeout 30s node --trace-warnings --trace-uncaught .output/server/index.mjs > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# Wait a moment for startup
sleep 3

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
    if curl -s http://localhost:$NITRO_PORT >/dev/null 2>&1; then
        print_success "✅ Server is responding on port $NITRO_PORT"
        break
    fi
    echo "  Attempt $i/10..."
    sleep 1
done

# Test server response
if curl -s http://localhost:$NITRO_PORT >/dev/null 2>&1; then
    print_success "✅ Server is working correctly!"
    
    # Test specific endpoints
    print_status "🧪 Testing endpoints..."
    
    # Test health endpoint
    if curl -s http://localhost:$NITRO_PORT/api/health >/dev/null 2>&1; then
        print_success "✅ Health endpoint responding"
    else
        print_warning "⚠️  Health endpoint not responding"
    fi
    
    # Test root endpoint
    RESPONSE=$(curl -s -w "%{http_code}" http://localhost:$NITRO_PORT -o /dev/null)
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

print_success "🎉 Comprehensive Nitro debug completed!" 