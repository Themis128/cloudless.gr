#!/usr/bin/env python3
"""Install kubectl (if missing) and write kubeconfig for the Pi k3s
API. On office LAN uses 192.168.1.128 (in cert SAN). Off-LAN /
userspace Tailscale needs tls-san for 100.x + SOCKS5 (see docs)."""

import os
import shutil
import socket
import subprocess
import sys
import urllib.request
from pathlib import Path

LAN_IP = os.environ.get("CLOUDLESS_K3S_LAN_IP", "192.168.1.128")
TS_IP = os.environ.get("CLOUDLESS_K3S_TS_IP", "100.74.191.58")
KUBE_OUT = Path(os.environ.get("KUBECONFIG_OUT", os.path.expanduser("~/.kube/config-cloudless-ts")))
ROOT = Path(__file__).resolve().parent.parent

os.environ["PATH"] = f"{os.path.expanduser('~/bin')}:{os.environ['PATH']}"

print("==> Ensuring userspace Tailscale…")
tswsl = ROOT / "scripts" / "ts-wsl.py"
cmd = (
    [sys.executable, str(tswsl), "status"]
    if tswsl.exists()
    else ["bash", str(ROOT / "scripts/ts-wsl.sh"), "status"]
)
subprocess.run(cmd, capture_output=True)


def tcp_open(host: str, port: int, timeout: int = 3) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def socks_ok(host: str) -> bool:
    try:
        import urllib.request as u

        u.ProxyHandler({"https": "socks5h://127.0.0.1:1055"})
        # PySocks not always available — skip if it fails
        return False
    except Exception:
        return False


api_host = ""
if tcp_open(LAN_IP, 6443):
    api_host = LAN_IP
elif tcp_open(TS_IP, 6443):
    api_host = TS_IP
elif socks_ok(TS_IP):
    api_host = TS_IP

if not api_host:
    print(f"ERROR: cannot reach k3s on {LAN_IP}:6443 or {TS_IP}:6443")
    print("On office LAN this should just work. Off-LAN: install system Tailscale")
    print("(with TUN) or add tls-san + use ALL_PROXY=socks5h://127.0.0.1:1055")
    sys.exit(1)
print(f"    API host: {api_host}:6443")

if not shutil.which("kubectl"):
    print("==> Installing kubectl to ~/bin…")
    bin_dir = Path.home() / "bin"
    bin_dir.mkdir(exist_ok=True)
    ver = (
        urllib.request.urlopen("https://dl.k8s.io/release/stable.txt", timeout=15)
        .read()
        .decode()
        .strip()
    )
    urllib.request.urlretrieve(
        f"https://dl.k8s.io/release/{ver}/bin/linux/amd64/kubectl", bin_dir / "kubectl"
    )
    (bin_dir / "kubectl").chmod(0o755)

need_refresh = (
    not KUBE_OUT.is_file() or f"server: https://{api_host}:6443" not in KUBE_OUT.read_text()
)

if need_refresh:
    print("==> Fetching kubeconfig from omv (SSH once)…")
    KUBE_OUT.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(
        [
            "ssh",
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=20",
            "-o",
            "ProxyJump=tbaltzakis@192.168.1.130",
            f"tbaltzakis@{LAN_IP}",
            "cat ~/.kube/config",
        ],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        sys.exit(f"kubeconfig fetch failed: {r.stderr.strip()}")
    KUBE_OUT.write_text(r.stdout.replace(f"https://{LAN_IP}:6443", f"https://{api_host}:6443"))
    KUBE_OUT.chmod(0o600)

os.environ["KUBECONFIG"] = str(KUBE_OUT)
if api_host == TS_IP and not tcp_open(TS_IP, 6443, timeout=2):
    os.environ["ALL_PROXY"] = "socks5h://127.0.0.1:1055"
    os.environ["HTTPS_PROXY"] = "socks5h://127.0.0.1:1055"
    print("    using SOCKS5 proxy (userspace Tailscale)")

print(f"==> KUBECONFIG={KUBE_OUT}")
subprocess.run(["kubectl", "config", "current-context"])
subprocess.run(["kubectl", "get", "nodes", "-o", "wide"])

print("""
Shell:
  export PATH="$HOME/bin:$PATH"
  export KUBECONFIG=~/.kube/config-cloudless-ts
  export TS_SOCKET=~/.local/tailscale/tailscaled.sock""")
