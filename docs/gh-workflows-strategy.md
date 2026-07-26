# GitHub Actions efficiency & speed strategy

**Last reviewed:** 2026-06-22 · **Author:** Claude (working with @tbaltzakis)

This document captures the strategy for keeping the 115-workflow CI/CD
catalogue **fast, cheap, and maintainable** as the repo grows. It pairs
with:

- `.github/workflows/README.md` — the catalogue index.
- Memory `feedback_organize_gh_workflows` — the curation rule.
- Memory `feedback_workflow_must_pass` — the failure-handling rule.
- Memory `project_gh_workflows_speedup_strategy` — the index pointer
  to **this** document (read it first when planning a speedup PR).
- `skills/gh-actions-pitfalls/SKILL.md` — the 8-CI-gotcha catalogue.

## Current baseline (2026-06-22)

| Metric | Value | Source |
|--------|-------|--------|
| Total active workflows | 115 | `ls .github/workflows/*.yml \| wc -l` |
| Use `pnpm install` | 31 | `grep -l "pnpm install" .github/workflows/*.yml \| wc -l` |
| Use `cache: pnpm` (setup-node) | 27 | already-good baseline |
| Build Next.js (`pnpm build` / `next build`) | 4 (ci, bundle-budget, bundle-size-pr, deploy) | post-PR-#1104 all 4 cache `.next/cache` ✅ |
| Use `concurrency: cancel-in-progress: true` | 29 / 115 | room to grow |
| Scheduled (cron) | 43 | many overlap — see "Consolidation candidates" |
| Self-hosted runner targets | ~8 (pi-build, omv-build) | for ARM64 + cluster-local work |

### Slowest workflows (last 100 main runs, succeeded)

| Workflow | Median duration | Why |
|----------|----------------|-----|
| `release.yml` | ~27 min | Semantic-release + build + publish; single sequential job |
| `cloudless.gr HTTPS health probe` | ~11s | tiny — no work to do |
| `tls-cert-parity-probe.yml` | ~9s | tiny |
| `selfhosted-healthchecks.yml` | ~5 min (when healthy) | 6 matrix jobs; each pings once. Failed runs hang on retry. |

`build pi image` and `deploy.yml` are not in the "succeeded" list above
because they have variable durations (5–25 min depending on cache state
and ECR availability). `deploy.yml` is the most-changed and most-watched.

## Optimization patterns (ranked by ROI)

### 1. Next.js build cache (`.next/cache`) — ✅ FULLY APPLIED

After PR #1104, all 4 workflows that build Next.js restore
`.next/cache`. Pattern (from `deploy.yml`):

```yaml
- name: Restore Next.js build cache
  uses: actions/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae # v5.0.5
  with:
    path: .next/cache
    key: nextjs-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-${{ hashFiles('src/**') }}
    restore-keys: |
      nextjs-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-
      nextjs-${{ runner.os }}-
```

**Savings:** cold ~3-4 min → warm <1 min on cache hit. Vercel measured
their internal monorepo at 45s → 12s.

**When to apply to a new workflow:** any time a job runs
`pnpm build` / `next build`. Paste the block before the install step.

### 2. pnpm store cache (via setup-node) — ✅ MOSTLY APPLIED (27/31)

`actions/setup-node@v6` with `cache: pnpm` is wired into 27 of the 31
pnpm workflows. The other 4 either don't need it (one-shot diagnostic
runs) or pre-date the convention. **No active work needed** — just
copy the pattern into new workflows by default.

```yaml
- uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4
- uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0
  with:
    node-version: 22
    cache: pnpm
- run: pnpm install --frozen-lockfile --prefer-offline
```

### 3. Path filters — ✅ ALREADY GOOD, MINOR GAPS

The grep "no `paths:`" I ran initially overcounted — many filterless
workflows are `on.schedule:` or `on.pull_request:` only (no push at
all). Real gaps after re-audit: just 3 workflows have a `push.branches`
trigger without `paths:` AND would benefit from one:

- `release.yml` — fine as-is, release intentionally runs on every push.
- `secret-scan.yml` — fine, must scan every push.
- `teardown-staging.yml` — could narrow to `e2e/**` + `playwright.config.mts`.

