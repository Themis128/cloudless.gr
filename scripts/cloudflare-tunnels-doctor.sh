#!/usr/bin/env bash
# Cloudflare tunnels doctor — probe, remediate, re-probe.
#
# Intended to run on omv (or any host with LAN SSH to omv + omv-ha).
# Canonical ingress: infrastructure/cloudflare-tunnels/cloudflared-config.yml
#
# Env:
#   DRY_RUN=1          — report only, no writes / restarts
#   FIX=1              — apply NodePort patches + sync config + restart
#   SKIP_PUBLIC=1      — skip public HTTPS probes (LAN-only)
#   SSH_USER           — default tbaltzakis
#   OMV_LAN / HA_LAN   — default 192.168.1.128 / 192.168.1.130
#   OMV_TS / HA_TS     — Tailscale IPs (fallback)
#   REPO_ROOT          — repo root (default: script ../..)
#
# Exit 0 only when public edges (and optional LAN checks) are healthy after fix.
set -euo pipefail

DRY_RUN="${DRY_RUN:-0}"
FIX="${FIX:-1}"
SKIP_PUBLIC="${SKIP_PUBLIC:-0}"
SSH_USER="${SSH_USER:-tbaltzakis}"
OMV_LAN="${OMV_LAN:-192.168.1.128}"
HA_LAN="${HA_LAN:-192.168.1.130}"
OMV_TS="${OMV_TS:-100.74.191.58}"
HA_TS="${HA_TS:-100.95.117.84}"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)

case "${DRY_RUN}" in 1|true|TRUE|yes|YES) DRY_RUN=1 ;; *) DRY_RUN=0 ;; esac
case "${FIX}" in 1|true|TRUE|yes|YES) FIX=1 ;; *) FIX=0 ;; esac
case "${SKIP_PUBLIC}" in 1|true|TRUE|yes|YES) SKIP_PUBLIC=1 ;; *) SKIP_PUBLIC=0 ;; esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
CANONICAL="${REPO_ROOT}/infrastructure/cloudflare-tunnels/cloudflared-config.yml"
KUBE="sudo kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml"

need() { command -v "$1" >/dev/null || { echo "missing $1" >&2; exit 1; }; }
need curl
need ssh
need python3

echo "==> Cloudflare tunnels doctor  DRY_RUN=$DRY_RUN FIX=$FIX"
echo "    canonical=$CANONICAL"

[[ -f "$CANONICAL" ]] || { echo "::error::Missing canonical config: $CANONICAL" >&2; exit 1; }

ssh_ok() {
  local host="$1"
  ssh "${SSH_OPTS[@]}" "${SSH_USER}@${host}" true 2>/dev/null
}

pick_host() {
  local lan="$1" ts="$2"
  if ssh_ok "$lan"; then echo "$lan"; return 0; fi
  if ssh_ok "$ts"; then echo "$ts"; return 0; fi
  return 1
}

remote() {
  local host="$1"
  shift
  ssh "${SSH_OPTS[@]}" "${SSH_USER}@${host}" "$@"
}

# --- Public edge probes (Access 302 = tunnel OK) ---
PUBLIC_URLS=(
  "grafana|https://grafana.cloudless.gr/api/health"
  "kuma|https://kuma.cloudless.gr/"
  "n8n|https://n8n.cloudless.gr/"
  "ntfy|https://ntfy.cloudless.gr/"
  "espocrm|https://espocrm.cloudless.gr/"
  "postiz|https://postiz.cloudless.gr/"
  "appflowy|https://appflowy.cloudless.gr/"
  "docs|https://docs.cloudless.gr/"
  "meili|https://meili.cloudless.gr/health"
  "logs|https://logs.cloudless.gr/health"
  "webmail|https://webmail.cloudless.gr/"
  "pi-origin|https://pi-origin.cloudless.gr/api/health"
)

# Optional apps — report but do not fail the job if backends are undeployed.
OPTIONAL_PUBLIC=(
  "agent|https://agent.cloudless.gr/"
  "vibe|https://vibe.cloudless.gr/"
)

# LAN origin ports expected on omv (must answer something other than timeout).
LAN_PORTS=(
  "grafana|30850|/api/health"
  "n8n|30900|/"
  "ntfy|30080|/"
  "espocrm|30700|/"
  "postiz|30500|/"
  "appflowy|30810|/"
  "kuma|32501|/"
  "docs|30901|/"
  "meili|30902|/health"
  "logs|30820|/health"
  "app|30300|/api/health"
)

