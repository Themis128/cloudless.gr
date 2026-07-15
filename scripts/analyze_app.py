import argparse
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


R21_FILES = [
    "src/app/api/search/route.ts",
    "src/app/api/admin/search/reindex/route.ts",
    "src/app/api/products/recommendations/route.ts",
    "src/app/[locale]/store/[id]/page.tsx",
    "src/lib/product-search.ts",
    "src/lib/product-recommendations.ts",
    "src/lib/meilisearch.ts",
    "src/lib/bedrock-embeddings.ts",
    "__tests__/r21-ai-baseline.test.ts",
    "__tests__/product-search.test.ts",
    "__tests__/api-search-route.test.ts",
    "__tests__/admin-search-reindex-route.test.ts",
    "__tests__/product-recommendations.test.ts",
    "__tests__/product-recommendations-route.test.ts",
]


def run(command: list[str]) -> int:
    print()
    print("$ " + " ".join(command))
    return subprocess.run(command, cwd=REPO_ROOT).returncode


def exists(path: str) -> bool:
    return (REPO_ROOT / path).exists()


def analyze_r21() -> int:
    print("cloudless.gr app analysis: R21 AI/search/recommendations")
    print("=" * 60)
    print()

    print("Relevant files:")
    for file in R21_FILES:
        marker = "✅" if exists(file) else "⚠️ "
        print(f"{marker} {file}")

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
        if run(command) != 0:
            failures += 1

    print()
    print("Suggested next checks:")
    if not exists("src/lib/product-recommendations.ts"):
        print("- Add R21L product recommendation helper.")
    if not exists("src/app/api/products/recommendations/route.ts"):
        print("- Add R21M product recommendations API route.")
    if exists("src/app/[locale]/store/[id]/page.tsx"):
        print("- Verify product detail page uses server-side recommendations helper.")
    print("- Run typecheck after TSX/page changes.")
    print("- Keep Meilisearch PVC on OMV-MAIN dedicated SSD.")

    return 1 if failures else 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze cloudless.gr app areas")
    parser.add_argument("topic", nargs="*", help="Area to analyze")
    args = parser.parse_args()

    topic = " ".join(args.topic).lower()

    if any(token in topic for token in ["r21", "search", "recommend", "meili", "ai"]):
        raise SystemExit(analyze_r21())

    print("No analyzer registered for this topic.")
    print("Available: R21 search/recommendations/Meilisearch")
    raise SystemExit(2)


if __name__ == "__main__":
    main()
