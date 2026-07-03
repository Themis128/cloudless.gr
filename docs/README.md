# Docs index

## CI/CD & infrastructure

| Doc | What it covers |
|---|---|
| [CLUSTER-HEALTH-CHECK-2026-07-03.md](CLUSTER-HEALTH-CHECK-2026-07-03.md) | Latest cluster health report — nodes, deployments, HA failover, storage, monitoring. Run weekly. |
| [deploy.md](deploy.md) | Production deploy workflow, IAM perms required, troubleshooting AccessDenied on `iam:GetRole`/`TagRole`. |
| [iam.md](iam.md) | IAM principals (deploy role, Pi-image role, `cloudless-ops` user), the managed policy hierarchy, and the no-root permission-update path. |
| [pi-cloud-sync.md](pi-cloud-sync.md) | Contract between the Pi K3s standby and the SST cloud — what's in sync, how, and what to monitor. |
| [security.md](security.md) | Single-source-of-truth security posture — auth, headers, CSP, rate limiting, Sentry scrubber, and what's deliberately out of scope. |
| [ci-health-routine.md](ci-health-routine.md) | The weekly Claude Code routine that checks all 6 workflows on `main` are green. |
| [SECURITY_ENHANCEMENTS_ROADMAP.md](SECURITY_ENHANCEMENTS_ROADMAP.md) | Standing security backlog. |

## Self-Hosted Applications Status

| App | Status | Uptime | Key Features |
|-----|--------|--------|--------------|
| [APPFLOWY-STATUS-2026-07-03.md](APPFLOWY-STATUS-2026-07-03.md) | ✅ Operational | 12d | Workspace, database, real-time collab, auth (GoTrue), MinIO storage |
| [DUCKDB-ANALYTICS-STATUS-2026-07-03.md](DUCKDB-ANALYTICS-STATUS-2026-07-03.md) | ✅ Operational | 56d | Data lake, 8 ETL CronJobs, 7 ML models, anomaly detection (15m), S3 sync |
| [MEILISEARCH-STATUS-2026-07-03.md](MEILISEARCH-STATUS-2026-07-03.md) | ✅ Operational | 9d | Full-text search, typo tolerance, SearXNG metasearch, 4Gi index capacity |
| [ESPOCRM-STATUS-2026-07-03.md](ESPOCRM-STATUS-2026-07-03.md) | ✅ Operational | 12d | CRM, MariaDB, hourly + daily backups, SMTP, Slack/Calendar integration |
| [N8N-STATUS-2026-07-03.md](N8N-STATUS-2026-07-03.md) | ✅ Operational | 56d | Workflow automation, 300+ nodes, 26 restarts (monitor memory) |
| [POSTIZ-STATUS-2026-07-03.md](POSTIZ-STATUS-2026-07-03.md) | ✅ Operational | 21d | Social media scheduler, 6 platforms, PostgreSQL + Redis, daily backups |
| [UPTIME-KUMA-STATUS-2026-07-03.md](UPTIME-KUMA-STATUS-2026-07-03.md) | ✅ Operational | 12d | Uptime monitoring, SSL tracking, incident alerts, status page |
| [NTFY-STATUS-2026-07-03.md](NTFY-STATUS-2026-07-03.md) | ✅ Operational | 57d | Push notifications, webhooks, channels, multi-platform alerts |
| [VIBE-STATUS-2026-07-03.md](VIBE-STATUS-2026-07-03.md) | ✅ Operational | 8d | Agent orchestration, project management, knowledge bases, 20Gi capacity |
| [ALERT-MANAGER-STATUS-2026-07-03.md](ALERT-MANAGER-STATUS-2026-07-03.md) | ✅ Operational | 45d | Alert routing, grouping, deduplication, multi-channel notifications |

## Application integrations

| Doc | Service |
|---|---|
| [ANTHROPIC.md](ANTHROPIC.md) | Anthropic SDK / Claude API usage in the app. |
| [GSC.md](GSC.md) | Google Search Console integration. |
| [GOOGLE-CALENDAR.md](GOOGLE-CALENDAR.md) | Calendar integration. |
| [HUBSPOT.md](HUBSPOT.md) | EspoCRM CRM integration. |
| [SENTRY.md](SENTRY.md) | Error monitoring. |
| [SLACK.md](SLACK.md) | Slack notifications. |
| [STRIPE.md](STRIPE.md) | Stripe checkout + webhooks. |
| [EMAIL-SES.md](EMAIL-SES.md) | Outbound email via SES. |
| [ACTIVECAMPAIGN.md](ACTIVECAMPAIGN.md) | Email marketing automation. |
| [NOTION-CMS.md](NOTION-CMS.md) | Notion-backed blog/docs CMS. |

## Product / surface

| Doc | What it covers |
|---|---|
| [AGENCY-HUB.md](AGENCY-HUB.md) | Agency Hub product surface. |
| [MARKETING-HUB-SETUP.md](MARKETING-HUB-SETUP.md) | Marketing Hub configuration. |
| [design-system-v2.md](design-system-v2.md) | Design tokens, components, layout primitives. |
| [mcp-manager-bridge.md](mcp-manager-bridge.md) | The MCP server bridge. |

### Admin panel quick reference

`/admin` is gated by `admin` group membership verified server-side and client-side. Key surfaces:

| Section | Path | Notes |
|---|---|---|
| Dashboard | `/admin` | Stat cards (orders, contacts, errors) + Infrastructure shortcuts |
| Analytics | `/admin/analytics`, `/admin/analytics/unified` | GSC + web metrics |
| EspoCRM | `/admin/hubspot`, `/admin/crm/**` | Contacts, companies, tickets |
| Marketing | `/admin/campaigns/**`, `/admin/email`, `/admin/calendar` | Campaigns, email, content calendar |
| Notion | `/admin/notion/**` | Submissions, projects, tasks, analytics |
| System | `/admin/orders`, `/admin/errors`, `/admin/integrations`, `/admin/settings` | Ops and config |
| Infrastructure | external links | Grafana (`grafana.cloudless.gr`) + Cluster Manager (`manage.cloudless.gr`) — open in new tab, each tool has its own auth |

### Social links

`src/components/SocialLinks.tsx` renders the shared icon row used in Footer, ContactFormSection, and the home page. It links to cloudless.gr brand accounts:

| Icon | URL |
|---|---|
| LinkedIn | `https://www.linkedin.com/company/cloudless-gr` |
| GitHub | `https://github.com/cloudless-gr` |

`src/lib/structured-data.ts` → `getOrganizationSchema().sameAs` mirrors the same two URLs for Schema.org JSON-LD.

## Project-aware Claude skills

These skills live in the local Claude installation (`~/.claude/skills/`) — they auto-load in future Claude sessions to apply context that doesn't belong in the repo. Names are stable; if you don't have them locally, future sessions will rebuild them from the corresponding docs above.

- **`lighthouse-perf-debug`** — diagnosing CI Lighthouse failures (variance vs. real regression, the median-of-3 pattern, score-driving metrics). Pairs with [.github/workflows/lighthouse.yml](../.github/workflows/lighthouse.yml).
- **`ecr-immutable-tags-ci`** — handling AWS ECR repos with IMMUTABLE tag mutability (the BatchDeleteImage untag pattern, IAM perms, SHA-only fallback). Pairs with [.github/workflows/build-pi-image.yml](../.github/workflows/build-pi-image.yml).
