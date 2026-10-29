# auto-heal-ops — PR self-healer

Watches a PR and fixes the failures it can, automatically:

| Failure | Healer |
|---|---|
| Python Lint (ruff) | `ruff check --fix` on changed .py → commit+push — checks re-run |
| CWV audit | one auto-retrigger (ARM-runner variance) |
| PR merge | reports done and exits |

## Usage

```bash
python3 .devin/skills/auto-heal-ops/scripts/self_heal.py 2319
python3 self_heal.py 2319 --watch-min 40
```

Heals each failure class once per run (won't loop). Run it right after
pushing — it catches the ruff/import-sort/semicolon class that burns
CI cycles on hand-fixable issues.

## Gotchas

- Needs the PR branch checked out locally for the ruff fix + push.
- `cwv` heal = retrigger only — a REAL regression (like the
  Content-Signal robots.txt bug) still needs the cwv-triage skill.
- Non-fixable fails (test logic, type errors needing thought) are
  reported, not healed.
