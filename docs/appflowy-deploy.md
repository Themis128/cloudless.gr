# AppFlowy Self-Host — Operator Runbook

Phase 1 of replacing Notion as the operator-facing CMS for cloudless.gr. This
runbook covers deploy, first-login, and the three known operational gotchas.
Architecture decisions and per-pod env reference live in
`infrastructure/appflowy/k8s/appflowy.yaml`.

## TL;DR Topology

| Pod | Node | Image | Purpose |
| --- | --- | --- | --- |
| postgres | omv (Pi 5) | pgvector/pgvector:pg16 | Shared DB for cloud + worker + gotrue (auth schema) |
| redis | omv | redis:7-alpine | Cache + outbox + collab streams |
| minio | omv | minio/minio:latest | S3-compatible blob store for collab + uploads |
| gotrue | omv | appflowyinc/gotrue:latest | Auth (issues JWT under `appflowy_admin` group) |
| appflowy-cloud | omv | appflowyinc/appflowy_cloud:latest | REST/WebSocket API |
| appflowy-web | omv | appflowyinc/appflowy_web:latest | Notion-like SPA UI |
| admin-frontend | omv | appflowyinc/admin_frontend:latest | Workspace admin console at `/console` |
| nginx | omv | nginx:1.27-alpine | In-cluster path router (matches upstream `nginx/nginx.conf`) |
| appflowy-worker | **omv-ha** (Pi 4) | appflowyinc/appflowy_worker:latest | Imports, snapshots, outbox publishers |

The worker is pinned to **omv-ha** because the upstream worker image's jemalloc
was built for 4 KiB pages. omv runs Raspberry Pi OS's `2712` kernel with 16 KiB
pages, which makes jemalloc panic at boot with
`<jemalloc>: Unsupported system page size`. omv-ha runs the `v8` kernel
(4 KiB pages), so the same image starts cleanly there. If a future image bumps
its jemalloc build to support 16 KiB, drop the `nodeSelector` block on the
worker Deployment and let it schedule freely.

## Deploy

```bash
# 1. Create the namespace + secret (NOT in git; generate fresh per environment)
kubectl create ns appflowy
kubectl -n appflowy create secret generic appflowy-secrets \
  --from-literal=POSTGRES_PASSWORD="$(openssl rand -hex 16)" \
  --from-literal=GOTRUE_JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=GOTRUE_ADMIN_EMAIL="baltzakis.themis@gmail.com" \
  --from-literal=GOTRUE_ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | head -c 22)" \
  --from-literal=APPFLOWY_S3_ACCESS_KEY="minioadmin" \
  --from-literal=APPFLOWY_S3_SECRET_KEY="minioadmin"

# 2. Apply the stack
kubectl apply -f infrastructure/appflowy/k8s/appflowy.yaml

# 3. Wait for Running
kubectl -n appflowy get pods -w
```

Expected end state: 9 pods Running. First boot takes ~3 min while AppFlowy
Cloud + GoTrue run their sqlx/Go migrations against the freshly initialised
postgres database.

## In-cluster verification (before exposing publicly)

```bash
NGINX=$(kubectl -n appflowy get pod -l app=nginx -o jsonpath='{.items[0].metadata.name}')
for p in / /api/health /gotrue/health /gotrue/settings /console; do
  CODE=$(kubectl -n appflowy exec "$NGINX" -- \
    wget -q -O /dev/null -S http://127.0.0.1$p 2>&1 \
    | grep -oE 'HTTP/[0-9.]+ [0-9]+' | head -1)
  printf '%-22s %s\n' "$p" "$CODE"
done
```

Expected:

```
/                      HTTP/1.1 302
/api/health            HTTP/1.1 200
/gotrue/health         HTTP/1.1 200
/gotrue/settings       HTTP/1.1 200
/console               HTTP/1.1 200
```

## Expose at `https://appflowy.cloudless.gr`

