---
name: pr-conflict-resolve
description: Resolve merge conflicts in a PR branch and push a clean rebase. Use when the user says "fix the conflict", "rebase this PR", or when a PR is blocked from merging due to conflicts. Covers the standard rebase workflow, how to choose the correct side of a conflict (theirs vs ours), and special handling for workflow files where the intent of the PR branch must win.
allowed-tools: Bash, Read, Edit, mcp__github__pull_request_read, mcp__github__update_pull_request_branch
---

# PR Conflict Resolution

## When to use this skill

- A PR shows "This branch has conflicts that must be resolved" on GitHub.
- `git status` shows `UU` (both-modified) files after a failed `git merge` or `git rebase`.
- The user says "resolve the conflict in PR #N".

## Standard rebase workflow

```bash
# 1. Switch to the PR branch
git checkout <branch-name>

# 2. Fetch latest main
git fetch origin main

# 3. Start the rebase
git rebase origin/main
# If conflicts: rebase stops, files are marked UU

# 4. For each conflicted file — resolve it (see rules below), then:
git add <file>

# 5. After all files are resolved:
GIT_EDITOR=true git rebase --continue
# GIT_EDITOR=true accepts the existing commit message without opening an editor

# 6. Force-push (rebase rewrites history)
git push --force-with-lease origin <branch-name>
```

## Choosing the right side for workflow files

`.github/workflows/*.yml` conflicts are the most common. Apply this decision table:

| PR intent | Which side wins? |
|---|---|
| "Pin to ubuntu-latest" (reverting a RUNNER_GENERIC change) | **PR branch side** (`=======` to `>>>>>>>` block) |
| "Add RUNNER_GENERIC failover" to a workflow | **PR branch side** |
| PR is a hotfix that main already has (cherry-pick scenario) | **Main side** (HEAD / `<<<<<<< HEAD` block) |
| Unclear — both sides add distinct lines | Merge both sides manually |

**Rule of thumb:** The PR branch represents the author's *intent*. Main represents what was merged after the PR was opened. Unless main's change supersedes the PR's change (e.g. main fixed a bug the PR also fixes), keep the PR branch's version.

## Reading conflict markers

```
<<<<<<< HEAD          ← main (what origin/main says)
    runs-on: ${{ fromJSON(vars.RUNNER_GENERIC || '"ubuntu-latest"') }}
=======               ← divider
    runs-on: ubuntu-latest
>>>>>>> abc1234 (fix(ci): pin deploy.yml)   ← PR branch commit
```

To keep the PR branch version: delete the `<<<<<<< HEAD` block, the `=======` line, and the `>>>>>>> ...` line. Leave only the PR branch content.

To keep main's version: delete from `=======` to `>>>>>>> ...`. Leave only the HEAD block.

## After resolving — verify the file

Always read the resolved file to confirm no conflict markers remain:

```bash
grep -n "<<<\|===\|>>>" .github/workflows/deploy.yml
# Should return nothing
```

## Known conflict patterns in this repo

### `deploy.yml` — `runs-on` line

Main has RUNNER_GENERIC toggle; a PR to pin back to `ubuntu-latest` conflicts here.

**Resolution:** Keep `ubuntu-latest` (SST + CDK synth does not run on ARM Pi — documented in `docs/runners.md`).

```yaml
    # Pinned to ubuntu-latest. SST + CDK synth + Sentry sourcemap upload
    # do not fit on an ARM Pi runner under cold-deploy conditions.
    runs-on: ubuntu-latest
```

### `AuthContext.tsx` — `checkAuth` function

If a security fix separated `getCurrentUser` and `fetchAuthSession` into sequential calls, but another branch still has `Promise.all`, the rebase will conflict in `checkAuth`.

**Resolution:** Keep the sequential version (the security fix). The `Promise.all` version can lock out admin users on transient network errors.

### `src/lib/cron-auth.ts` — `safeEqual` export

If one PR added `export function safeEqual` and another touched the same file, conflict will be in the function signature.

**Resolution:** Always keep `export` — it's required for callers in `src/app/api/admin/`.

## When `git rebase --continue` opens an editor

Use `GIT_EDITOR=true git rebase --continue` — this makes git use the shell command `true` as the editor, which immediately exits without modification, accepting the existing commit message. Never use `--no-edit` (not a valid flag for `rebase --continue`).

## When a PR has multiple conflicted commits

If there are multiple commits in the PR and several stop with conflicts, resolve each one in sequence. The rebase will pause at each conflicting commit. Apply the same resolution strategy each time.

## After pushing — check the PR

After `git push --force-with-lease`, verify:

1. GitHub shows the branch is now mergeable (no conflict warning).
2. CI re-runs automatically on the new push.
3. The PR diff still shows only the intended changes (no accidental regression from wrong conflict resolution).
