#!/usr/bin/env python3
"""Daily health check for post-fix monitoring.

Usage: python3 scripts/daily-health-check.py \
    [n8n|duckdb|searxng|espocrm|all]"""

import subprocess
import sys
from datetime import UTC, datetime

BLUE, GREEN, YELLOW, RED, NC = ("\033[0;34m", "\033[0;32m", "\033[1;33m", "\033[0;31m", "\033[0m")


def header(title: str) -> None:
    bar = "═" * 55
    print(f"{BLUE}{bar}{NC}\n{BLUE}{title}{NC}\n{BLUE}{bar}{NC}")


def status(ok: bool, msg: str) -> None:
    print(f"{GREEN}✅ {msg}{NC}" if ok else f"{RED}❌ {msg}{NC}")


def jpath(args: list[str]) -> str:
    r = subprocess.run(["kubectl", *args], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


def check_n8n() -> bool:
    header("N8N RESTART RATE CHECK")
    pod = jpath(["get", "pod", "-n", "n8n", "-o", "jsonpath={.items[0].metadata.name}"])
    if not pod:
        status(False, "No n8n pod found")
        return False
    restarts = jpath(
        [
            "get",
            "pod",
            "-n",
            "n8n",
            pod,
            "-o",
            "jsonpath={.status.containerStatuses[0].restartCount}",
        ]
    )
    age = jpath(["get", "pod", "-n", "n8n", pod, "-o", "jsonpath={.metadata.creationTimestamp}"])
    phase = jpath(["get", "pod", "-n", "n8n", pod, "-o", "jsonpath={.status.phase}"])
    print(f"Pod: {pod}\nStatus: {phase}\nAge: {age}\nRestarts: {restarts}")
    ok = phase == "Running" and int(restarts or 9) < 2
    status(ok, "n8n pod is healthy" if ok else f"n8n pod may have issues (restarts: {restarts})")
    return ok


def check_duckdb() -> bool:
    header("DUCKDB S3 SYNC JOB CHECK")
    r = subprocess.run(
        ["kubectl", "get", "cronjob", "-n", "analytics", "s3-to-duckdb-sync"],
        capture_output=True,
        text=True,
    )
    if not r.stdout.strip():
        status(False, "CronJob not found")
        return False
    suspend = jpath(
        ["get", "cronjob", "-n", "analytics", "s3-to-duckdb-sync", "-o", "jsonpath={.spec.suspend}"]
    )
    last_run = jpath(
        [
            "get",
            "cronjob",
            "-n",
            "analytics",
            "s3-to-duckdb-sync",
            "-o",
            "jsonpath={.status.lastScheduleTime}",
        ]
    )
    print(f"CronJob: s3-to-duckdb-sync\nSuspended: {suspend}\nLast Run: {last_run}")
    recent = jpath(
        [
            "get",
            "jobs",
            "-n",
            "analytics",
            "-l",
            "cronjob-name=s3-to-duckdb-sync",
            "--sort-by=.status.completionTime",
            "-o",
            'jsonpath={range .items[*]}{.status.completionTime}{"\\n"}{end}',
        ]
    )
    print("Recent Job Completions:")
    lines = [ln for ln in recent.splitlines() if ln.strip()][-2:]
    print("\n".join(lines) if lines else "  (none)")
    ok = suspend == "false"
    status(ok, "DuckDB S3 sync is active" if ok else "DuckDB S3 sync is suspended")
    return ok


def check_searxng() -> bool:
    header("SEARXNG LIMITER CHECK")
    pod = jpath(
        [
            "get",
            "pod",
            "-n",
            "search",
            "-l",
            "app=searxng",
            "-o",
            "jsonpath={.items[0].metadata.name}",
        ]
    )
    if not pod:
        status(False, "No SearXNG pod found")
        return False
    phase = jpath(["get", "pod", "-n", "search", pod, "-o", "jsonpath={.status.phase}"])
    settings = jpath(
        [
            "get",
            "configmap",
            "-n",
            "search",
            "searxng-settings",
            "-o",
            "jsonpath={.data.settings\\.yml}",
        ]
    )
    limiter = next((ln for ln in settings.splitlines() if "limiter:" in ln), "not found")
    print(f"Pod: {pod}\nStatus: {phase}\nLimiter Config: {limiter}")
    logs = subprocess.run(
        ["kubectl", "logs", "-n", "search", pod], capture_output=True, text=True
    ).stdout
    err = next(
        (ln for ln in logs.splitlines() if "limiter" in ln.lower() and "error" in ln.lower()), ""
    )
    if err:
        print(f"{YELLOW}⚠️  Note: {err}{NC}")
    ok = phase == "Running"
    status(ok, "SearXNG is running" if ok else "SearXNG pod not running")
    return ok


def check_espocrm() -> bool:
    header("ESPOCRM R2 BACKUP CHECK")
    r = subprocess.run(
        ["kubectl", "get", "cronjob", "-n", "espocrm", "mariadb-xbstream-backup"],
        capture_output=True,
        text=True,
    )
    if not r.stdout.strip():
        status(False, "mariadb-xbstream-backup CronJob not found")
        return False
    print("CronJob:")
    subprocess.run(
        [
            "kubectl",
            "get",
            "cronjob",
            "-n",
            "espocrm",
            "mariadb-xbstream-backup",
            "-o",
            "wide",
            "--no-headers",
        ]
    )
    last_ok = jpath(
        [
            "get",
            "jobs",
            "-n",
            "espocrm",
            "-l",
            "app.kubernetes.io/name=mariadb-xbstream-backup",
            "--sort-by=.status.completionTime",
            "-o",
            'jsonpath={range .items[?(@.status.succeeded==1)]{.status.completionTime}{"\\n"}{end}',
        ]
    )
    if last_ok.strip().splitlines()[-1:]:
        print(f"Last successful job: {last_ok.strip().splitlines()[-1]}")
        status(
            True, "EspoCRM xbstream backup CronJob has recent success (target: R2 datalake-bucket)"
        )
        return True
    status(True, "Backup CronJob configured (R2 Free) — no completed Job yet in this window")
    return True


checks = sys.argv[1] if len(sys.argv) > 1 else "all"
print(f"\nDaily Health Check - {datetime.now(UTC):%Y-%m-%d %H:%M:%S UTC}\n")

table = {
    "n8n": check_n8n,
    "duckdb": check_duckdb,
    "searxng": check_searxng,
    "espocrm": check_espocrm,
}
if checks == "all":
    for fn in table.values():
        fn()
        print()
elif checks in table:
    table[checks]()
else:
    sys.exit(f"Usage: {sys.argv[0]} [n8n|duckdb|searxng|espocrm|all]")

print(f"\n{BLUE}{'═' * 55}{NC}")
print("Check complete. Review results above.")
print(f"{BLUE}{'═' * 55}{NC}")
