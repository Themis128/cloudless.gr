import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from agents.cloudless_fast_answers import try_fast_answer


def main() -> None:
    parser = argparse.ArgumentParser(description="Fast deterministic cloudless.gr agent answers")
    parser.add_argument("question", nargs="*", help="Question to answer")
    args = parser.parse_args()

    question = " ".join(args.question).strip()

    if not question:
        question = sys.stdin.read().strip()

    if not question:
        raise SystemExit("Missing question")

    answer = try_fast_answer(question)

    if answer is None:
        raise SystemExit("No deterministic fast answer available for this question.")

    print(answer)


if __name__ == "__main__":
    main()
