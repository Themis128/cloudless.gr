#!/usr/bin/env bash
# ts-diagnose.sh <ip> <port> — connectivity diagnosis for a tailnet node
IP="${1:-100.74.191.58}"; PORT="${2:-22}"
echo "=== tailscale status ==="; tailscale status 2>/dev/null | head -5 || echo "tailscaled not running here"
echo "=== ping $IP ==="; tailscale ping "$IP" -c 2 2>&1 | tail -3 || ping -c2 -W3 "$IP" 2>&1 | tail -3
echo "=== port $PORT ==="; python3 -c "import socket;s=socket.socket();s.settimeout(5);s.connect(('$IP',$PORT));print('open')" 2>&1