probe_public() {
  local label="$1" phase="$2"
  local fail=0
  echo ""
  echo "=== Public edge ($phase) ==="
  local entry name url code
  for entry in "${PUBLIC_URLS[@]}"; do
    IFS='|' read -r name url <<<"$entry"
    code=$(curl -4 -sS -o /dev/null -w '%{http_code}' --max-time 12 "$url" 2>/dev/null || echo ERR)
    case "$code" in
      200|301|302|303|307|401|403)
        echo "  OK  [$name] $code"
        ;;
      *)
        echo "  BAD [$name] $code  ($url)"
        fail=1
        ;;
    esac
  done
  for entry in "${OPTIONAL_PUBLIC[@]}"; do
    IFS='|' read -r name url <<<"$entry"
    code=$(curl -4 -sS -o /dev/null -w '%{http_code}' --max-time 12 "$url" 2>/dev/null || echo ERR)
    case "$code" in
      200|301|302|303|307|401|403)
        echo "  OK  [$name] $code (optional)"
        ;;
      *)
        echo "  WARN [$name] $code (optional — backend may be undeployed)"
        ;;
    esac
  done
  return "$fail"
}

probe_lan() {
  local omv="$1"
  local fail=0
  echo ""
  echo "=== LAN origins via $omv ==="
  local entry name port path code
  for entry in "${LAN_PORTS[@]}"; do
    IFS='|' read -r name port path <<<"$entry"
    code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 \
      "http://${omv}:${port}${path}" 2>/dev/null || echo ERR)
    case "$code" in
      200|301|302|303|307|401|403|404)
        # 404 on some roots is fine if the port is open (e.g. alert-api /).
        echo "  OK  [$name] :$port → $code"
        ;;
      *)
        echo "  BAD [$name] :$port → $code"
        fail=1
        ;;
    esac
  done
  return "$fail"
}

# --- Resolve endpoints ---
OMV_EP=""
HA_EP=""
if ! OMV_EP=$(pick_host "$OMV_LAN" "$OMV_TS"); then
  echo "::error::Cannot SSH to omv ($OMV_LAN / $OMV_TS)"
  exit 1
fi
if ! HA_EP=$(pick_host "$HA_LAN" "$HA_TS"); then
  echo "::warning::Cannot SSH to omv-ha ($HA_LAN / $HA_TS) — will only fix omv"
  HA_EP=""
fi
echo "    omv=$OMV_EP  omv-ha=${HA_EP:-UNREACHABLE}"

PRE_FAIL=0
if [[ "$SKIP_PUBLIC" -eq 0 ]]; then
  probe_public "pre" "before" || PRE_FAIL=1
fi
probe_lan "$OMV_LAN" || PRE_FAIL=1

echo ""
echo "=== cloudflared status ==="
remote "$OMV_EP" 'systemctl is-active cloudflared; cloudflared tunnel info e977a490-58c5-4fdb-9155-86832e3e636a 2>/dev/null | head -15 || true'
if [[ -n "$HA_EP" ]]; then
  remote "$HA_EP" 'systemctl is-active cloudflared || echo inactive'
fi

if [[ "$FIX" -eq 0 ]]; then
  echo ""
  echo "==> FIX=0 — probe only"
  if [[ "$PRE_FAIL" -ne 0 ]]; then
    echo "::error::Tunnel probes failed (FIX disabled)"
    exit 1
  fi
  echo "==> Healthy"
  exit 0
fi

# --- Fix NodePorts on omv ---
echo ""
echo "=== Ensure NodePorts ==="
fix_nodeports() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "  [dry-run] would patch NodePorts (n8n 30900, ntfy 30080, grafana 30850, …)"
    return 0
  fi
  remote "$OMV_EP" bash -s <<'EOS'
