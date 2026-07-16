# skills/ — in-repo operator skills index

Every directory under `skills/` is a self-contained runbook for a recurring
operator task. Each one has a `SKILL.md` with frontmatter that documents:

- when to use it (trigger keywords)
- the canonical step-by-step path
- sources (linked docs)

The operator's repeated guidance is: **always read the relevant
`skills/*/SKILL.md` BEFORE solving from first principles** (per
[memory: use-in-repo-skills](../../../spaces/<id>/memory/feedback_use_in_repo_skills.md)).
This README is the entry table to find the right one fast.

## Active skills (alphabetical, by trigger keyword)

| Skill | Trigger keywords | What it does |
| --- | --- | --- |
| [ad-analytics](ad-analytics/SKILL.md) | LinkedIn ads, ad campaigns, conversion tracking, ad performance, AdPlatformAdapter | Architecture + operations for the multi-platform ad-tracking module (LinkedIn-first; extracted from L1/L2 split). |
| [alertmanager-slack](alertmanager-slack/SKILL.md) | alertmanager, slack receiver, no_active_hooks, alert routing | Canonical Alertmanager-to-Slack pattern (CronJob-based, not direct slack_configs) per the 2026-06-21 fix. |
| [anthropic](anthropic/SKILL.md) | claude api, anthropic sdk, model invoke, bedrock | Claude/Bedrock model invocation patterns + the Nova Micro switch (Marketplace gotcha). |
| [appflowy-operator](appflowy-operator/SKILL.md) | appflowy, notion replacement, 9-pod stack, jemalloc, gotrue | Full AppFlowy Cloud stack ops on the 9-pod Phase 1 deploy. **Worker pin to omv-ha is mandatory** (16K/4K-page kernel). |
| [aws-data-migration](aws-data-migration/SKILL.md) | DynamoDB to D1, migrate database, S3 to R2 sync, RDS dump to Workers, data migration, KV vs D1, DynamoDB hot partition | Migrate AWS data stores (DynamoDB, RDS, S3) to Cloudflare equivalents with type conversions and sync tools. |
| [aws-migration-pitfalls](aws-migration-pitfalls/SKILL.md) | migration issue, Lambda rewrite, Postgres JSONB query, s3 glacier, Workers CPU limit, Cognito export, API Gateway stage var, Lambda VPC, SQS DLQ, migration gotcha | 10 common AWS to Cloudflare migration pitfalls and avoidance strategies. |
| [aws-migration-preflight](aws-migration-preflight/SKILL.md) | prepare migration, migration checklist, before AWS migration, migration pre-flight, migration prerequisites, migration readiness check | Pre-flight checklist for AWS to Cloudflare migration — validates credentials, resource budgets, and rollback paths before starting migration. |
| [aws-migration-strategies](aws-migration-strategies/SKILL.md) | migration strategy, strangler fig migration, big bang deploy, hybrid cloudflare, migration timeline | Choose and execute AWS to Cloudflare migration strategies (strangler fig, big bang, hybrid) with timeline and risk assessment. |
| [aws-post-migration](aws-post-migration/SKILL.md) | post-migration cleanup, delete AWS resources, AWS cleanup after migration, verify Cloudflare cutover, AWS cost after migration, decommission DynamoDB, remove S3 buckets | Clean up and verify AWS resources after Cloudflare migration — safely delete DynamoDB, S3, IAM, and SSM resources with verification steps. |
| [audit-routine](audit-routine/SKILL.md) | audit, security audit, stack health, regular check | The "address all issues" loop the operator runs end-of-session. |
| [cloudflare-token-doctor](cloudflare-token-doctor/SKILL.md) | cloudflare token, 401 on cloudflare_*, mint cloudflare token, ssm cloudflare | 4-stage Cloudflare API token mint + verify + store (SSM half + cloud-session half). |
| [cloudflare-tunnel-ops](cloudflare-tunnel-ops/SKILL.md) | cloudflare tunnel, ingress add/remove, DNS CNAME, tunnel 404 | Add/remove ingress for the shared cloudless.gr tunnel (UUID `e977a490-58c5-...`) — works from Kubernetes_MCP only. |
| [cluster-bash](cluster-bash/SKILL.md) | cluster_run_command, cluster_run_fanout, SFTP, ssh-mcp | Two-node SSH ops via `mcp__cloudless-infra__cluster_*` tools. Read before any cluster SSH. |
| [cowork-session-secrets](cowork-session-secrets/SKILL.md) | session secret, OMV_SSH_KEY, TAILSCALE_AUTH_KEY, GITHUB_PAT, cloud-session secret | Cloud-session secret bootstrap so MCP tools work after Claude restarts. |
| [esphome-ota-flash](esphome-ota-flash/SKILL.md) | esphome run, ESP32 OTA, reflash without USB, esp32 remote update | Network-flash an ESP32 via WiFi from laptop or in-cluster Job. **2026.5 signed-OTA verification documented.** |
| [fly-proxy-deploy](fly-proxy-deploy/SKILL.md) | redeploy fly proxy, fly.io proxy update, deploy fly.io, flyctl deploy, ha proxy redeploy, cloudflare failover, PRIMARY_HOST update | Deploy and manage Fly.io HA proxy for Cloudflare Workers with Tailscale fallback. Covers deployment, secret updates, and rollback procedures. |
| [espocrm-operator](espocrm-operator/SKILL.md) | espocrm, hubspot replacement, api key, webhook entity, ses bridge | Full EspoCRM ops: API rotation, Slack webhooks, ETL, SES → Lambda → Case bridge. |
| [gh-actions-pitfalls](gh-actions-pitfalls/SKILL.md) | matrix bash, pnpm action-setup, runner saturation, ResourceQuota, kube-cleanup-operator | 8 CI gotchas that have bitten cloudless.gr. Read BEFORE authoring any workflow. |
| [linkedin-campaigns](linkedin-campaigns/SKILL.md) | linkedin campaign, paid acquisition, /campaigns/<slug>, insight tag, CAPI | Add a new LinkedIn campaign — landing page + checkout + dual-fire conversion. |
| [linkedin-insight-doctor](linkedin-insight-doctor/SKILL.md) | linkedin pixel, insight tag, partner id, conversion-id mismatch | Diagnose silent LinkedIn pixel failures (CSP, conversion-id type mismatch, sync vs async fire). |
| [mqtt-auth-rollout](mqtt-auth-rollout/SKILL.md) | mosquitto auth, allow_anonymous, password_file, ESP32 mqtt creds | 3-phase no-downtime credential rollout for the cluster Mosquitto broker. |
| [ollama-operator](ollama-operator/SKILL.md) | ollama, local model, qwen2.5-coder, local inference, ask the local model, pull model | Use local Ollama from Amazon Q via the mcp-ollama-server bridge. Covers chat, generate, model management, and service ops. |
| [postiz](postiz/SKILL.md) | postiz, social media scheduling, postiz auth | Postiz API + admin operations. |
| [postiz-doctor](postiz-doctor/SKILL.md) | postiz crashloop, postiz oom, postiz down | Postiz-specific incident diagnosis. |
| [selfhosted-admin-bootstrap](selfhosted-admin-bootstrap/SKILL.md) | new self-hosted admin, unified admin password, admin user bootstrap | Per-app recipe for creating the unified `tbaltzakis@cloudless.gr` admin. |
| [terraform-doctor](terraform-doctor/SKILL.md) | terraform openpgp expired, tf init failed, AWS provider 5.x, validate fail | Terraform CI failures end-to-end — `mcp__cloudless-infra__tf_doctor` automates Stages 0-3. |

## Plus 5 `*.skill` bundles (zipped sharable skills)

`cluster-health.skill`, `dev-server-doctor.skill`, `lambda-env-check.skill`,
`playwright-smart-run.skill`, `wsl-net-fix.skill` — distribution artefacts,
not live SKILL.md files. Unzip if a colleague needs to install one.

## How this list is maintained

`scripts/audit-skill-usage.sh` lists every active skill + reference
counts. Re-run when adding a skill — entries should land here too.

If a skill has zero references in CLAUDE.md / docs/ / code AND its last
commit is >30 days old, prune via the 2026-06-21 sweep pattern (3 skills
pruned that day: `postiz-apply`, `workmail-outlook-setup`,
`cowork-wsl-handoff`).
