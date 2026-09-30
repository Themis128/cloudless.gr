#!/usr/bin/env python3
"""Read-only cluster diagnostics posted as a Markdown snapshot to
issue #382.

Runs under cluster-doctor.yml with tailscale joined and KUBECONFIG_B64
decoded. The workflow captures stdout via `tee snapshot.md`. Never
touches cluster state."""

import json
import os
import shutil
import subprocess
import sys
import urllib.request
from datetime import UTC, datetime

kbin = shutil.which("kubectl") or "kubectl"
if not kbin:
    print("# Cluster snapshot\n")
    print("_kubectl is not on PATH — doctor cannot run._")
    sys.exit(0)


def k(*args: str, timeout: int = 30) -> str:
    r = subprocess.run([kbin, *args], capture_output=True, text=True, timeout=timeout)
    return r.stdout + r.stderr


now_utc = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%SZ")
git_sha = os.environ.get("GITHUB_SHA", "")
if not git_sha and os.path.isdir(".git"):
    r = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True)
    git_sha = r.stdout.strip()
short_sha = git_sha[:12]

print(f"# Cluster snapshot — {now_utc}\n")
print(f"**Expected app SHA (main HEAD):** `{short_sha or 'unknown'}`\n")

# ── Reachability ──
r = subprocess.run(
    [kbin, "get", "--raw=/healthz", "--request-timeout=5s"], capture_output=True, text=True
)
if r.returncode:
    print("## ❌ kubectl cannot reach the k3s API\n")
    print("```")
    print("\n".join(k("cluster-info", "dump", "--request-timeout=5s").splitlines()[:20]))
    print("```\n")
    print("_Aborting further probes; the API server is unreachable._")
    sys.exit(0)
print(f"✅ k3s API reachable (`{k('config', 'current-context').strip()}`)\n")

# ── Nodes ──
print("## Nodes\n")
print("```")
print(k("get", "nodes", "-o", "wide").strip())
print("```\n")
print("```")
print(k("top", "nodes").strip() or "(metrics-server unavailable)")
print("```\n")

nodes = [
    ln.replace("node/", "") for ln in k("get", "nodes", "-o", "name").splitlines() if ln.strip()
]

# ── Per-node conditions ──
for node in nodes:
    print(f"### {node} — conditions & allocation")
    print("```")
    desc = k("describe", "node", node)
    lines = desc.splitlines()
    try:
        i = next(i for i, ln in enumerate(lines) if ln.startswith("Conditions:"))
        j = next(i for i, ln in enumerate(lines[i:], i) if ln.startswith("Addresses:"))
        print("\n".join(lines[i:j][:30]))
    except StopIteration:
        pass
    print("---")
    try:
        i = next(i for i, ln in enumerate(lines) if ln.startswith("Allocated resources:"))
        j = next(i for i, ln in enumerate(lines[i:], i) if ln.startswith("Events:"))
        print("\n".join(lines[i:j][:30]))
    except StopIteration:
        pass
    print("```\n")

# ── Pods by node ──
for node in nodes:
    print(f"## All pods on node `{node}`\n")
    print("```")
    print(k("get", "pods", "-A", "-o", "wide", f"--field-selector=spec.nodeName={node}").strip())
    print("```\n")

# ── Problem pods ──
print("## Pods not Running/Completed (all namespaces)\n")
print("```")
bad = [
    ln
    for ln in k("get", "pods", "-A", "--no-headers").splitlines()
    if len(ln.split()) > 4 and ln.split()[3] not in ("Running", "Completed")
]
print("\n".join(bad) if bad else "(none — every pod is Running or Completed)")
print("```\n")

# ── Restarts ──
print("## Pods with restart count > 0\n")
print("```")
rows = []
for ln in k("get", "pods", "-A", "--no-headers").splitlines():
    f = ln.split()
    if len(f) >= 6 and f[4].isdigit() and int(f[4]) > 0:
        rows.append((int(f[4]), ln))
for _n, ln in sorted(rows, reverse=True)[:20]:
    f = ln.split()
    print(
        f"{f[0]:<25} {f[1]:<45} ready={f[2]:<5} status={f[3]:<15} "
        f"restarts={f[4]} age={f[5] if len(f) > 5 else ''}"
    )
print("```\n")

