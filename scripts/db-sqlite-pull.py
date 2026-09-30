#!/usr/bin/env python3
"""db-sqlite-pull.py — copy in-pod SQLite files to .local/db/ for
SQLTools.

n8n / Uptime Kuma / Grafana keep SQLite on PVCs (no TCP DB service).

Usage:
  python3 scripts/db-sqlite-pull.py           # all
  python3 scripts/db-sqlite-pull.py n8n|kuma|grafana"""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / ".local" / "db"
OUT.mkdir(parents=True, exist_ok=True)

# Bypass any configured proxy for cluster access
os.environ["NO_PROXY"] = (os.environ.get("NO_PROXY", "") +
                          ",127.0.0.1,::1,localhost,192.168.1.128,"
                          "192.168.1.130,10.43.0.0/16,10.42.0.0/16,"
                          ".svc,.cluster.local").lstrip(",")
os.environ["no_proxy"] = os.environ["NO_PROXY"]
for var in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy",
            "ALL_PROXY", "all_proxy", "SOCKS_PROXY", "SOCKS5_PROXY",
            "socks_proxy", "socks5_proxy"):
    os.environ.pop(var, None)


def kubectl(*args: str, check: bool = False) -> str:
    r = subprocess.run(["kubectl", *args], capture_output=True,
                       text=True)
    if check and r.returncode:
        sys.exit(r.returncode)
    return r.stdout.strip()


if subprocess.run(["kubectl", "get", "ns"],
                  capture_output=True).returncode:
    print("kubectl cannot reach the cluster", file=sys.stderr)
    sys.exit(1)


def find_pod(ns: str, selector: str = "", fallback_label: str = "",
             label_key: str = "app") -> str:
    sel = selector or f"{label_key}={fallback_label}"
    pod = kubectl("-n", ns, "get", "pod", "-l", sel, "-o",
                  "jsonpath={.items[0].metadata.name}")
    if not pod:
        pod = kubectl("-n", ns, "get", "pods", "-o",
                      "jsonpath={.items[0].metadata.name}")
    return pod


def pull_n8n() -> None:
    pod = find_pod("n8n", fallback_label="n8n")
    print(f"pulling n8n SQLite from {pod} …")
    kubectl("-n", "n8n", "exec", pod, "--", "sh", "-c",
            "test -f /home/node/.n8n/database.sqlite", check=True)
    kubectl("-n", "n8n", "cp",
            f"{pod}:/home/node/.n8n/database.sqlite",
            str(OUT / "n8n.sqlite"), check=True)
    print(f"→ {OUT}/n8n.sqlite")


def pull_kuma() -> None:
    pod = find_pod("uptime-kuma", fallback_label="uptime-kuma")
    print(f"pulling Uptime Kuma SQLite from {pod} …")
    src = kubectl(
        "-n", "uptime-kuma", "exec", pod, "--", "sh", "-c",
        'for f in /app/data/kuma.db /app/data/db/kuma.db '
        '/app/data/database.db; do'
        '  if [ -f "$f" ]; then echo "$f"; exit 0; fi;'
        'done;'
        'find /app/data -name "*.db" 2>/dev/null | head -1')
    if not src:
        print(f"no .db found under /app/data in {pod}",
              file=sys.stderr)
        sys.exit(1)
    kubectl("-n", "uptime-kuma", "cp", f"{pod}:{src}",
            str(OUT / "uptime-kuma.db"), check=True)
    print(f"→ {OUT}/uptime-kuma.db (from {src})")


def pull_grafana() -> None:
    pod = find_pod("monitoring",
                   selector="app.kubernetes.io/name=grafana")
    print(f"pulling Grafana SQLite from {pod} …")
    kubectl("-n", "monitoring", "exec", pod, "--", "sh", "-c",
            "test -f /var/lib/grafana/grafana.db", check=True)
    kubectl("-n", "monitoring", "cp",
            f"{pod}:/var/lib/grafana/grafana.db",
            str(OUT / "grafana.db"), check=True)
    print(f"→ {OUT}/grafana.db")


target = sys.argv[1] if len(sys.argv) > 1 else "all"
if target == "all":
    pull_n8n()
    pull_kuma()
    try:
        pull_grafana()
    except SystemExit:
        print("warn: grafana pull skipped")
elif target == "n8n":
    pull_n8n()
elif target in ("kuma", "uptime-kuma"):
    pull_kuma()
elif target == "grafana":
    pull_grafana()
else:
    print(f"Usage: {sys.argv[0]} [all|n8n|kuma|grafana]",
          file=sys.stderr)
    sys.exit(2)

print()
print("Open SQLTools connections: omv · n8n SQLite / omv · Uptime "
      "Kuma SQLite / omv · Grafana SQLite")
print("(Re-run this script after writes in the cluster — these are "
      "snapshots.)")
