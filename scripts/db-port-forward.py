#!/usr/bin/env python3
"""db-port-forward.py — expose omv k3s databases on localhost for
SQLTools / redis-cli.

DB ports are ClusterIP-only (never Cloudflare-tunnelled). This opens
kubectl port-forwards so Cursor SQLTools can connect to 127.0.0.1.

Usage:
  python3 scripts/db-port-forward.py          # start all (background)
  python3 scripts/db-port-forward.py status
  python3 scripts/db-port-forward.py stop
  python3 scripts/db-port-forward.py passwords
  python3 scripts/db-port-forward.py map

Local ports (fixed; match .vscode/settings.json sqltools.connections):
  13306 EspoCRM MariaDB · 15432 AppFlowy Postgres · 15433 Postiz
  Postgres · 16379/16380 AppFlowy/Postiz Redis · 17700 Meilisearch ·
  19000/19001 AppFlowy MinIO API/console"""

import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
state_dir = os.environ.get("CLOUDLESS_DB_FORWARD_DIR")
if state_dir:
    STATE_DIR = Path(state_dir)
else:
    xdg = os.environ.get("XDG_RUNTIME_DIR")
    if xdg and os.access(xdg, os.W_OK):
        STATE_DIR = Path(xdg) / "cloudless-db-forward"
    else:
        STATE_DIR = ROOT / ".local" / "db-forward"
PID_FILE = STATE_DIR / "pids"
LOG_FILE = STATE_DIR / "forward.log"
STATE_DIR.mkdir(parents=True, exist_ok=True)

# name|namespace|resource|local|remote
FORWARDS = [
    ("espocrm-mariadb", "espocrm", "svc/espocrm-mariadb", 13306, 3306),
    ("appflowy-postgres", "appflowy", "svc/postgres", 15432, 5432),
    ("postiz-postgres", "postiz", "svc/postiz-postgres", 15433, 5432),
    ("appflowy-redis", "appflowy", "svc/redis", 16379, 6379),
    ("postiz-redis", "postiz", "svc/postiz-redis", 16380, 6379),
    ("meilisearch", "meilisearch", "svc/meilisearch", 17700, 7700),
    ("appflowy-minio", "appflowy", "svc/minio", 19000, 9000),
    ("appflowy-minio-console", "appflowy", "svc/minio", 19001, 9001),
]


def need_kubectl() -> None:
    # Cursor sandbox injects HTTP(S)_PROXY; LAN kube-apiserver must
    # bypass it.
    no_proxy = os.environ.get("NO_PROXY", "") + (
        ",127.0.0.1,::1,localhost,192.168.1.128,192.168.1.130,"
        "10.43.0.0/16,10.42.0.0/16,.svc,.cluster.local")
    os.environ["NO_PROXY"] = os.environ["no_proxy"] = no_proxy
    for var in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy",
                "https_proxy", "ALL_PROXY", "all_proxy",
                "SOCKS_PROXY", "SOCKS5_PROXY", "socks_proxy",
                "socks5_proxy"):
        os.environ.pop(var, None)
    if not shutil.which("kubectl"):
        sys.exit("kubectl not found. See docs/kubectl-tailscale.md")
    if subprocess.call(["kubectl", "get", "ns"],
                       stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL) != 0:
        r = subprocess.run(["kubectl", "config", "current-context"],
                           capture_output=True, text=True)
        sys.exit("kubectl cannot reach the cluster (context: "
                 f"{r.stdout.strip() or 'unknown'})")


MAP_TEXT = """\
Local port map (use after: python3 scripts/db-port-forward.py)
  127.0.0.1:13306  EspoCRM MariaDB     user=espocrm  db=espocrm
  127.0.0.1:15432  AppFlowy Postgres   user=postgres db=postgres
  127.0.0.1:15433  Postiz Postgres     user=postiz   db=postiz
  127.0.0.1:16379  AppFlowy Redis      (no auth)
  127.0.0.1:16380  Postiz Redis        (no auth)
  127.0.0.1:17700  Meilisearch         Bearer MEILI_MASTER_KEY
  127.0.0.1:19000  AppFlowy MinIO API
  127.0.0.1:19001  AppFlowy MinIO console

SQLTools connections are preconfigured in .vscode/settings.json.
Passwords: python3 scripts/db-port-forward.py passwords
SQLite (n8n / Kuma / Grafana): python3 scripts/db-sqlite-pull.py
Cloudflare D1 snapshots:       python3 scripts/db-d1-pull.py
Docs: docs/databases/"""


def is_listening(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=1):
            return True
    except OSError:
        return False


