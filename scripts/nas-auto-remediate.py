#!/usr/bin/env python3
"""nas-auto-remediate — daily NAS self-healing (omv).

Fixes from health log automatically:
  1. minio OOM loop (appflowy) → raise limit to 512Mi
  2. stale backup alert → re-run nas-backup if its LOG is stale,
     else correct the health check's mtime heuristic
  3. failed systemd units → reset stale 'failed' state for one-shots
     that recovered; restart long-running services once per day
  4. stuck k3s pods → delete CrashLoopBackOff/Error/Pending>30m pods
     so controllers recreate them (wedged-pod recovery)
  5. root disk pressure → vacuum journal + prune dangling docker
     layers when / crosses the threshold
  6. docker containers stuck 'unhealthy' → restart once/day each
     (Docker marks the state but never acts on it); also runnable
     standalone via --docker-health from a frequent cron entry
  7. tailscale down → restart tailscaled (it is the access path)
"""

import json
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

LOG = Path("/var/log/nas-auto-remediate.log")
HEALTH_LOG = Path("/var/log/nas-daily-health.log")
BACKUP_LOG = Path("/var/log/nas-backup.log")
STATE = Path("/var/lib/nas-auto-remediate/state.json")

DISK_WARN_PCT = 85
POD_PENDING_MIN = 30
MAX_SERVICE_RESTARTS_PER_DAY = 1

# One-shot/timer units that legitimately exit non-zero on transient
# failure and self-recover on the next tick — never restart these,
# just clear the stale 'failed' flag.
ONESHOT_UNITS = {
    "pi-release-pull.service",
    "safedeploy-watchdog.service",
    "systemd-quotacheck@.service",
}
# Long-running units worth an auto-restart attempt.
RESTARTABLE_UNITS = {
    "tailscaled.service",
    "k3s.service",
    "docker.service",
    "containerd.service",
    "cron.service",
    "nginx.service",
}


def stamp() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S")


def log(msg: str) -> None:
    line = f"[{stamp()}] {msg}"
    print(line)
    try:
        with LOG.open("a") as f:
            f.write(line + "\n")
    except OSError:
        pass


def _text_or_decode(value: str | bytes | None) -> str:
    if isinstance(value, bytes):
        return value.decode(errors="replace")
    return value or ""


