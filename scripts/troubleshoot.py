import argparse
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


def run(command: list[str]) -> int:
    print()
    print("$ " + " ".join(command))
    result = subprocess.run(command, cwd=REPO_ROOT)
    return result.returncode


def troubleshoot_r21() -> int:
    print("Troubleshooting area: R21 search / Meilisearch")
    print("Mode: read-only checks + focused tests")
    print()

    commands = [
        ["bash", "scripts/check_r21_search_baseline.sh"],
        ["bash", "scripts/check_r21_meilisearch_k3s_storage.sh"],
        ["bash", "scripts/check_r21_meilisearch_live_readiness.sh"],
        [
            "pnpm",
            "vitest",
            "run",
            "__tests__/r21-ai-baseline.test.ts",
            "__tests__/product-search.test.ts",
            "__tests__/api-search-route.test.ts",
            "__tests__/admin-search-reindex-route.test.ts",
        ],
    ]

    failures = 0

    for command in commands:
        code = run(command)
        if code != 0:
            failures += 1

    print()

    if failures:
        print(f"❌ R21 troubleshooting completed with {failures} failing check(s).")
        print()
        print("Next safe step:")
        print("- inspect the first failing command above")
        print("- create a patch proposal with:")
        print('  pnpm run ai:vibe:patch -- "Fix the failing R21 troubleshooting check"')
        return 1

    print("✅ R21 troubleshooting checks all passed.")
    print()
    print("If the issue still reproduces:")
    print("- verify app runtime env has MEILI_HOST and MEILI_SEARCH_KEY")
    print("- verify reindex runtime has MEILI_ADMIN_KEY or MEILI_MASTER_KEY")
    print("- verify CRON_SECRET for /api/admin/search/reindex")
    print("- inspect app logs for /api/search fallback warnings")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="cloudless.gr troubleshooting dispatcher")
    parser.add_argument("topic", nargs="*", help="Issue/topic to troubleshoot")
    args = parser.parse_args()

    topic = " ".join(args.topic).lower().strip()

    if not topic:
        raise SystemExit("Missing troubleshooting topic")

    if any(token in topic for token in ["r21", "search", "meili", "meilisearch"]):
        raise SystemExit(troubleshoot_r21())

    print(f"No troubleshooting workflow registered for: {topic}")
    print()
    print("Available workflows:")
    print("- R21 search / Meilisearch")
    raise SystemExit(2)


if __name__ == "__main__":
    main()