**Verdict:** not enough leverage to ship as a PR. Pattern for future
workflows:

```yaml
on:
  push:
    branches: [main]
    paths:
      - "src/**"
      - "package.json"
      - "pnpm-lock.yaml"
      - ".github/workflows/<this-workflow>.yml"
```

The `.github/workflows/<self>.yml` line is important: it lets you
re-trigger by re-saving the workflow (used for `workflow_dispatch`
fallback when the GH API is unreachable).

### 4. `concurrency` groups — 29 / 115 covered

Most deploy/sync workflows already have:

```yaml
concurrency:
  group: <workflow-name>-${{ github.ref }}
  cancel-in-progress: true
```

**Gap:** ~50 PR-triggered workflows (audits, lighthouse, e2e, security
scans) don't. Adding `concurrency` to them cancels stale runs when the
PR gets a new push — saves runner minutes for free.

**Don't add `cancel-in-progress: true` to:**

- Deploy chains where mid-flight cancellation leaves partial state
  (e.g. `deploy.yml` — uses `cancel-in-progress: true` but the SST
  deploy is atomic).
- ETLs that write to a transactional sink and would corrupt on
  cancel (none here today — all ETLs idempotent-overwrite Parquet).

**Mass-add plan (not yet shipped):** sweep all `on.pull_request:`
workflows lacking `concurrency:`, add the standard block via a
mechanical PR (~50 files, no behavior change).

### 5. Docker buildx GHA cache for `build-pi-image.yml`

**Current state:** uses `cache-from: type=local,src=/opt/docker-cache`
plus `cache-to: type=local,dest=...,mode=max`. The runner is
`ubuntu-latest` (GH-hosted), so `/opt/docker-cache` is **ephemeral** —
gone after every run. The local-cache lines are effectively no-ops.

**Fix:**

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

GHA cache backend persists across runs (uses `ACTIONS_CACHE_URL`).
Expected savings on a typical Next.js Pi build: ~25 min → ~10-12 min
on warm cache.

**Why not shipped in PR #1104:** the workflow has dense pre-existing
caching logic + a SHA-short-circuit + a complex buildx config. Wants
its own focused PR with a test-on-branch first. Tracked in master
TODO.

### 6. Reusable composite action `setup-repo` — LOW ROI today

Originally floated as "extract 31 callers into one action". After
auditing: only 4 actually build Next.js, the other 27 do varied work
(lint, typecheck, test, audit). A composite covering "checkout, pnpm,
node, install" would save ~10 lines × 27 callers, but speed-wise
it's a wash (cache behavior identical).

**Verdict:** skip until the count crosses ~50 callers OR we want to
centralize the cache-key strategy. The DRY win isn't worth the
churn-on-31-files today.

### 7. ETL orchestrator (merge 10 → 1)

10 ETL workflows currently each: trigger their own cron, install
`scripts/etl/`'s npm deps, OIDC auth to AWS, run one mjs script,
ping Slack on failure. They share ~70% of the YAML.

**Proposal:**

```yaml
name: ETL — orchestrator
on:
  schedule:
    - cron: "30 6 * * *"
  workflow_dispatch:
    inputs:
      only:
        description: "Comma-separated ETL names (default: all)"
        required: false

jobs:
  etl:
    strategy:
      fail-fast: false
      matrix:
        etl: [aws-cost, espocrm, stripe, sentry, gsc, linkedin, clients, selfhosted, rfm, compute-rfm-churn]
    steps:
      - uses: actions/checkout@v6
      - uses: aws-actions/configure-aws-credentials@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22
      - run: npm ci
        working-directory: scripts/etl
      - run: node scripts/etl/${{ matrix.etl }}-to-lake.mjs
```

**Tradeoffs:**

- ✅ One file to maintain, one Slack alert path, one OIDC token mint.
- ✅ Matrix parallelism — all 10 ETLs run concurrently.
- ❌ Loses per-ETL `paths:` filter (a code change to one ETL re-triggers
  all). Mitigated by `paths: scripts/etl/**` + matrix `if:` gates.
- ❌ One ETL failure no longer surfaces as its own workflow status —
  needs convention "click the failing matrix leg".

**Verdict:** worth it. Plan as a dedicated PR ("R-row" item) with a
2-week parallel-run period before deleting the old workflows.

