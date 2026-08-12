#!/usr/bin/env bash
# configure-pi-firewall.sh — SSH-safe host firewall for omv / omv-ha.
#
# Goals (per Tailscale docs: classic OpenSSH over the mesh, not Tailscale SSH):
#   - Allow SSH from Tailscale CGNAT (100.64.0.0/10) WITHOUT ufw rate-limit
#   - Allow SSH from LAN 192.168.1.0/24 without rate-limit
#   - Keep public SSH rate-limited (omv) or closed (omv-ha preference)
#   - Always allow Tailscale UDP 41641 + established
#
# Run as root on the Pi:
#   sudo bash configure-pi-firewall.sh
set -euo pipefail
[ "$EUID" = "0" ] || { echo "must be root" >&2; exit 1; }

LAN_CIDR="${PI_LAN_CIDR:-192.168.1.0/24}"
TS_CGNAT="100.64.0.0/10"
HOST="$(hostname -s 2>/dev/null || hostname)"

echo "[fw] host=$HOST"

if command -v ufw >/dev/null 2>&1; then
  echo "[fw] configuring ufw"
  ufw --force enable || true

  # Specific allows MUST precede any LIMIT Anywhere (ufw first-match wins).
  while ufw status numbered | grep -qE 'cloudless-ssh-ts|cloudless-ssh-lan|cloudless-ssh-public|22/tcp.*LIMIT'; do
    NUM=$(ufw status numbered | grep -E 'cloudless-ssh-ts|cloudless-ssh-lan|cloudless-ssh-public|22/tcp.*LIMIT' | head -1 | sed -n 's/^\[\s*\([0-9]*\)\].*/\1/p')
    [[ -z "$NUM" ]] && break
    yes | ufw delete "$NUM" >/dev/null || break
  done

  ufw insert 1 allow from "$TS_CGNAT" to any port 22 proto tcp comment 'cloudless-ssh-ts'
  ufw insert 2 allow from "$LAN_CIDR" to any port 22 proto tcp comment 'cloudless-ssh-lan'
  ufw limit 22/tcp comment 'cloudless-ssh-public-limit'

  # Broad Tailscale allow (non-SSH) if missing
  if ! ufw status | grep -qF '100.64.0.0/10'; then
    ufw allow from "$TS_CGNAT" comment 'cloudless-tailscale-net' || true
  fi
  if ! ufw status | grep -q '41641/udp'; then
    ufw allow 41641/udp comment 'cloudless-tailscale-wireguard' || true
  fi

  # Avoid full reload mid-session when possible — enable is enough if already active
  ufw status verbose | head -40
else
  echo "[fw] no ufw — installing nftables SSH allow set (omv-ha style)"
  command -v nft >/dev/null || { echo "nft not found"; exit 1; }

  nft list table inet cloudless_fw >/dev/null 2>&1 && nft delete table inet cloudless_fw || true
  nft -f - <<EOF
table inet cloudless_fw {
  chain input {
    type filter hook input priority -10; policy accept;
    ct state established,related accept
    iifname "lo" accept
    iifname "tailscale0" accept
    udp dport 41641 accept
    tcp dport 22 ip saddr ${LAN_CIDR} accept
    tcp dport 22 ip saddr ${TS_CGNAT} accept
  }
}
EOF
  echo "[fw] nft table inet cloudless_fw installed"
  nft list table inet cloudless_fw
fi

# Tailscale SSH stays off — classic sshd only
if command -v tailscale >/dev/null 2>&1; then
  tailscale set --ssh=false || true
fi

echo "[fw] done"
