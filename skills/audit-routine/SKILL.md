---
name: audit-routine
description: |
  Run the full cloudless.gr stack-health audit and publish a one-page
  report. Use when the user asks for a stack audit, a "health check",
  a weekly status, or wants to see what's drifted since the last
  baseline. Pairs with the Monday CI health routine
  (`docs/ci-health-routine.md`) — that routine runs `gh run` checks
  only; this skill runs the full audit surface and is what you reach
  for when you want code + infra + perf in one place.

  Trigger phrases: "audit the stack", "health check", "weekly status",
  "what's drifted", "is the stack healthy", "run the audit".
---

# cloudless.gr stack audit routine

A single, repeatable pass over every audit surface in the repo. The
output is a markdown table the operator can scan in 30 seconds.

## What the audit covers

| Surface | Tool | Failure mode |
|---|---|---|
| Type safety | `pnpm typecheck` | `tsc` errors → broken build |
| Lint hygiene | `pnpm lint` | ESLint errors → CI fail; warnings → drift |
| Dependency vulns | `pnpm audit` | known advisories from the npm DB |
| Outdated deps | `pnpm outdated` | major+minor lag, deprecated packages |
| Lambda env drift | `bash scripts/lambda-env-audit.sh` | required vars missing or stale |
| Live `/` round-trip | `curl -w '%{time_total}'` | regression in TTFB |
| Live `/api/health` | same + version field cross-check | deploy version vs current `main` |
| Live `/sitemap.xml` | same + 1.75 s threshold | ISR cache not engaging |
| Live `/robots.txt` | same | upstream CDN broken |
| Security headers | `curl -sI \| grep` | missing HSTS / CSP / COOP etc. |
| Cluster k3s state | `pnpm cluster:doctor` (from cowork/CI only — kubectl is not in WSL) | pod evictions, OOM, image churn |
| Unit tests | `pnpm test:ci --reporter=dot` | regression in covered paths |

## Running

The pure-code surface (typecheck, lint, audit, outdated, tests, env
audit, live curls, headers) runs from any environment with
`pnpm install --frozen-lockfile` complete. Suggested ordering:

```bash
pnpm typecheck
pnpm lint
pnpm audit --audit-level=moderate
pnpm outdated
bash scripts/lambda-env-audit.sh

# Live surface — measure in 5 sequential warm hits to filter cold-start
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w '%{url_effective} %{time_total}s\n' \
    https://cloudless.gr/ \
    https://cloudless.gr/api/health \
    https://cloudless.gr/sitemap.xml \
    https://cloudless.gr/robots.txt
done

# Security headers smoke
curl -sI https://cloudless.gr/ | \
  grep -iE 'hsts|content-security|x-content-type-options|x-frame-options|cross-origin|permissions-policy'
```

The k3s surface needs the cowork-infra MCP (`cluster_run_command`,
`k3s_get_pods`) or GH Actions. From WSL `kubectl` is intentionally
absent (per `CLAUDE.md`), so this step is silently skipped in a local
audit run.

## Reporting

Produce a single markdown table with one row per surface and
columns: **Check**, **Before** (last baseline), **Now**, **Status**.
For pass/fail use `✅` / `⚠️` / `❌`. The latest baseline lives at
`docs/AUDIT-2026-06-20.md` — extend it (don't replace) so trends are
visible.

When run weekly, save the report as
`docs/audit-routine/YYYY-MM-DD.md` and link from the index. Operator
should be able to skim in 30 seconds and spot anything that turned
yellow or red.

## When to use a deeper tool instead

- A **cluster incident** (k3s pods CrashLoopBackOff, runner stuck) →
  use `cluster-incident-response` skill.
- An **integration is silently broken** (LinkedIn pixel, Postiz,
  Cloudflare token) → use the corresponding `*-doctor` skill
  (`linkedin-insight-doctor`, `postiz-doctor`,
  `cloudflare-token-doctor`).
- A **PR check is red** for SonarCloud → use `sonarcloud-triage`.
- A **performance regression** specific to one route → use the
  Lighthouse plan in `docs/lighthouse-optimization-plan.md`.

This audit-routine skill is the **coarse** layer; the doctors are the
**fine** layer.

## What this skill won't do

- It won't dispatch fixes. It surfaces drift; fixing is a separate
  PR (the docs/AUDIT-2026-06-20.md report has the ranked improvement
  list — that's the action queue).
- It won't run e2e (Playwright) — too slow for a weekly cadence.
  Reserve `pnpm test:e2e` for pre-deploy.
- It won't touch AWS console state (cost analysis, IAM audit). For
  those, see `docs/aws-cost-reduction.md` + `docs/iam.md` and run
  the AWS-side checks manually.

## Integration with the Monday CI routine

`docs/ci-health-routine.md` already runs every Monday 09:00 Athens.
That routine is gh-checks-only. To upgrade it: edit the Anthropic
Cloud routine prompt (ID `trig_01WQ7NdStiHu4Ab3DpBrRuiV`) to add the
commands above. Keep the agent **read-only** — triage is manual.
