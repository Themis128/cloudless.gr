import argparse
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.vibe_review import review_proposal


def git_status_short() -> str:
    result = subprocess.run(
        ["git", "status", "--short"],
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )

    if result.returncode != 0:
        return f"ERROR: git status failed: {result.stderr.strip()}"

    return result.stdout.strip()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Show readiness status for a vibe patch proposal"
    )
    parser.add_argument("proposal", help="Path to proposal markdown file")
    args = parser.parse_args()

    proposal_path = (REPO_ROOT / args.proposal).resolve()

    ok, errors, warnings = review_proposal(proposal_path)
    status = git_status_short()

    print(f"Vibe proposal status: {proposal_path}")
    print()

    if ok:
        print("Review: ✅ passed")
    else:
        print("Review: ❌ failed")
        for error in errors:
            print(f"  - {error}")

    if warnings:
        print()
        print("Warnings:")
        for warning in warnings:
            print(f"  - {warning}")

    print()

    if status:
        print("Working tree: ⚠️ not clean")
        print(status)
    else:
        print("Working tree: ✅ clean")

    print()
    print("Next step:")

    if ok and not status:
        print("- Proposal is review-clean and working tree is clean.")
        print("- You may manually implement the change, then run validation tests.")
    elif ok:
        print("- Proposal is review-clean, but working tree has changes.")
        print("- Inspect the working tree before implementing anything else.")
    else:
        print("- Fix proposal review errors before implementing.")

    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
