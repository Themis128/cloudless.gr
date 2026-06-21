---
name: gh-actions-pitfalls
description: |
  Common GitHub Actions pitfalls that have bitten cloudless.gr and how to
  avoid them. Triggered by phrases like "GH Actions matrix", "workflow
  failing", "matrix.var", "secrets[matrix...]", "expression context",
  "pnpm action-setup", "self-hosted runner stuck", "saturated runner",
  "GH Actions bash", "ERR_PNPM_BAD_PM_VERSION", "Multiple versions of
  pnpm specified", "bad substitution", "ParserError", "RUNNER_GENERIC",
  "deferred deploy", or any new-workflow review.
---

# GitHub Actions pitfalls (cloudless.gr edition)

A flat list of the issues we've actually hit in this repo, with the
canonical fix for each. Read this when authoring a new workflow OR when
a freshly-merged workflow fails on first run.

## 1. matrix.* only works in YAML expression context, NOT in bash

```yaml
# ❌ BROKEN — ${matrix.secret_var} is a bash bad-substitution
- run: |
    if [ -z "$HC_URL" ]; then
      echo "::warning::${matrix.secret_var} not set"   # bash sees ${...} → bad substitution
      exit 0
    fi
```

```yaml
# ✅ CORRECT — pipe the matrix value through env: so bash sees it as a plain string
- env:
    SECRET_NAME: ${{ matrix.secret_var }}
    HC_URL: ${{ secrets[matrix.secret_var] }}
  run: |
    if [ -z "$HC_URL" ]; then
      echo "::warning::Repo secret $SECRET_NAME not set"
      exit 0
    fi
```

The `${{ }}` interpolation runs in GitHub's YAML expression engine BEFORE
bash sees anything. `${matrix.foo}` inside a `run:` block is just bash
syntax that bash doesn't recognize — exit 1, opaque failure.

Surfaced 2026-06-21 in `selfhosted-healthchecks.yml` (PR #1058 → #1059).

## 2. pnpm/action-setup@v4 errors on conflicting versions

```yaml
# ❌ BROKEN — pnpm/action-setup@v4 errors when version is passed AND
#    package.json has a `packageManager` field
- uses: pnpm/action-setup@v4
  with: { version: 10 }
```

```yaml
# ✅ CORRECT — let the action read the version from packageManager
- uses: pnpm/action-setup@v4
```

Error message:
`Multiple versions of pnpm specified: version 10 in the GitHub Action
config with the key "version" / version pnpm@10.33.2+... in the
package.json with the key "packageManager"`.

Surfaced 2026-06-21 in `etl-selfhosted-to-lake.yml` (PR #1056).

## 3. Self-hosted Pi runners are scarce — workflows queue serially

The repo's `RUNNER_GENERIC` variable resolves to
`[self-hosted, omv, build]` — there are only 2 Pi runners (`omv` +
`omv-build`). A typical PR merge triggers Lighthouse + CWV + HA-sync +
build-pi-image simultaneously; new workflow-dispatch runs queue behind
those 12-15 min builds.

If a workflow_dispatch run sits queued for 5+ minutes, that's normal,
not broken. Check:

```bash
gh api /repos/Themis128/cloudless.gr/actions/runners \
  | python3 -c 'import sys,json;[print(x["name"], "busy="+str(x["busy"])) for x in json.load(sys.stdin)["runners"]]'
```

To override one-off runs to GH-hosted: flip the repo variable
`RUNNER_GENERIC` to `"ubuntu-latest"` via
`.github/scripts/toggle-runner.sh hosted` per the CLAUDE.md "CI Runner
Failover" section.

## 4. PowerShell wraps `wsl.exe -- bash -lc 'single quoted'` and chokes on `${{ }}`, `(`, `)`

When triggering bash via `wsl.exe -d ubuntu-24.04 -- bash -lc '…'` from
PowerShell, single quotes around expression-containing strings (notably
`${{ secrets... }}`, `( )`, `*` outside of patterns) cause PowerShell
parser errors before WSL even runs.

```powershell
# ❌ BROKEN — PowerShell parses ${{ }} as variable subexpression
wsl.exe -d ubuntu-24.04 -- bash -lc 'gh pr create --body "secrets in YAML: ${{ secrets.X }}"'

# ✅ CORRECT — use double quotes outside, escape inside, OR move complex strings to a heredoc / script file
wsl.exe -d ubuntu-24.04 -- bash -lc "gh pr create --body 'plain text without dollar-brace-brace'"
```

When the body needs `${{`, write it to a tempfile first then `gh pr
create --body-file /tmp/body.md`.

## 5. kube-cleanup-operator deletes one-off pods before you read logs

The `kube-cleanup-operator` namespace runs an auto-delete for completed
pods (configurable, default ~60 s). One-off pods (debug, ad-hoc
verification, ETL bootstrap) often exit before you see the logs.

```yaml
# ✅ Annotate one-off pods to opt out
metadata:
  annotations:
    kube-cleanup-operator.io/ignore: "true"
```

Surfaced 2026-06-21 with the SSM-bootstrap pods.

## 6. ResourceQuota limits per-namespace service count — manifests fail with "exceeded quota"

`kubectl apply -f manifest-with-Service.yaml` returns
`services is forbidden: exceeded quota: ns-quota, requested: services=1,
used: services=15, limited: services=15`.

Fix: bump the quota (in-cluster `kubectl patch resourcequota ns-quota -n
<ns> --type=merge -p '{"spec":{"hard":{"services":"25"}}}'`) AND commit
the manifest update so the limit is in source control.

Surfaced 2026-06-21 in `monitoring` ns deploying blackbox-exporter
(PR #1058).

## 7. ssm-config.ts is huge — easy to double-declare keys

When adding new SSM keys to `src/lib/ssm-config.ts`, ALWAYS grep first:

```bash
grep -n NEWKEY src/lib/ssm-config.ts
```

If the key already exists at another line, your additions become
TypeScript "Duplicate identifier" errors that take down the next build.

Same applies to `src/lib/integrations.ts`. The file has 3 places per key
(interface, sync `getIntegrations`, async `getIntegrationsAsync`) so the
grep should return either 0 results (new key, safe to add) or 3 results
(already there, don't duplicate).

Surfaced 2026-06-21 in PR #1054 (operator hotfixed in `ssm1`).

## 8. Deferred deploy: trigger workflow re-run after merge

If the post-merge `Deploy to Production` workflow fails for a transient
reason (image push race, runner saturation), the change isn't deployed
until the NEXT push to `main`. Manually re-run via:

```bash
gh run rerun <run-id> --failed
```

Or trigger a no-op commit if `rerun` won't pick up the right ref.

## See also

- `skills/cluster-bash/SKILL.md`
- `CLAUDE.md` § "CI Runner Failover" — `RUNNER_GENERIC` mechanics
- `CLAUDE.md` § "Git Workflow" — commit cadence
- Memory: `feedback-git-push-then-merge`, `feedback-use-in-repo-skills`
