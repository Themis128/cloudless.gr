#!/usr/bin/env python3
"""Foreground Next.js supervisor for local `pnpm dev`.

Heals the failures that leave the dev port dead or lying:
  - EADDRINUSE / leftover next-server after Ctrl+C or Playwright
  - process crash / SIGKILL / OOM
  - hung /api/health
  - stale Turbopack routing (auth pages and APIs 404 in a few ms)
Always kills the whole tree on SIGINT/SIGTERM so the next start is
clean.

Usage:
  python3 scripts/dev-server.py [--webpack] [--clean] [--no-heal]
      [-p PORT] [--hostname HOST]
Env:
  DEV_PORT (default 4000), DEV_HOST (default localhost)
  DEV_HEAL=0, DEV_HEAL_INTERVAL=5, DEV_HEAL_FAILS=3, DEV_HEAL_MAX=20
  DEV_READY_TIMEOUT=90
  AUTH_DB_USE_HTTP=1 (live user-auth-db, default),
  AUTH_DB_PREFER_LOCAL=1 (local wrangler sqlite)"""

import json
import os
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)

PORT = os.environ.get("DEV_PORT", "4000")
HOST = os.environ.get("DEV_HOST", "localhost")
BUNDLER = "turbopack"
CLEAN = False
HEAL = os.environ.get("DEV_HEAL", "1") != "0"
INTERVAL = int(os.environ.get("DEV_HEAL_INTERVAL", "5"))
FAILS_NEEDED = int(os.environ.get("DEV_HEAL_FAILS", "3"))
MAX_RESTARTS = int(os.environ.get("DEV_HEAL_MAX", "20"))
READY_TIMEOUT = int(os.environ.get("DEV_READY_TIMEOUT", "90"))


def log(*a):
    print("[dev-heal]", *a, flush=True)


if os.environ.get("AUTH_DB_PREFER_LOCAL") == "1":
    os.environ["AUTH_DB_USE_HTTP"] = "0"
    log("AUTH_DB_PREFER_LOCAL=1 — local wrangler sqlite (not live user-auth-db)")
else:
    os.environ["AUTH_DB_USE_HTTP"] = "1"
    os.environ["AUTH_DB_PREFER_LOCAL"] = "0"
    log("AUTH_DB_USE_HTTP=1 — live Cloudflare D1 user-auth-db (same as cloudless.gr)")

i = 1
while i < len(sys.argv):
    a = sys.argv[i]
    if a == "--webpack":
        BUNDLER = "webpack"
    elif a == "--clean":
        CLEAN = True
    elif a == "--restart":
        pass
    elif a == "--no-heal":
        HEAL = False
    elif a in ("-p", "--port"):
        PORT = sys.argv[i + 1]
        i += 1
    elif a == "--hostname":
        HOST = sys.argv[i + 1]
        i += 1
    elif a in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)
    else:
        sys.exit(f"[dev-heal] unknown arg: {a}")
    i += 1

# Playwright owns the suite lifecycle; do not yank the server mid-run.
if os.environ.get("NEXT_PUBLIC_E2E") == "1" or os.environ.get("CI"):
    HEAL = False

NEXT_BIN = ROOT / "node_modules" / ".bin" / "next"
if not NEXT_BIN.exists():
    log(f"missing {NEXT_BIN} — run pnpm install")
    sys.exit(1)

PIDFILE = Path(os.environ.get("XDG_RUNTIME_DIR", "/tmp")) / f"cloudless-dev-{PORT}.pid"

state = {
    "shutdown": False,
    "child": None,
    "restarts": 0,
    "boot_failures": 0,
    "cleaned_for_stale": False,
    "d1_ready": False,
}


