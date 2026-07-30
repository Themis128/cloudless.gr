# `espocrm`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `espocrm` |
| Resource name | `espocrm` |
| Hostname / DNS | espocrm.cloudless.gr |
| Ports | NodePort 30700 |
| Role | Self-hosted CRM (EspoCRM 9) — contacts, deals, cases, newsletter. |

## How cloudless.gr uses it

Primary CRM for the marketing site. Contact form, subscribe, calendar book,
admin CRM/pipeline/email, and Slack entity webhooks all go through
`src/lib/espocrm.ts` (HTTP API + `X-Api-Key`). The app never opens MariaDB
TCP — only this HTTP surface.

## Key files

- `src/lib/espocrm.ts`
- `src/lib/espocrm-webhook.ts`
- `src/lib/espocrm-slack.ts`
- `src/app/api/webhooks/espocrm/route.ts`
- `src/app/api/crm/**`
- `src/app/api/admin/crm/**`
- `infrastructure/espocrm/`

## Secrets / config

- `ESPOCRM_BASE_URL`
- `ESPOCRM_API_KEY`
- `ESPOCRM_WEBHOOK_SECRET`

## Related workloads

- [`espocrm-mariadb`](../espocrm-mariadb/)
- [`n8n`](../n8n/)
- [`cloudless-app`](../cloudless-app/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
