#!/usr/bin/env bash
# Install kubectl (if missing) and write kubeconfig for the Pi k3s API.
# On the office LAN: uses 192.168.1.128 (in cert SAN) — works without TUN.
# Off-LAN / userspace Tailscale: needs k3s tls-san for 100.x + SOCKS5 (see docs).
set -euo pipefail

LAN_IP="${CLOUDLESS_K3S_LAN_IP:-192.168.1.128}"
TS_IP="${CLOUDLESS_K3S_TS_IP:-100.74.191.58}"
KUBE_OUT="${KUBECONFIG_OUT:-$HOME/.kube/config-cloudless-ts}"
SOCK="${TS_SOCKET:-$HOME/.local/tailscale/tailscaled.sock}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

need_cmd() { command -v "$1" >/dev/null 2>&1; }
export PATH="$HOME/bin:$PATH"

echo "==> Ensuring userspace Tailscale…"
bash "$ROOT/scripts/ts-wsl.sh" status >/dev/null 2>&1 || true

pick_api() {
  if timeout 3 bash -c "echo >/dev/tcp/${LAN_IP}/6443" 2>/dev/null; then
    echo "$LAN_IP"
    return
  fi
  if timeout 3 bash -c "echo >/dev/tcp/${TS_IP}/6443" 2>/dev/null; then
    echo "$TS_IP"
    return
  fi
  # userspace: try SOCKS5
  if curl -sk --connect-timeout 5 --max-time 8 \
      --socks5-hostname 127.0.0.1:1055 "https://${TS_IP}:6443/version" >/dev/null 2>&1; then
    echo "$TS_IP"
    return
  fi
  echo ""
}

API_HOST="$(pick_api)"
if [[ -z "$API_HOST" ]]; then
  echo "ERROR: cannot reach k3s on ${LAN_IP}:6443 or ${TS_IP}:6443"
  echo "On office LAN this should just work. Off-LAN: install system Tailscale"
  echo "(with TUN) or add tls-san + use ALL_PROXY=socks5h://127.0.0.1:1055"
  exit 1
fi
echo "    API host: ${API_HOST}:6443"

if ! need_cmd kubectl; then
  echo "==> Installing kubectl to ~/bin…"
  mkdir -p "$HOME/bin"
  VER=$(curl -fsSL https://dl.k8s.io/release/stable.txt)
  curl -fsSLo "$HOME/bin/kubectl" "https://dl.k8s.io/release/${VER}/bin/linux/amd64/kubectl"
  chmod +x "$HOME/bin/kubectl"
fi

need_refresh=0
if [[ ! -s "$KUBE_OUT" ]]; then
  need_refresh=1
elif ! grep -q "server: https://${API_HOST}:6443" "$KUBE_OUT"; then
  need_refresh=1
fi

if [[ "$need_refresh" -eq 1 ]]; then
  echo "==> Fetching kubeconfig from omv (SSH once)…"
  mkdir -p "$(dirname "$KUBE_OUT")"
  ssh -o BatchMode=yes -o ConnectTimeout=20 \
    -o ProxyJump=tbaltzakis@192.168.1.130 \
    tbaltzakis@"$LAN_IP" 'cat ~/.kube/config' \
    | sed "s#https://${LAN_IP}:6443#https://${API_HOST}:6443#g" \
    > "$KUBE_OUT"
  chmod 600 "$KUBE_OUT"
fi

export KUBECONFIG="$KUBE_OUT"
# Prefer direct TCP; only set SOCKS when dialing Tailscale IP from userspace
if [[ "$API_HOST" == "$TS_IP" ]] && ! timeout 2 bash -c "echo >/dev/tcp/${TS_IP}/6443" 2>/dev/null; then
  export ALL_PROXY=socks5h://127.0.0.1:1055
  export HTTPS_PROXY=socks5h://127.0.0.1:1055
  echo "    using SOCKS5 proxy (userspace Tailscale)"
fi

echo "==> KUBECONFIG=$KUBECONFIG"
kubectl config current-context
kubectl get nodes -o wide
echo
echo "Shell:"
echo "  export PATH=\"\$HOME/bin:\$PATH\""
echo "  export KUBECONFIG=~/.kube/config-cloudless-ts"
echo "  export TS_SOCKET=~/.local/tailscale/tailscaled.sock"
