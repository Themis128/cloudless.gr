# Docs index

## CI/CD & infrastructure

| Doc                                                                                      | What it covers                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [OMV_HEALTH_CHECK_2026_07_05.md](OMV_HEALTH_CHECK_2026_07_05.md)                         | Latest cluster health report and remediation status.    |
| [OMV_STORAGE_STRATEGY_SUMMARY_2026_07_05.md](OMV_STORAGE_STRATEGY_SUMMARY_2026_07_05.md) | 3-tier storage architecture and auto-overflow policy.   |
| [CLOUDFLARE_TAILSCALE_SETUP_2026_07_04.md](CLOUDFLARE_TAILSCALE_SETUP_2026_07_04.md)     | Tunnel, DNS, and file service (FTP/TFTP) configuration. |
| [deploy.md](deploy.md)                                                                   | Production deploy workflow and IAM troubleshooting.     |
| [iam.md](iam.md)                                                                         | IAM principals and managed policy hierarchy.            |
| [pi-cloud-sync.md](pi-cloud-sync.md)                                                     | Contract between the Pi K3s standby and the SST cloud.  |
| [security.md](security.md)                                                               | Single-source-of-truth security posture.                |
| [SECURITY_ENHANCEMENTS_ROADMAP.md](SECURITY_ENHANCEMENTS_ROADMAP.md)                     | Standing security backlog.                              |

## Self-Hosted Applications & Operations

| Doc                                                                                                    | Status       | Key Features                                                |
| ------------------------------------------------------------------------------------------------------ | ------------ | ----------------------------------------------------------- |
| [OMV_COMPLETE_IMPLEMENTATION_SUMMARY_2026_07_05.md](OMV_COMPLETE_IMPLEMENTATION_SUMMARY_2026_07_05.md) | ✅ Verified  | Summary of storage and maintenance implementation.          |
| [SELF_HOSTED_APPS_CLEANUP_CONFIG_2026_07_05.md](SELF_HOSTED_APPS_CLEANUP_CONFIG_2026_07_05.md)         | 🔶 Partial   | App-level cleanup configurations (Postgres, MariaDB, etc.). |
| [DOCS_SERVICE_FIX_2026_07_05.md](DOCS_SERVICE_FIX_2026_07_05.md)                                       | ✅ Fixed     | Resolution of the docs.cloudless.gr 502 error.              |
| [K3S_STORAGE_MIGRATION_PLAN_2026_07_05.md](K3S_STORAGE_MIGRATION_PLAN_2026_07_05.md)                   | ✅ Completed | Step-by-step guide for k3s root relocation to SSD.          |

## AI & Search

| Doc | Service |
| --- | ------- |
| [ANTHROPIC.md](ANTHROPIC.md) | Anthropic SDK / Claude API usage. |
| [AI_ANALYTICS_ORCHESTRATION.md](AI_ANALYTICS_ORCHESTRATION.md) | Stripe analytics orchestration pipeline. |
| [AGENTS_ROADMAP.md](AGENTS_ROADMAP.md) | AI agents roadmap (dev, runtime, CI). |
| [LANGSMITH-EVALS.md](LANGSMITH-EVALS.md) | LangSmith evaluation suite. |

## Application integrations

| Doc                                      | Service                            |
| ---------------------------------------- | ---------------------------------- |
| [ANTHROPIC.md](ANTHROPIC.md)             | Anthropic SDK / Claude API usage.  |
| [GSC.md](GSC.md)                         | Google Search Console integration. |
| [GOOGLE-CALENDAR.md](GOOGLE-CALENDAR.md) | Calendar integration.              |
| [HUBSPOT.md](HUBSPOT.md)                 | EspoCRM CRM integration.           |
| [SENTRY.md](SENTRY.md)                   | Error monitoring.                  |
| [SLACK.md](SLACK.md)                     | Slack notifications and commands.  |
| [STRIPE.md](STRIPE.md)                   | Stripe checkout + webhooks.        |
| [EMAIL-SES.md](EMAIL-SES.md)             | Outbound email via SES.            |
| [ACTIVECAMPAIGN.md](ACTIVECAMPAIGN.md)   | Email marketing automation.        |
| [NOTION-CMS.md](NOTION-CMS.md)           | Notion-backed blog/docs CMS.       |

## Product & Roadmap

| Doc                                                          | What it covers                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| [master-todo-list.md](master-todo-list.md)                   | **The Master Roadmap** — pending features and perfection path. |
| [AGENCY-HUB.md](AGENCY-HUB.md)                               | Agency Hub product surface.                                    |
| [MARKETING-HUB-SETUP.md](MARKETING-HUB-SETUP.md)             | Marketing Hub configuration.                                   |
| [design-system-v2.md](design-system-v2.md)                   | Design tokens, components, layout primitives.                  |
| [best-practices-audit-2026.md](best-practices-audit-2026.md) | 2026 standards validation.                                     |

### Admin panel quick reference

`/admin` is gated by `admin` group membership. Key surfaces:

| Section        | Path                                  | Notes                                 |
| -------------- | ------------------------------------- | ------------------------------------- |
| Dashboard      | `/admin`                              | Stat cards + Infrastructure shortcuts |
| Analytics      | `/admin/analytics`                    | GSC + web metrics                     |
| EspoCRM        | `/admin/crm/**`                       | Contacts, companies, tickets          |
| Marketing      | `/admin/campaigns/**`, `/admin/email` | Campaigns, email, calendar            |
| Notion         | `/admin/notion/**`                    | Submissions, projects, tasks          |
| Infrastructure | external links                        | Grafana + Cluster Manager             |

## Session Summaries

- [SESSION_SUMMARY_2026_07_06.md](SESSION_SUMMARY_2026_07_06.md) — OMV remediation, Meilisearch activation, R21b/R21c shipped.
- [SESSION_SUMMARY_2026_07_04.md](SESSION_SUMMARY_2026_07_04.md) — Infrastructure setup, branch cleanup.
- [session-summary-2026-06-21.md](session-summary-2026-06-21.md) — R7-R14 implementation.
