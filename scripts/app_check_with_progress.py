import argparse
import datetime as dt
import subprocess
import sys
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
RUN_DIR = REPO_ROOT / ".agent-runs"


def shell_join(command: list[str]) -> str:
    return " ".join(command)


def write(log, text: str = "") -> None:
    print(text, flush=True)
    log.write(text + "\n")
    log.flush()


def run_step(log, index: int, total: int, name: str, command: list[str]) -> int:
    started = time.monotonic()

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

    code = process.wait()
    elapsed = time.monotonic() - started

    if code == 0:
        write(log, f"[{index}/{total}] ✅ {name} passed in {elapsed:.1f}s")
    else:
        write(log, f"[{index}/{total}] ❌ {name} failed in {elapsed:.1f}s with exit code {code}")

    return code


def main() -> None:
    parser = argparse.ArgumentParser(description="Run cloudless.gr app checks with progress and logs")
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
            ("R21 search baseline", ["bash", "scripts/check_r21_search_baseline.sh"]),
            ("R21 Meilisearch k3s storage", ["bash", "scripts/check_r21_meilisearch_k3s_storage.sh"]),
        ]
    )

    if not args.no_live:
        steps.append(
            ("R21 Meilisearch live readiness", ["bash", "scripts/check_r21_meilisearch_live_readiness.sh"])
        )

    steps.append(("R14 Sentry check", ["bash", "scripts/check_r14_sentry_env_tagging.sh"]))

    if (REPO_ROOT / "scripts/check_app_completion_basics.sh").exists():
        steps.append(("app completion basics", ["bash", "scripts/check_app_completion_basics.sh"]))

    started_all = time.monotonic()
    results: list[tuple[str, int]] = []

    with log_path.open("w", encoding="utf-8") as log:
        write(log, "cloudless.gr app check")
        write(log, f"Started: {dt.datetime.now().isoformat(timespec='seconds')}")
        write(log, f"Repo: {REPO_ROOT}")
        write(log, f"Log: {log_path}")
        write(log, f"Steps: {len(steps)}")

        for idx, (name, command) in enumerate(steps, start=1):
            code = run_step(log, idx, len(steps), name, command)
            results.append((name, code))

        elapsed_all = time.monotonic() - started_all

        write(log)
        write(log, "================ SUMMARY ================")

        failures = 0
        for name, code in results:
            status = "PASS" if code == 0 else f"FAIL({code})"
            if code != 0:
                failures += 1
            write(log, f"{name:32} {status}")

        write(log, "=========================================")
        write(log, f"Elapsed: {elapsed_all:.1f}s")
        write(log, f"Log file: {log_path}")

        if failures:
            write(log)
            write(log, f"❌ Completed with {failures} failing step(s).")
            write(log, "Next: inspect the first failing command above or ask Deep Agent to summarize this log.")
        else:
            write(log)
            write(log, "✅ All app checks passed.")

    print()
    print(f"Log saved to: {log_path}")

    raise SystemExit(1 if any(code != 0 for _, code in results) else 0)


if __name__ == "__main__":
    main()
