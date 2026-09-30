#!/usr/bin/env python3
"""Cloudflare tunnels doctor — probe, remediate, re-probe.

Intended to run on omv (or any host with LAN SSH to omv + omv-ha).
Canonical ingress: infrastructure/cloudflare-tunnels/
cloudflared-config.yml

Env:
  DRY_RUN=1      — report only, no writes / restarts
  FIX=1          — apply NodePort patches + sync config + restart
  SKIP_PUBLIC=1  — skip public HTTPS probes (LAN-only)
  SSH_USER       — default tbaltzakis
  OMV_LAN/HA_LAN, OMV_TS/HA_TS
  REPO_ROOT      — default: repo root

Exit 0 only when public edges (and LAN checks) are healthy after fix."""

import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path


def truthy(v: str) -> bool:
    return v.lower() in ("1", "true", "yes")


DRY_RUN = truthy(os.environ.get("DRY_RUN", "0"))
FIX = truthy(os.environ.get("FIX", "1"))
SKIP_PUBLIC = truthy(os.environ.get("SKIP_PUBLIC", "0"))
SSH_USER = os.environ.get("SSH_USER", "tbaltzakis")
OMV_LAN = os.environ.get("OMV_LAN", "192.168.1.128")
HA_LAN = os.environ.get("HA_LAN", "192.168.1.130")
OMV_TS = os.environ.get("OMV_TS", "100.74.191.58")
HA_TS = os.environ.get("HA_TS", "100.95.117.84")
SSH_OPTS = [
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "ConnectTimeout=10",
]

REPO_ROOT = Path(os.environ.get("REPO_ROOT", Path(__file__).resolve().parent.parent))
CANONICAL = REPO_ROOT / "infrastructure/cloudflare-tunnels/cloudflared-config.yml"

print(f"==> Cloudflare tunnels doctor  DRY_RUN={int(DRY_RUN)} FIX={int(FIX)}")
print(f"    canonical={CANONICAL}")
if not CANONICAL.is_file():
    print(f"::error::Missing canonical config: {CANONICAL}", file=sys.stderr)
    sys.exit(1)


def ssh_ok(host: str) -> bool:
    return (
        subprocess.run(
            ["ssh", *SSH_OPTS, f"{SSH_USER}@{host}", "true"], capture_output=True
        ).returncode
        == 0
    )


def pick_host(lan: str, ts: str) -> str | None:
    for h in (lan, ts):
        if ssh_ok(h):
            return h
    return None


def remote(host: str, cmd: str = "", script: str = "") -> int:
    if script:
        return subprocess.run(
            ["ssh", *SSH_OPTS, f"{SSH_USER}@{host}", "bash", "-s"], input=script, text=True
        ).returncode
    return subprocess.call(["ssh", *SSH_OPTS, f"{SSH_USER}@{host}", cmd])


PUBLIC_URLS = [
    ("grafana", "https://grafana.cloudless.gr/api/health"),
    ("kuma", "https://kuma.cloudless.gr/"),
    ("n8n", "https://n8n.cloudless.gr/"),
    ("ntfy", "https://ntfy.cloudless.gr/"),
    ("espocrm", "https://espocrm.cloudless.gr/"),
    ("postiz", "https://postiz.cloudless.gr/"),
    ("appflowy", "https://appflowy.cloudless.gr/"),
    ("docs", "https://docs.cloudless.gr/"),
    ("meili", "https://meili.cloudless.gr/health"),
    ("logs", "https://logs.cloudless.gr/health"),
    ("webmail", "https://webmail.cloudless.gr/"),
    ("pi-origin", "https://pi-origin.cloudless.gr/api/health"),
]
OPTIONAL_PUBLIC: list[tuple[str, str]] = []

LAN_PORTS = [
    ("grafana", 30850, "/api/health"),
    ("n8n", 30900, "/"),
    ("ntfy", 30080, "/"),
    ("espocrm", 30700, "/"),
    ("postiz", 30500, "/"),
    ("appflowy", 30810, "/"),
    ("kuma", 32501, "/"),
    ("docs", 30901, "/"),
    ("meili", 30902, "/health"),
    ("logs", 30820, "/health"),
    ("app", 30300, "/api/health"),
]

OK_CODES = {200, 301, 302, 303, 307, 401, 403}


def http_code(url: str, timeout: int = 12) -> int | str:
    try:
        return urllib.request.urlopen(url, timeout=timeout).status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return "ERR"


