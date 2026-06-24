from pathlib import Path

required_handlers = [
    "test",
    "check",
    "skills-check",
    "ingest-docs",
    "ingest-repo",
    "ingest-all",
    "docs",
    "repo",
    "unified",
    "deep-smoke",
    "deep",
    "vibe-plan",
    "troubleshoot",
    "vibe-status",
    "vibe-review",
    "vibe-patch",
    "fast-answer",
    "langsmith-check",
    "langsmith-call",
    "langsmith-page",
    "langsmith-stream",
    "langsmith-endpoint",
]

text = Path("scripts/ai.sh").read_text()

missing = []

for handler in required_handlers:
    needle = f"  {handler})"
    if needle not in text:
        missing.append(handler)

if missing:
    print("Missing ai.sh handlers:")
    for item in missing:
        print(f"- {item}")
    raise SystemExit(1)

print("ai.sh dispatcher handlers OK")
