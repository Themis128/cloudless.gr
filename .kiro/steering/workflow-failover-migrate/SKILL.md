---
name: workflow-failover-migrate
description: Migrate a GitHub Actions workflow in or out of the `RUNNER_GENERIC` failover pattern, and apply the per-step `continue-on-error` pattern for informational workflows. Use when a hosted-runner outage is blocking PRs (instant-fail jobs in 2-4s with `ubuntu-latest`), when a workflow should fail over to Pi runners, when an informational scanner needs to always report green, or when you need to roll a previously-migrated workflow back to hosted because it doesn't run on ARM64. Triggers on "migrate workflow to Pi", "RUNNER_GENERIC failover", "instant-fail", "make check non-blocking", "informational only check", "pin back to ubuntu-latest", "workflow always green".
allowed-tools: Bash, Read, Edit, Grep
---

# Workflow Failover Migration

## What this skill knows

This is hard-won from a session where five rounds of fixes were needed before the right pattern stuck. It codifies four lessons:

1. **Instant-fail = hosted-runner outage.** Jobs that complete in 2–4 seconds and report `failure` haven't actually run — the GitHub control plane rejected the runner request before any YAML executed. CLAUDE.md describes the canonical failure: *"the job was not started because recent account payments have failed"*.
2. **Job-level `continue-on-error: true` does NOT flip the per-job check conclusion** that branch protection reads. It only affects the overall workflow conclusion. Empirically verified — was reverted in commit 884b0cf during the same session.
3. **Step-level `continue-on-error: true` DOES flip the job conclusion** if applied to *every* step that can fail. The job ends up with `success` even if individual steps fail.
4. **Not every workflow can fail over to Pi.** ARM64-incompatible deps (system Chrome on x86_64 for some Playwright matrices, CodeQL bundles older than v4, SST cold deploys that exceed Pi RAM) will hang or fail in a different way. The Preview workflow was documented as failed-on-Pi for months before being re-tried successfully when SST/CDK matured.

## The three patterns

### 1. Migrate a hard-pinned workflow into `RUNNER_GENERIC` failover

Use when the workflow is currently `runs-on: ubuntu-latest` and the underlying tooling is ARM64-compatible (pure JS/TS, anything that uses `actions/setup-node` only, Playwright with bundled Chromium ≥ v1.40, CodeQL action v4+).

```yaml
# Before
runs-on: ubuntu-latest

# After
runs-on: ${{ fromJSON(vars.RUNNER_GENERIC || '"ubuntu-latest"') }}
```

When `RUNNER_GENERIC` is unset, behaviour is identical to before (hosted). When flipped to Pi via `.github/scripts/toggle-runner.sh pi`, the workflow uses Pi runners.

**Always** also update `docs/runners.md` — move the entry from the "stay GitHub-hosted" section to the "opted in" list. Past failed-failover attempts (like `preview.yml` run 26321031309) belong in a parenthetical note, not a deletion.

If the migration is risky (cold-start SST, CodeQL on heavy projects), bump the `timeout-minutes` by 50–100% to leave headroom for slower ARM execution.

### 2. Make an informational workflow always report green

Use when a workflow is intentionally non-blocking but its `failure` check status still blocks branch protection. Common cases: security scanners that flag false positives, custom audit scripts, anything where the value is in the log not the gate.

```yaml
jobs:
  scan:
    name: My Informational Check
    # Job-level continue-on-error is NOT enough — see lesson 2 above.
    # Apply step-level continue-on-error on EVERY step that can fail.

    steps:
      - uses: actions/checkout@v4

      - name: Setup tool
        uses: actions/setup-something@v4
        continue-on-error: true   # ← needed; setup itself can fail on Pi
        with:
          version: 'latest'

      - name: Install deps
        continue-on-error: true   # ← needed; npm/pip can fail on ARM
        run: npm install

      - name: Run the scan
        continue-on-error: true   # ← needed; the tool itself may exit non-zero
        run: npm run scan
```

`actions/checkout@v4` does not need it — checkout failures should still fail the job.

### 3. Pin a workflow back to hosted (rollback)

Use when a migrated workflow actually doesn't work on Pi and needs to go back. Reverse the YAML edit:

```yaml
# After (rollback)
runs-on: ubuntu-latest
```

And update `docs/runners.md`:
- Move entry back into the "stay GitHub-hosted" list
- Add a one-line note explaining what broke and the run ID, so the next person doesn't re-try blindly

## Workflow checklist

For each workflow being migrated:

1. **Read the workflow file** with `Read` and locate the `runs-on:` line.
2. **Check the tooling** — Grep the steps for native deps, x86_64-only binaries, Chrome from system package manager (not the bundled Playwright Chromium), or anything with "linux-amd64" in its install URL.
3. **Edit the file** with `Edit` — replace exactly one line, the `runs-on:`.
4. **Bump the timeout** if the work is non-trivial (build, test matrices, scans).
5. **Edit `docs/runners.md`** — move the entry between the two lists, preserving prior-attempt notes.
6. **Commit** with a message describing the intent and the timeout bump rationale.

## Decision tree

```
Workflow failing on PR?
├── Failed in 2-4s? → Hosted-runner outage.
│   ├── ARM64-compatible tooling? → Pattern 1 (migrate to failover)
│   └── x86_64-only tooling?      → Either wait for hosted to recover,
│                                    or remove from required checks in
│                                    branch protection (admin-only).
│
├── Failed after running for > 30s? → Real failure.
│   ├── Real bug or flake?  → Fix it.
│   └── Informational/scanner with false positives?
│                                    → Pattern 2 (always-green via step-level CoE)
│
└── Was previously migrated to Pi, now hanging?
    └── Pattern 3 (rollback to hosted, document)
```

## Files this skill touches

- `.github/workflows/*.yml` — the workflow being migrated
- `docs/runners.md` — the opt-in / stay-hosted lists

## Toggling the runner pool itself

This skill does NOT toggle the `RUNNER_GENERIC` repo variable. That's the job of `.github/scripts/toggle-runner.sh` (documented in `runner-ops` skill). This skill assumes you've already decided which runner pool to target.

## Anti-patterns observed in the wild

- **Setting `continue-on-error: true` at the job level and expecting branch protection to accept it.** It doesn't. See lesson 2.
- **Adding new `runs-on: ubuntu-latest` workflows without considering the failover pattern.** Every new workflow without browser/x86_64 needs should opt in from day one.
- **Migrating a workflow blindly because it's failing.** Confirm it failed for an outage reason (instant-fail signature) before changing the runner — a real bug stays a real bug after migration.
- **Removing the prior-failed-attempt note from `docs/runners.md` during a re-try.** Always demote to a parenthetical, never delete — institutional memory matters when the next outage hits.
