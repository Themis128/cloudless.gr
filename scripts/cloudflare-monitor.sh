#!/bin/bash
# Cloudflare Worker Health Monitor
# Run this to continuously monitor cloudless.gr service status

ENDPOINTS=(
  "https://cloudless.gr/api/health"
  "https://cloudless.gr/api/services"
)

while true; do
  echo "=== $(date -u +"%Y-%m-%dT%H:%M:%SZ") ==="
  for endpoint in "${ENDPOINTS[@]}"; do
    response=$(curl -s --max-time 5 "$endpoint" 2>/dev/null)
    if [ $? -eq 0 ]; then
      status=$(echo "$response" | jq -r '.status // .services // "ok"' 2>/dev/null || echo "parse-error")
      echo "✓ $endpoint: $status"
    else
      echo "✗ $endpoint: failed"
    fi
  done
  
  # Parse service status for issues
  services=$(curl -s --max-time 5 "https://cloudless.gr/api/services" 2>/dev/null | jq -r '.services | to_entries[] | select(.value == false) | .key' 2>/dev/null)
  if [ -n "$services" ]; then
    echo "Missing services: $services"
  fi
  
  echo ""
  sleep 60
done