def probe_public(phase: str) -> bool:
    fail = False
    print(f"\n=== Public edge ({phase}) ===")
    for name, url in PUBLIC_URLS:
        code = http_code(url)
        if isinstance(code, int) and code in OK_CODES:
            print(f"  OK  [{name}] {code}")
        else:
            print(f"  BAD [{name}] {code}  ({url})")
            fail = True
    for name, url in OPTIONAL_PUBLIC:
        code = http_code(url)
        if isinstance(code, int) and code in OK_CODES:
            print(f"  OK  [{name}] {code} (optional)")
        else:
            print(f"  WARN [{name}] {code} (optional — backend may be undeployed)")
    return not fail


def probe_lan(omv: str) -> bool:
    fail = False
    print(f"\n=== LAN origins via {omv} ===")
    for name, port, path in LAN_PORTS:
        code = http_code(f"http://{omv}:{port}{path}", timeout=5)
        if isinstance(code, int) and code in (*OK_CODES, 404):
            print(f"  OK  [{name}] :{port} → {code}")
        else:
            print(f"  BAD [{name}] :{port} → {code}")
            fail = True
    return not fail


# --- Resolve endpoints ---
OMV_EP = pick_host(OMV_LAN, OMV_TS)
if not OMV_EP:
    print(f"::error::Cannot SSH to omv ({OMV_LAN} / {OMV_TS})")
    sys.exit(1)
HA_EP = pick_host(HA_LAN, HA_TS)
if not HA_EP:
    print(f"::warning::Cannot SSH to omv-ha ({HA_LAN} / {HA_TS}) — will only fix omv")
print(f"    omv={OMV_EP}  omv-ha={HA_EP or 'UNREACHABLE'}")

pre_fail = False
if not SKIP_PUBLIC:
    pre_fail = not probe_public("before")
if not probe_lan(OMV_LAN):
    pre_fail = True

print("\n=== cloudflared status ===")
remote(
    OMV_EP,
    "systemctl is-active cloudflared; cloudflared tunnel "
    "info e977a490-58c5-4fdb-9155-86832e3e636a 2>/dev/null | "
    "head -15 || true",
)
if HA_EP:
    remote(HA_EP, "systemctl is-active cloudflared || echo inactive")

if not FIX:
    print("\n==> FIX=0 — probe only")
    if pre_fail:
        print("::error::Tunnel probes failed (FIX disabled)")
        sys.exit(1)
    print("==> Healthy")
    sys.exit(0)

# Don't mutate NodePorts / restart cloudflared when the edge is already
# healthy — a wrong targetPort takes down grafana + cloudless-app.
if not pre_fail and not DRY_RUN:
    print("\n==> Pre-probes healthy — skipping NodePort/config mutation")
    print("==> Tunnels healthy")
    sys.exit(0)

print("\n=== Ensure NodePorts ===")
if DRY_RUN:
    print("  [dry-run] would patch NodePorts (n8n 30900, ntfy 30080, grafana 30850, …)")
else:
    remote(
        OMV_EP,
        script="""\
set -euo pipefail
KUBE="sudo kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml"
patch() {
  local ns="$1" name="$2" json="$3"
  $KUBE patch svc "$name" -n "$ns" -p "$json" --type=merge 2>&1 || \
    echo "WARN: patch $ns/$name failed (may not exist)"
}
patch n8n n8n '{"spec":{"type":"NodePort","ports":[{"name":"http","port":5678,"targetPort":5678,"nodePort":30900}]}}'
patch ntfy ntfy '{"spec":{"type":"NodePort","ports":[{"name":"http","port":80,"targetPort":80,"nodePort":30080}]}}'
patch monitoring kube-prom-grafana '{"spec":{"type":"NodePort","ports":[{"name":"http","port":80,"targetPort":3000,"nodePort":30850}]}}' || true
patch postiz postiz '{"spec":{"type":"NodePort","ports":[{"name":"http","port":5000,"targetPort":5000,"nodePort":30500}]}}' || true
patch espocrm espocrm '{"spec":{"type":"NodePort","ports":[{"name":"http","port":80,"targetPort":80,"nodePort":30700}]}}' || true
patch appflowy nginx-nodeport '{"spec":{"type":"NodePort","ports":[{"name":"http","port":80,"targetPort":80,"nodePort":30810}]}}' || true
patch uptime-kuma uptime-kuma '{"spec":{"type":"NodePort","ports":[{"name":"http","port":3001,"targetPort":3001,"nodePort":32501}]}}' || true
patch default docs-service '{"spec":{"type":"NodePort","ports":[{"name":"http","port":8080,"targetPort":8080,"nodePort":30901}]}}' || true
patch meilisearch meilisearch '{"spec":{"type":"NodePort","ports":[{"name":"http","port":7700,"targetPort":7700,"nodePort":30902}]}}' || true
patch alert-manager alert-api '{"spec":{"type":"NodePort","ports":[{"name":"http","port":8080,"targetPort":8080,"nodePort":30820}]}}' || true
patch cloudless cloudless-app '{"spec":{"type":"NodePort","ports":[{"name":"http","port":80,"targetPort":3000,"nodePort":30300}]}}' || true
echo "NodePort patches attempted"
""",
    )