set -euo pipefail
KUBE="sudo kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml"
patch() {
  local ns="$1" name="$2" json="$3"
  $KUBE patch svc "$name" -n "$ns" -p "$json" --type=merge 2>&1 || \
    echo "WARN: patch $ns/$name failed (may not exist)"
}
# Known self-hosted NodePorts used by cloudflared ingress
patch n8n n8n '{"spec":{"type":"NodePort","ports":[{"name":"http","port":5678,"targetPort":5678,"nodePort":30900}]}}'
patch ntfy ntfy '{"spec":{"type":"NodePort","ports":[{"name":"http","port":80,"targetPort":80,"nodePort":30080}]}}'
patch monitoring kube-prom-grafana '{"spec":{"type":"NodePort","ports":[{"name":"http","port":80,"targetPort":80,"nodePort":30850}]}}' || true
patch postiz postiz '{"spec":{"type":"NodePort","ports":[{"name":"http","port":5000,"targetPort":5000,"nodePort":30500}]}}' || true
patch espocrm espocrm '{"spec":{"type":"NodePort","ports":[{"name":"http","port":80,"targetPort":80,"nodePort":30700}]}}' || true
patch appflowy nginx-nodeport '{"spec":{"type":"NodePort","ports":[{"name":"http","port":80,"targetPort":80,"nodePort":30810}]}}' || true
patch uptime-kuma uptime-kuma '{"spec":{"type":"NodePort","ports":[{"name":"http","port":3001,"targetPort":3001,"nodePort":32501}]}}' || true
patch default docs-service '{"spec":{"type":"NodePort","ports":[{"name":"http","port":8080,"targetPort":8080,"nodePort":30901}]}}' || true
patch meilisearch meilisearch '{"spec":{"type":"NodePort","ports":[{"name":"http","port":7700,"targetPort":7700,"nodePort":30902}]}}' || true
patch alert-manager alert-api '{"spec":{"type":"NodePort","ports":[{"name":"http","port":8080,"targetPort":8080,"nodePort":30820}]}}' || true
patch cloudless cloudless-app '{"spec":{"type":"NodePort","ports":[{"name":"http","port":80,"targetPort":80,"nodePort":30300}]}}' || true
echo "NodePort patches attempted"
EOS
}
fix_nodeports

# --- Build host-specific configs from canonical ---
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT
cp "$CANONICAL" "$WORKDIR/omv.yml"

python3 - "$CANONICAL" "$WORKDIR/ha.yml" <<'PY'
import re, sys
src, dst = sys.argv[1:3]
text = open(src).read()
# omv-ha: webmail is local mail stack; omv/ftp must point at omv LAN, not ha localhost
text = text.replace("service: http://192.168.1.130:80", "service: http://localhost:80", 1)
text = re.sub(
    r"(- hostname: omv\.cloudless\.gr\n  service: )http://localhost:80",
    r"\1http://192.168.1.128:80",
    text,
    count=1,
)
text = re.sub(
    r"(- hostname: ftp\.cloudless\.gr\n  service: )http://localhost:21",
    r"\1http://192.168.1.128:21",
    text,
    count=1,
)
open(dst, "w").write(text)
print("wrote omv-ha variant", dst)
PY

apply_config() {
  local ep="$1" local_file="$2" label="$3"
  echo ""
  echo "=== Sync cloudflared config → $label ($ep) ==="
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "  [dry-run] would install $(wc -l < "$local_file") lines and restart cloudflared"
    # Show drift vs live
    remote "$ep" 'sudo cat /etc/cloudflared/config.yml' >"$WORKDIR/live-$label.yml" 2>/dev/null || true
    if [[ -f "$WORKDIR/live-$label.yml" ]]; then
      diff -u "$WORKDIR/live-$label.yml" "$local_file" | head -80 || true
    fi
    return 0
  fi
  scp "${SSH_OPTS[@]}" "$local_file" "${SSH_USER}@${ep}:/tmp/cloudflared-config.doctor.yml"
  remote "$ep" bash -s <<'EOS'
set -euo pipefail
CFG=/etc/cloudflared/config.yml
sudo cp "$CFG" "$CFG.bak.doctor.$(date +%Y%m%d%H%M%S)"
sudo cp /tmp/cloudflared-config.doctor.yml "$CFG"
sudo systemctl enable --now cloudflared
sudo systemctl restart cloudflared
sleep 3
systemctl is-active cloudflared
# Prefer matching hostnames from canonical
grep -E 'hostname: (grafana|n8n|ntfy|espocrm|postiz|appflowy|logs|webmail|agent|vibe)' "$CFG" || true
EOS
}

apply_config "$OMV_EP" "$WORKDIR/omv.yml" "omv"
if [[ -n "$HA_EP" ]]; then
  apply_config "$HA_EP" "$WORKDIR/ha.yml" "omv-ha"
fi

if [[ "$DRY_RUN" -eq 0 ]]; then
  echo ""
  echo "Waiting 15s for tunnel connectors to re-register…"
  sleep 15
fi

POST_FAIL=0
probe_lan "$OMV_LAN" || POST_FAIL=1
if [[ "$SKIP_PUBLIC" -eq 0 ]]; then
  probe_public "post" "after" || POST_FAIL=1
fi

echo ""
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "==> Dry-run complete (pre_fail=$PRE_FAIL)"
  exit 0
fi

if [[ "$POST_FAIL" -ne 0 ]]; then
  echo "::error::Tunnel doctor finished but probes still failing"
  exit 1
fi
echo "==> Tunnels healthy after doctor"
