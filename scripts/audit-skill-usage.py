#!/usr/bin/env python3
"""One-shot skill usage audit. Outputs:
  <last-commit-date> | claudeMD=<n> docs=<n> code=<n> | <skill>

- claudeMD: occurrences in CLAUDE.md
- docs: files under docs/ referencing the skill name
- code: files under src/ scripts/ .github/workflows/
        infrastructure/ referencing the skill name

Stale candidates: zero code+docs+claudeMD refs AND last commit
>30d ago."""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

claude = (ROOT / "CLAUDE.md").read_text() \
    if (ROOT / "CLAUDE.md").is_file() else ""


def count_refs(name: str, dirs: list[str], glob_pat: str = "*") -> int:
    n = 0
    for d in dirs:
        base = ROOT / d
        if not base.is_dir():
            continue
        for f in base.rglob(glob_pat):
            try:
                if name in f.read_text(errors="replace"):
                    n += 1
            except Exception:
                pass
    return n


rows = []
for d in sorted((ROOT / "skills").iterdir()):
    if not d.is_dir() or not (d / "SKILL.md").is_file():
        continue
    name = d.name
    r = subprocess.run(
        ["git", "log", "-1", "--format=%cs", "--", str(d)],
        capture_output=True, text=True, cwd=ROOT)
    last = r.stdout.strip() or "unknown"
    cmd_count = claude.count(name)
    docs = count_refs(name, ["docs"], "*.md")
    code = count_refs(
        name, ["src", "scripts", ".github/workflows",
               "infrastructure"])
    rows.append((last, cmd_count, docs, code, name))

for last, c, doc, code, name in sorted(rows):
    print(f"{last:<12} | claudeMD={c} docs={doc} code={code} | "
          f"{name}")
