#!/bin/bash
set -e

echo "🚀 Starting simple integration test..."

# Set environment variables
export NODE_ENV=production
export NUXT_HOST=0.0.0.0
export NUXT_PORT=3000

# Check if build output exists
if [ ! -d ".output" ]; then
  echo "❌ Build output directory not found"
  exit 1
fi

# Find server file
SERVER_FILE=""
for file in ".output/server/index.mjs" ".output/server/index.js" ".output/server/index.cjs"; do
  if [ -f "$file" ]; then
    SERVER_FILE="$file"
    break
  fi
done

if [ -z "$SERVER_FILE" ]; then
  echo "❌ No server file found"
  exit 1
fi

echo "📦 Testing server: $SERVER_FILE"

# Test server startup (timeout after 15 seconds)
echo "🔧 Starting server..."
timeout 15s node "$SERVER_FILE" > /dev/null 2>&1 &
SERVER_PID=$!

# Wait a moment
sleep 5

# Check if still running
if ps -p $SERVER_PID > /dev/null 2>&1; then
  echo "✅ Server started successfully"
  kill $SERVER_PID
  echo "✅ Simple integration test passed"
else
  echo "❌ Server failed to start"
  exit 1
fi 