# Reference — Cowork on Windows: what we know

## Timeline of the discovery

Session: 2026-05-22, branch `fix/malformed-mcp-json`.

| Edit | File | Symptom on disk |
|---|---|---|
| Switch `import Link from "next/link"` → `@/i18n/navigation` | 10 admin pages | Tail truncated mid-`</...>` tag. Files ended with `< /` instead of `};\n`. |
| Merge two `@/i18n/navigation` imports | `src/app/[locale]/admin/AdminLayoutClient.tsx` | 36 trailing NUL bytes appended. `git diff` showed the merge correctly but tsc parsed the NULs as invalid characters. |
| Add `export const dynamic = "force-dynamic"` | `src/app/sitemap.ts` | Truncated from 117 lines to 112, last line `new Date(l` mid-token. |

Each Edit returned a success message. Each file looked correct via `Read`. `git diff` accurately reflected the corruption. `pnpm typecheck` cascaded into `TS1127 Invalid character` and `TS17008 JSX element has no corresponding closing tag` at the very last lines.

## What works and what doesn't (summary table)

See SKILL.md table. Short version:

- `Write` new files: always safe.
- `Edit` existing files: 0% success rate, ~100% corruption.
- `git checkout HEAD -- <file>` from sandbox: blocked by `.git/index.lock` perm-denied.

## Why this happens (hypothesis)

The Cowork sandbox mounts `D:\cloudless.gr` over a Windows ↔ WSL2 bridge. The `Edit` tool writes through the host view; the bash tool reads the WSL view. When a write hasn't fully fsync'd, the WSL side sees:

- the new prefix + a tail of NULs from the longer previous version, OR
- the file truncated to whatever was flushed.

The `git checkout` blocker is a separate issue: `.git/index.lock` is created by Windows-side processes with permissions the WSL UID can't override. Once stuck, only Windows can release it.

This is consistent with reports of NTFS ↔ Linux interop write coherence issues, but I have not confirmed it at the kernel level — treat the hypothesis as load-bearing, not gospel.

## Proper fixes (out of scope for this session)

Two ways out, in order of effort:

### Move the repo into the WSL filesystem

```powershell
# From Windows
wsl --cd ~ git clone https://github.com/Themis128/cloudless.gr.git
# Then point Cowork at \\wsl.localhost\Ubuntu\home\$USER\cloudless.gr
```

The WSL filesystem doesn't have the interop write-coherence problem. Cost: you lose direct Windows-side access via `D:\cloudless.gr`. You can still get there via `\\wsl.localhost\Ubuntu\...`.

### Windows-side bridge daemon

A small service running on Windows that exposes a few endpoints to the sandbox:

- `POST /git/checkout` — run `git checkout HEAD -- <file>`
- `POST /git/apply` — run `git apply <patch>`
- `POST /pwsh` — run a PowerShell script with stdout/stderr piped back

Authenticated by a per-session token written to a known sandbox-readable path. This would let Cowork sessions perform every operation it currently can't.

Real engineering: needs auth, request size limits, audit log, command allow-list. Multi-day project. Don't build it in a feature session.

## Quick refs

- The Notion KB page for this issue: <https://www.notion.so/3687d82c410a8114931bed213e486474>
- The session log that documents all four follow-ups: <https://www.notion.so/3687d82c410a8172866ce06bf3ee1e0f>
- Patch-script template: `scripts/patch-script-template.ps1` in this skill
- Pre-flight check: `scripts/cowork-preflight.sh` in this skill
