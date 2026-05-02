# Docs index

## CI/CD & infrastructure

| Doc | What it covers |
|---|---|
| [deploy.md](deploy.md) | Production deploy workflow, IAM perms required, troubleshooting AccessDenied on `iam:GetRole`/`TagRole`. |
| [iam.md](iam.md) | IAM principals (deploy role, Pi-image role, `cloudless-ops` user), the managed policy hierarchy, and the no-root permission-update path. |
| [pi-cloud-sync.md](pi-cloud-sync.md) | Contract between the Pi K3s standby and the SST cloud — what's in sync, how, and what to monitor. |
| [ci-health-routine.md](ci-health-routine.md) | The weekly Claude Code routine that checks all 6 workflows on `main` are green. |
| [SECURITY_ENHANCEMENTS_ROADMAP.md](SECURITY_ENHANCEMENTS_ROADMAP.md) | Standing security backlog. |

## Application integrations

| Doc | Service |
|---|---|
| [ANTHROPIC.md](ANTHROPIC.md) | Anthropic SDK / Claude API usage in the app. |
| [GSC.md](GSC.md) | Google Search Console integration. |
| [GOOGLE-CALENDAR.md](GOOGLE-CALENDAR.md) | Calendar integration. |
| [HUBSPOT.md](HUBSPOT.md) | HubSpot CRM integration. |
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

## Skills (live in `~/.claude/skills/`)

These are project-aware skills that future Claude sessions auto-load:

- **[lighthouse-perf-debug](../../home/.claude/skills/lighthouse-perf-debug/SKILL.md)** — diagnosing CI Lighthouse failures (variance vs. real regression, the median-of-3 pattern, score-driving metrics).
- **[ecr-immutable-tags-ci](../../home/.claude/skills/ecr-immutable-tags-ci/SKILL.md)** — handling AWS ECR repos with IMMUTABLE tag mutability (the BatchDeleteImage untag pattern, IAM perms, SHA-only fallback).
