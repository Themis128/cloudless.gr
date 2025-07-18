#!/bin/bash

echo "🚀 Starting integration test..."

# Start server and redirect output to log
echo "📦 Starting server from build output..."
node .output/server/index.mjs > server.log 2>&1 &
SERVER_PID=$!

# Wait briefly for server to attempt startup
echo "⏳ Waiting for server to start..."
sleep 5

# Check if server is still running
if ps -p $SERVER_PID > /dev/null; then
  echo "✅ Server is still running (PID: $SERVER_PID)"
  # Wait a bit more for full startup
  sleep 10
else
  echo "❌ Server crashed. Logs:"
  cat server.log
  echo "📊 Checking if any node processes are running:"
  ps aux | grep node
  exit 1
fi

# Test if server is responding - try multiple approaches
echo "🔍 Testing server response..."

# Try different server variants
if curl -f -s --connect-timeout 10 http://192.168.0.23:3000 > /dev/null 2>&1; then
    echo "✅ Server is responding on 192.168.0.23:3000"
elif curl -f -s --connect-timeout 10 http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Server is responding on localhost"
elif curl -f -s --connect-timeout 10 http://127.0.0.1:3000 > /dev/null 2>&1; then
    echo "✅ Server is responding on 127.0.0.1"
else
    echo "❌ Server is not responding to any localhost variant"
    echo "📊 Checking server status..."
    ps aux | grep node
    echo "📊 Checking port 3000..."
    netstat -tlnp | grep :3000 || echo "Port 3000 not found"
    echo "📊 Checking server logs..."
    echo "Server PID: $SERVER_PID"
    if ps -p $SERVER_PID > /dev/null; then
        echo "Server process is still running"
    else
        echo "Server process has stopped"
    fi
    exit 1
fi

# Kill server
echo "🛑 Stopping server..."
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null

echo "✅ Integration test passed" 