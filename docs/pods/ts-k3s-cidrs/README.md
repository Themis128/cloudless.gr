# `ts-k3s-cidrs-2cp9f`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | StatefulSet |
| Namespace | `tailscale` |
| Resource name | `ts-k3s-cidrs-2cp9f` |
| Hostname / DNS | subnet router |
| Ports | Connector for 10.42/16 · 10.43/16 |
| Role | Advertises pod/service CIDRs into the tailnet. |

## How cloudless.gr uses it

Enables reaching ClusterIPs (Meili, Postgres forwards, etc.) from Tailscale
clients. No Next.js dependency beyond making operator debugging possible.

## Key files

- `docs/cluster/TAILSCALE-FABRIC.md`

## Secrets / config

- operator-managed

## Related workloads

- [`operator`](../operator/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
