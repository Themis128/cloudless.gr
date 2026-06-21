# `.github/workflows/` — catalogue index

124 workflow files as of 2026-06-21. Curated by category per
`feedback_organize_gh_workflows` memory. Every new workflow MUST follow
the naming taxonomy here + carry the comment/timeout/concurrency/alert
conventions listed in that memory.

Conventions in use today (consolidated retroactively):

- **Top comment** at file head describing purpose + trigger + paging.
- **`timeout-minutes:`** on every job (5 probes / 15 deploys / 30 ETLs).
- **`concurrency:` group** for any workflow that races against itself.
- **Failure path**: probes/audits/healthchecks POST to
  `/api/webhooks/admin-alert` (R8 path) → fans to Slack + ntfy.
- **OIDC** for any workflow that touches AWS — never long-lived AKID.

## 🚀 Deploy (8)

| File | Purpose | Trigger |
|------|---------|---------|
| `deploy.yml` | Lambda + CloudFront via SST | push to main |
| `deploy-pi.yml` | ECR build + k3s rollout for Pi half | push to main |
| `deploy-pi-proxy.yml` | IPv6 Lambda proxy for the Pi backup path | manual |
| `deploy-alert-api.yml` | Pi alert-api Lambda (R8 publisher) | push to its path |
| `deploy-infrastructure.yml` | Terraform infra apply | manual |
| `deploy-infrastructure-workaround.yml` | Bypass when Terraform CLI breaks | manual |
| `build-pi-image.yml` | Standalone Pi ARM64 image build | manual / workflow_call |
| `rollout-pi-force.yml` | Emergency force-rollout (skip checks) | manual |

## 📥 ETL (10) — daily lake feeders

| File | Source | S3 prefix |
|------|--------|-----------|
| `etl-aws-cost-to-lake.yml` | AWS Cost Explorer | `lake/aws-cost/` |
| `etl-espocrm-to-lake.yml` | EspoCRM CRM | `lake/espocrm/` |
| `etl-stripe-to-lake.yml` | Stripe orders/subs | `lake/stripe/` |
| `etl-sentry-to-lake.yml` | Sentry issues | `lake/sentry-issues/` |
| `etl-gsc-to-lake.yml` | Google Search Console | `lake/gsc/` |
| `etl-linkedin-ads-to-lake.yml` | LinkedIn Ads | `lake/linkedin/` |
| `etl-clients-to-lake.yml` | Client portals | `lake/clients/` |
| `etl-selfhosted-to-lake.yml` | AppFlowy + Postiz + n8n | `lake/{appflowy,postiz,n8n}/` |
| `etl-compute-rfm-churn.yml` | Computes RFM segments | `lake/rfm/` |
| `analytics-etl.yml` | Umbrella runner (legacy) | mixed — review for archival |

## 🔍 Probe (12) — silent-failure detectors

| File | Probes | Cadence |
|------|--------|---------|
| `tls-cert-parity-probe.yml` | ACM + Let's Encrypt expiry (R11) | daily 07:00 UTC |
| `pi-tls-cert-check.yml` | APIGW secondary cert | every 6h |
| `cloudless-https-health-probe.yml` | HTTPS reachability | every 5 min |
| `sha-drift-detector.yml` | SSM SHA == Lambda SHA == Pi SHA | every 6h |
| `sha-drift-watchdog.yml` | Re-runs detector on failure | workflow_run |
| `admin-login-probe.yml` | Cognito login still works | hourly |
| `app-auth-doctor.yml` | NextAuth config + JWKS | daily |
| `notion-integration-health.yml` | All 13 DBs reachable | daily |
| `notion-schema-check.yml` | Schema vs code expectations | weekly |
| `notion-schema-drift.yml` | Diff vs last-known schema | daily |
| `ad-readiness.yml` | LinkedIn pixel + CAPI smoke | daily |
| `link-health-audit.yml` | Cross-site link checker | weekly |

## 🛡️ Security (5)

`codacy.yml` · `codeql.yml` · `mcp-security-scan.yml` · `secret-scan.yml` · `secrets-check.yml` · `monthly-security-audit.yml` · `security-headers-audit.yml`

## 📊 Audit (17) — measurement, not gating

`a11y-audit.yml` · `a11y-live-audit.yml` · `api-contract-audit.yml` ·
`audits-aggregator.yml` · `bundle-budget.yml` · `bundle-size-pr.yml` ·
`cluster-status-audit.yml` · `core-web-vitals-audit.yml` ·
`cost-audit.yml` · `deps-drift-audit.yml` · `i18n-audit.yml` ·
`links-audit.yml` · `seo-hygiene.yml` · `lighthouse.yml` ·
`pwa-audit.yml` · `structured-data-audit.yml` · `weekly-gsc-sync.yml`

