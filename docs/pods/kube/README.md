# `kube`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | StatefulSet |
| Namespace | `tailscale` |
| Resource name | `kube` |
| Hostname / DNS | apiserver auth-proxy |
| Ports | ProxyGroup kube |
| Role | Tailscale auth proxy in front of kube-apiserver. |

## How cloudless.gr uses it

Lets GHA / WSL reach the API over the tailnet. `cloudless-app` uses the
in-cluster SA; this is for operators and CI, not product traffic.

## Key files

- `docs/cluster/kubectl-tailscale.md`
- `docs/cluster/TAILSCALE-FABRIC.md`

## Secrets / config

- operator-managed

## Related workloads

- [`operator`](../operator/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
