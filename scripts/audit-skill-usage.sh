#!/usr/bin/env bash
# One-shot skill usage audit. Outputs:
#   <last-commit-date> | claudeMD=<count> docs=<count> code=<count> | <skill-name>
# - claudeMD: occurrences in CLAUDE.md
# - docs:     files under docs/ that reference the skill name
# - code:     files under src/ scripts/ .github/workflows/ infrastructure/
#             that reference the skill name
# Stale candidates: anything with zero code+docs+claudeMD refs AND last commit > 30d ago.
# NOTE: set -e is intentionally OFF — grep -c returning 0 (no match) is exit
# code 1 in some grep builds and would kill the loop on the first stale skill.
set -uo pipefail
cd "$(dirname "$0")/.."
for d in skills/*/; do
  n=$(basename "$d")
  [[ -f "$d/SKILL.md" ]] || continue
  last=$(git log -1 --format=%cs -- "$d" 2>/dev/null)
  [[ -z "${last:-}" ]] && last="unknown"
  claude=$(grep -c "$n" CLAUDE.md 2>/dev/null)
  [[ -z "${claude:-}" ]] && claude=0
  docs=$(grep -rl --include="*.md" "$n" docs/ 2>/dev/null | wc -l)
  code=$(grep -rl "$n" src/ scripts/ .github/workflows/ infrastructure/ 2>/dev/null | wc -l)
  printf "%-12s | claudeMD=%s docs=%s code=%s | %s\n" "$last" "$claude" "$docs" "$code" "$n"
done | sort