## 🔄 Sync (3)

`sync-secrets-to-vars.yml` · `sync-smtp-secrets.yml` · `sync-ssm-to-vars.yml`

## 🏗️ HA / failover (2)

`ha-failover-watchdog.yml` · `ha-sync-orchestrator.yml`

## ❤️ Healthcheck.io pings (3)

`selfhosted-healthchecks.yml` · `cluster-healthcheck.yml` · `restart-pi-runners.yml`

## ⚙️ Cluster ops (11) — operator-fired or scheduled

`cluster-doctor.yml` · `cluster-remediate.yml` · `k3s-app-recover.yml` ·
`k3s-e2e.yml` · `k3s-restart.yml` · `k3s-ssh-restart.yml` ·
`k3s-watchdog-deploy.yml` · `etcd-defrag-now.yml` · `prometheus-tune.yml` ·
`pi-disk-cleanup.yml` · `pi-auth-logs.yml`

## ☁️ Cloudflare ops (6)

`cloudflare-lb.yml` · `apply-cloudflare-lb.yml` ·
`cloudflare-disable-email-obfuscation.yml` · `cloudflare-token-rotate.yml` ·
`store-cloudflare-token.yml` · `verify-cloudflare-token.yml`

## 📚 CMS / Notion (4)

`notion-docs-sitemap.yml` · `notion-update-cluster-docs.yml` ·
`populate-cms.yml` · `weekly-article-draft.yml`

## 📰 Release / publish (4)

`release.yml` · `weekly-newsletter.yml` · `weekly-article-draft.yml` ·
`postiz-crons.yml`

## 🏃 Runners / bootstrap (4)

`bootstrap-gh-runners.yml` · `runner-mode.yml` · `ci-babysitter.yml` · `devcontainer.yml`

## 🧹 Stale / cleanup (5)

`stale.yml` · `stale-gate-sweeper.yml` · `cache-cleanup.yml` ·
`teardown-staging.yml` · `ecr-lifecycle.yml`

## 🔧 Dev tooling (6)

`ci.yml` · `dependabot-automerge.yml` · `dependency-review.yml` ·
`labeler.yml` · `preview.yml` · `pr-review.yml` ·
`e2e-full-coverage.yml` · `unit-coverage.yml`

## 🏷️ One-shots / candidates for archival (review quarterly)

`apply-cognito-ui.yml` · `cognito-setup.yml` · `ses-smtp-iam-bootstrap.yml`
· `decommission-cloudless-online.yml` · `delete-cloudless-online-r53.yml` ·
`retry-delete-cloudless-online-cert.yml` · `recreate-r53-hc.yml` ·
`fix-oidc-thumbprint.yml` · `oidc-diagnostic.yml` · `restore-oidc-trust.yml` ·
`wire-pi-cognito.yml` · `wire-pi-cognito-from-pi.yml` ·
`slack-manifest-apply.yml` · `test-indexing.yml` ·
`grafana-esp32-query.yml` · `ntfy-restore.yml` · `analytics-restore.yml` ·
`linkedin-poll.yml` · `platform-crons.yml` · `workers-ai-verify.yml` ·
`domain-decommission.yml`

**Suggested action:** review each in this section quarterly. If it
hasn't been triggered in 90 days AND its purpose is satisfied by another
workflow, archive (`.github/workflows.archived/<name>.yml.disabled`).

## Failure routing matrix

| Severity tier | Channel | Examples |
|---------------|---------|----------|
| 🔴 SEV1 — production user-facing | `notifyAdmin()` → Slack DM + ntfy phone push | `tls-cert-parity-probe`, `deploy.yml` fail, `admin-login-probe` |
| 🟡 SEV2 — degraded / silent failure | Slack `#alerts` channel only | ETL fails, drift detector |
| 🟢 SEV3 — informational | Workflow status badge only | audits, lighthouse, bundle-size |

If a new workflow doesn't fit, add it to the SEV2 default and refine
after the first incident.

## Coverage check (run quarterly)

```bash
# Workflows that haven't completed in 90+ days are candidates for archival.
gh run list --limit 200 --json workflowName,createdAt | \
  jq -r '.[] | select(.createdAt < "'$(date -u -d '90 days ago' +%Y-%m-%d)'") | .workflowName' | \
  sort -u
```

## See also

- Memory `feedback_organize_gh_workflows` — the rule this catalogue
  implements.
- Memory `feedback_workflow_must_pass` — every failure must be fixed +
  re-run until green.
- `skills/gh-actions-pitfalls/SKILL.md` — 8 CI gotchas catalogue.
- `docs/master-todo-list.md` — R-row roadmap (each row that adds a
  workflow appends to this catalogue).
