# `coredns`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `kube-system` |
| Resource name | `coredns` |
| Hostname / DNS | cluster DNS (kube-dns) |
| Ports | 53 UDP/TCP |
| Role | Cluster DNS for `*.svc.cluster.local` and upstream recursion. |

## How cloudless.gr uses it

**Platform only — no Next.js client.** Every in-cluster call from
`cloudless-app` (Meili, MQTT, Kuma, etc.) depends on CoreDNS. Mass
`getaddrinfo EAI_AGAIN` in Uptime Kuma usually means this path (or the node)
is stalled, not that every app is down.

## Key files

- `docs/cluster/TAILSCALE-FABRIC.md`
- k3s CoreDNS ConfigMap

## Secrets / config

- none in app

## Related workloads

- [`cloudless-app`](../cloudless-app/)
- [`meilisearch`](../meilisearch/)
- [`traefik`](../traefik/)
- [`metrics-server`](../metrics-server/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
