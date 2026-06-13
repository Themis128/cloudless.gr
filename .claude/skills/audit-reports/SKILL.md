---
name: audit-reports
description: Trigger, watch, and consume any audit workflow (lighthouse, a11y-live, security-headers, link-health, deps-drift, bundle-budget, core-web-vitals) and the unified audits-aggregator dashboard. Use when the user asks "run the lighthouse audit", "what's the security headers grade", "show the latest a11y violations", "are we drifting on deps", "give me the audit dashboard".
---

# Audit Reports

This skill turns the **audit-report family of GitHub Actions workflows** into a single conversational interface. Each audit emits a JSON+Markdown report bundled as an artifact, plus the `audits-aggregator.yml` workflow rolls them into one `dashboard.json` consumed by `/admin/audits`.

## Workflows in the suite

| Key                | File                              | Triggers                          | Strict on fail | Artifact prefix              |
|--------------------|-----------------------------------|-----------------------------------|----------------|------------------------------|
| `lighthouse`       | `lighthouse.yml`                  | post-deploy, daily 04:00, manual  | tiered         | `lighthouse-report-*`        |
| `a11yLive`         | `a11y-live-audit.yml`             | daily 05:00, manual               | yes            | `a11y-live-report-*`         |
| `securityHeaders`  | `security-headers-audit.yml`      | daily 05:30, manual               | optional       | `security-headers-report-*`  |
| `linkHealth`       | `link-health-audit.yml`           | daily 04:30, manual               | yes            | `links-report-*`             |
| `depsDrift`        | `deps-drift-audit.yml`            | Mondays 06:00, manual             | no             | `deps-drift-report-*`        |
| `bundleBudget`     | `bundle-budget.yml`               | PR + manual                       | yes            | `bundle-report-*`            |
| `coreWebVitals`    | `core-web-vitals-audit.yml`       | scheduled, manual                 | optional       | `cwv-report-*`               |
| `aggregator`       | `audits-aggregator.yml`           | daily 06:00, manual               | n/a            | `audits-dashboard-*`         |

## Quickstart

> "Run the lighthouse audit on the root URL only and report when it lands."

1. Trigger the workflow via the cloudless-infra MCP:
   `mcp__cloudless-infra__gh_workflow_trigger(repo="cloudless.gr", workflow="lighthouse.yml", ref="main")`
2. Watch to completion: `gh_workflow_watch(repo="cloudless.gr", workflow="lighthouse.yml")`.
3. Pull the dashboard once the aggregator next runs (or invoke it explicitly), then report the medians.

> "What's the latest audit dashboard?"

* Read `/admin/audits` in the browser, OR call the API directly: `GET /api/admin/audits/latest` (admin-gated).
* The endpoint downloads the latest `audits-dashboard-*` artifact from the aggregator workflow and returns parsed JSON.

> "Why is the deps-drift critical count up this week?"

* Download the latest `deps-drift-report-*` artifact.
* Inside, `deps-drift.json` has `vulnerabilities.advisories[]` with module + severity + url. Walk the array and report the new critical/high entries that weren't in last week's report.

## Authoring rules

* **Every audit produces a JSON file with a stable shape** the aggregator can parse. See `scripts/audit/aggregate.mjs` for the per-audit `parse()` contract.
* **Every audit emits its key file under `audit-report/`** so the upload step is identical: `actions/upload-artifact` with `name: <audit>-report-${{ github.run_id }}` and `path: audit-report/`.
* **Strictness is enforced in the workflow, never in the script.** Scripts always exit 0 unless they can't read a required input — the YAML decides whether a finding fails the job.

## Common pitfalls

* GitHub Actions artifact zips use `deflate` (compression method 8). The `/api/admin/audits/latest` route includes an inline unzipper because Lambda has no `/usr/bin/unzip`. Don't switch back to shell tools without checking.
* `pnpm outdated --format json` exits 1 when any package is outdated. The deps-drift workflow uses `set +e` while calling it; do the same for any new script reading similar tools.
* CodeQL flags `console.error(...)` with tainted values. Wrap any user-supplied or external value with `JSON.stringify` before logging.

## When the user says…

* "audit my app" → run `audits-aggregator.yml` (manual dispatch) — it triggers the aggregator which pulls every other audit's latest run.
* "lighthouse failed again" → call `gh_workflow_failure_logs` for the failed run; almost always a 1-point miss on the root URL (tiered threshold absorbs this now).
* "a11y is red" → download the live report, open `a11y-live.json`, group violations by `impact` and report the first 10 by route.
* "security grade dropped" → diff the latest `security-headers.json` against the previous artifact's findings array.
