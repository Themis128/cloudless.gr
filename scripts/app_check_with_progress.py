import argparse
import datetime as dt
import subprocess
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RUN_DIR = REPO_ROOT / ".agent-runs"

WARNING_PATTERNS = (
    " error:",
    " failed",
    " failed:",
    " not configured",
    " unauthorized",
    " access denied",
    " 401",
    " 403",
    " 500",
    " 502",
    " exception",
    " throttl",
    " down",
    " unreachable",
)

EXPECTED_TEST_NOISE = (
    "returns 500",
    "returns 502",
    "returns 401",
    "returns 400",
    "returns null",
    "returns empty",
    "falls back",
    "handles",
    "does not throw",
    "ignores duplicate",
    "skipping.",
    "not implemented: navigation",
)


def shell_join(command: list[str]) -> str:
    return " ".join(command)


def write(log, text: str = "") -> None:
    print(text, flush=True)
    log.write(text + "\n")
    log.flush()


def is_warning_line(line: str) -> bool:
    line_lc = line.lower()

    if any(expected in line_lc for expected in EXPECTED_TEST_NOISE):
        return False

    return any(pattern in line_lc for pattern in WARNING_PATTERNS)


def run_step(log, index: int, total: int, name: str, command: list[str]) -> tuple[int, list[str]]:
    started = time.monotonic()
    warnings: list[str] = []

    write(log)
    write(log, f"[{index}/{total}] ▶ {name}")
    write(log, f"$ {shell_join(command)}")

    process = subprocess.Popen(
        command,
        cwd=REPO_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    assert process.stdout is not None

    for line in process.stdout:
        print(line, end="", flush=True)
        log.write(line)
        log.flush()

        clean = line.rstrip()
        if clean and is_warning_line(clean):
            warnings.append(clean)

    code = process.wait()
    elapsed = time.monotonic() - started

    if code == 0:
        write(log, f"[{index}/{total}] ✅ {name} passed in {elapsed:.1f}s")
    else:
        write(log, f"[{index}/{total}] ❌ {name} failed in {elapsed:.1f}s with exit code {code}")

    if warnings:
        write(
            log,
            f"[{index}/{total}] ⚠️  {name} emitted {len(warnings)} warning/error-looking line(s)",
        )

    return code, warnings


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run cloudless.gr app checks with progress and logs"
    )
    parser.add_argument(
        "--no-live",
        action="store_true",
        help="Skip live kubectl checks such as Meilisearch readiness",
    )
    parser.add_argument(
        "--no-test",
        action="store_true",
        help="Skip full pnpm test",
    )
    parser.add_argument(
        "--keep-going",
        action="store_true",
        default=True,
        help="Continue after failures and summarize at the end",
    )
    args = parser.parse_args()

    RUN_DIR.mkdir(exist_ok=True)

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    log_path = RUN_DIR / f"app-check-{stamp}.log"

    steps: list[tuple[str, list[str]]] = [
        ("git status", ["git", "status", "--short"]),
        ("clean generated Next output", ["rm", "-rf", ".next"]),
        ("typecheck", ["pnpm", "run", "typecheck"]),
        ("lint", ["pnpm", "run", "lint"]),
    ]

    if not args.no_test:
        steps.append(("unit/app tests", ["pnpm", "run", "test:ci"]))

    steps.extend(
        [
            (
                "R21 focused tests",
                [
                    "pnpm",
                    "vitest",
                    "run",
                    "__tests__/r21-ai-baseline.test.ts",
                    "__tests__/product-search.test.ts",
                    "__tests__/api-search-route.test.ts",
                    "__tests__/admin-search-reindex-route.test.ts",
                    "__tests__/product-recommendations.test.ts",
                    "__tests__/product-recommendations-route.test.ts",
                    "__tests__/product-recommendations-page.test.ts",
                    "__tests__/product-recommendation-signals.test.ts",
                ],
            ),
            ("AI/API tests", ["pnpm", "run", "ai:test:api"]),
            ("Deep Agent readiness", ["pnpm", "run", "ai:check"]),
            ("skills check", ["pnpm", "run", "ai:skills-check"]),
            ("dispatcher check", ["python", "scripts/check_ai_dispatcher.py"]),
            ("cluster node SSH access", ["bash", "scripts/check_cluster_node_ssh_access.sh"]),
            ("DDNS auth updater", ["bash", "scripts/check_ddns_update_auth.sh"]),
            ("R21 search baseline", ["bash", "scripts/check_r21_search_baseline.sh"]),
            (
                "R21 Meilisearch k3s storage",
                ["bash", "scripts/check_r21_meilisearch_k3s_storage.sh"],
            ),
        ]
    )

    if not args.no_live:
        steps.append(
            (
                "R21 Meilisearch live readiness",
                ["bash", "scripts/check_r21_meilisearch_live_readiness.sh"],
            )
        )

    steps.append(("R14 Sentry check", ["bash", "scripts/check_r14_sentry_env_tagging.sh"]))

    if (REPO_ROOT / "scripts/check_app_completion_basics.sh").exists():
        steps.append(("app completion basics", ["bash", "scripts/check_app_completion_basics.sh"]))

    started_all = time.monotonic()
    results: list[tuple[str, int, list[str]]] = []

    with log_path.open("w", encoding="utf-8") as log:
        write(log, "cloudless.gr app check")
        write(log, f"Started: {dt.datetime.now().isoformat(timespec='seconds')}")
        write(log, f"Repo: {REPO_ROOT}")
        write(log, f"Log: {log_path}")
        write(log, f"Steps: {len(steps)}")

        for idx, (name, command) in enumerate(steps, start=1):
            code, warnings = run_step(log, idx, len(steps), name, command)
            results.append((name, code, warnings))

        elapsed_all = time.monotonic() - started_all

        write(log)
        write(log, "================ SUMMARY ================")

        failures = 0
        warning_steps = 0

        for name, code, warnings in results:
            status = "PASS" if code == 0 else f"FAIL({code})"
            if warnings:
                status += f" WARN({len(warnings)})"
                warning_steps += 1
            if code != 0:
                failures += 1
            write(log, f"{name:32} {status}")

        write(log, "=========================================")
        write(log, f"Elapsed: {elapsed_all:.1f}s")
        write(log, f"Log file: {log_path}")

        if warning_steps:
            write(log)
            write(log, "=============== WARNINGS ===============")
            for name, _code, warnings in results:
                if not warnings:
                    continue
                write(log, f"{name}: {len(warnings)} warning/error-looking line(s)")
                for warning in warnings[:12]:
                    write(log, f"  - {warning}")
                if len(warnings) > 12:
                    write(log, f"  ... {len(warnings) - 12} more in full log")
            write(log, "=========================================")

        if failures:
            write(log)
            write(log, f"❌ Completed with {failures} failing step(s).")
            write(
                log,
                "Next: inspect the first failing command above or ask Deep Agent to summarize this log.",
            )
        elif warning_steps:
            write(log)
            write(log, f"✅ All app checks passed, with warnings in {warning_steps} step(s).")
            write(
                log,
                "Review the WARNINGS section above; many test stderr lines are expected fallback-path tests.",
            )
        else:
            write(log)
            write(log, "✅ All app checks passed.")

    print()
    print(f"Log saved to: {log_path}")

    raise SystemExit(1 if any(code != 0 for _name, code, _warnings in results) else 0)


if __name__ == "__main__":
    main()