1. Add the DNS record at Cloudflare (`Themis128` zone `cloudless.gr`):
   `appflowy.cloudless.gr CNAME → e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com`, proxied.
2. SSH to omv and append the fragment from
   `infrastructure/appflowy/cloudflare-tunnel.yaml` to `/etc/cloudflared/config.yml`,
   then `sudo systemctl restart cloudflared` (SIGHUP does not reliably re-read
   ingress rules — see CLAUDE.md "Cluster Incident Response").
3. Verify from anywhere:

   ```bash
   curl -I https://appflowy.cloudless.gr            # 302 → /login
   curl -I https://appflowy.cloudless.gr/gotrue/health   # 200
   curl -I https://appflowy.cloudless.gr/api/health      # 200
   curl -I https://appflowy.cloudless.gr/console        # 200
   ```

4. First login: visit `https://appflowy.cloudless.gr/console` and sign in with
   the `GOTRUE_ADMIN_EMAIL` / `GOTRUE_ADMIN_PASSWORD` you put into the
   `appflowy-secrets` Secret. Workspace creation is on the same page.

## Three gotchas that cost the deploy

These are documented inline in `appflowy.yaml` so future-you doesn't repeat
them; they're collected here as one quick read.

1. **`$(POSTGRES_PASSWORD)` env substitution requires POSTGRES_PASSWORD to come
   first in the container's env list.** K8s does string substitution top-down;
   an undeclared/late variable expands to empty string and Postgres returns
   `password authentication failed for user "postgres"`. All three affected
   pods (gotrue, appflowy-cloud, appflowy-worker) put POSTGRES_PASSWORD first.
2. **admin_frontend listens on port 3000, not 80.** Upstream docker-compose
   uses `http://admin_frontend:3000` for the nginx upstream; the in-cluster
   Service matches.
3. **AppFlowy Web's `APPFLOWY_WS_BASE_URL` ends in `/ws/v2`, not `/ws/v1`.**
   The path was bumped silently; only the upstream `deploy.env` reveals it.

## Resource budget

Roughly 700 MiB across all 9 pods at idle. The 940 MiB Postiz LiteLLM eviction
freed enough headroom on omv to host the 8 omv-resident pods (worker lives on
omv-ha). To restore Postiz AI:
`kubectl apply -f infrastructure/appflowy/evicted-deployments/postiz-litellm.yaml`.

## Where things live on disk

- postgres PVC `appflowy-postgres` (20 GiB requested) → local-path on omv's
  sda1 (the dedicated 120 GiB k3s SSD).
- minio PVC `appflowy-minio` (10 GiB requested) → same.
- gotrue / appflowy-cloud / appflowy-web / admin-frontend / nginx are
  stateless.

## Backup / restore

- **etcd**: existing hourly `k3s-etcd-snapshot` captures PVC metadata.
- **Postgres**: run a daily dump to the user-data SSD (sdb1), never to sda1:

```bash
PG_POD=$(kubectl -n appflowy get pod -l app=postgres -o jsonpath='{.items[0].metadata.name}')
kubectl -n appflowy exec "$PG_POD" -- \
  pg_dump -U postgres appflowy | \
  gzip > /srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/Backups/appflowy-$(date +%F).sql.gz
```

- **MinIO**: use `mc mirror` or PVC snapshot before destructive upgrades.
- **WAL-G continuous backup**: scaffold at `infrastructure/appflowy/walg-sidecar.yaml` (PARTIAL — verify rollout before relying on it).

## Roadmap context

- Phase 1: deploy + first-login. **Done.**
- Phase 2: Cloudflare tunnel + DNS. **Done.**
- Phase 3: AppFlowy HTTP client + dual-run public readers. **In progress / shipped in app** — see `docs/appflowy-espocrm-migration-checklist.md`.
- Phase 4: promote AppFlowy primary after parity, then retire `NOTION_*` SSM keys (operator `aws ssm delete-parameters`).