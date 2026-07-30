# `postiz`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `postiz` |
| Resource name | `postiz` |
| Hostname / DNS | postiz.cloudless.gr |
| Ports | NodePort 30500 |
| Role | Social media scheduler / publisher. |

## How cloudless.gr uses it

Admin Postiz UI + API proxy, blog auto-post (`postiz-blog`), webhooks → Slack,
crons `postiz-sync` / `postiz-oauth-check`, workspace `postizGroupId`. Next talks
HTTP API only (`POSTIZ_API_URL` + key).

## Key files

- `src/lib/postiz.ts`
- `src/lib/postiz-blog.ts`
- `src/lib/postiz-slack.ts`
- `src/app/api/admin/postiz/**`
- `src/app/api/webhooks/postiz/route.ts`
- `src/app/api/cron/postiz-*`

## Secrets / config

- `POSTIZ_API_URL`
- `POSTIZ_API_KEY`
- `POSTIZ_WEBHOOK_SECRET`
- `POSTIZ_SLACK_CHANNEL`

## Related workloads

- [`postiz-postgres`](../postiz-postgres/)
- [`postiz-redis`](../postiz-redis/)
- [`cloudless-app`](../cloudless-app/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
