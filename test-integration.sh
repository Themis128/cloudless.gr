#!/bin/bash
set -e

echo "🚀 Starting integration test..."

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
echo "📦 Launching server..."

# Start server and capture output
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
TIMEOUT=30
COUNTER=0

while [ $COUNTER -lt $TIMEOUT ]; do
  # Check if server crashed
  if ! ps -p $SERVER_PID > /dev/null 2>&1; then
    echo "❌ Server crashed during startup. Here are the logs:"
    cat server.log
    exit 1
  fi
  
  # Check if server is responding
  if curl -f -s --connect-timeout 2 http://127.0.0.1:3000 > /dev/null 2>&1; then
    echo "✅ Server is responding on http://127.0.0.1:3000"
    break
  fi
  
  sleep 1
  COUNTER=$((COUNTER + 1))
  
  if [ $COUNTER -eq $TIMEOUT ]; then
    echo "❌ Server did not respond within $TIMEOUT seconds"
    echo "📋 Server logs:"
    cat server.log
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
fi

# Check server response headers
echo "📊 Server response headers:"
curl -I -s http://127.0.0.1:3000 | head -5 || true

echo "✅ Integration test passed" 