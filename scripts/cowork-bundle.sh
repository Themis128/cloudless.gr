#!/usr/bin/env bash
# cowork-bundle.sh — package a path-set from a Cowork session into a
# tarball + commit-message + APPLY.md the user runs in their WSL clone.
#
# Why: Cowork can't reliably push (.git/index.lock perms, missing
# GITHUB_PAT, dirty unrelated working tree). This produces a portable
# bundle the user applies in ~/code/cloudless.gr.
#
# Design: tarball (not `git bundle` — bundling requires a commit, blocked
# by the index.lock; not `git format-patch` — loses binary files and is
# clunky for many new files).
#
# Usage:
#   scripts/cowork-bundle.sh \
#     --name <slug> --branch <name> --title "<msg>" \
#     --body-file <path> --outputs <dir> -- <path> [<path>...]

set -euo pipefail

NAME=""; BRANCH=""; TITLE=""; BODY_FILE=""; OUTPUTS=""; PATHS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)      NAME="$2"; shift 2 ;;
    --branch)    BRANCH="$2"; shift 2 ;;
    --title)     TITLE="$2"; shift 2 ;;
    --body-file) BODY_FILE="$2"; shift 2 ;;
    --outputs)   OUTPUTS="$2"; shift 2 ;;
    --)          shift; PATHS=("$@"); break ;;
    -h|--help)   sed -n '2,15p' "$0"; exit 0 ;;
    *)           echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

die() { echo "ERR: $*" >&2; exit 1; }
[[ -n "${NAME}" && -n "${BRANCH}" && -n "${TITLE}" && -n "${BODY_FILE}" && -n "${OUTPUTS}" ]] \
  || die "--name --branch --title --body-file --outputs all required"
[[ -f "${BODY_FILE}" ]] || die "body-file missing: ${BODY_FILE}"
[[ "${#PATHS[@]}" -gt 0 ]] || die "no paths after --"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

for p in "${PATHS[@]}"; do
  [[ -e "$p" ]] || die "path missing from worktree: $p"
done

mkdir -p "${OUTPUTS}"
TARBALL="${OUTPUTS}/${NAME}.tar.gz"
COMMIT_MSG="${OUTPUTS}/COMMIT-MSG-${NAME}.txt"
PR_BODY="${OUTPUTS}/PR-BODY-${NAME}.md"
APPLY_MD="${OUTPUTS}/APPLY-${NAME}.md"

# Tarball
tar -czf "${TARBALL}" "${PATHS[@]}"

# Commit message: subject + blank + body
{ printf '%s\n\n' "${TITLE}"; cat "${BODY_FILE}"; } > "${COMMIT_MSG}"

# PR body: same as the bundle's body file
cp "${BODY_FILE}" "${PR_BODY}"

# APPLY.md — generated via Python to dodge nested-heredoc parsing
PATHS_JSON="$(printf '%s\n' "${PATHS[@]}" | python3 -c 'import sys,json; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')"

NAME="${NAME}" BRANCH="${BRANCH}" TITLE="${TITLE}" APPLY_MD="${APPLY_MD}" \
PATHS_JSON="${PATHS_JSON}" python3 <<'PYEOF'
import json, os, textwrap

name    = os.environ["NAME"]
branch  = os.environ["BRANCH"]
title   = os.environ["TITLE"]
out     = os.environ["APPLY_MD"]
paths   = json.loads(os.environ["PATHS_JSON"])

# git add block: `git add \` then `  "path" \` lines, last with NO trailing `\`
add_lines = ["git add \\"]
for i, p in enumerate(paths):
    suffix = "" if i == len(paths) - 1 else " \\"
    add_lines.append(f'  "{p}"{suffix}')
add_block = "\n".join(add_lines)

paths_listing = "\n".join(paths)

# Recipe body — all backticks/dollars are literal Python; no shell parse issues.
recipe = f"""\
# Apply {name} to `~/code/cloudless.gr`

Produced by `scripts/cowork-bundle.sh`. Four artefacts in the Cowork
outputs folder:

- `{name}.tar.gz` — file payload
- `COMMIT-MSG-{name}.txt` — commit subject + body (use with `git commit -F`)
- `PR-BODY-{name}.md` — PR body (use with `gh pr create --body-file`)
- `APPLY-{name}.md` (this file) — copy-paste recipe

```bash
# Set WIN_TMP to wherever you dropped the four files
export WIN_TMP=/mnt/c/Users/baltz/AppData/Roaming/Claude/local-agent-mode-sessions/...

cd ~/code/cloudless.gr
git fetch origin main

# Idempotent: reuse the branch if you ran this before
if git show-ref --verify --quiet refs/heads/{branch}; then
  git checkout {branch}
  git reset --hard origin/main
else
  git checkout -b {branch} origin/main
fi

# 1. Drop the bundle in
tar -xzf "$WIN_TMP/{name}.tar.gz" -C .

# 2. Stage ONLY the bundle paths (never `git add -A` from a Cowork mount)
{add_block}

git status --short

# 3. Commit using the message file (preserves multiline body)
git commit -F "$WIN_TMP/COMMIT-MSG-{name}.txt"

# 4. Push
git push -u origin {branch}

# 5. Open or update the PR — idempotent
PR_NUM="$(gh pr view --json number -q .number 2>/dev/null || true)"
if [ -n "$PR_NUM" ]; then
  echo "PR #$PR_NUM exists; updating."
  gh pr edit "$PR_NUM" --title {title!r} --body-file "$WIN_TMP/PR-BODY-{name}.md"
else
  gh pr create --base main --title {title!r} --body-file "$WIN_TMP/PR-BODY-{name}.md"
  PR_NUM="$(gh pr view --json number -q .number)"
fi

# 6. Squash-merge per CLAUDE.md house style
gh pr merge "$PR_NUM" --squash --delete-branch
```

## Bundle contents ({len(paths)} top-level paths)

```
{paths_listing}
```

## Why a tarball, not `git push` or `git bundle`?

| Approach | Works in Cowork sandbox? | Why we skipped it |
|---|---|---|
| Direct `git push` | NO | `.git/index.lock` perms + missing `GITHUB_PAT` |
| `git bundle create` | NO | Bundling requires committing first, blocked by index.lock |
| `git format-patch` | clunky | Loses binary files, awkward for many new files |
| `git diff HEAD` patch | partial | Tracked modifications only, no new files |
| **Tarball + APPLY.md** | YES | Works around all of the above |

`git bundle` is the canonical "transfer commits without a network"
tool — <https://git-scm.com/book/en/v2/Git-Tools-Bundling>. We only
skip it because Cowork can't reliably commit. Once a session can
commit (working `GITHUB_PAT` is set), prefer `git bundle` over this
script.

## Setting up `GITHUB_PAT` to skip this next time

**Claude Code web UI → Session → Environment → Secrets → add `GITHUB_PAT`**.
See CLAUDE.md "Cloud Session Secrets".
"""

with open(out, "w") as f:
    f.write(recipe)

print(f"wrote {out}")
PYEOF

echo "wrote ${TARBALL} ($(wc -c < "${TARBALL}") bytes, $(tar -tzf "${TARBALL}" | wc -l) entries)"
echo "wrote ${COMMIT_MSG}"
echo "wrote ${PR_BODY}"
echo
echo "Done. Present these to the user:"
echo "  ${TARBALL}"
echo "  ${COMMIT_MSG}"
echo "  ${PR_BODY}"
echo "  ${APPLY_MD}"
