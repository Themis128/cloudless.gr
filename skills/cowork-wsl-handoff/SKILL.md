---
name: cowork-wsl-handoff
description: |
  Package edits made during a Cowork D:\ session into a portable bundle
  the user applies in the WSL canonical clone (~/code/cloudless.gr) to
  commit, push, PR, and squash-merge. Use whenever you've made
  non-trivial repo edits from inside Cowork and need to land them on
  main but the sandbox can't push (stale .git/index.lock, missing
  GITHUB_PAT, dirty unrelated working tree). The bundler is
  scripts/cowork-bundle.sh.
---

# Cowork → WSL handoff

Cowork sessions mount the Windows-side `D:\cloudless.gr`, but the canonical
clone per CLAUDE.md is the WSL one at `~/code/cloudless.gr`. Three
gotchas keep biting any session that tries to push from the sandbox:

1. **`.git/index.lock` perms** — the Windows mount semantics leak through;
   a stale lock can't be unlinked from inside the sandbox.
2. **`GITHUB_PAT` not present** — the session-start hook needs it
   pre-registered in the web UI's Session → Environment → Secrets. If it
   isn't there, no auth → no push.
3. **Dirty working tree** — Cowork sessions often have 10–20 unrelated
   half-finished modifications from earlier work. A naive `git add -A`
   commits them by accident.

This skill is the systematic way around all three: build a bundle, hand it
off, apply it in WSL.

## When to invoke this skill

- You've made multi-file repo edits in a Cowork session and the session
  has no `GITHUB_PAT`.
- The sandbox returns `fatal: Unable to create '.git/index.lock'` and you
  can't `rm` it.
- The working tree has unrelated modifications you don't want to commit.
- The user asked to "ship the changes" or "open a PR" for work that
  exists on disk but not in any commit yet.

If `GITHUB_PAT` **is** in session secrets and the working tree is clean
for your paths, prefer a direct push — this skill is the fallback, not
the default.

## Pre-flight check

```bash
echo "GITHUB_PAT len: ${#GITHUB_PAT}"
ls -la /sessions/*/mnt/cloudless.gr/.git/index.lock 2>&1 | head -1
git -C /sessions/*/mnt/cloudless.gr status --short | wc -l
```

- PAT length 0 → can't push, use this skill.
- index.lock exists with `Operation not permitted` on `rm` → use this skill.
- High status-line count → unrelated work present, bundle the targeted
  paths only.

## The script

`scripts/cowork-bundle.sh` is the workhorse. Pattern:

```bash
# Write the PR/commit body to a file (no placeholders — real markdown)
cat > /tmp/<name>-body.md <<'EOF'
## What
...
## Verification
...
EOF

scripts/cowork-bundle.sh \
  --name      <slug> \
  --branch    claude/<slug> \
  --title     "<one-line commit/PR subject>" \
  --body-file /tmp/<name>-body.md \
  --outputs   /sessions/<session-id>/mnt/outputs \
  -- \
  <relative-path-1> \
  <relative-path-2> \
  ...
```

Output (in the Cowork outputs folder):

- `<slug>.tar.gz` — the bundle (only your paths, nothing extra).
- `APPLY-<slug>.md` — copy-paste-runnable recipe with the exact `git add`
  list, the commit message, the PR body, the `gh pr merge --squash`.

## Stage 1 — Pick paths

Be aggressive about narrowing. The `--` separator takes paths relative to
the repo root. Subdirectories include everything under them recursively.
The script validates each path exists before tarring.

```bash
# Good — narrow, every entry is real work
infrastructure/postiz/helm/
skills/postiz/
src/lib/postiz.ts
src/app/api/admin/postiz/

# Avoid — too coarse, may pull in dirty unrelated files
src/
infrastructure/
```

## Stage 2 — Write the body file

The same markdown is used as both the commit's body and the PR body. Keep
it under 60 lines and structured with `## What` / `## Verification` /
`## Deferred` headers — the same shape used in recent PRs.

Inline triple-backtick fences are safe; the script wraps the body in a
heredoc inside the generated `gh pr create` command.

## Stage 3 — Run + present

```bash
scripts/cowork-bundle.sh --name foo --branch claude/foo \
  --title "feat(foo): ..." --body-file /tmp/foo-body.md \
  --outputs /sessions/$(echo $HOSTNAME | cut -d. -f1)/mnt/outputs \
  -- src/foo/ tests/foo/
```

Then `mcp__cowork__present_files` with both produced paths so the user
can click them.

## Stage 4 — User applies in WSL

The user runs the block in `APPLY-<slug>.md` from their WSL clone. It
does:

1. `git fetch origin main && git checkout -b claude/<slug> origin/main`
2. `tar -xzf <bundle>.tar.gz -C .`
3. `git add` the explicit path list (no `-A`)
4. `git commit` with the canonical message
5. `git push -u origin claude/<slug>`
6. `gh pr create` + `gh pr merge --squash --delete-branch`

## Don't do this

- **Don't run `git add -A` from the bundle.** Defeats the whole point.
  The bundle's APPLY.md uses an explicit path list — leave it that way.
- **Don't omit the `--body-file`.** The script enforces this so the PR
  body matches the commit body. Empty bodies waste a merge.
- **Don't bundle Cowork's `.git/index.lock`.** The tar paths are
  worktree-relative, but a wildcard like `.` would catch dot-files. Always
  list real paths.
- **Don't apply the bundle in the Cowork mount itself.** The whole point
  is to escape the broken mount. Apply in `~/code/cloudless.gr`.

## See also

- `skills/postiz-apply/SKILL.md` — task-specific recipe that calls this
  script with the Postiz path set baked in.
- CLAUDE.md → "Working Style" and "Git Workflow" for the canonical-clone
  rule and house-style commit/merge flow.
- CLAUDE.md → "Cloud Session Secrets" for the `GITHUB_PAT` setup that
  obviates this skill altogether.