### 8. Self-hosted runner expansion

Currently `pi-build` / `omv-build` carry Docker + ARM64 work that GH
runners would do under QEMU emulation. Each Pi runner is effectively
4 vCPU + 8GB RAM. Lessons learned (memory `project_gh_runners`):

- ARM64 native runner ≈ 8-15× faster than QEMU emulation on ubuntu-latest.
- Pi disk pressure incidents (memory `project_pi_disk_layout`) require
  the daily `cloudless-cleanup.timer` — already deployed.
- `RUNNER_GENERIC` repo var enables instant fallover from Pi → GH-hosted
  for non-cluster workflows when Pi is degraded.

**Don't ship more workflows to Pi runners until** disk pressure
trending is established (look at `pi-disk-cleanup.yml` output weekly).

## Consolidation candidates

After the round-1 and round-2 cleanup sweeps (PR #1101, #1102),
115 active workflows. Remaining candidate consolidations (each is its
own future PR):

| Idea | Files affected | ROI |
|------|---------------|-----|
| ETL orchestrator (pattern 7) | 10 ETL files → 1 | High — saves 9 cron schedules + 9 OIDC mints/day |
| Audit aggregator already exists (`audits-aggregator.yml`) | n/a | Already done |
| Healthcheck matrix consolidation | Already done (1 file, 6 matrix legs) | n/a |
| Probe consolidation | 12 probes share <30% YAML | LOW — they probe different things with different cadences |

## Failure-handling integration

Every probe / audit / healthcheck posts to `/api/webhooks/admin-alert`
on failure (R8 path). Don't introduce new bespoke alert paths — the
admin-alert webhook fans to Slack + ntfy + Sentry. See
`feedback_admin_must_track_backend` memory and PR #1082.

## Measurement

Quarterly sweep — run this from the Pi or any session:

```bash
# Workflows that haven't run in 90+ days (archival candidates).
gh run list --limit 200 --json workflowName,createdAt | \
  jq -r '.[] | select(.createdAt < "'$(date -u -d "90 days ago" +%Y-%m-%d)'") | .workflowName' | \
  sort -u

# Median duration of top 20 most-run workflows.
gh run list --limit 500 --json workflowName,createdAt,updatedAt,conclusion | \
  jq -r '.[] | select(.conclusion=="success") | "\(.workflowName)\t\((.updatedAt|fromdateiso8601) - (.createdAt|fromdateiso8601))"' | \
  sort | awk -F'\t' '{a[$1]+=$2; n[$1]++} END {for (k in a) printf "%-50s %4d runs  avg %5ds\n", k, n[k], a[k]/n[k]}' | \
  sort -k4 -nr | head -20
```

Track in this doc on each quarterly sweep: baseline → after-changes,
so we can see what the optimizations actually delivered (not what we
hoped they'd deliver).

## Roadmap (prioritized)

1. **Buildx GHA cache for `build-pi-image.yml`** (pattern 5) — expected
   ~15 min savings per build, runs ~10×/day. Highest single-PR ROI.
2. **Concurrency block sweep** (pattern 4) — mechanical, low-risk,
   ~50 files. Saves runner minutes on busy PR days.
3. **ETL orchestrator** (pattern 7) — biggest structural win but most
   surgery. Pair with `feedback_workflow_must_pass` setup so the matrix
   leg failure surfaces.
4. **Workflow age sweep** — at the next quarterly check, archive any
   that hasn't run in 90+ days.

When shipping any of these, update this doc's "Roadmap" section and
the workflows README catalogue index in the same PR.

## See also

- `.github/workflows/README.md` — catalogue index (115 active).
- `docs/runners.md` — `RUNNER_GENERIC` fallover pattern.
- Memory `project_pi_disk_layout` — why self-hosted runners are
  capacity-sensitive.
- [pnpm CI guide](https://pnpm.io/continuous-integration)
- [actions/cache @ v5](https://github.com/actions/cache)
- [docker/build-push-action cache backends](https://docs.docker.com/build/cache/backends/gha/)
- [GH Actions monorepo guide 2026](https://dev.to/pockit_tools/github-actions-in-2026-the-complete-guide-to-monorepo-cicd-and-self-hosted-runners-1jop)
