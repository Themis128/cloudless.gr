#!/bin/bash
# Fix WSL2 kernel header symlinks
# WSL2 uses a custom Microsoft kernel, so apt can't find matching header packages.
# This script creates symlinks to the installed generic headers.

set -e

WSL2_KERNEL="6.6.87.2-microsoft-standard-WSL2"
GENERIC_HEADERS="/usr/src/linux-headers-6.8.0-124-generic"
GENERIC_SOURCE="/usr/src/linux-headers-6.8.0-124"
MODULE_DIR="/lib/modules/${WSL2_KERNEL}"

echo "WSL2 Kernel: $(uname -r)"
echo "Using generic headers: ${GENERIC_HEADERS}"

if [ ! -d "${GENERIC_HEADERS}" ]; then
    echo "ERROR: ${GENERIC_HEADERS} not found. Install with: sudo apt install linux-headers-generic"
    exit 1
fi

if [ ! -d "${MODULE_DIR}" ]; then
    echo "ERROR: ${MODULE_DIR} not found"
    exit 1
fi

# Create build symlink
sudo ln -sf "${GENERIC_HEADERS}" "${MODULE_DIR}/build"
echo "Created: ${MODULE_DIR}/build -> ${GENERIC_HEADERS}"

# Create source symlink
sudo ln -sf "${GENERIC_SOURCE}" "${MODULE_DIR}/source"
echo "Created: ${MODULE_DIR}/source -> ${GENERIC_SOURCE}"

# Verify
echo ""
echo "Verification:"
ls -la "${MODULE_DIR}/build"
ls -la "${MODULE_DIR}/source"
echo ""
echo "Done! Kernel headers are now available for building modules."