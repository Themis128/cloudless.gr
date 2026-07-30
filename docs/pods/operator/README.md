# `operator`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `tailscale` |
| Resource name | `operator` |
| Hostname / DNS | (Tailscale operator) |
| Ports | n/a |
| Role | Tailscale Kubernetes Operator. |

## How cloudless.gr uses it

**Ops/dev fabric only.** Enables ProxyGroups / MagicDNS for kubectl and
admin UIs. Next.js product code does not call Tailscale APIs.

## Key files

- `infrastructure/tailscale/`
- `docs/cluster/TAILSCALE-FABRIC.md`

## Secrets / config

- Tailscale OAuth / auth keys (CI/MCP)

## Related workloads

- [`ingress`](../ingress/)
- [`kube`](../kube/)
- [`ts-k3s-cidrs`](../ts-k3s-cidrs/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
