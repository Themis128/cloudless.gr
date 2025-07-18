#!/bin/bash

echo "🚀 Starting integration test..."

# Start server directly from build output
echo "📦 Starting server from build output..."
node .output/server/index.mjs &
SERVER_PID=$!

# Wait for server to start (increased wait time)
echo "⏳ Waiting for server to start..."
sleep 15

# Test if server is responding - try multiple approaches
echo "🔍 Testing server response..."

# Try IPv6 localhost
if curl -f -s --connect-timeout 10 http://[::1]:3000 > /dev/null 2>&1; then
    echo "✅ Server is responding on IPv6"
elif curl -f -s --connect-timeout 10 http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Server is responding on IPv4"
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