#!/bin/bash

# Docker Image Versioning Script
# This script generates version tags for Docker images

set -e

# Get the current version from package.json
VERSION=$(node -p "require('./package.json').version")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Base image name
IMAGE_NAME="cloudlessgr-app"

# Generate different version tags
TAGS=(
    "${IMAGE_NAME}:latest"
    "${IMAGE_NAME}:v${VERSION}"
    "${IMAGE_NAME}:v${VERSION}-${GIT_COMMIT}"
    "${IMAGE_NAME}:${GIT_BRANCH}"
    "${IMAGE_NAME}:${GIT_BRANCH}-${GIT_COMMIT}"
)

# Build arguments
BUILD_ARGS=(
    "--build-arg" "VERSION=${VERSION}"
    "--build-arg" "GIT_COMMIT=${GIT_COMMIT}"
    "--build-arg" "GIT_BRANCH=${GIT_BRANCH}"
    "--build-arg" "BUILD_DATE=${BUILD_DATE}"
)

echo "Building Docker image with versioning..."
echo "Version: ${VERSION}"
echo "Git Commit: ${GIT_COMMIT}"
echo "Git Branch: ${GIT_BRANCH}"
echo "Build Date: ${BUILD_DATE}"
echo ""

# Build the image with all tags
TAG_ARGS=""
for tag in "${TAGS[@]}"; do
    TAG_ARGS="${TAG_ARGS} -t ${tag}"
done

# Build the image
docker build ${BUILD_ARGS[@]} ${TAG_ARGS} .

echo ""
echo "Successfully built image with tags:"
for tag in "${TAGS[@]}"; do
    echo "  - ${tag}"
done

# Save version info to a file for reference
cat > .docker-version << EOF
VERSION=${VERSION}
GIT_COMMIT=${GIT_COMMIT}
GIT_BRANCH=${GIT_BRANCH}
BUILD_DATE=${BUILD_DATE}
IMAGE_NAME=${IMAGE_NAME}
TAGS=${TAGS[@]}
EOF

echo ""
echo "Version information saved to .docker-version" 