# EspoCRM — self-hosted CRM (replacing HubSpot)

EspoCRM is the open-source CRM (SugarCRM lineage, same family as SuiteCRM)
that replaces HubSpot for `cloudless.gr`. Deployed on the k3s cluster on
`omv-main`, exposed via Cloudflare Tunnel at `https://espocrm.cloudless.gr`.

## Why EspoCRM and not SuiteCRM

This was the original ask. Three blockers killed SuiteCRM on this stack:

| Blocker | Detail |
|---|---|
| arm64 image | The official Bitnami SuiteCRM image is amd64-only ([bitnami/charts#7305](https://github.com/bitnami/charts/issues/7305)); won't run on Pi 5. |
| Image licensing | Bitnami moved SuiteCRM into its **commercial Secure Images** catalogue in 2024 — no longer free on Docker Hub. |
| Helm chart status | The official `helm/charts` SuiteCRM chart is **deprecated**. |

EspoCRM publishes [official multi-arch `espocrm/espocrm`](https://hub.docker.com/r/espocrm/espocrm)
(amd64 + arm64), idles at ~380 MB, and has a community Helm chart at
[twenty20/twenty20-helm-charts](https://artifacthub.io/packages/helm/twenty20-helm-charts/espocrm)
that supports Traefik IngressRoute (which k3s ships by default).

## Architecture

```
                  Internet
                     │
                     ▼
       Cloudflare (TLS termination)
                     │
                     ▼
       cloudflared tunnel on omv-main
       (existing tunnel e977a490-58c5-4fdb-9155-86832e3e636a)
                     │
                     ▼
       http://192.168.1.128:30700  (NodePort, k3s)
                     │
                     ▼
       Service: espocrm-nginx (ClusterIP, port 80)
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
       espocrm pod          mariadb pod
       (PHP-FPM + nginx)    (chart sub-chart)
          │                     │
          ▼                     ▼
       PVC 4Gi              PVC 4Gi
       /var/www/html        /bitnami/mariadb
```

## Install (operator action — runs from omv-main)

1. **Generate secrets** — do NOT commit the values:

   ```bash
   kubectl create namespace espocrm

   # MariaDB root + user passwords (chart sub-chart consumes these)
   kubectl -n espocrm create secret generic espocrm-mariadb \
     --from-literal=mariadb-root-password="$(openssl rand -hex 24)" \
     --from-literal=mariadb-password="$(openssl rand -hex 24)" \
     --from-literal=mariadb-replication-password="$(openssl rand -hex 24)"

   # EspoCRM admin bootstrap (used on first boot only)
   kubectl -n espocrm create secret generic espocrm-admin \
     --from-literal=username=admin \
     --from-literal=password="$(openssl rand -hex 20)"
   ```

   Stash the admin password in 1Password — you'll use it for the first UI login.

2. **Add the Helm repo and install**:

   ```bash
   bash infrastructure/espocrm/install.sh
   ```

   Or manually:

   ```bash
   helm repo add twenty20 https://twenty20-contrib.github.io/twenty20-helm-charts
   helm repo update
   helm upgrade --install espocrm twenty20/espocrm \
     --namespace espocrm \
     --create-namespace \
     --values infrastructure/espocrm/values.yaml \
     --wait --timeout 10m
   ```

3. **Verify pods**:

   ```bash
   kubectl -n espocrm get pods
   # Expected:
   #   espocrm-<hash>           1/1 Running
   #   espocrm-mariadb-0        1/1 Running
   ```

4. **Wire Cloudflare Tunnel** — paste the ingress fragment from
   `cloudflare-tunnel.yaml` into `/etc/cloudflared/config.yml` on omv-main
   (before the catch-all rule), then:

   ```bash
   sudo systemctl reload cloudflared
   ```

5. **Add the DNS CNAME** in Cloudflare:

   ```
   espocrm.cloudless.gr   CNAME   e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com
   ```

6. **First-boot UI**: `https://espocrm.cloudless.gr/install` walks through the
   one-time installer. Use the admin credentials from step 1. After install,
   `/install` returns 404 and the regular `/` login is live.

7. **Generate an API key for the Next.js app**:

   Admin → Administration → API Users → Create User → check "API User",
   pick the auth method "Hmac" or "Api Key", copy the key. Store in SSM:

   ```bash
   aws ssm put-parameter --name /cloudless/production/ESPOCRM_BASE_URL \
     --type String --overwrite --value "https://espocrm.cloudless.gr"
   aws ssm put-parameter --name /cloudless/production/ESPOCRM_API_KEY \
     --type SecureString --overwrite --value "<copied-key>"
   ```

   The Lambda will pick these up within the 5-minute SSM cache TTL — no redeploy.

## App-side migration

`src/lib/espocrm.ts` (PR 2) will export the same 21-function surface as the
current `src/lib/hubspot.ts` so the 10 API routes + 9 admin pages can flip
import paths with no behavioral change. Each function maps to EspoCRM v8 JSON
API: `Contact`, `Account`, `Opportunity`, `Case`, `Campaign` modules.

See `docs/HUBSPOT.md` for the function-by-function migration map.

## Backups

EspoCRM data lives in two PVCs:

- `espocrm-data` (4 Gi) — uploaded files, custom layouts
- `espocrm-mariadb-data` (4 Gi) — all CRM records

The daily Pi cleanup script (`/usr/local/sbin/cloudless-cleanup.sh`) already
includes general PVC accounting; add a weekly `mysqldump` cron after the
first month of production use:

```bash
kubectl -n espocrm exec espocrm-mariadb-0 -- \
  mariadb-dump -uespocrm -p"$DB_PASS" espocrm | \
  gzip > /srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/Backups/espocrm-$(date +%F).sql.gz
```

## Resource sizing (Pi 5, omv-main)

| Pod | Requests | Limits |
|---|---|---|
| espocrm | 256 Mi RAM, 100 m CPU | 768 Mi RAM, 1 CPU |
| espocrm-mariadb | 256 Mi RAM, 100 m CPU | 512 Mi RAM, 500 m CPU |
| **total** | **512 Mi / 200 m** | **1.28 Gi / 1.5 CPU** |

omv-main has 8 Gi RAM and 4 cores. After the existing Next.js + Postiz +
Postgres + Redis + Prometheus stack, this leaves ~1.5 Gi RAM and 1 CPU of
headroom — comfortable.

If memory pressure hits, the first knob to turn down is `mariadb.primary.persistence.size` and the
`innodb_buffer_pool_size` in `mariadb.primary.configuration` (chart values).
