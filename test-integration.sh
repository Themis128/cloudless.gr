#!/bin/bash
set -e

echo "🚀 Starting integration test..."

# Start server in background, redirect output to log
echo "📦 Launching server..."
node .output/server/index.mjs --hostname=0.0.0.0 > server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Give the server time to initialize
sleep 5

# Check if the server is still running
if ps -p $SERVER_PID > /dev/null; then
  echo "✅ Server is still running"
else
  echo "❌ Server crashed during startup. Here are the logs:"
  cat server.log
  exit 1
fi

# Try connecting via IPv4 and IPv6
echo "🔍 Testing server response..."

if curl -f http://127.0.0.1:3000 > /dev/null 2>&1 \
  || curl -f http://localhost:3000 > /dev/null 2>&1 \
  || curl -f http://[::1]:3000 > /dev/null 2>&1; then
  echo "✅ Server responded successfully"
else
  echo "❌ Server didn't respond correctly. Logs:"
  cat server.log

  echo "📊 Process check:"
  ps -p $SERVER_PID || echo "Process $SERVER_PID not found"

  echo "📊 Port 3000 status:"
  netstat -tlnp | grep :3000 || echo "No listener on port 3000"

  kill $SERVER_PID || true
  exit 1
fi

# Clean up
kill $SERVER_PID || true
echo "✅ Integration test passed!" 