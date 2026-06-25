from datetime import UTC, datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MEMORY_FILE = PROJECT_ROOT / ".agent-memory" / "memories" / "AGENTS.md"


FORBIDDEN_TERMS = [
    "api key",
    "apikey",
    "token",
    "password",
    "secret",
    "credential",
    "private key",
    "access key",
    "refresh token",
]


def remember(note: str, section: str = "User preferences") -> None:
    """Append a safe, non-secret memory note to the local agent memory file."""
    cleaned_note = note.strip()

    if not cleaned_note:
        raise ValueError("Memory note cannot be empty.")

    lowered = cleaned_note.lower()
    if any(term in lowered for term in FORBIDDEN_TERMS):
        raise ValueError("Refusing to store possible secret or credential in memory.")

    MEMORY_FILE.parent.mkdir(parents=True, exist_ok=True)

    existing = MEMORY_FILE.read_text(encoding="utf-8") if MEMORY_FILE.exists() else ""

    if cleaned_note in existing:
        print("Memory already exists.")
        return

    timestamp = datetime.now(UTC).isoformat(timespec="seconds")

    if f"## {section}" not in existing:
        addition = f"\n\n## {section}\n"
    else:
        addition = ""

    addition += f"- {cleaned_note}\n"
    addition += f"  - Recorded at: {timestamp}\n"

    MEMORY_FILE.write_text(existing.rstrip() + addition + "\n", encoding="utf-8")

    print(f"Memory added to: {MEMORY_FILE}")


if __name__ == "__main__":
    import sys

    note = " ".join(sys.argv[1:]).strip()

    if not note:
        raise SystemExit('Usage: PYTHONPATH=. python agents/remember.py "memory note"')

    remember(note)
