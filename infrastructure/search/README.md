# Meilisearch Search Engine — R21a

Self-hosted search engine on the omv-main Pi cluster node.

## Deployment Status

**Phase 3 (AI Baseline)** — deployed but pending Cloudflare tunnel activation.

## Components

| Resource | Location | Purpose |
|----------|----------|---------|
| Namespace | `search` | Isolated namespace for search service |
| PVC | `meilisearch-data` | 4Gi persistent storage on dedicated SSD |
| Deployment | `meilisearch` | v1.42.1 image, pinned to omv node |
| Service | `meilisearch` | NodePort 30770 for tunnel access |
| Service | `meilisearch-internal` | ClusterIP for in-cluster API access |

## Storage

- Uses `local-path` storage class → `/srv/dev-disk-by-uuid-a9a5a108-.../k3s/storage` (120GB SSD)
- PVC size: 4Gi (expandable to 8Gi if needed)
- Label: `cloudless.gr/storage-purpose: r21-search`

## Secret Requirements

```bash
# Generate and create the master key (run once)
kubectl create namespace search
kubectl -n search create secret generic meilisearch-master-key \
  --from-literal=MEILI_MASTER_KEY="$(openssl rand -hex 32)"

# Optional: store in SSM for backup
aws ssm put-parameter \
  --name /cloudless/production/MEILI_MASTER_KEY \
  --value "<key>" \
  --type SecureString \
  --overwrite
```

## Apply to Cluster

```bash
# Apply manifests
kubectl apply -f k8s/search/meilisearch.yaml

# Verify deployment
kubectl -n search get pods -o wide
kubectl -n search get svc

# Check health
curl -s http://<cluster-ip>:7700/health
# Expected: {"status":"available"}
```

## Cloudflare Tunnel Setup

Add to `/etc/cloudflared/config.yml` on **both omv and omv-ha**:

```yaml
ingress:
  - hostname: search.cloudless.gr
    service: http://192.168.1.128:30770
    originRequest:
      connectTimeout: 15s
      tcpKeepAlive: 30s
      httpHostHeader: search.cloudless.gr
  # ... existing ingress rules ...
  - service: http_status:404
```

Then create DNS record:

```bash
# CNAME record
search.cloudless.gr → e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com
(Proxied=true, TTL=auto)
```

Verify:

```bash
curl -I https://search.cloudless.gr/health
# Expect: HTTP/2 200
```

## API Integration

See `/api/search` route (R21b) for the Next.js integration that calls Meilisearch.

## Resources

- [Meilisearch Documentation](https://www.meilisearch.com/docs)
- [R21b Search Route](/src/app/api/search/route.ts)
- [R21c Product Recommendations](/src/app/api/recommend/route.ts)
