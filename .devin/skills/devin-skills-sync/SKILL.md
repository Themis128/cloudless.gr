# devin-skills-sync — publish roaming Devin skills to cloudless.gr

The live Devin skills live in `%APPDATA%/devin/skills/` — user-level,
NOT versioned. The canonical, shared copies belong in the
`Themis128/cloudless.gr` repo under `.devin/skills/` so every agent
(Devin, Claude, Cursor) and every machine gets them.

## Tool

`scripts/sync-skills-to-repo.py` — one file, stdlib only.

```
S="python C:/Users/tbaltzakis/AppData/Roaming/devin/skills/devin-skills-sync/scripts/sync-skills-to-repo.py"

$S cloudless-mail-ops gmail-local-mcp        # named skills
$S --all-new                              # every roaming skill missing from repo
$S --dry-run ...                          # print plan, change nothing
```

What it does per run:

0. **Lint gate** — runs `ruff check --fix` + `ruff format` on the
   roaming skill dirs using the REPO's `pyproject.toml` config (CI
   lints `.devin/skills/**` with F,E,W,I,UP,B,C4 — roaming dirs have no
   config so default ruff misses most rules). Aborts if unfixable
   findings remain, so a red Python-Lint PR is never pushed.
1. `git fetch origin main` in the WSL repo
   (`//wsl.localhost/Ubuntu-24.04/home/tbaltzakis/cloudless.gr`)
2. `git worktree add` a throwaway worktree on branch
   `devin/skills-sync-<ts>` off `origin/main` — this avoids the dirty
   `pr-2408` checkout AND the stale `D:\cloudless.gr` (~4600 commits
   behind)
3. Copies the skill dirs into `.devin/skills/`, commits with the Devin
   identity, pushes, opens a PR via `gh -R Themis128/cloudless.gr`,
   arms `--squash --auto`, removes the worktree

## Why the worktree dance

- The main WSL checkout sits on `pr-2408` with hundreds of unrelated
  modifications — committing there would sweep up other agents' WIP.
- Windows git over `//wsl.localhost` UNC reports every file as
  mode-changed (100755→100644); the script only stages the new skill
  dirs so the noise never enters a commit.
- `gh` can't run inside the worktree (dubious-ownership on the gitdir)
  — the script calls `gh -R Themis128/cloudless.gr` from a neutral cwd.

## Gotchas

- Git identity isn't configured for `OFFICE\tbaltzakis` — the script
  passes `-c user.name/-c user.email` per command (repo rule: never
  update git config).
- `git -c safe.directory=<path>` is required for every UNC-path git
  call; the script bakes it in.
- After a sync PR merges, the roaming copy and repo copy are identical
  — edit the ROAMING copy for live use, then re-run the sync to publish.
- First run of a skill that references `%APPDATA%` paths is fine — the
  SKILL.md docs describe the OFFICE deployment; adjust paths if the
  skill ever runs elsewhere.

## Related

- `cloudless-mail-ops` / `cloudless-mail-mcp` / `gmail-local-mcp` /
  `docker-mcp-gateway` — the skills synced by PR #2413 (this tool
  generalizes that flow).
