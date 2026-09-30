#!/usr/bin/env python3
"""cowork-bundle.py — package a path-set from a Cowork session into
a tarball + commit-message + APPLY.md the user runs in their WSL
clone.

Why: Cowork can't reliably push (.git/index.lock perms, missing
GITHUB_PAT, dirty unrelated working tree). This produces a
portable bundle the user applies in ~/code/cloudless.gr.

Usage:
  python3 scripts/cowork-bundle.py \\
    --name <slug> --branch <name> --title "<msg>" \\
    --body-file <path> --outputs <dir> -- <path> [<path>...]"""

import argparse
import os
import shutil
import sys
import tarfile
from pathlib import Path

p = argparse.ArgumentParser(
    description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
)
p.add_argument("--name", required=True)
p.add_argument("--branch", required=True)
p.add_argument("--title", required=True)
p.add_argument("--body-file", required=True, dest="body_file")
p.add_argument("--outputs", required=True)
p.add_argument("paths", nargs="+")
a = p.parse_args()

body_file = Path(a.body_file)
if not body_file.is_file():
    sys.exit(f"ERR: body-file missing: {body_file}")

REPO = Path(__file__).resolve().parent.parent

os.chdir(REPO)

for path in a.paths:
    if not Path(path).exists():
        sys.exit(f"ERR: path missing from worktree: {path}")

outputs = Path(a.outputs)
outputs.mkdir(parents=True, exist_ok=True)
tarball = outputs / f"{a.name}.tar.gz"
commit_msg = outputs / f"COMMIT-MSG-{a.name}.txt"
pr_body = outputs / f"PR-BODY-{a.name}.md"
apply_md = outputs / f"APPLY-{a.name}.md"

with tarfile.open(tarball, "w:gz") as tar:
    for path in a.paths:
        tar.add(path)

commit_msg.write_text(f"{a.title}\n\n" + body_file.read_text())
shutil.copy(body_file, pr_body)

add_lines = ["git add \\"]
for i, path in enumerate(a.paths):
    suffix = "" if i == len(a.paths) - 1 else " \\"
    add_lines.append(f'  "{path}"{suffix}')
add_block = "\n".join(add_lines)
paths_listing = "\n".join(a.paths)

apply_md.write_text(f"""\
# Apply {a.name} to `~/code/cloudless.gr`

Produced by `scripts/cowork-bundle.py`. Four artefacts in the
Cowork outputs folder:

- `{a.name}.tar.gz` — file payload
- `COMMIT-MSG-{a.name}.txt` — commit subject + body (use with `git commit -F`)
- `PR-BODY-{a.name}.md` — PR body (use with `gh pr create --body-file`)
- `APPLY-{a.name}.md` (this file) — copy-paste recipe

```bash
# Set WIN_TMP to wherever you dropped the four files
export WIN_TMP=/mnt/c/Users/baltz/AppData/Roaming/Claude/local-agent-mode-sessions/...

cd ~/code/cloudless.gr
git fetch origin main

# Idempotent: reuse the branch if you ran this before
if git show-ref --verify --quiet refs/heads/{a.branch}; then
  git checkout {a.branch}
  git reset --hard origin/main
else
  git checkout -b {a.branch} origin/main
fi

# 1. Drop the bundle in
tar -xzf "$WIN_TMP/{a.name}.tar.gz" -C .

# 2. Stage ONLY the bundle paths (never `git add -A` from a Cowork mount)
{add_block}

git status --short

# 3. Commit using the message file (preserves multiline body)
git commit -F "$WIN_TMP/COMMIT-MSG-{a.name}.txt"

# 4. Push
git push -u origin {a.branch}

# 5. Open or update the PR — idempotent
PR_NUM="$(gh pr view --json number -q .number 2>/dev/null || true)"
if [ -n "$PR_NUM" ]; then
  echo "PR #$PR_NUM exists; updating."
  gh pr edit "$PR_NUM" --title {a.title!r} --body-file "$WIN_TMP/PR-BODY-{a.name}.md"
else
  gh pr create --base main --title {a.title!r} --body-file "$WIN_TMP/PR-BODY-{a.name}.md"
  PR_NUM="$(gh pr view --json number -q .number)"
fi

# 6. Squash-merge per CLAUDE.md house style
gh pr merge "$PR_NUM" --squash --delete-branch
```

## Bundle contents ({len(a.paths)} top-level paths)

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
commit (working `GITHUB_PAT` is set), prefer `git bundle` over
this script.

## Setting up `GITHUB_PAT` to skip this next time

**Claude Code web UI → Session → Environment → Secrets → add
`GITHUB_PAT`**. See CLAUDE.md "Cloud Session Secrets".
""")
print(f"wrote {apply_md}")

size = tarball.stat().st_size
n_entries = sum(1 for _ in tarfile.open(tarball).getmembers())
print(f"wrote {tarball} ({size} bytes, {n_entries} entries)")
print(f"wrote {commit_msg}")
print(f"wrote {pr_body}")
print(f"""
Done. Present these to the user:
  {tarball}
  {commit_msg}
  {pr_body}
  {apply_md}""")
