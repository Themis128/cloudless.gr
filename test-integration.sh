#!/bin/bash
set -e

echo "🚀 Starting integration test..."
echo "📦 Launching server..."

# Start server and capture output
node .output/server/index.mjs --hostname=0.0.0.0 > server.log 2>&1 &
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

# Try curl against localhost
if curl -f http://127.0.0.1:3000 > /dev/null 2>&1; then
  echo "✅ Server is responding"
else
  echo "❌ Server is not responding"
  cat server.log
  kill $SERVER_PID
  exit 1
fi

# Kill server after test
kill $SERVER_PID
echo "✅ Integration test passed" 