#!/bin/bash

echo "🧪 Testing Docker build process..."
echo "=================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running"
    exit 1
fi

echo "✅ Docker is running"

# Clean up any existing test images
echo "🧹 Cleaning up existing test images..."
docker rmi cloudlessgr-app:test 2>/dev/null || true

# Build the test image
echo "🔨 Building test Docker image..."
docker build \
    --target runner \
    --tag cloudlessgr-app:test \
    --build-arg VERSION="test" \
    --build-arg GIT_COMMIT="test" \
    --build-arg GIT_BRANCH="test" \
    --build-arg BUILD_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    --build-arg NODE_ENV=production \
    -f Dockerfile .

if [ $? -eq 0 ]; then
    echo "✅ Docker build successful!"
    
    # List the image
    echo "📋 Built image details:"
    docker images cloudlessgr-app:test
    
    # Test the image
    echo "🧪 Testing Docker image..."
    docker run --rm --name test-container cloudlessgr-app:test echo "✅ Container test successful"
    
    if [ $? -eq 0 ]; then
        echo "✅ Docker image test passed!"
        
        # Clean up
        echo "🧹 Cleaning up test image..."
        docker rmi cloudlessgr-app:test
        
        echo "🎉 All Docker tests passed!"
        exit 0
    else
        echo "❌ Docker container test failed"
        exit 1
    fi
else
    echo "❌ Docker build failed"
    exit 1
fi 