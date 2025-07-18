#!/bin/bash
set -e

echo "🚀 Starting integration test with debug..."
echo "📦 Launching server..."

# Check if .output exists
if [ ! -d ".output" ]; then
  echo "❌ .output directory not found. Please run 'npm run build' first."
  exit 1
fi

# Check if server file exists
if [ ! -f ".output/server/index.mjs" ]; then
  echo "❌ Server file not found at .output/server/index.mjs"
  exit 1
fi

# Set environment variables
export NODE_ENV=production
export NUXT_HOST=0.0.0.0
export NUXT_PORT=3000

echo "Environment:"
echo "  NODE_ENV: $NODE_ENV"
echo "  NUXT_HOST: $NUXT_HOST"
echo "  NUXT_PORT: $NUXT_PORT"

# Start server and capture output
echo "Starting server..."
node .output/server/index.mjs --hostname=0.0.0.0 --port=3000 > server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait briefly for the server to try starting
sleep 5

# Check if server crashed
if ! ps -p $SERVER_PID > /dev/null; then
  echo "❌ Server crashed during startup. Here are the logs:"
  cat server.log
  exit 1
fi

echo "✅ Server is still running"

# Try curl against localhost
if curl -f http://127.0.0.1:3000 > /dev/null 2>&1; then
  echo "✅ Server is responding"
else
  echo "❌ Server is not responding"
  echo "📋 Server logs:"
  cat server.log
  kill $SERVER_PID
  exit 1
fi

# Kill server after test
kill $SERVER_PID
echo "✅ Integration test passed" 