#!/usr/bin/env bash
# Cluster + node + runner status snapshot.
#
# Outputs JSON + Markdown. Designed to run on a Pi self-hosted GH runner
# that has kubectl (k3s context), tailscale, and the GH CLI authenticated.
#
# Usage:
#   bash scripts/audit/cluster-status.sh --json out.json --md out.md

set -uo pipefail

JSON_OUT=""
MD_OUT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --json) JSON_OUT="$2"; shift 2 ;;
    --md)   MD_OUT="$2";   shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

generated_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Each tool may be missing or unauthorized; treat absence as a soft signal
# and keep collecting the rest.
have() { command -v "$1" >/dev/null 2>&1; }

# ── k3s cluster info ──────────────────────────────────────────────────
cluster_reachable=false
api_server=""
k3s_version=""
nodes_json="[]"
namespaces_json="[]"
pods_json="[]"

if have kubectl; then
  if kubectl get --raw=/healthz >/dev/null 2>&1; then
    cluster_reachable=true
    api_server=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}' 2>/dev/null || echo "")
    k3s_version=$(kubectl version --short 2>/dev/null | grep -i "server version" | awk '{print $3}' || echo "")
  fi

  if [[ "$cluster_reachable" == "true" ]]; then
    nodes_json=$(kubectl get nodes -o json 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
out = []
for n in data.get('items', []):
    name = n['metadata']['name']
    conds = {c['type']: c['status'] for c in n['status'].get('conditions', [])}
    capacity = n['status'].get('capacity', {})
    allocatable = n['status'].get('allocatable', {})
    nodeinfo = n['status'].get('nodeInfo', {})
    out.append({
        'name': name,
        'status': 'Ready' if conds.get('Ready') == 'True' else 'NotReady',
        'reason': '' if conds.get('Ready') == 'True' else conds.get('Ready', 'Unknown'),
        'os': nodeinfo.get('osImage',''),
        'arch': nodeinfo.get('architecture',''),
        'kubelet': nodeinfo.get('kubeletVersion',''),
        'cpu': capacity.get('cpu',''),
        'memory': capacity.get('memory',''),
        'pods_capacity': capacity.get('pods',''),
        'memory_pressure': conds.get('MemoryPressure', '?'),
        'disk_pressure': conds.get('DiskPressure', '?'),
    })
print(json.dumps(out))
" 2>/dev/null || echo "[]")

    namespaces_json=$(kubectl get ns -o jsonpath='{.items[*].metadata.name}' 2>/dev/null | tr ' ' '\n' | jq -R . | jq -s . 2>/dev/null || echo "[]")

    pods_json=$(kubectl get pods -A -o json 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
agg = {}
for p in data.get('items', []):
    ns = p['metadata']['namespace']
    phase = p['status'].get('phase', 'Unknown')
    container_statuses = p['status'].get('containerStatuses') or []
    # Detect CrashLoopBackOff
    for cs in container_statuses:
        ws = (cs.get('state') or {}).get('waiting') or {}
        if ws.get('reason') in ('CrashLoopBackOff','ImagePullBackOff','ErrImagePull'):
            phase = ws['reason']
            break
    agg.setdefault(ns, {})
    agg[ns][phase] = agg[ns].get(phase, 0) + 1
out = []
for ns, phases in sorted(agg.items()):
    out.append({'namespace': ns, **phases})
print(json.dumps(out))
" 2>/dev/null || echo "[]")
  fi
fi

# ── GH Actions runner inventory ───────────────────────────────────────
runners_json="[]"
if have gh; then
  runners_json=$(gh api repos/Themis128/cloudless.gr/actions/runners --jq '[.runners[] | {name, os, status, busy, labels: [.labels[].name]}]' 2>/dev/null || echo "[]")
fi

# ── Tailscale connectivity ────────────────────────────────────────────
tailscale_json="[]"
if have tailscale; then
  tailscale_json=$(tailscale status --json 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
peers = []
self = data.get('Self', {})
peers.append({'name': self.get('HostName',''), 'ip': (self.get('TailscaleIPs') or [''])[0], 'online': self.get('Online', False), 'self': True})
for p in (data.get('Peer') or {}).values():
    peers.append({
        'name': p.get('HostName',''),
        'ip': (p.get('TailscaleIPs') or [''])[0],
        'online': p.get('Online', False),
        'lastSeen': p.get('LastSeen',''),
        'self': False,
    })
print(json.dumps(peers))
" 2>/dev/null || echo "[]")
fi

# ── Assemble JSON ─────────────────────────────────────────────────────
# Write each subprocess output to a temp file and have Python read them.
# The previous heredoc embedded the JSON values into a Python triple-quoted
# string which broke any time the kubectl output contained quotes or newlines —
# silently producing an empty cluster.json. Temp files sidestep all quoting.
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
printf '%s' "$nodes_json"      > "$tmpdir/nodes.json"
printf '%s' "$namespaces_json" > "$tmpdir/namespaces.json"
printf '%s' "$pods_json"       > "$tmpdir/pods.json"
printf '%s' "$runners_json"    > "$tmpdir/runners.json"
printf '%s' "$tailscale_json"  > "$tmpdir/tailscale.json"

export GENERATED_AT="$generated_at" CLUSTER_REACHABLE="$cluster_reachable" \
       API_SERVER="$api_server" K3S_VERSION="$k3s_version" TMPDIR_OUT="$tmpdir"

payload=$(python3 - <<'PY'
import json, os
def load(name):
    try:
        with open(os.path.join(os.environ["TMPDIR_OUT"], name)) as f:
            return json.loads(f.read() or "[]")
    except Exception:
        return []
out = {
  "generatedAt": os.environ["GENERATED_AT"],
  "cluster": {
    "reachable": os.environ["CLUSTER_REACHABLE"] == "true",
    "apiServer": os.environ["API_SERVER"],
    "k3sVersion": os.environ["K3S_VERSION"],
  },
  "nodes":      load("nodes.json"),
  "namespaces": load("namespaces.json"),
  "pods":       load("pods.json"),
  "runners":    load("runners.json"),
  "tailscale":  load("tailscale.json"),
}
print(json.dumps(out, indent=2))
PY
)

if [[ -n "$JSON_OUT" ]]; then
  printf '%s\n' "$payload" > "$JSON_OUT"
  echo "JSON -> $JSON_OUT"
fi

# ── Markdown summary ──────────────────────────────────────────────────
if [[ -n "$MD_OUT" ]]; then
  {
    echo "## 🖥️ Cluster Status — $generated_at"
    echo ""

    # Cluster
    echo "### k3s"
    echo ""
    if [[ "$cluster_reachable" == "true" ]]; then
      echo "- ✅ API server reachable: \`$api_server\`"
      [[ -n "$k3s_version" ]] && echo "- Version: $k3s_version"
    else
      echo "- ❌ API server unreachable (kubeconfig missing or cluster down)"
    fi
    echo ""

    # Nodes
    echo "### Nodes"
    echo ""
    echo "| Name | Status | OS | Arch | CPU | Memory | Mem Pressure | Disk Pressure |"
    echo "|------|--------|----|------|-----|--------|--------------|---------------|"
    printf '%s\n' "$payload" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for n in d.get('nodes', []):
    icon = '✅' if n['status']=='Ready' else '❌'
    mp = n.get('memory_pressure','?')
    dp = n.get('disk_pressure','?')
    print(f\"| {n['name']} | {icon} {n['status']} | {n.get('os','')[:25]} | {n.get('arch','')} | {n.get('cpu','')} | {n.get('memory','')} | {mp} | {dp} |\")
"
    echo ""

    # Pods
    echo "### Pods by namespace"
    echo ""
    echo "| Namespace | Running | Pending | CrashLoopBackOff | Other |"
    echo "|-----------|---------|---------|------------------|-------|"
    printf '%s\n' "$payload" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for row in d.get('pods', []):
    ns = row['namespace']
    running = row.get('Running', 0)
    pending = row.get('Pending', 0)
    crash = row.get('CrashLoopBackOff', 0) + row.get('ImagePullBackOff', 0) + row.get('ErrImagePull', 0)
    other = sum(v for k,v in row.items() if k not in ('namespace','Running','Pending','CrashLoopBackOff','ImagePullBackOff','ErrImagePull') and isinstance(v, int))
    icon = '🔴 ' if crash else ''
    print(f\"| {icon}{ns} | {running} | {pending} | {crash} | {other} |\")
"
     echo ""

    # Runners
    echo "### Self-hosted GH runners"
    echo ""
    echo "| Name | Status | Busy | Labels |"
    echo "|------|--------|------|--------|"
    printf '%s\n' "$payload" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for r in d.get('runners', []):
    icon = '✅' if r['status']=='online' else '⚠️'
    busy = '🟡 busy' if r.get('busy') else '🟢 idle'
    labels = ', '.join(r.get('labels',[])[:6])
    print(f\"| {r['name']} | {icon} {r['status']} | {busy} | {labels} |\")
"
    echo ""

    # Tailscale
    echo "### Tailscale fleet"
    echo ""
    echo "| Host | IP | Online | Self |"
    echo "|------|----|--------|------|"
    printf '%s\n' "$payload" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for t in d.get('tailscale', []):
    on = '✅' if t.get('online') else '❌'
    me = '⭐' if t.get('self') else ''
    print(f\"| {t.get('name','')} | {t.get('ip','')} | {on} | {me} |\")
"
  } > "$MD_OUT"
  echo "Markdown -> $MD_OUT"
fi
