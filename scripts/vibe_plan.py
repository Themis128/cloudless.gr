import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.vibe_review import review_proposal

SECTION_RE = re.compile(r"^## (?P<title>.+)$", re.MULTILINE)


def read_sections(text: str) -> dict:
    matches = list(SECTION_RE.finditer(text))
    sections = {}

    for idx, match in enumerate(matches):
        title = match.group("title").strip()
        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        sections[title] = text[start:end].strip()

    return sections


def extract_bullets(section: str) -> list:
    items = []

    for line in section.splitlines():
        line = line.strip()
        if line.startswith("- "):
            items.append(line[2:].strip())

    return items


def build_plan(proposal_path: Path) -> str:
    ok, errors, warnings = review_proposal(proposal_path)
    text = proposal_path.read_text(encoding="utf-8", errors="ignore")
    sections = read_sections(text)

    request = sections.get("Request", "").strip()
    relevant_files = extract_bullets(sections.get("Relevant existing files", ""))
    tests = extract_bullets(sections.get("Tests to run", ""))

    try:
        display_path = proposal_path.relative_to(REPO_ROOT)
    except ValueError:
        display_path = proposal_path

    lines = [
        "# Vibe Implementation Plan",
        "",
        f"Proposal: `{display_path}`",
        "",
        "## Review status",
        "",
        "✅ Passed deterministic safety review."
        if ok
        else "❌ Failed deterministic safety review.",
        "",
    ]

    if errors:
        lines.append("### Errors")
        lines.append("")
        lines.extend(f"- {error}" for error in errors)
        lines.append("")

    if warnings:
        lines.append("### Warnings")
        lines.append("")
        lines.extend(f"- {warning}" for warning in warnings)
        lines.append("")

    lines.extend(
        [
            "## Request",
            "",
            request or "(missing)",
            "",
            "## Relevant files to inspect",
            "",
        ]
    )

    if relevant_files:
        lines.extend(f"- {item}" for item in relevant_files)
    else:
        lines.append("- No relevant files listed.")

    lines.extend(
        [
            "",
            "## Implementation checklist",
            "",
            "- Inspect the relevant files before editing.",
            "- Keep changes minimal and limited to the request.",
            "- Do not modify `.env.local`, `.deepagents/`, generated DBs, or backup files.",
            "- Do not add API keys, tokens, passwords, or secret-looking placeholders.",
            "- Prefer existing test locations and existing helper APIs.",
            "- Make one small commit after validation passes.",
            "",
            "## Suggested implementation steps",
            "",
        ]
    )

    request_lc = request.lower()

    if (
        "r21" in request_lc
        or "ai baseline" in request_lc
        or "product search" in request_lc
        or "meilisearch" in request_lc
        or "semantic search" in request_lc
        or "bedrock embedding" in request_lc
        or "admin reindex" in request_lc
    ):
        lines.extend(
            [
                "- Inspect `src/lib/product-search.ts`, `src/lib/meilisearch.ts`, and `src/lib/bedrock-embeddings.ts`.",
                "- Verify `/api/search` returns `source: empty` for blank queries.",
                "- Verify `/api/search` uses fallback search when Meilisearch is not configured.",
                "- Verify `/api/search` falls back if Meilisearch or Bedrock search throws.",
                "- Verify admin reindex requires `x-cron-secret` or `x-admin-secret`.",
                "- Verify product search documents preserve numeric prices as strings.",
                "- Run the R21 focused Vitest suite.",
            ]
        )
    elif "sentry" in request_lc or "sentry_environment" in request_lc or "r14" in request_lc:
        lines.extend(
            [
                "- Inspect `sentry.server.config.ts`, `sentry.edge.config.ts`, and `sentry.client.config.ts`.",
                "- Verify server/edge use `process.env.SENTRY_ENVIRONMENT`.",
                "- Verify client/browser uses `process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT`.",
                "- Verify AWS deploy sets `SENTRY_ENVIRONMENT: prod` and `NEXT_PUBLIC_SENTRY_ENVIRONMENT: prod`.",
                "- Verify Pi deploy/build workflows set `SENTRY_ENVIRONMENT=pi-standby` and `NEXT_PUBLIC_SENTRY_ENVIRONMENT=pi-standby`.",
                "- Run `bash scripts/check_r14_sentry_env_tagging.sh`.",
            ]
        )
    elif "langsmith" in request_lc and "auth" in request_lc:
        lines.extend(
            [
                "- Open `tests/langsmith_api/test_endpoints.py`.",
                '- Add a test that reads `get_endpoint("langsmith.health")` and `get_endpoint("fleet.connections.list")`.',
                "- Assert `langsmith.health` has `auth_required is False`.",
                "- Assert `fleet.connections.list` has `auth_required is True`.",
                "- Run `pnpm run ai:test:api`.",
            ]
        )
    elif "langsmith" in request_lc:
        lines.extend(
            [
                "- Inspect existing files under `tests/langsmith_api/`.",
                "- Prefer extending an existing test file over creating a new one.",
                "- Use registered endpoint names rather than arbitrary paths.",
                "- Run `pnpm run ai:test:api`.",
            ]
        )
    else:
        lines.extend(
            [
                "- Inspect the listed files.",
                "- Draft the smallest possible change.",
                "- Run the validation commands below.",
            ]
        )

    lines.extend(
        [
            "",
            "## Validation commands",
            "",
        ]
    )

    if tests:
        lines.extend(f"- `{test}`" for test in tests)
    else:
        lines.extend(
            [
                "- `pnpm run ai:skills-check`",
                "- `pnpm run ai:test:api`",
                "- `pnpm run ai:check`",
            ]
        )

    lines.extend(
        [
            "",
            "## Rollback",
            "",
            "- Before commit: `git restore <changed-files>`",
            "- After commit: `git revert <commit>`",
            "",
            "## Safety note",
            "",
            "This command does not modify source files. It only creates an implementation plan.",
            "",
        ]
    )

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create an implementation plan from a reviewed vibe proposal"
    )
    parser.add_argument("proposal", help="Path to proposal markdown file")
    parser.add_argument(
        "--write", action="store_true", help="Write a .plan.md next to the proposal"
    )
    args = parser.parse_args()

    proposal_path = (REPO_ROOT / args.proposal).resolve()

    if not proposal_path.exists():
        raise SystemExit(f"Proposal does not exist: {proposal_path}")

    plan = build_plan(proposal_path)

    if args.write:
        output_path = proposal_path.with_suffix(".plan.md")
        output_path.write_text(plan, encoding="utf-8")
        print(f"Created implementation plan: {output_path}")
    else:
        print(plan)


if __name__ == "__main__":
    main()
