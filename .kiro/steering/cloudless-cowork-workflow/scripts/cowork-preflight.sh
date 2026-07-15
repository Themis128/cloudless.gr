#!/usr/bin/env bash
# Cowork pre-flight sanity check for D:\cloudless.gr.
# Catches the known Windows-mount issues before they cost you a debug detour.
# Exit non-zero if anything looks corrupt.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
cd "$REPO_ROOT" || { echo "FAIL: can't cd to repo root"; exit 2; }

red()    { printf "\033[31m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }

fail=0

# Check 1: .git/index.lock stuck?
if [ -f .git/index.lock ]; then
  yellow "WARN .git/index.lock exists. Windows side is holding it."
  yellow "     From Windows: Remove-Item .git\\index.lock -Force"
  fail=$((fail+1))
else
  green   "OK   .git/index.lock is clear."
fi

# Check 2: working tree state
dirty=$(git status -s | wc -l)
if [ "$dirty" -gt 0 ]; then
  yellow "INFO Working tree has $dirty modified or untracked entries:"
  git status -s | sed 's/^/       /'
else
  green   "OK   Working tree is clean."
fi

# Check 3: do any modified text files show corruption signatures?
suspect=0
mods=$(git diff --name-only HEAD)
if [ -n "$mods" ]; then
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    case "$f" in
      *.ts|*.tsx|*.js|*.jsx|*.mts|*.cts|*.json|*.md|*.yml|*.yaml|*.sh|*.ps1|*.css|.env.example|.env*) ;;
      *) continue ;;
    esac

    nulls=$(tr -dc '\0' < "$f" 2>/dev/null | wc -c)
    if [ "$nulls" -gt 0 ]; then
      red "FAIL $f has $nulls NUL byte(s) — partial-flush corruption."
      suspect=$((suspect+1))
      continue
    fi

    if git cat-file -e "HEAD:$f" 2>/dev/null; then
      head_sz=$(git show "HEAD:$f" 2>/dev/null | wc -c)
      cur_sz=$(wc -c < "$f")
      sz_delta=$((head_sz - cur_sz))
      if [ "$sz_delta" -gt 50 ]; then
        diff_lines=$(git diff -- "$f" 2>/dev/null | grep -c '^-' || echo 0)
        if [ "$diff_lines" -lt 3 ]; then
          red "FAIL $f shrank by $sz_delta bytes vs HEAD with only $diff_lines '-' lines — likely truncation."
          suspect=$((suspect+1))
          continue
        fi
      fi
    fi

    tail_b=$(tail -c 4 "$f" 2>/dev/null | od -An -c | tr -d ' \n')
    case "$tail_b" in
      *'</'*) red "FAIL $f ends with '</' — looks truncated mid-closing-tag."; suspect=$((suspect+1)) ;;
    esac
  done <<< "$mods"
fi

if [ "$suspect" -gt 0 ]; then
  fail=$((fail+1))
elif [ "$dirty" -gt 0 ]; then
  green "OK   None of the modified files show known corruption signatures."
fi

# Check 4: can the sandbox actually write to the repo?
tmp="$(mktemp -u "$REPO_ROOT/.cowork-preflight-XXXXX")"
if echo "preflight" > "$tmp" 2>/dev/null; then
  if [ "$(cat "$tmp" 2>/dev/null)" = "preflight" ]; then
    green "OK   Sandbox can write into the repo."
  else
    red   "FAIL Sandbox write returned different content — mount is unreliable."
    fail=$((fail+1))
  fi
  rm -f "$tmp" 2>/dev/null || yellow "WARN could not rm probe file — Windows perm issue (harmless)."
else
  red "FAIL Sandbox cannot write into the repo at all."
  fail=$((fail+1))
fi

echo
if [ "$fail" -eq 0 ]; then
  green "Preflight passed."
  exit 0
else
  red "Preflight found $fail issue(s). Heal from Windows before continuing."
  exit 1
fi
