#!/bin/bash
# Startup health check script for Cloudless.gr
set -e

echo "🏥 Performing startup health checks..."

# Wait for the application to be ready
MAX_ATTEMPTS=30
ATTEMPT=1
HEALTH_ENDPOINT="http://localhost:3000/api/health/simple"

echo "⏳ Waiting for application to be ready..."

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "   Attempt $ATTEMPT/$MAX_ATTEMPTS..."

    if curl -f -s "$HEALTH_ENDPOINT" > /dev/null 2>&1; then
        echo "✅ Application is healthy and ready!"
        echo "   - Health endpoint: $HEALTH_ENDPOINT"
        echo "   - Main app: http://localhost:3000"
        exit 0
    fi

    echo "   Application not ready yet, waiting 10 seconds..."
    sleep 10
    ATTEMPT=$((ATTEMPT + 1))
done

echo "❌ Application failed to start within expected time"
echo "   - Check logs: docker logs cloudlessgr-app-dev"
echo "   - Check container status: docker ps"
exit 1
