# EspoCRM — self-hosted CRM (EspoCRM replacement)

EspoCRM (SugarCRM lineage, same family as SuiteCRM) replaces EspoCRM for
`cloudless.gr`. Deployed on the k3s cluster on `omv`, exposed via Cloudflare
Tunnel at `https://espocrm.cloudless.gr`.

**Status (2026-07-29):** ✅ LIVE on omv. App runtime uses `src/lib/espocrm.ts`
with SSM keys `ESPOCRM_BASE_URL` / `ESPOCRM_API_KEY` / `ESPOCRM_WEBHOOK_SECRET`.
HubSpot naming is decommissioned in UI/API; leftover `HUBSPOT_*` SSM params may
be deleted by the operator.

## Why EspoCRM and not SuiteCRM (the original ask)

Three blockers killed SuiteCRM on this stack:

| Blocker | Detail |
|---|---|
| arm64 image | Bitnami SuiteCRM image is amd64-only ([bitnami/charts#7305](https://github.com/bitnami/charts/issues/7305)); won't run on Pi 5. |
| Licensing | Bitnami moved SuiteCRM into commercial Secure Images in 2024. |
| Helm chart | Official `helm/charts` SuiteCRM chart is deprecated. |

EspoCRM publishes [official multi-arch `espocrm/espocrm`](https://hub.docker.com/r/espocrm/espocrm)
(amd64 + arm64), idles at ~300 MiB, has a clean v8 JSON-API.

## Why raw manifests and not Helm

We initially tried the [twenty20/espocrm](https://artifacthub.io/packages/helm/twenty20-helm-charts/espocrm)
Helm chart but it does NOT bundle a database (operator must install MariaDB
separately anyway), and the `cloudpirates/espocrm` chart uses the Bitnami
MariaDB sub-chart which is amd64-only. Raw manifests match the existing
[`infrastructure/postiz/k8s/postiz.yaml`](../postiz/k8s/postiz.yaml) pattern
exactly, work cleanly on arm64, and pin both pods to `omv` so the local-path
PVCs stay on the dedicated 120 GB SSD.

## Architecture

```
                  Internet
                     │
                     ▼
       Cloudflare (TLS termination)
                     │
                     ▼
       cloudflared tunnel on omv
       (existing tunnel e977a490-58c5-4fdb-9155-86832e3e636a,
        same one used by postiz.cloudless.gr + logs.cloudless.gr)
                     │
                     ▼
       http://192.168.1.128:30700  (NodePort, k3s)
                     │
                     ▼
       Service: espocrm (port 80, ClusterIP via the NodePort proxy)
                     │
                     ▼
       Pod: espocrm (Apache + PHP-FPM bundled in espocrm/espocrm:9)
            ↕  TCP 3306
       Service: espocrm-mariadb (ClusterIP only — never exposed)
                     │
                     ▼
       Pod: espocrm-mariadb (mariadb:11)

       Storage (both PVCs, local-path StorageClass):
         espocrm-app-data       4 Gi  → sda1 (120 GB SSD)
         espocrm-mariadb-data   4 Gi  → sda1 (120 GB SSD)
```

## Live deploy state (verified 2026-06-20)

| Pod | Status | Image | RAM live |
|---|---|---|---|
| `espocrm-d9fb465d4-*` | 1/1 Running | `espocrm/espocrm:9` (sha256:213e6b62…) | ~200 MiB |
| `espocrm-mariadb-ccf4d6f78-*` | 1/1 Running | `mariadb:11` | ~100 MiB |

| PVC | Capacity | Bound | Storage |
|---|---|---|---|
| `espocrm-app-data` | 4 Gi | pvc-8ae109a5-… | local-path → sda1 |
| `espocrm-mariadb-data` | 4 Gi | pvc-59f6bacb-… | local-path → sda1 |

Memory cost on omv: net +304 MiB after the HA + Metabase eviction (see below).

## Memory we freed to make room

Total budget on omv (Pi 5 8 GB) was 97% before this work — adding EspoCRM
required eviction. The deployments saved to
`evicted-deployments/` were removed; their PVCs were preserved so they can be
re-applied later (likely on a third Pi):

| Deployment | RAM freed | PVC preserved |
|---|---|---|
| `home-assistant/home-assistant` | ~354 MiB | `ha-config-pvc` |
| `analytics/metabase`            | ~808 MiB | `metabase-data`, `duckdb-data` |
| **total** | **~1.16 GiB** | |

`evicted-deployments/*.yaml` re-applies each one verbatim once you have a
node to put them on. `omv-ha` is a Pi 4 with 1 GB RAM — neither fits there.

## Install (already done — kept for re-deploy)

1. **Create namespace + secret** (the actual install used fresh random hex strings
   generated locally; the values are NOT committed):

   ```bash
   kubectl create namespace espocrm
   kubectl -n espocrm create secret generic espocrm-secrets \
     --from-literal=mariadb-root-password="$(openssl rand -hex 24)" \
     --from-literal=mariadb-password="$(openssl rand -hex 24)" \
     --from-literal=admin-username="admin" \
     --from-literal=admin-password="$(openssl rand -hex 16)"
   ```

2. **Apply manifests**:

   ```bash
   kubectl apply -f infrastructure/espocrm/k8s/espocrm.yaml
   ```

3. **Verify**:

   ```bash
   kubectl -n espocrm get pods
   kubectl -n espocrm exec deploy/espocrm -- curl -sI http://localhost/ | head -1
   ```

## Operator next steps (~10 min)

1. **Cloudflare tunnel** — append the ingress fragment from
   `cloudflare-tunnel.yaml` to `/etc/cloudflared/config.yml` on omv (BEFORE
   the catch-all), then `sudo systemctl reload cloudflared`.

2. **DNS** — in Cloudflare zone `cloudless.gr`:

   ```
   espocrm.cloudless.gr   CNAME   e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com
   ```

3. **First UI login** — visit `https://espocrm.cloudless.gr` with the admin
   credentials from the Secret. The `ESPOCRM_ADMIN_*` env vars seed them on
   first boot; rotate immediately via the UI (User → Settings → Change Password).

4. **API key for the Next.js app** — Administration → API Users → Create
   user "cloudless-app" with `API User=true`, auth method `Api Key`. Copy
   the key, store in SSM:

   ```bash
   aws ssm put-parameter --name /cloudless/production/ESPOCRM_BASE_URL \
     --type String --overwrite --value "https://espocrm.cloudless.gr"
   aws ssm put-parameter --name /cloudless/production/ESPOCRM_API_KEY \
     --type SecureString --overwrite --value "<copied-key>"
   ```

   The Lambda picks these up within the 5-minute SSM cache TTL.

## Next PRs in the migration

- **PR 3**: `src/lib/espocrm.ts` mirroring the 21 exported functions of
  `src/lib/hubspot.ts` (drop-in by export name).
- **PR 4**: Flip imports in the 10 admin API routes + 9 admin pages
  (51 files reference EspoCRM today).

EspoCRM SSM key stays in place during cutover so anything still pointing
at it keeps working.

## Inbound Email → Cases (operator setup, ~10 min)

EspoCRM can convert incoming emails on `support@cloudless.gr` into Case
records automatically. Free, no extension needed — built into the core.

1. **Get IMAP creds** for `support@cloudless.gr` (whatever provider hosts
   the mailbox — Google Workspace, Zoho, mail.cloudless.gr, etc).
2. EspoCRM UI → **Administration → Inbound Emails → Create**:
   - Name: `Support inbox`
   - From Name: `Cloudless Support`
   - Status: `Active`
   - Use IMAP: ✓ (host, port 993, SSL)
   - Username / Password: as provided
   - Monitored folders: `INBOX`
   - **Create Case: ✓** (the magic flag — every new IMAP message becomes a Case)
   - Case Distribution: Round-Robin (or pick an owner manually)
3. Test by emailing `support@cloudless.gr` — within ~5 min the message
   appears as a Case under Admin → Cases. The EspoCRM webhook for
   `Case.create` is already registered, so a Slack notification fires to
   `#notifications` automatically.
4. (Optional) Set up the matching SMTP **Outbound Email** so replies sent
   from the Case detail view land in the customer's inbox under the right
   threading. Same Admin → Outbound Emails settings.

## ETL: EspoCRM → R2 Data Lake

`scripts/etl/espocrm-to-r2.mjs` pulls Contact / Account / Opportunity /
Case / Campaign into **R2 parquet** (`datalake-bucket`). Admin analytics
read gold snapshots via `datalake-serve.ts` — not Athena and not live
EspoCRM on page load.

Athena SQL in `docs/analytics-athena.sql` is historical. Do not stand
Athena back up from this inventory.

## Backups (set up after first month of production data)

```bash
kubectl -n espocrm exec espocrm-mariadb-<hash> -- \
  mariadb-dump -uespocrm -p"$DB_PASS" espocrm | \
  gzip > /srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/Backups/espocrm-$(date +%F).sql.gz
```

The 1 TB sdb1 has room; do NOT back up to sda1 (would compete with k3s data).
