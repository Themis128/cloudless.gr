#!/bin/bash
# Script to run Tailscale diagnostics on Pi nodes via SSH

set -euo pipefail

# SSH connection details
OMV_USER="tbaltzakis"
OMV_HOST="192.168.1.128"
OMV_HA_HOST="192.168.1.130"
SSH_PASSWORD="themis"

# Function to run command on Pi via SSH
run_ssh() {
  local host=$1
  local cmd=$2

  echo "Running on $host: $cmd"
  sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$OMV_USER@$host" "$cmd"
}

# Run diagnostics on omv node
echo "=== Running diagnostics on omv node ==="
run_ssh "$OMV_HOST" "bash -s" < scripts/tailscale-diagnose.sh

# Run diagnostics on omv-ha node
echo "=== Running diagnostics on omv-ha node ==="
run_ssh "$OMV_HA_HOST" "bash -s" < scripts/tailscale-diagnose.sh

# Check Tailscale status
echo "=== Checking Tailscale status ==="
run_ssh "$OMV_HOST" "tailscale status"

# Check Tailscale ping
echo "=== Checking Tailscale ping ==="
run_ssh "$OMV_HOST" "ping -c 3 100.110.250.58"

# Check Tailscale service
echo "=== Checking Tailscale service ==="
run_ssh "$OMV_HOST" "systemctl status tailscale"

# Check firewall rules
echo "=== Checking firewall rules ==="
run_ssh "$OMV_HOST" "sudo iptables -L -n -v"

echo "Diagnostics complete. Check the output for any issues."