# --- Traefik IngressRoutes ---
ingressroutes = REPO_ROOT / "infrastructure/traefik/ingressroutes.yaml"
if ingressroutes.is_file():
    print("\n=== Apply Traefik IngressRoutes ===")
    if DRY_RUN:
        print(f"  [dry-run] would kubectl apply {ingressroutes} on omv")
    else:
        subprocess.run(
            [
                "scp",
                *SSH_OPTS,
                str(ingressroutes),
                f"{SSH_USER}@{OMV_EP}:/tmp/ingressroutes.doctor.yaml",
            ]
        )
        remote(
            OMV_EP,
            "sudo kubectl --kubeconfig "
            "/etc/rancher/k3s/k3s.yaml apply -f "
            "/tmp/ingressroutes.doctor.yaml",
        )

# --- Build host-specific configs ---
workdir = tempfile.mkdtemp()
omv_yml = Path(workdir) / "omv.yml"
ha_yml = Path(workdir) / "ha.yml"
omv_yml.write_text(CANONICAL.read_text())

text = CANONICAL.read_text()
text = text.replace("service: http://192.168.1.130:80", "service: http://localhost:80", 1)
text = re.sub(
    r"(- hostname: omv\.cloudless\.gr\n  service: )"
    r"http://localhost:80",
    r"\1http://192.168.1.128:80",
    text,
    count=1,
)
text = re.sub(
    r"(- hostname: ftp\.cloudless\.gr\n  service: )"
    r"http://localhost:21",
    r"\1http://192.168.1.128:21",
    text,
    count=1,
)
ha_yml.write_text(text)
print(f"wrote omv-ha variant {ha_yml}")


def apply_config(ep: str, local_file: Path, label: str) -> None:
    print(f"\n=== Sync cloudflared config → {label} ({ep}) ===")
    if DRY_RUN:
        n = len(local_file.read_text().splitlines())
        print(f"  [dry-run] would install {n} lines and restart cloudflared")
        r = subprocess.run(
            ["ssh", *SSH_OPTS, f"{SSH_USER}@{ep}", "sudo cat /etc/cloudflared/config.yml"],
            capture_output=True,
            text=True,
        )
        live = r.stdout
        if live:
            import difflib

            diff = difflib.unified_diff(
                live.splitlines(), local_file.read_text().splitlines(), lineterm=""
            )
            print("\n".join(list(diff)[:80]))
        return
    subprocess.run(
        ["scp", *SSH_OPTS, str(local_file), f"{SSH_USER}@{ep}:/tmp/cloudflared-config.doctor.yml"],
        check=True,
    )
    remote(
        ep,
        script="""\
set -euo pipefail
CFG=/etc/cloudflared/config.yml
sudo cp "$CFG" "$CFG.bak.doctor.$(date +%Y%m%d%H%M%S)"
sudo cp /tmp/cloudflared-config.doctor.yml "$CFG"
sudo systemctl enable --now cloudflared
sudo systemctl restart cloudflared
sleep 3
systemctl is-active cloudflared
grep -E 'hostname: (grafana|n8n|ntfy|espocrm|postiz|appflowy|logs|webmail|agent|vibe)' "$CFG" || true
""",
    )


apply_config(OMV_EP, omv_yml, "omv")
if HA_EP:
    apply_config(HA_EP, ha_yml, "omv-ha")

if not DRY_RUN:
    print("\nWaiting 15s for tunnel connectors to re-register…")
    time.sleep(15)

post_fail = not probe_lan(OMV_LAN)
if not SKIP_PUBLIC:
    if not probe_public("after"):
        post_fail = True

print()
if DRY_RUN:
    print(f"==> Dry-run complete (pre_fail={int(pre_fail)})")
    sys.exit(0)
if post_fail:
    print("::error::Tunnel doctor finished but probes still failing")
    sys.exit(1)
print("==> Tunnels healthy after doctor")
