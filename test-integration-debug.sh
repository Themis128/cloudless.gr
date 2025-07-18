#!/bin/bash
set -e

echo "🔍 Starting debug integration test..."

# Set environment variables
export NODE_ENV=production
export NUXT_HOST=0.0.0.0
export NUXT_PORT=3000

# Function to find the server file
find_server_file() {
  if [ -f ".output/server/index.mjs" ]; then
    echo ".output/server/index.mjs"
  elif [ -f ".output/server/index.js" ]; then
    echo ".output/server/index.js"
  elif [ -f ".output/server/index.cjs" ]; then
    echo ".output/server/index.cjs"
  else
    echo ""
  fi
}

# Check if build output exists
if [ ! -d ".output" ]; then
  echo "❌ Build output directory not found"
  echo "📁 Available directories:"
  ls -la | grep "^d" || true
  exit 1
fi

# Find the server file
SERVER_FILE=$(find_server_file)
if [ -z "$SERVER_FILE" ]; then
  echo "❌ Server build file not found in expected locations"
  echo "📁 .output directory contents:"
  ls -la .output/ || true
  if [ -d ".output/server" ]; then
    echo "📁 Server directory contents:"
    ls -la .output/server/ || true
  fi
  exit 1
fi

echo "📦 Found server file: $SERVER_FILE"
echo "📦 Launching server in debug mode..."

# Check if port 3000 is already in use
if lsof -i :3000 > /dev/null 2>&1; then
  echo "⚠️ Port 3000 is already in use. Attempting to kill existing process..."
  lsof -ti :3000 | xargs kill -9 2>/dev/null || true
  sleep 2
fi

# Test server file syntax first
echo "🔧 Testing server file syntax..."
if node --check "$SERVER_FILE" 2>/dev/null; then
  echo "✅ Server file syntax is valid"
else
  echo "❌ Server file has syntax errors"
  node --check "$SERVER_FILE"
  exit 1
fi

# Try to run server directly to see immediate errors
echo "🔧 Testing server startup directly..."
if timeout 10s node "$SERVER_FILE" 2>&1; then
  echo "✅ Server started successfully in direct mode"
else
  echo "❌ Server failed to start in direct mode"
  echo "🔍 Trying with more verbose output..."
  
  # Try with more verbose Node.js output
  NODE_OPTIONS="--trace-warnings --trace-uncaught" timeout 10s node "$SERVER_FILE" 2>&1 || true
fi

# Now try the background approach with better logging
echo "🔧 Testing server in background mode with enhanced logging..."

# Start server and capture ALL output
node "$SERVER_FILE" > server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Function to cleanup
cleanup() {
  if [ -n "$SERVER_PID" ] && ps -p $SERVER_PID > /dev/null 2>&1; then
    echo "🧹 Cleaning up server process..."
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
  fi
}

# Set trap for cleanup
trap cleanup EXIT

# Wait for server to start (with timeout)
echo "⏳ Waiting for server to start..."
TIMEOUT=20
COUNTER=0

while [ $COUNTER -lt $TIMEOUT ]; do
  # Check if server crashed
  if ! ps -p $SERVER_PID > /dev/null 2>&1; then
    echo "❌ Server crashed during startup."
    echo "📋 Server logs:"
    cat server.log
    echo ""
    echo "🔍 Additional debugging information:"
    echo "📁 Current directory: $(pwd)"
    echo "📁 .output contents:"
    ls -la .output/ 2>/dev/null || echo "No .output directory"
    echo "📁 .output/server contents:"
    ls -la .output/server/ 2>/dev/null || echo "No server directory"
    echo "🔧 Node.js version: $(node --version)"
    echo "🔧 NPM version: $(npm --version)"
    echo "🔧 Environment variables:"
    echo "   NODE_ENV: $NODE_ENV"
    echo "   NUXT_HOST: $NUXT_HOST"
    echo "   NUXT_PORT: $NUXT_PORT"
    echo "🔧 Process information:"
    ps aux | grep node | grep -v grep || echo "No node processes found"
    echo "🔧 Port information:"
    lsof -i :3000 2>/dev/null || echo "No processes on port 3000"
    exit 1
  fi
  
  # Check if server is responding
  if curl -f -s --connect-timeout 2 http://127.0.0.1:3000 > /dev/null 2>&1; then
    echo "✅ Server is responding on http://127.0.0.1:3000"
    break
  fi
  
  # Show progress every 3 seconds
  if [ $((COUNTER % 3)) -eq 0 ]; then
    echo "⏳ Still waiting... ($COUNTER/$TIMEOUT seconds)"
    echo "📋 Recent server logs:"
    tail -15 server.log 2>/dev/null || echo "No logs yet"
    echo ""
  fi
  
  sleep 1
  COUNTER=$((COUNTER + 1))
  
  if [ $COUNTER -eq $TIMEOUT ]; then
    echo "❌ Server did not respond within $TIMEOUT seconds"
    echo "📋 Full server logs:"
    cat server.log
    echo ""
    echo "🔍 Process information:"
    ps aux | grep node | grep -v grep || echo "No node processes found"
    echo "🔍 Port information:"
    lsof -i :3000 2>/dev/null || echo "No processes on port 3000"
    exit 1
  fi
done

# Additional health checks
echo "🔍 Running health checks..."

# Check if we can get the homepage
if curl -f -s http://127.0.0.1:3000 | grep -q "<!DOCTYPE html" 2>/dev/null; then
  echo "✅ Homepage returns valid HTML"
else
  echo "⚠️ Homepage might not be returning valid HTML"
  echo "📋 Homepage content (first 200 chars):"
  curl -f -s http://127.0.0.1:3000 | head -c 200 || echo "Could not fetch homepage"
fi

# Check server response headers
echo "📊 Server response headers:"
curl -I -s http://127.0.0.1:3000 | head -5 || true

echo "✅ Debug integration test passed" 