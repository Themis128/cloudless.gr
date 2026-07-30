# `meilisearch`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `meilisearch` |
| Resource name | `meilisearch` |
| Hostname / DNS | meili.cloudless.gr · in-cluster `meilisearch.meilisearch.svc:7700` |
| Ports | 7700 ClusterIP · NodePort 30902 |
| Role | Full-text / vector product search (R21). |

## How cloudless.gr uses it

The app indexes store products (optional Workers AI embeddings) and serves
`/api/search`. Admin reindex is `/api/admin/search/reindex`. Prefer
`MEILI_HOST=http://meilisearch.meilisearch.svc.cluster.local:7700` from the
`cloudless-app` pod so traffic stays on the cluster network.

## Key files

- `src/lib/meilisearch.ts`
- `src/lib/search-index.ts`
- `src/lib/product-search.ts`
- `src/app/api/search/route.ts`
- `src/app/api/admin/search/reindex/route.ts`
- `infrastructure/meilisearch/`

## Secrets / config

- `MEILI_HOST`
- `MEILI_MASTER_KEY` / `MEILI_ADMIN_KEY`
- `MEILI_SEARCH_KEY`
- k8s `meilisearch-secret`

## Related workloads

- [`cloudless-app`](../cloudless-app/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
