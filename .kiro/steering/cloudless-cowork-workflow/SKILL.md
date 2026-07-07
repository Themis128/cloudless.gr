---
name: cloudless-cowork-workflow
description: Use when working on cloudless.gr from a Cowork session on Windows (path D:\cloudless.gr). Documents the partial-flush bug that corrupts file Edits on this mount and the heredoc + patch-script workflow that works around it. Trigger whenever the user is in a Cowork session and asks to edit, fix, refactor, or otherwise modify existing files in the cloudless.gr repo. Also triggers on "Cowork", "partial flush", ".git/index.lock", or when an Edit/Write operation reports success but `git status` doesn't agree.
---

# Cloudless Cowork Workflow

## The problem this skill exists for

When Cowork runs on Windows and the cloudless.gr repo is mounted from `D:\cloudless.gr`, **the `Edit` tool and the `Write` tool on *existing files* corrupt the tail of the file**. The tool reports success, but on disk:

- the file is truncated mid-token (e.g. ends with `</` or `new Date(l`), OR
- trailing NUL bytes are appended (e.g. 36 `\0` after the last real byte), OR
- the on-disk content is the OLD version while the host view shows the new content.

`tsc --noEmit` then emits a cascade of `TS1127 Invalid character` / `TS17008 JSX element has no corresponding closing tag` at the very last lines of every affected file. They look like real syntax errors. They are not — the source in Claude's host view is fine; only the WSL/git view is broken.

Observed in the 2026-05-22 session — 4 of 4 Edits corrupted, 1 of 1 Write-on-existing corrupted. New-file Writes were 100% reliable.

A second related issue: `.git/index.lock` is held by the Windows side with permissions the sandbox can't override. Once stuck, `git checkout HEAD -- <file>` from inside Cowork returns `fatal: Unable to create '.git/index.lock': File exists` and you can't roll back the corruption from this side.

## Hard rules — do not break these

1. **Never use `Edit` on an existing file under `D:\cloudless.gr` from a Cowork session.** Use the workarounds below.
2. **Never use `Write` to overwrite an existing file.** Same failure mode.
3. **`Write` on a brand-new path is safe** (verified 100%).
4. **`cat > file <<'EOF' ... EOF` via `mcp__workspace__bash` is safe** for both new and existing files (verified — the preflight script was rewritten this way after Write failed).
5. **`git push`, `git commit`, `git rebase` cannot run reliably from the sandbox.** Defer them to Themis-side execution.
6. **`pwsh` is not installed in the sandbox.** Don't try to invoke PowerShell from `mcp__workspace__bash`.

## The three safe ways to modify files

In order of preference:

### A) New file: use `Write` directly

```
Write file_path="D:\cloudless.gr\src\lib\new-thing.ts" content="..."
```

100% reliable when the path doesn't yet exist. Use for new lib modules, new API routes, new scripts.

### B) Existing file: emit a patch script

Compose the edit as a unified diff in Claude's context. Write the diff into a PowerShell script at `D:\cloudless.gr\scripts\fix-task-NN-<short-name>.ps1`. The script must:

1. Remove any stale `.git/index.lock`.
2. `git checkout HEAD -- <file>` to heal any prior Cowork corruption on that file.
3. Pipe a heredoc into `git apply --whitespace=nowarn`.
4. Run `pnpm typecheck` to confirm.
5. Show the resulting `git diff` for review.

Tell the user to run the script from a Windows PowerShell prompt in `D:\cloudless.gr`. See `scripts/fix-task-25-sitemap-dynamic.ps1` for a worked example.

### C) Small in-session fix: bash heredoc through `mcp__workspace__bash`

```bash
cat > path/to/file.ext <<'END_OF_FILE'
...full new content...
END_OF_FILE
```

Verified reliable on this mount, including for overwriting existing files. Use when you need the change to land now (e.g. fixing an in-session helper script), not later when Themis runs PowerShell.

**Caveat:** this writes the WHOLE file. Don't use it for surgical line-level edits on large source files — you'd need to keep the entire file content in context. Best for short files (< 200 lines) or fresh rewrites.

## Detection — how to know corruption happened

Run after any file-touching operation:

```bash
# 1. git is the source of truth
git status -s

# 2. trailing-byte check
tail -c 10 path/to/file | od -c
# Healthy: ends with `} \n` or `\n`.
# Corrupt: ends with `\0 \0 ...` or mid-token (`< /`, `( l`, etc.).

# 3. null-byte count
tr -dc '\0' < path/to/file | wc -c
# Should be 0 for source files.

# 4. compare to HEAD
diff <(cat path/to/file) <(git show HEAD:path/to/file) | head
```

The included `scripts/cowork-preflight.sh` runs all four checks against the working tree and exits non-zero if anything looks corrupt.

## What works in Cowork without workarounds

| Operation | Safe? | Notes |
|---|---|---|
| `Read` existing file | ✅ | Host view is accurate. |
| `Write` brand-new file | ✅ | 100% success. |
| `Write` overwrite existing file | ❌ | Same partial-flush bug as Edit. |
| `Edit` existing file | ❌ | Corrupts tail. Use patch script. |
| `cat > file <<EOF` via bash | ✅ | Works for new AND existing files. |
| `mcp__workspace__bash` reads | ✅ | WSL view is canonical. |
| `mcp__workspace__bash` writes via redirects | ✅ | Verified reliable. |
| `git commit` | ❌ | `.git/index.lock` perm-denied. |
| `git push` | ❌ | No credentials in sandbox. |
| `pnpm typecheck` | ⚠️ | Project too big for 45 s sandbox bash timeout; narrow tsconfig works. |
| Notion MCP writes | ✅ | KB updates, DB creation. |
| `cloudless-infra` MCP | ✅ | Use freely for CI/cluster diagnostics. |

## Themis-side runbook

After Cowork emits a patch script, Themis runs from PowerShell in `D:\cloudless.gr`:

```powershell
# Heal + apply the patch from this session
pwsh -File scripts\fix-task-<NN>-<short-name>.ps1

# Ship anything Cowork composed but couldn't commit
pwsh -File scripts\rebase-and-ship-esp32-pr.ps1
```

## Recovery — when corruption is found

1. From the sandbox: do NOT try to heal. The lock will block it.
2. From Windows: `Remove-Item .git\index.lock -Force` then `git checkout HEAD -- <file>`.
3. Run the patch script from this session instead of re-attempting the Edit/Write.

## Why this skill exists (the meta-question)

Proper fix is either:

- a Windows-side daemon that exposes `git`, `pwsh`, and a credentialed pusher to the sandbox over an authenticated local socket, OR
- moving the Cowork session to work inside WSL on `\\wsl.localhost\Ubuntu\home\$USER\cloudless.gr` instead of `D:\cloudless.gr` (the WSL filesystem doesn't have the interop coherence issue).

Neither is built. Until one of them is, this skill is the operating procedure.

## Related Notion pages

- 📘 [KB — Cowork on Windows mounts: partial-flush file corruption](https://www.notion.so/3687d82c410a8114931bed213e486474)
- 🛠️ [2026-05-22 — Session log](https://www.notion.so/3687d82c410a8172866ce06bf3ee1e0f)
- 📘 [ESP32 ↔ Notion KB](https://www.notion.so/3687d82c410a8126b728f0c31d36c14f)