def listening_pids() -> list[str]:
    pids: list[str] = []
    if (
        subprocess.call(["which", "lsof"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        == 0
    ):
        r = subprocess.run(
            ["lsof", "-nP", f"-iTCP:{PORT}", "-sTCP:LISTEN", "-t"], capture_output=True, text=True
        )
        pids = r.stdout.split()
    if (
        not pids
        and subprocess.call(["which", "ss"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        == 0
    ):
        r = subprocess.run(["ss", "-ltnp"], capture_output=True, text=True)
        for ln in r.stdout.splitlines():
            if f":{PORT} " in ln and "pid=" in ln:
                for part in ln.split(","):
                    if part.startswith("pid="):
                        pids.append(part.split("=", 1)[1])
    return sorted(set(pids))


def kill_tree(pid: int) -> None:
    try:
        kids = subprocess.run(
            ["pgrep", "-P", str(pid)], capture_output=True, text=True
        ).stdout.split()
        for k in kids:
            kill_tree(int(k))
        os.kill(pid, signal.SIGTERM)
    except (ProcessLookupError, OSError, ValueError):
        pass


def free_port() -> bool:
    pids = listening_pids()
    if pids:
        log(f"freeing :{PORT} (pids: {' '.join(pids)})")
        for p in pids:
            try:
                os.kill(int(p), signal.SIGTERM)
            except OSError:
                pass
        time.sleep(0.4)
        pids = listening_pids()
        for p in pids:
            try:
                os.kill(int(p), signal.SIGKILL)
            except OSError:
                pass
        time.sleep(0.3)

    r = subprocess.run(["pgrep", "-f", f"next dev -p {PORT}"], capture_output=True, text=True)
    leftover = [p for p in r.stdout.split() if p != str(os.getpid())]
    if leftover:
        log(f"killing leftover next dev -p {PORT} (pids: {' '.join(leftover)})")
        for p in leftover:
            try:
                os.kill(int(p), signal.SIGTERM)
            except OSError:
                pass
        time.sleep(0.3)
        for p in leftover:
            try:
                os.kill(int(p), signal.SIGKILL)
            except OSError:
                pass

    still = listening_pids()
    if still:
        log(f"port {PORT} still bound after kill (pids: {' '.join(still)})")
        return False

    lock = ROOT / ".next" / "dev" / "lock"
    if lock.exists():
        try:
            lock.unlink()
        except OSError:
            pass
    return True


def http_code(url: str, timeout: int = 3) -> str:
    try:
        return str(urllib.request.urlopen(url, timeout=timeout).status)
    except urllib.error.HTTPError as e:
        return str(e.code)
    except Exception:
        return "000"


def route_ok(code: str) -> bool:
    return code not in ("404", "000")


def child_alive() -> bool:
    c = state["child"]
    return c is not None and c.poll() is None


def stop_child() -> None:
    c = state["child"]
    if c and c.poll() is None:
        kill_tree(c.pid)
        for _ in range(8):
            if c.poll() is not None:
                break
            time.sleep(0.25)
        if c.poll() is None:
            try:
                c.kill()
            except OSError:
                pass
            kill_tree(c.pid)
        try:
            c.wait()
        except Exception:
            pass
    state["child"] = None
    free_port()


def release_pidfile() -> None:
    try:
        if PIDFILE.is_file() and PIDFILE.read_text().strip() == str(os.getpid()):
            PIDFILE.unlink()
    except OSError:
        pass


def on_signal(*_):
    state["shutdown"] = True
    log(f"stopping (signal) — releasing :{PORT}")
    stop_child()
    release_pidfile()
    sys.exit(0)


signal.signal(signal.SIGINT, on_signal)
signal.signal(signal.SIGTERM, on_signal)


def takeover_supervisor() -> None:
    if PIDFILE.is_file():
        try:
            old = int(PIDFILE.read_text().strip())
        except ValueError:
            old = 0
        if old and old != os.getpid():
            try:
                os.kill(old, 0)
                log(f"taking over from supervisor pid {old}")
                os.kill(old, signal.SIGTERM)
                for _ in range(25):
                    try:
                        os.kill(old, 0)
                        time.sleep(0.2)
                    except OSError:
                        break
                try:
                    os.kill(old, signal.SIGKILL)
                except OSError:
                    pass
            except OSError:
                pass
    PIDFILE.write_text(str(os.getpid()))


def ensure_local_d1() -> bool:
    if os.environ.get("AUTH_DB_USE_HTTP") == "1":
        log("AUTH_DB_USE_HTTP=1 — skipping local D1 sqlite migrate")
        return True
    if state["d1_ready"]:
        return True
    log("ensuring local D1 (user-auth-db)")
    script = ROOT / "scripts" / "ensure-local-d1.py"
    cmd = (
        [sys.executable, str(script)]
        if script.exists()
        else ["bash", str(ROOT / "scripts/ensure-local-d1.sh")]
    )
    if subprocess.call(cmd) != 0:
        log("local D1 migrate failed — AUTH_DB will be unbound")
        return False
    state["d1_ready"] = True
    return True


def health_ok() -> bool:
    try:
        data = json.loads(
            urllib.request.urlopen(f"http://{HOST}:{PORT}/api/health", timeout=8).read()
        )
        return data.get("status") == "ok" and data.get("dbConnected") is True
    except Exception:
        return False


def clear_cache() -> None:
    dist = os.environ.get("NEXT_DIST_DIR", ".next")
    log(f"clearing {dist} and tmp")
    import shutil as sh

    sh.rmtree(ROOT / dist, ignore_errors=True)
    sh.rmtree(ROOT / "tmp", ignore_errors=True)


if CLEAN:
    clear_cache()


def start_next() -> None:
    args = ["dev", "-p", str(PORT), "--hostname", HOST]
    if BUNDLER == "webpack":
        args.append("--webpack")
    log(f"starting next {' '.join(args)} ({BUNDLER})")
    state["child"] = subprocess.Popen([str(NEXT_BIN), *args])


def wait_ready() -> bool:
    code = "000"
    for i in range(1, READY_TIMEOUT + 1):
        if state["shutdown"]:
            return False
        if not child_alive():
            log("next exited before ready")
            return False
        code = http_code(f"http://{HOST}:{PORT}/api/health", 8)
        if code == "200" and health_ok():
            log(f"healthy after {i}s (/api/health ok, D1 bound)")
            return True
        time.sleep(1)
    log(f"timed out waiting for /api/health (last {code})")
    return False


def warm_routes() -> bool:
    paths = [
        "/api/health",
        "/en",
        "/en/auth/login",
        "/en/auth/signup",
        "/api/auth/session",
        "/api/auth/login",
    ]
    for path in paths:
        code = "000"
        ok = False
        for _ in range(8):
            code = http_code(f"http://{HOST}:{PORT}{path}", 8)
            if route_ok(code):
                ok = True
                break
            time.sleep(0.5)
        if not ok:
            log(f"warm {path} still {code} — treating as stale routing")
            return False
    log("warmed auth + health routes")
    return True


def watch_child() -> bool:
    fail = login_fail = 0
    while child_alive():
        if state["shutdown"]:
            return True
        time.sleep(INTERVAL)
        if not HEAL:
            continue
        code = http_code(f"http://{HOST}:{PORT}/api/health")
        if code != "200" or not health_ok():
            fail += 1
            log(f"health {code} d1-unbound ({fail}/{FAILS_NEEDED})")
            if fail >= FAILS_NEEDED:
                return False
            continue
        fail = 0
        code = http_code(f"http://{HOST}:{PORT}/en/auth/login")
        if not route_ok(code):
            login_fail += 1
            log(f"auth login {code} ({login_fail}/{FAILS_NEEDED})")
            if login_fail >= FAILS_NEEDED:
                return False
        else:
            login_fail = 0
    log("next process exited")
    return False


if not (ROOT / ".env.local").is_file():
    log(
        "warning: .env.local is missing — CMS/integrations may be "
        "degraded; D1 still binds via local sqlite"
    )

log(f"auto-heal on (crash restart always; probe restart={int(HEAL)}). Ctrl+C stops the tree.")
takeover_supervisor()

while not state["shutdown"]:
    if not free_port():
        log(f"could not bind :{PORT} — retrying")
        time.sleep(1)
        continue
    if not ensure_local_d1():
        state["restarts"] += 1
        if state["restarts"] >= MAX_RESTARTS:
            log(f"gave up after {MAX_RESTARTS} restarts (D1 migrate failed)")
            stop_child()
            release_pidfile()
            sys.exit(1)
        time.sleep(2)
        continue

    start_next()
    if not wait_ready():
        if state["shutdown"]:
            stop_child()
            break
        state["boot_failures"] += 1
        stop_child()
        if state["boot_failures"] == 3 and not state["cleaned_for_stale"]:
            state["cleaned_for_stale"] = True
            clear_cache()
    else:
        state["boot_failures"] = 0
        if not warm_routes():
            log("stale routing after ready — restarting")
            stop_child()
            if not state["cleaned_for_stale"]:
                state["cleaned_for_stale"] = True
                try:
                    (ROOT / ".next" / "dev" / "lock").unlink(missing_ok=True)
                except OSError:
                    pass
        else:
            watch_child()
            stop_child()

    if state["shutdown"]:
        break

    state["restarts"] += 1
    if state["restarts"] >= MAX_RESTARTS:
        log(f"gave up after {MAX_RESTARTS} restarts")
        stop_child()
        release_pidfile()
        sys.exit(1)
    backoff = state["restarts"] * 2 if state["restarts"] < 5 else 10
    log(f"restart {state['restarts']}/{MAX_RESTARTS} in {backoff}s")
    time.sleep(backoff)

release_pidfile()
