#!/usr/bin/env bash
# Print the URLs to use to access the dev server from Windows.
# Run this when 'localhost:4000' doesn't work from your Windows browser.

set -euo pipefail

WSL_IP=$(ip -4 addr show eth0 2>/dev/null | awk '/inet / {print $2}' | cut -d/ -f1 | head -1)
DISTRO=$(/mnt/c/Windows/System32/wsl.exe -l --running 2>&1 | tr -d '\0' | grep -i ubuntu | awk '{print $1}' | head -1 || echo "Ubuntu-24.04")
CONFIG_PATH="/mnt/c/Users/baltz/.wslconfig"

echo "=== WSL Networking Info ==="
echo "Distro:   ${DISTRO}"
echo "WSL IP:   ${WSL_IP}"
echo ""
echo "=== Dev URLs to try in your Windows browser ==="
echo "  http://localhost:4000        (works with mirrored mode)"
echo "  http://${WSL_IP}:4000        (always works — direct WSL IP)"
echo ""

if [ -f "$CONFIG_PATH" ]; then
  if grep -q "networkingMode=mirrored" "$CONFIG_PATH"; then
    echo "✓ .wslconfig has mirrored mode enabled."
    if [[ "$WSL_IP" == 172.* ]]; then
      echo "✗ But you're still on 172.x — WSL hasn't been restarted yet."
      echo ""
      echo "To activate mirrored mode, run this in Windows PowerShell (as Admin):"
      echo "  wsl --shutdown"
      echo "Then reopen your WSL terminal and run 'pnpm dev' again."
    else
      echo "✓ Mirrored mode is active — localhost:4000 should just work."
    fi
  else
    echo "ℹ .wslconfig does not have mirrored mode."
    echo "  http://${WSL_IP}:4000 is the way to go."
  fi
else
  echo "ℹ No .wslconfig found at $CONFIG_PATH"
fi