def run(*args: str, timeout: int = 120) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(list(args), capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as e:
        # TimeoutExpired keeps raw bytes even with text=True — decode so
        # downstream `stdout + stderr` concatenation cannot TypeError.
        out = _text_or_decode(e.stdout)
        err = _text_or_decode(e.stderr)
        return subprocess.CompletedProcess(
            list(args),
            124,
            out,
            f"timeout after {timeout}s" + (f": {err.strip()[:200]}" if err else ""),
        )


def find_health_script() -> Path | None:
    for d in ("/usr/local/sbin", "/usr/local/bin", "/usr/bin"):
        p = Path(d)
        if not p.is_dir():
            continue
        for f in p.iterdir():
            if not f.is_file() or "nas-auto-remediate" in f.name or f.suffix == ".orig":
                continue
            try:
                if "Daily Health Check" in f.read_text(errors="replace"):
                    return f
            except OSError:
                continue
    return None


HEALTH = find_health_script()


def _find_kubectl() -> str:
    """Resolve kubectl for cron's minimal PATH (/usr/bin:/bin).

    Cron does not include /usr/local/bin, which is where k3s installs
    kubectl on omv — bare "kubectl" raised FileNotFoundError and the
    whole fix_stuck_pods pass logged an error daily."""
    for cand in (
        shutil.which("kubectl"),
        "/usr/local/bin/kubectl",
        "/usr/bin/kubectl",
        "/bin/kubectl",
    ):
        if cand and Path(cand).is_file():
            return cand
    return "kubectl"


KUBECTL = _find_kubectl()


def kubectl(*args: str) -> str:
    r = run(KUBECTL, *args)
    return r.stdout.strip() if r.returncode == 0 else ""


def load_state() -> dict:
    try:
        return json.loads(STATE.read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def save_state(state: dict) -> None:
    try:
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps(state))
    except OSError:
        pass


def fix_minio() -> None:
    r = run("journalctl", "-p", "err", "--since", "24 hours ago", "--no-pager")
    oom = sum(1 for ln in r.stdout.splitlines() if re.search(r"Killed process.*minio", ln))
    if oom < 1:
        log(f"minio: no OOM in 24h ({oom})")
        return

    limit = kubectl(
        "-n",
        "appflowy",
        "get",
        "deploy",
        "minio",
        "-o",
        "jsonpath={.spec.template.spec.containers[0].resources.limits.memory}",
    )
    rc = kubectl(
        "-n",
        "appflowy",
        "get",
        "pod",
        "-l",
        "app=minio",
        "-o",
        "jsonpath={.items[0].status.containerStatuses[0].restartCount}",
    )
    log(f"minio: {oom} OOMs (limit={limit or 'none'}, restarts={rc or '?'})")
    if limit not in ("512Mi", "1Gi"):
        log(f"minio: raising limit {limit or 'unset'} -> 512Mi")
        r = run(
            KUBECTL,
            "-n",
            "appflowy",
            "patch",
            "deployment",
            "minio",
            "--type=strategic",
            "-p",
            '{"spec":{"template":{"spec":{"containers":'
            '[{"name":"minio","resources":{"limits":'
            '{"cpu":"500m","memory":"512Mi"},'
            '"requests":{"cpu":"50m","memory":"128Mi"}'
            "}}]}}}}",
        )
        try:
            with LOG.open("a") as f:
                f.write(r.stdout + r.stderr)
        except OSError:
            pass
        log("minio: patched")
    else:
        log(f"minio: limit already {limit}, no patch")


def fix_backup() -> None:
    try:
        age = int((time.time() - BACKUP_LOG.stat().st_mtime) / 3600)
    except OSError:
        age = 999
    if age > 25:
        log(f"backup: log {age}h stale - re-running nas-backup")
        r = run("/usr/local/sbin/nas-backup")
        try:
            with LOG.open("a") as f:
                f.write(r.stdout + r.stderr)
        except OSError:
            pass
        return

    if HEALTH is None:
        log("backup: health script not found")
        return
    text = HEALTH.read_text(errors="replace")
    if "mmin -1500" in text:
        orig = HEALTH.with_suffix(HEALTH.suffix + ".orig")
        if not orig.exists():
            shutil.copy(HEALTH, orig)
        log(f"backup: job fresh ({age}h), source static - correcting mmin heuristic (orig saved)")
        new = re.sub(
            r"BACKUP_AGE=.*",
            "BACKUP_AGE=$(expr $(date +%s) - $(stat -c %Y "
            "/var/log/nas-backup.log 2>/dev/null || echo 0))",
            text,
        )
        HEALTH.write_text(new)
        log("backup: health script now checks backup-log freshness")
    else:
        log("backup: health heuristic already corrected")


def fix_failed_units() -> None:
    """Clear stale 'failed' flags on recovered one-shots; restart real services once/day."""
    state = load_state()
    try:
        _fix_failed_units(state)
    finally:
        save_state(state)


def _fix_failed_units(state: dict) -> None:
    r = run("systemctl", "list-units", "--failed", "--no-pager", "--no-legend", "--plain")
    failed = [
        ln.split()[0]
        for ln in r.stdout.splitlines()
        if ln.strip() and ln.split()[0].endswith(".service")
    ]
    if not failed:
        log("systemd: no failed units")
        return

    today = time.strftime("%Y-%m-%d")
    restarts = state.setdefault("service_restarts", {})
    restarted, stale_only, persistent = [], [], []

    for unit in failed:
        base = re.sub(r"@[^.]+\.", "@.", unit) if "@" in unit else unit
        if unit in ONESHOT_UNITS or base in ONESHOT_UNITS:
            stale_only.append(unit)
            continue
        if unit in RESTARTABLE_UNITS or base in RESTARTABLE_UNITS:
            key = f"{unit}:{today}"
            if restarts.get(key, 0) >= MAX_SERVICE_RESTARTS_PER_DAY:
                persistent.append(unit)
                continue
            rr = run("systemctl", "restart", unit)
            restarts[key] = restarts.get(key, 0) + 1
            if rr.returncode == 0:
                restarted.append(unit)
                log(f"systemd: restarted failed unit {unit}")
            else:
                persistent.append(unit)
                log(
                    f"systemd: restart of {unit} FAILED rc={rr.returncode}: {rr.stderr.strip()[:200]}"
                )
            continue
        # Unknown unit — oneshots that already exited get their stale flag
        # cleared; services wedged at start-limit-hit get one reset+restart
        # per day (observed: pod-filebrowser recovered this way); anything
        # else is reported as persistent.
        show = run("systemctl", "show", unit, "-p", "Type,Result,ActiveEnterTimestamp")
        props = dict(ln.split("=", 1) for ln in show.stdout.splitlines() if "=" in ln)
        if props.get("Type") == "oneshot":
            stale_only.append(unit)
        elif props.get("Result") == "start-limit-hit":
            key = f"{unit}:{today}"
            if restarts.get(key, 0) >= MAX_SERVICE_RESTARTS_PER_DAY:
                persistent.append(unit)
                continue
            run("systemctl", "reset-failed", unit)
            rr = run("systemctl", "restart", unit)
            restarts[key] = restarts.get(key, 0) + 1
            if rr.returncode == 0:
                restarted.append(unit)
                log(f"systemd: recovered {unit} from start-limit-hit via reset-failed + restart")
            else:
                persistent.append(unit)
                log(f"systemd: {unit} still failing after reset-failed: {rr.stderr.strip()[:200]}")
        else:
            persistent.append(unit)

    if stale_only:
        run("systemctl", "reset-failed", *stale_only)
        log(
            f"systemd: cleared stale failed flag on {len(stale_only)} one-shot(s): {', '.join(stale_only)}"
        )
    if persistent:
        log(f"systemd: PERSISTENT failures need attention: {', '.join(persistent)}")
    if not restarted and not stale_only and not persistent:
        log("systemd: failed units present but none actionable")


def fix_stuck_pods() -> None:
    """Delete pods stuck in bad states so their controllers recreate them."""
    r = run(KUBECTL, "get", "pods", "-A", "-o", "json")
    if r.returncode != 0:
        log(f"pods: kubectl unavailable ({r.stderr.strip()[:120]})")
        return
    try:
        items = json.loads(r.stdout).get("items", [])
    except json.JSONDecodeError:
        log("pods: kubectl returned unparseable JSON")
        return

    deleted = []
    for pod in items:
        meta, status = pod.get("metadata", {}), pod.get("status", {})
        ns, name = meta.get("namespace", ""), meta.get("name", "")
        phase = status.get("phase", "")
        if not ns or not name:
            continue
        waiting_reasons = [
            cs.get("state", {}).get("waiting", {}).get("reason", "")
            for key in ("containerStatuses", "initContainerStatuses")
            for cs in status.get(key, []) or []
        ]
        bad_wait = any(
            w in ("CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull", "CreateContainerError")
            for w in waiting_reasons
        )
        pending_old = False
        if phase == "Pending":
            try:
                created = meta.get("creationTimestamp", "").replace("Z", "+00:00")
                age_s = time.time() - datetime.fromisoformat(created).timestamp()
                pending_old = age_s > POD_PENDING_MIN * 60
            except (ValueError, TypeError):
                pass
        if phase == "Succeeded" or (phase == "Running" and not bad_wait):
            continue
        if bad_wait or pending_old or phase in ("Failed", "Unknown"):
            dr = run(KUBECTL, "-n", ns, "delete", "pod", name, "--ignore-not-found")
            if dr.returncode == 0:
                deleted.append(f"{ns}/{name}")
                log(
                    f"pods: deleted stuck pod {ns}/{name} "
                    f"(phase={phase} waiting={','.join(waiting_reasons) or 'none'})"
                )
            else:
                log(f"pods: delete of {ns}/{name} failed: {dr.stderr.strip()[:150]}")

    if not deleted:
        log("pods: no stuck pods")


def fix_disk() -> None:
    """Relieve root-disk pressure before it wedges k3s/etcd."""
    st = shutil.disk_usage("/")
    pct = int(st.used * 100 / st.total)
    if pct < DISK_WARN_PCT:
        log(f"disk: / at {pct}% (< {DISK_WARN_PCT}%), ok")
        return
    log(f"disk: / at {pct}% >= {DISK_WARN_PCT}% — vacuuming journal + pruning dangling docker")
    r1 = run("journalctl", "--vacuum-time=14d")
    log(f"disk: journal vacuum rc={r1.returncode}")
    r2 = run("docker", "system", "prune", "-f")
    log(
        f"disk: docker prune rc={r2.returncode} ({r2.stdout.strip().splitlines()[-1] if r2.stdout else 'no output'})"
    )
    st2 = shutil.disk_usage("/")
    log(f"disk: / now at {int(st2.used * 100 / st2.total)}%")


def fix_docker_health() -> None:
    """Restart containers stuck 'unhealthy' — Docker marks the state but
    never acts on it, so a crash-looping-but-up container (observed:
    nextcloud Apache segfault loop, 2026-10-07→15) sits dead for days.
    Same per-day restart budget as systemd units."""
    r = run("docker", "ps", "--filter", "health=unhealthy", "--format", "{{.Names}}")
    if r.returncode != 0:
        log(f"docker-health: docker ps failed rc={r.returncode}: {r.stderr.strip()[:200]}")
        return
    names = [n.strip() for n in r.stdout.splitlines() if n.strip()]
    if not names:
        log("docker-health: no unhealthy containers")
        return

    state = load_state()
    today = time.strftime("%Y-%m-%d")
    restarts = state.setdefault("container_restarts", {})
    restarted, persistent, warming = [], [], []

    for name in names:
        insp = run(
            "docker",
            "inspect",
            name,
            "--format",
            "{{.State.StartedAt}}",
        )
        try:
            started = datetime.fromisoformat(insp.stdout.strip().replace("Z", "+00:00")).timestamp()
        except ValueError:
            started = 0.0
        if started and (time.time() - started) < 300:
            warming.append(name)
            continue
        key = f"{name}:{today}"
        if restarts.get(key, 0) >= MAX_SERVICE_RESTARTS_PER_DAY:
            persistent.append(name)
            continue
        rr = run("docker", "restart", name)
        restarts[key] = restarts.get(key, 0) + 1
        if rr.returncode == 0:
            restarted.append(name)
            log(f"docker-health: restarted unhealthy container {name}")
        else:
            persistent.append(name)
            log(
                f"docker-health: restart of {name} FAILED rc={rr.returncode}: "
                f"{rr.stderr.strip()[:200]}"
            )

    save_state(state)
    if warming:
        log(f"docker-health: skipped recently-started (grace 5m): {', '.join(warming)}")
    if persistent:
        log(
            "docker-health: PERSISTENT unhealthy containers need attention: "
            + ", ".join(persistent)
        )


def fix_tailscale() -> None:
    r = run("tailscale", "status")
    if r.returncode == 0 and r.stdout.strip():
        log("tailscale: up")
        return
    log("tailscale: status failed — restarting tailscaled")
    rr = run("systemctl", "restart", "tailscaled")
    log(f"tailscale: restart rc={rr.returncode}")


def main() -> None:
    # `--docker-health` runs only the container-health pass — cron fires it
    # every 10 min so an unhealthy container self-heals in minutes, not on
    # the next daily run.
    if "--docker-health" in sys.argv[1:]:
        try:
            fix_docker_health()
        except Exception as exc:
            log(f"fix_docker_health: unexpected error: {exc}")
        return

    log("===== nas-auto-remediate start =====")
    for fn in (
        fix_minio,
        fix_backup,
        fix_failed_units,
        fix_stuck_pods,
        fix_disk,
        fix_docker_health,
        fix_tailscale,
    ):
        try:
            fn()
        except Exception as exc:  # remediation must never kill the pass
            log(f"{fn.__name__}: unexpected error: {exc}")
    try:
        with HEALTH_LOG.open("a") as f:
            f.write(f"[{stamp()}] nas-auto-remediate: pass complete\n")
    except OSError:
        pass
    log("===== nas-auto-remediate done =====")


if __name__ == "__main__":
    main()
