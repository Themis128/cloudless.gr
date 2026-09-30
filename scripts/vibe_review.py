import argparse
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

REQUIRED_SECTIONS = [
    "## Request",
    "## Goal",
    "## Relevant existing files",
    "## Proposed change",
    "## Tests to run",
    "## Rollback plan",
    "## Human approval question",
]

FORBIDDEN_PATTERNS = [
    r"package\.json\.bak",
    r"LANGSMITH_API_KEY\s*=",
    r"API_KEY\s*=\s*['\"][^'\"]+['\"]",
    r"SECRET\s*=\s*['\"][^'\"]+['\"]",
    r"TOKEN\s*=\s*['\"][^'\"]+['\"]",
    r"PASSWORD\s*=\s*['\"][^'\"]+['\"]",
]

CONTEXTUAL_FORBIDDEN_TERMS = [
    ".env.local",
    ".deepagents/",
]


def contextual_forbidden_errors(text: str) -> list[str]:
    """Flag risky paths unless they are clearly mentioned as things to avoid."""
    errors = []

    allowed_markers = [
        "avoid",
        "avoids",
        "never commit",
        "do not commit",
        "not commit",
        "ignore",
        "ignored",
        "generated",
    ]

    for line in text.splitlines():
        line_lc = line.lower()

        for term in CONTEXTUAL_FORBIDDEN_TERMS:
            if term in line:
                if any(marker in line_lc for marker in allowed_markers):
                    continue

                errors.append(f"Forbidden risky path mention outside safety guidance: {term}")

    return errors


RECOMMENDED_TEST_MARKERS = [
    "pnpm run ai:skills-check",
    "pnpm run ai:test:api",
    "pnpm run ai:check",
]


def is_relative_to_repo(path: Path) -> bool:
    try:
        path.resolve().relative_to(REPO_ROOT.resolve())
        return True
    except ValueError:
        return False


def review_proposal(path: Path) -> tuple[bool, list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    if not path.exists():
        errors.append(f"Proposal does not exist: {path}")
        return False, errors, warnings

    if not is_relative_to_repo(path):
        errors.append("Proposal path escapes repository root.")

    if ".agent-patches" not in path.parts:
        warnings.append("Proposal is not under .agent-patches/.")

    text = path.read_text(encoding="utf-8", errors="ignore")

    for section in REQUIRED_SECTIONS:
        if section not in text:
            errors.append(f"Missing required section: {section}")

    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, text, flags=re.IGNORECASE):
            errors.append(f"Forbidden pattern found: {pattern}")

    errors.extend(contextual_forbidden_errors(text))

    if "Apply this patch? yes/no" not in text:
        errors.append('Missing approval question: "Apply this patch? yes/no"')

    if "```diff" not in text:
        warnings.append("No diff block found. This is acceptable for proposal-only drafts.")

    for marker in RECOMMENDED_TEST_MARKERS:
        if marker not in text:
            warnings.append(f"Recommended test missing: {marker}")

    if "No patch has been applied" not in text:
        warnings.append('Proposal does not explicitly say "No patch has been applied".')

    return len(errors) == 0, errors, warnings


def main() -> None:
    parser = argparse.ArgumentParser(description="Review a deterministic vibe patch proposal")
    parser.add_argument("proposal", help="Path to proposal markdown file")
    args = parser.parse_args()

    proposal_path = (REPO_ROOT / args.proposal).resolve()
    ok, errors, warnings = review_proposal(proposal_path)

    print(f"Reviewing proposal: {proposal_path}")
    print()

    if errors:
        print("Errors:")
        for error in errors:
            print(f"❌ {error}")
        print()

    if warnings:
        print("Warnings:")
        for warning in warnings:
            print(f"⚠️ {warning}")
        print()

    if ok:
        print("✅ Proposal passed deterministic safety review.")
        raise SystemExit(0)

    print("❌ Proposal failed deterministic safety review.")
    raise SystemExit(1)


if __name__ == "__main__":
    main()
