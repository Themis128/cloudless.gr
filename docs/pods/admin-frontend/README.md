# `admin-frontend`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `appflowy` |
| Resource name | `admin-frontend` |
| Hostname / DNS | appflowy.cloudless.gr (admin path) |
| Ports | via nginx |
| Role | AppFlowy admin frontend. |

## How cloudless.gr uses it

Operator console for AppFlowy. Not invoked by Next product routes;
accessible via CF Access for admins.

## Key files

- `skills/appflowy-operator/SKILL.md`

## Secrets / config

- shared AppFlowy secrets / CF Access

## Related workloads

- [`appflowy-cloud`](../appflowy-cloud/)
- [`nginx`](../nginx/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
