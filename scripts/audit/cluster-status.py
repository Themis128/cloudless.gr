#!/usr/bin/env python3
"""Cluster + node + runner status snapshot — outputs JSON + Markdown.

Designed to run on a Pi self-hosted GH runner with kubectl (k3s
context), tailscale, and the GH CLI authenticated. Missing tools are
a soft signal — the rest still collects.

Usage:
  python3 scripts/audit/cluster-status.py --json out.json \
      --md out.md"""

import json
import shutil
import subprocess
import sys
from datetime import UTC, datetime

JSON_OUT = MD_OUT = ""
i = 1
while i < len(sys.argv):
    if sys.argv[i] == "--json":
        JSON_OUT = sys.argv[i + 1]
        i += 2
    elif sys.argv[i] == "--md":
        MD_OUT = sys.argv[i + 1]
        i += 2
    else:
        sys.exit(f"Unknown arg: {sys.argv[i]}")
generated_at = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def have(tool: str) -> bool:
    return shutil.which(tool) is not None


def run(args: list[str]) -> str:
    r = subprocess.run(args, capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else ""


# ── k3s cluster info ──
cluster_reachable = False
api_server = k3s_version = ""
nodes: list[dict] = []
namespaces: list[str] = []
pods: list[dict] = []

if have("kubectl"):
    if run(["kubectl", "get", "--raw=/healthz"]):
        cluster_reachable = True
        api_server = run(
            [
                "kubectl",
                "config",
                "view",
                "--minify",
                "-o",
                "jsonpath={.clusters[0].cluster.server}",
            ]
        ).strip()
        ver = run(["kubectl", "version", "--short"])
        for ln in ver.splitlines():
            if "server version" in ln.lower():
                k3s_version = ln.split()[-1]

    if cluster_reachable:
        try:
            data = json.loads(run(["kubectl", "get", "nodes", "-o", "json"]))
            for n in data.get("items", []):
                conds = {c["type"]: c["status"] for c in n["status"].get("conditions", [])}
                cap = n["status"].get("capacity", {})
                info = n["status"].get("nodeInfo", {})
                nodes.append(
                    {
                        "name": n["metadata"]["name"],
                        "status": "Ready" if conds.get("Ready") == "True" else "NotReady",
                        "reason": ""
                        if conds.get("Ready") == "True"
                        else conds.get("Ready", "Unknown"),
                        "os": info.get("osImage", ""),
                        "arch": info.get("architecture", ""),
                        "kubelet": info.get("kubeletVersion", ""),
                        "cpu": cap.get("cpu", ""),
                        "memory": cap.get("memory", ""),
                        "pods_capacity": cap.get("pods", ""),
                        "memory_pressure": conds.get("MemoryPressure", "?"),
                        "disk_pressure": conds.get("DiskPressure", "?"),
                    }
                )
        except Exception:
            pass

        ns = run(["kubectl", "get", "ns", "-o", "jsonpath={.items[*].metadata.name}"])
        namespaces = ns.split()

        try:
            data = json.loads(run(["kubectl", "get", "pods", "-A", "-o", "json"]))
            agg: dict[str, dict] = {}
            for p in data.get("items", []):
                nsn = p["metadata"]["namespace"]
                phase = p["status"].get("phase", "Unknown")
                for cs in p["status"].get("containerStatuses") or []:
                    ws = (cs.get("state") or {}).get("waiting") or {}
                    if ws.get("reason") in ("CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull"):
                        phase = ws["reason"]
                        break
                agg.setdefault(nsn, {})
                agg[nsn][phase] = agg[nsn].get(phase, 0) + 1
            pods = [{"namespace": nsn, **phases} for nsn, phases in sorted(agg.items())]
        except Exception:
            pass

# ── GH Actions runner inventory ──
runners: list[dict] = []
if have("gh"):
    r = subprocess.run(
        [
            "gh",
            "api",
            "repos/Themis128/cloudless.gr/actions/runners",
            "--jq",
            "[.runners[] | {name, os, status, busy, labels: [.labels[].name]}]",
        ],
        capture_output=True,
        text=True,
    )
    try:
        runners = json.loads(r.stdout)
    except Exception:
        runners = []

# ── Tailscale connectivity ──
tailscale: list[dict] = []
if have("tailscale"):
    r = subprocess.run(["tailscale", "status", "--json"], capture_output=True, text=True)
    try:
        data = json.loads(r.stdout)
        me = data.get("Self", {})
        tailscale.append(
            {
                "name": me.get("HostName", ""),
                "ip": (me.get("TailscaleIPs") or [""])[0],
                "online": me.get("Online", False),
                "self": True,
            }
        )
        for p in (data.get("Peer") or {}).values():
            tailscale.append(
                {
                    "name": p.get("HostName", ""),
                    "ip": (p.get("TailscaleIPs") or [""])[0],
                    "online": p.get("Online", False),
                    "lastSeen": p.get("LastSeen", ""),
                    "self": False,
                }
            )
    except Exception:
        tailscale = []

payload = {
    "generatedAt": generated_at,
    "cluster": {"reachable": cluster_reachable, "apiServer": api_server, "k3sVersion": k3s_version},
    "nodes": nodes,
    "namespaces": namespaces,
    "pods": pods,
    "runners": runners,
    "tailscale": tailscale,
}

if JSON_OUT:
    with open(JSON_OUT, "w") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    print(f"JSON -> {JSON_OUT}")

if MD_OUT:
    lines = [f"## 🖥️ Cluster Status — {generated_at}", "", "### k3s", ""]
    if cluster_reachable:
        lines.append(f"- ✅ API server reachable: `{api_server}`")
        if k3s_version:
            lines.append(f"- Version: {k3s_version}")
    else:
        lines.append("- ❌ API server unreachable (kubeconfig missing or cluster down)")
    lines += [
        "",
        "### Nodes",
        "",
        "| Name | Status | OS | Arch | CPU | Memory | Mem Pressure | Disk Pressure |",
        "|------|--------|----|------|-----|--------|--------------|---------------|",
    ]
    for n in nodes:
        icon = "✅" if n["status"] == "Ready" else "❌"
        lines.append(
            f"| {n['name']} | {icon} {n['status']} | "
            f"{n.get('os', '')[:25]} | {n.get('arch', '')} | "
            f"{n.get('cpu', '')} | {n.get('memory', '')} | "
            f"{n.get('memory_pressure', '?')} | "
            f"{n.get('disk_pressure', '?')} |"
        )
    lines += [
        "",
        "### Pods by namespace",
        "",
        "| Namespace | Running | Pending | CrashLoopBackOff | Other |",
        "|-----------|---------|---------|------------------|-------|",
    ]
    for row in pods:
        crash = (
            row.get("CrashLoopBackOff", 0)
            + row.get("ImagePullBackOff", 0)
            + row.get("ErrImagePull", 0)
        )
        other = sum(
            v
            for k, v in row.items()
            if k
            not in (
                "namespace",
                "Running",
                "Pending",
                "CrashLoopBackOff",
                "ImagePullBackOff",
                "ErrImagePull",
            )
            and isinstance(v, int)
        )
        icon = "🔴 " if crash else ""
        lines.append(
            f"| {icon}{row['namespace']} | "
            f"{row.get('Running', 0)} | "
            f"{row.get('Pending', 0)} | {crash} | {other} |"
        )
    lines += [
        "",
        "### Self-hosted GH runners",
        "",
        "| Name | Status | Busy | Labels |",
        "|------|--------|------|--------|",
    ]
    for r in runners:
        icon = "✅" if r["status"] == "online" else "⚠️"
        busy = "🟡 busy" if r.get("busy") else "🟢 idle"
        labels = ", ".join(r.get("labels", [])[:6])
        lines.append(f"| {r['name']} | {icon} {r['status']} | {busy} | {labels} |")
    lines += [
        "",
        "### Tailscale fleet",
        "",
        "| Host | IP | Online | Self |",
        "|------|----|--------|------|",
    ]
    for t in tailscale:
        on = "✅" if t.get("online") else "❌"
        me_mark = "⭐" if t.get("self") else ""
        lines.append(f"| {t.get('name', '')} | {t.get('ip', '')} | {on} | {me_mark} |")
    with open(MD_OUT, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"Markdown -> {MD_OUT}")
