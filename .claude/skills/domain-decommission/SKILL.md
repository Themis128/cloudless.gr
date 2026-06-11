---
name: domain-decommission
description: Safely retire a domain's cloud footprint — Route 53 health checks + Cloudflare DNS records — and silence the monitors that still probe it. Use when a domain has been migrated away (e.g. cloudless.online → cloudless.gr) and is still generating DNS-change / health-check alerts, or the user says "retire cloudless.online", "stop the DNS alerts", "decommission the old domain", "clean up the dead domain". Drives the cleanup through a path-triggered GitHub workflow (OIDC + SSM) that reports to issue #382; report-only by default.
argument-hint: "domain to retire, e.g. cloudless.online"
---

# Domain decommission — cloudless.gr

Retire a migrated-away domain's **Route 53 health checks** and **Cloudflare DNS
records** from a session with no AWS/Cloudflare console — the same OIDC + SSM +
issue-#382 pattern as the rest of the ops tooling here. Report-only by default;
deletes only on an explicit `apply`.

## Why this exists

`cloudless.online` was migrated to `cloudless.gr` and its DNS delegation pulled,
but leftover **Route 53 health checks**, **Cloudflare DNS records**, and
**in-cluster monitors** that still probe it keep firing DNS-change /
health-check alerts. This toolkit retires the AWS + Cloudflare side cleanly.

## The single most important safety rule

**Never delete a health check by a hardcoded id.** The id
`30a69f1c-8d48-49bd-9067-cabec979478b` is the **cloudless.gr HA *secondary*
(Pi/APIGW failover) health check** defined in `sst.config.ts` — it belongs to
the *active* cloudless.gr failover, not cloudless.online. Deleting it breaks
cloudless.gr's failover to the Pi. The `omv-ha` cleanup tool hardcodes this id;
**ours does not** — it matches health checks by `FullyQualifiedDomainName`
ending in the target domain, and hard-guards that id (see `PROTECTED_HEALTH_CHECKS`).

## Tools (in repo)

| Command / Workflow | What it does |
| --- | --- |
| `pnpm domain:decommission` (`scripts/domain-decommission.sh`) | Report (default) or apply. Lists/deletes Route 53 health checks whose FQDN is `$DOMAIN` (or `*.{DOMAIN}`), and Cloudflare DNS records in `$DOMAIN`'s zone. Scoped by name; protected ids are skipped. `DOMAIN=`, `MODE=report\|apply`, `CONFIRM=1`. |
| `.github/workflows/domain-decommission.yml` | Runs it on a hosted runner via OIDC (`AWS_DEPLOY_ROLE_ARN`), reads `CLOUDFLARE_API_TOKEN` from SSM, posts the result to **#382**. `workflow_dispatch` inputs `domain` + `apply`; a push to the workflow/script is **report-only**. |

## Run order

1. **Report first.** Dispatch `domain-decommission.yml` with `apply=false`
   (or merge a touch to the script — push is always report-only). Read the
   `#382` comment: it lists every Route 53 health check + Cloudflare record
   scoped to the domain, and flags the protected id.
2. **Confirm the list is correct** — every FQDN/record is genuinely the retired
   domain, and the protected cloudless.gr secondary is shown as *skipped*.
3. **Apply.** Dispatch again with `apply=true` (→ `MODE=apply CONFIRM=1`). It
   deletes only the listed, non-protected resources and re-reports to #382.

## Prerequisites / gotchas

- **AWS:** the OIDC deploy role needs `route53:ListHealthChecks` (report) and
  `route53:DeleteHealthCheck` (apply). Per `aws-iam-audit`, health-check
  deletion historically needed a temporary inline-policy escalation on
  `cloudless-ops-role` — if apply returns `AccessDenied`, grant
  `route53:DeleteHealthCheck` (and revoke after).
- **Cloudflare:** the workflow reads the token from the **`CLOUDFLARE_API_TOKEN`
  repo secret** first (add it in GitHub → Settings → Secrets — no AWS access
  needed), and falls back to SSM `/cloudless/production/CLOUDFLARE_API_TOKEN`.
  Scope the token `Zone:Read` + `Zone.DNS:Edit`. Without either, the Cloudflare
  step skips with a warning (Route 53 still runs). The `cloudless.online` ACM cert is
  Cloudflare-owned and **cannot** be deleted by us — leave it (see aws-iam-audit).
- **In-cluster monitors live elsewhere.** The probes that actually generate the
  recurring alerts are in **other repos**, not cloudless.gr:
  - `omv-ha` → `k8s/health-monitor/health-monitor.yaml` (curls
    `https://cloudless.online/api/health` → the `health-monitor` / `cluster-health-check`
    Error pods).
  - `OMV` → `docs/phase1-acceptance.md` uptime-kuma monitor on the same URL.
  - `raspberry-pi-monitoring-stack` → Grafana dashboards referencing the CF zone,
    and most likely the DNS-record snapshot monitor that emits the "DNS changes
    detected" alerts.
  This toolkit can't reach those (GitHub scope = cloudless.gr). Clean them in
  their own repo/session, or via the `omv-ha` `cloudless-infra` MCP.

## Reading results

```
mcp__github__issue_read(method="get_comments", owner="Themis128",
  repo="cloudless.gr", issue_number=382)
```

The newest "Domain decommission —" comment is the latest run.