print("## Highest-memory pods\n")
print("```")
print(
    "\n".join(k("top", "pods", "-A", "--sort-by=memory").splitlines()[:21])
    or "(pod metrics unavailable)"
)
print("```\n")

# ── cloudless-app Deployment ──
print("## cloudless-app — deployment\n")
print("```")
print(
    k("-n", "cloudless", "get", "deploy", "cloudless-app", "-o", "wide").strip()
    or "(deployment not found)"
)
print("```\n")

print("### cloudless-app — pods on omv")
print("```")
print(
    k("-n", "cloudless", "get", "pods", "-l", "app=cloudless-app", "-o", "wide").strip()
    or "(no pods)"
)
print("```\n")

print("### cloudless-app — container image & env sync")
pod = k(
    "-n",
    "cloudless",
    "get",
    "pod",
    "-l",
    "app=cloudless-app",
    "-o",
    "jsonpath={.items[0].metadata.name}",
).strip()
if pod:
    print("```")
    print(f"Pod name        : {pod}")
    for label, path in (
        ("Node            ", ".spec.nodeName"),
        ("Container image ", ".spec.containers[0].image"),
        ("Restart count   ", ".status.containerStatuses[0].restartCount"),
        ("Ready           ", ".status.containerStatuses[0].ready"),
        ("Started at      ", ".status.startTime"),
    ):
        print(
            f"{label}: "
            + k("-n", "cloudless", "get", "pod", pod, "-o", f"jsonpath={{{path}}}").strip()
        )
    print("\nAPP_VERSION env on live pod:")
    out = k("-n", "cloudless", "exec", pod, "--", "printenv", "APP_VERSION").strip()
    print("\n".join("  " + ln for ln in out.splitlines()) if out else "  (exec failed)")
    print("\nAPP_VERSION env from spec (last applied by deploy-pi.yml):")
    print(
        k(
            "-n",
            "cloudless",
            "get",
            "deploy",
            "cloudless-app",
            "-o",
            "jsonpath={.spec.template.spec.containers[0].env}",
        ).strip()
    )
    print("```")
else:
    print("_No cloudless-app pod found — deployment likely absent or renamed._")
print()

# ── Sync verdict ──
print("## App sync verdict\n")
live_version = ""
for url in (
    "http://192.168.1.128:30300/api/health",
    "http://192.168.1.130:30300/api/health",
    "https://pi-origin.cloudless.gr/api/health",
):
    try:
        body = urllib.request.urlopen(url, timeout=6).read()
        parsed = json.loads(body).get("version", "")
    except Exception:
        parsed, body = "", b""
    if parsed:
        live_version = parsed
        print(f"- Reached `{url}` — reported version `{live_version[:12]}`")
        break
    print(f"- `{url}` → no version (body: `{body[:80].decode(errors='replace')}`)")

print()
if live_version and short_sha:
    if (
        live_version == git_sha
        or live_version.startswith(short_sha)
        or git_sha.startswith(live_version)
    ):
        print(f"✅ **Live app is in sync with main.** `{live_version[:12]}` == `{short_sha}`")
    else:
        print(
            f"⚠️ **Drift detected.** Live app version "
            f"`{live_version[:12]}` ≠ main HEAD `{short_sha}`.\n"
        )
        print("Deploy-pi likely stalled or never ran for the newer SHA. Check:")
        print("  - Runs of `deploy-pi.yml` (needs `[self-hosted, omv, build]` runner online)")
        print("  - Whether the recent commits touched paths on deploy-pi's push filter")
elif not live_version:
    print("❌ Could not reach any `/api/health` endpoint — cannot compare app SHA.")
else:
    print("_Skipped verdict (git_sha unknown)._")
print()

# ── Warning events ──
print("## Recent Warning events (all namespaces, last 20)\n")
print("```")
ev = k(
    "get", "events", "-A", "--field-selector=type=Warning", "--sort-by=.lastTimestamp"
).splitlines()
print("\n".join(ev[-20:]))
print("```\n")

print("## cloudless namespace — event tail\n")
print("```")
ev = k("get", "events", "-n", "cloudless", "--sort-by=.lastTimestamp").splitlines()
print("\n".join(ev[-15:]))
print("```\n")

print("_End of snapshot._")