def stop_all() -> None:
    if PID_FILE.is_file():
        for line in PID_FILE.read_text().splitlines():
            parts = line.split(maxsplit=1)
            if not parts:
                continue
            try:
                os.kill(int(parts[0]), signal.SIGTERM)
                print(f"stopped {parts[1] if len(parts) > 1 else ''} "
                      f"(pid {parts[0]})")
            except (OSError, ValueError):
                pass
        PID_FILE.unlink(missing_ok=True)
    # orphan cleanup by port
    if shutil.which("fuser"):
        for _, _, _, port, _ in FORWARDS:
            subprocess.run(["fuser", "-k", f"{port}/tcp"],
                           capture_output=True)
    print("all port-forwards stopped")


def status_all() -> None:
    r = subprocess.run(["kubectl", "config", "current-context"],
                       capture_output=True, text=True)
    print(f"cluster context: {r.stdout.strip() or 'unknown'}")
    print(f"{'NAME':<24} {'PORT':<8} STATE")
    for name, _, _, port, _ in FORWARDS:
        print(f"{name:<24} {port:<8} "
              f"{'listening' if is_listening(port) else 'down'}")


def start_one(name: str, ns: str, res: str, local_port: int,
              remote_port: int) -> bool:
    if is_listening(local_port):
        print(f"skip {name} — :{local_port} already listening")
        return True
    logf = open(LOG_FILE, "a")
    proc = subprocess.Popen(
        ["kubectl", "-n", ns, "port-forward", res,
         f"{local_port}:{remote_port}"],
        stdout=logf, stderr=subprocess.STDOUT,
        start_new_session=True)
    with open(PID_FILE, "a") as f:
        f.write(f"{proc.pid} {name}\n")
    for _ in range(30):
        if is_listening(local_port):
            print(f"ok   {name} → 127.0.0.1:{local_port}")
            return True
        if proc.poll() is not None:
            print(f"FAIL {name} — port-forward exited (see "
                  f"{LOG_FILE})", file=sys.stderr)
            return False
        time.sleep(0.167)
    print(f"warn {name} — pid {proc.pid} started but :{local_port} "
          "not yet listening")
    return True


def start_all() -> int:
    need_kubectl()
    LOG_FILE.write_text("")
    PID_FILE.write_text("")
    failed = False
    for name, ns, res, lp, rp in FORWARDS:
        if not start_one(name, ns, res, lp, rp):
            failed = True
    print()
    print(MAP_TEXT)
    if failed:
        print(f"\nSome forwards failed — check {LOG_FILE}",
              file=sys.stderr)
        return 1
    return 0


def secret(ns: str, name: str, key: str) -> str:
    import base64
    r = subprocess.run(
        ["kubectl", "-n", ns, "get", "secret", name, "-o",
         f"jsonpath={{.data.{key}}}"],
        capture_output=True, text=True)
    if r.returncode != 0 or not r.stdout:
        return ""
    try:
        return base64.b64decode(r.stdout).decode()
    except Exception:
        return ""


def print_passwords() -> None:
    need_kubectl()
    print("# Secrets from live cluster (do not commit)\n")
    print("## EspoCRM MariaDB (127.0.0.1:13306)")
    print("user: espocrm")
    print("password:", secret("espocrm", "espocrm-secrets",
                               "mariadb-password"))
    print("root password:", secret("espocrm", "espocrm-secrets",
                                    "mariadb-root-password"))
    print("\n## AppFlowy Postgres (127.0.0.1:15432)")
    print("user: postgres")
    print("password:", secret("appflowy", "appflowy-secrets",
                               "POSTGRES_PASSWORD"))
    print("\n## Postiz Postgres (127.0.0.1:15433)")
    print("user: postiz")
    print("password:", secret("postiz", "postiz-secrets",
                               "POSTGRES_PASSWORD"))
    print("\n## Meilisearch (127.0.0.1:17700)")
    mk = (secret("meilisearch", "meilisearch-secret",
                 "MEILI_MASTER_KEY")
          or secret("meilisearch", "meilisearch-secret",
                    "master-key"))
    print("MEILI_MASTER_KEY:", mk or "(check secret keys: kubectl -n "
          "meilisearch get secret meilisearch-secret -o json)")
    print("\n## AppFlowy MinIO")
    print("access key:", secret("appflowy", "appflowy-secrets",
                                 "APPFLOWY_S3_ACCESS_KEY"))
    print("secret key:", secret("appflowy", "appflowy-secrets",
                                 "APPFLOWY_S3_SECRET_KEY"))


cmd = sys.argv[1] if len(sys.argv) > 1 else "start"
if cmd == "start":
    sys.exit(start_all())
elif cmd == "stop":
    stop_all()
elif cmd == "status":
    status_all()
elif cmd == "passwords":
    print_passwords()
elif cmd == "map":
    print(MAP_TEXT)
else:
    sys.exit(f"Usage: {sys.argv[0]} "
             "{start|stop|status|passwords|map}")
