# omv k3s — cluster database inventory

> Folder index: [README.md](README.md) · Landscape diagrams: [landscape.md](landscape.md)

Canonical reference for every data store on the Pi k3s cluster (`omv` + `omv-ha`).
Verified live 2026-07-30. Passwords are **never** stored in this doc — pull them with
`pnpm db:passwords` (reads k8s Secrets).

## Access rules

| Rule | Detail |
|------|--------|
| DB ports | **ClusterIP only** — not exposed via Cloudflare tunnels |
| App HTTP | Cloudflare (`*.cloudless.gr`) / NodePorts — apps, not DBs |
| From WSL / Cursor | `kubectl port-forward` → localhost (see [Developer access](#developer-access)) |
| kube-apiserver | LAN `https://192.168.1.128:6443` (preferred in office) — [kubectl-tailscale.md](../kubectl-tailscale.md) |
| Shared `database` / `cache` NS | **Do not exist** on the live cluster (manifests under `infrastructure/database/` are unused) |

```mermaid
flowchart LR
  Dev[Developer] -->|db:forward| Local[127.0.0.1]
  Local --> Maria[(EspoCRM :13306)]
  Local --> AFpg[(AppFlowy :15432)]
  Local --> PZpg[(Postiz :15433)]
  Internet((Internet)) --> CF[Cloudflare]
  CF -->|HTTP only| Apps[App pods]
  CF -.->|no DB TCP| Maria
```

## Quick reference

| Store | Engine | NS | Service | Port | PVC | Daily R2 backup |
|-------|--------|----|---------|------|-----|-----------------|
| EspoCRM | MariaDB 11 | `espocrm` | `espocrm-mariadb` | 3306 | `espocrm-mariadb-data` 4Gi | yes (`mariadb-dump`) |
| AppFlowy | Postgres 16 + pgvector | `appflowy` | `postgres` | 5432 | `appflowy-postgres` 20Gi | yes (`pg_dump`) |
| AppFlowy | Redis 7 | `appflowy` | `redis` | 6379 | none (ephemeral) | no |
| AppFlowy | MinIO | `appflowy` | `minio` | 9000 / 9001 | `appflowy-minio` 10Gi | not yet (R10b) |
| Postiz | Postgres 17 | `postiz` | `postiz-postgres` | 5432 | `postiz-postgres-data` 2Gi | yes (`pg_dump`) |
| Postiz | Redis 7 (AOF) | `postiz` | `postiz-redis` | 6379 | `postiz-redis-data` 512Mi | no |
| Search | Meilisearch 1.48.3 | `meilisearch` | `meilisearch` | 7700 (NodePort 30902) | `meilisearch-data` 5Gi | no |
| n8n | SQLite | `n8n` | `n8n` (HTTP only) | — | `n8n-data` 5Gi | yes (`sqlite3 .backup`) |
| Uptime Kuma | SQLite | `uptime-kuma` | `uptime-kuma` (HTTP only) | — | `uptime-kuma-data` 1Gi | not yet (R10c) |
| Grafana | SQLite (default) | `monitoring` | `kube-prom-grafana` | 80 | none (`emptyDir`) | no |

Platform stores (not app RDBMS): k3s **etcd**, Prometheus TSDB, Loki chunks — see [Platform / observability](#platform--observability).

---

## Developer access

DB TCP is never tunnelled. Use the repo helpers:

```bash
pnpm db:forward          # kubectl port-forward all TCP stores → localhost
pnpm db:forward:status
pnpm db:passwords        # print usernames + passwords from Secrets (do not commit)
pnpm db:sqlite:pull      # copy n8n / Kuma / Grafana SQLite → .local/db/
pnpm db:d1:pull          # export Cloudflare D1 → .local/db/*.sqlite
pnpm db:forward:stop
```

Scripts: `scripts/db-port-forward.sh`, `scripts/db-sqlite-pull.sh`, `scripts/db-d1-pull.sh`.

### Cursor / VS Code — use SQLTools (not Microsoft SQL Server)

Cluster stores are **MariaDB, PostgreSQL, SQLite, and Cloudflare D1**. The Microsoft **SQL Server** extension (`ms-mssql`) only speaks TDS to SQL Server / Azure SQL — it cannot open these databases. Workspace `mssql.connections` is intentionally empty; leave SQL Server Object Explorer unused for omv / Cloudflare work.

Use **SQLTools** instead:

| Extension ID | Role |
|--------------|------|
| `mtxr.sqltools` | Sidebar + query runner |
| `mtxr.sqltools-driver-mysql` | EspoCRM MariaDB |
| `mtxr.sqltools-driver-pg` | AppFlowy + Postiz Postgres |
| `mtxr.sqltools-driver-sqlite` | n8n / Kuma / Grafana / D1 snapshots |

All four are listed in `.vscode/extensions.json` (workspace recommendations). Connections live in `.vscode/settings.json` under `sqltools.connections` (groups `omv`, `omv-sqlite`, `cloudflare-d1`). Passwords are **never** stored there — SQLTools prompts (`askForPassword: true`), or copy from `pnpm db:passwords`.

#### Preconfigured SQLTools connections

| SQLTools name | Engine | Endpoint | User / DB |
|---------------|--------|----------|-----------|
| `omv · EspoCRM MariaDB` | MariaDB | `127.0.0.1:13306` | `espocrm` / `espocrm` |
| `omv · EspoCRM MariaDB (root)` | MariaDB | `127.0.0.1:13306` | `root` / `espocrm` |
| `omv · AppFlowy Postgres` | PostgreSQL | `127.0.0.1:15432` | `postgres` / `postgres` |
| `omv · Postiz Postgres` | PostgreSQL | `127.0.0.1:15433` | `postiz` / `postiz` |
| `omv · n8n SQLite` | SQLite | `${workspaceFolder}/.local/db/n8n.sqlite` | — |
| `omv · Uptime Kuma SQLite` | SQLite | `${workspaceFolder}/.local/db/uptime-kuma.db` | — |
| `omv · Grafana SQLite` | SQLite | `${workspaceFolder}/.local/db/grafana.db` | — |
| `cf · user-auth-db (D1 snapshot)` | SQLite | `${workspaceFolder}/.local/db/user-auth-db.sqlite` | — |
| `cf · auth-db-preview (D1 snapshot)` | SQLite | `${workspaceFolder}/.local/db/auth-db-preview.sqlite` | — |
| `cf · cloudless-auth (D1 snapshot)` | SQLite | `${workspaceFolder}/.local/db/cloudless-auth.sqlite` | — |

#### Connect from Cursor

1. Install the four SQLTools extensions above (accept workspace recommendations if prompted).
2. Open the **SQLTools** sidebar — not the SQL Server Object Explorer.
3. Start TCP forwards and pull snapshots:

   ```bash
   pnpm db:forward
   pnpm db:passwords          # paste when SQLTools asks for MariaDB/Postgres password
   pnpm db:sqlite:pull        # required before the three omv-sqlite connections work
   pnpm db:d1:pull            # required before the three cloudflare-d1 connections work
   ```

4. Click a connection under group `omv`, `omv-sqlite`, or `cloudflare-d1` and authenticate when prompted.
5. When done: `pnpm db:forward:stop`.

VS Code tasks also exist: `db:forward`, `db:forward:stop`, `db:passwords`, `db:sqlite:pull`, `db:d1:pull` (see `.vscode/tasks.json`).

### Local port map

| Local | Target | Client |
|-------|--------|--------|
| `127.0.0.1:13306` | EspoCRM MariaDB | SQLTools MySQL / `mysql` |
| `127.0.0.1:15432` | AppFlowy Postgres | SQLTools PostgreSQL / `psql` |
| `127.0.0.1:15433` | Postiz Postgres | SQLTools PostgreSQL / `psql` |
| `127.0.0.1:16379` | AppFlowy Redis | `redis-cli -p 16379` |
| `127.0.0.1:16380` | Postiz Redis | `redis-cli -p 16380` |
| `127.0.0.1:17700` | Meilisearch | HTTP + `Authorization: Bearer <MEILI_MASTER_KEY>` |
| `127.0.0.1:19000` | AppFlowy MinIO API | S3 / `mc` |
| `127.0.0.1:19001` | AppFlowy MinIO console | browser |
| `.local/db/n8n.sqlite` | n8n snapshot | SQLTools SQLite |
| `.local/db/uptime-kuma.db` | Kuma snapshot | SQLTools SQLite |
| `.local/db/grafana.db` | Grafana snapshot | SQLTools SQLite |
| `.local/db/user-auth-db.sqlite` | D1 `user-auth-db` snapshot | SQLTools SQLite |
| `.local/db/auth-db-preview.sqlite` | D1 `auth-db-preview` snapshot | SQLTools SQLite |
| `.local/db/cloudless-auth.sqlite` | D1 `cloudless-auth` snapshot | SQLTools SQLite |

`.local/` is gitignored (DB snapshots + port-forward state).

---

## Application databases

### 1. EspoCRM — MariaDB

| Field | Value |
|-------|--------|
| Purpose | CRM (contacts, opportunities, cases) |
| Engine / image | `mariadb:11` |
| Namespace | `espocrm` |
| Workload | Deployment `espocrm-mariadb` |
| Service | `espocrm-mariadb` ClusterIP → **3306** |
| PVC | `espocrm-mariadb-data` · 4Gi · local-path |
| Database / user | `espocrm` / `espocrm` (+ `root`) |
| Secret | `espocrm-secrets` |
| Secret keys | `mariadb-password`, `mariadb-root-password`, `admin-username`, `admin-password` |
| In-cluster DSN | host `espocrm-mariadb`, port `3306`, db/user `espocrm` |
| App HTTP | NodePort **30700** → `espocrm.cloudless.gr` |
| App API creds | SSM `/cloudless/production/ESPOCRM_{BASE_URL,API_KEY,WEBHOOK_SECRET}` (not DB password) |
| Manifest | `infrastructure/espocrm/k8s/espocrm.yaml` |
| Docs | `infrastructure/espocrm/README.md`, `skills/espocrm-operator/SKILL.md` |
| Local SQLTools | `omv · EspoCRM MariaDB` (:13306) |

```bash
kubectl -n espocrm port-forward svc/espocrm-mariadb 13306:3306
# password: pnpm db:passwords  (or secret key mariadb-password)
```

---

### 2. AppFlowy — Postgres (pgvector)

| Field | Value |
|-------|--------|
| Purpose | AppFlowy Cloud primary DB (+ GoTrue `auth` schema) |
| Engine / image | `pgvector/pgvector:pg16` (+ `walg` sidecar `alpine:3.20`) |
| Namespace | `appflowy` |
| Workload | Deployment `postgres` |
| Service | `postgres` ClusterIP → **5432** |
| PVC | `appflowy-postgres` · 20Gi |
| Database / user | `postgres` / `postgres` |
| Secret | `appflowy-secrets` key `POSTGRES_PASSWORD` |
| Other secrets | `appflowy-walg-r2` (WAL → R2) |
| In-cluster URL | `postgres://postgres:$(POSTGRES_PASSWORD)@postgres:5432/postgres` |
| GoTrue | same host, `?search_path=auth` |
| App HTTP | NodePort **30810** → `appflowy.cloudless.gr` |
| Manifest | `infrastructure/appflowy/k8s/appflowy.yaml` |
| Docs | [appflowy-deploy.md](../appflowy-deploy.md), `skills/appflowy-operator/SKILL.md` |
| Local SQLTools | `omv · AppFlowy Postgres` (:15432) |

**Env-var ordering:** `POSTGRES_PASSWORD` must appear **before** any `DATABASE_URL` that uses `$(POSTGRES_PASSWORD)` expansion (see AppFlowy skill).

---

### 3. AppFlowy — Redis

| Field | Value |
|-------|--------|
| Purpose | AppFlowy cache / queues |
| Engine / image | `redis:7-alpine` |
| Namespace | `appflowy` |
| Service | `redis` ClusterIP → **6379** |
| PVC | **none** — data is ephemeral |
| Auth | none |
| In-cluster URL | `redis://redis:6379` |
| Local | `127.0.0.1:16379` |

---

### 4. AppFlowy — MinIO (object store)

| Field | Value |
|-------|--------|
| Purpose | AppFlowy blob / S3-compatible storage |
| Engine / image | `minio/minio:latest` |
| Namespace | `appflowy` |
| Service | `minio` ClusterIP → **9000** (API), **9001** (console) |
| PVC | `appflowy-minio` · 10Gi |
| Credentials | `appflowy-secrets`: `APPFLOWY_S3_ACCESS_KEY`, `APPFLOWY_S3_SECRET_KEY` |
| In-cluster | `http://minio:9000` |
| Local | `:19000` API, `:19001` console |
| Backup | Not in daily R2 PVC dump yet (tracked as R10b) |

---

### 5. Postiz — Postgres

| Field | Value |
|-------|--------|
| Purpose | Postiz social publisher |
| Engine / image | `postgres:17-alpine` |
| Namespace | `postiz` |
| Workload | Deployment `postiz-postgres` |
| Service | `postiz-postgres` ClusterIP → **5432** |
| PVC | `postiz-postgres-data` · 2Gi |
| Database / user | `postiz` / `postiz` |
| Secret | `postiz-secrets` key `POSTGRES_PASSWORD` (also `JWT_SECRET`) |
| In-cluster URL | `postgresql://postiz:$(POSTGRES_PASSWORD)@postiz-postgres:5432/postiz` |
| App HTTP | NodePort **30500** → `postiz.cloudless.gr` |
| App API | SSM `POSTIZ_API_URL` / `POSTIZ_API_KEY` / `POSTIZ_WEBHOOK_SECRET` |
| Manifest | `infrastructure/postiz/k8s/postiz.yaml` |
| Docs | [POSTIZ.md](../POSTIZ.md), `skills/postiz/SKILL.md` |
| Local SQLTools | `omv · Postiz Postgres` (:15433) |

Note: `postiz-providers` Secret is referenced by the app but was **missing** on the cluster at last check — providers may be unset until recreated.

---

### 6. Postiz — Redis

| Field | Value |
|-------|--------|
| Purpose | Postiz cache / jobs (AOF persistence) |
| Engine / image | `redis:7-alpine` |
| Namespace | `postiz` |
| Service | `postiz-redis` ClusterIP → **6379** |
| PVC | `postiz-redis-data` · 512Mi |
| Auth | none |
| In-cluster URL | `redis://postiz-redis:6379` |
| Local | `127.0.0.1:16380` |

---

### 7. Meilisearch

| Field | Value |
|-------|--------|
| Purpose | Product / site search (R21) |
| Engine / image | `getmeili/meilisearch:v1.48.3` |
| Namespace | `meilisearch` |
| Service | `meilisearch` **NodePort** 7700 → **30902** |
| PVC | `meilisearch-data` · 5Gi |
| Secret | `meilisearch-secret` key `MEILI_MASTER_KEY` |
| App env | `MEILI_HOST`, `MEILI_MASTER_KEY`, `MEILI_SEARCH_KEY` (SSM / app config) |
| In-cluster | `http://meilisearch.meilisearch.svc.cluster.local:7700` |
| Public hostname | `meili.cloudless.gr` (HTTP + Access — prefer in-cluster DNS for the app) |
| Manifest | `infrastructure/meilisearch/k8s.yaml` |
| Docs | [r21-meilisearch-operations.md](../roadmap/r21-meilisearch-operations.md) |
| Local | `127.0.0.1:17700` |

```bash
curl -sH "Authorization: Bearer $(kubectl -n meilisearch get secret meilisearch-secret -o jsonpath='{.data.MEILI_MASTER_KEY}' | base64 -d)" \
  http://127.0.0.1:17700/health
```

---

### 8. n8n — SQLite

| Field | Value |
|-------|--------|
| Purpose | Workflow automation |
| Engine | Embedded SQLite |
| Path in pod | `/home/node/.n8n/database.sqlite` |
| Namespace | `n8n` |
| Workload / image | Deployment `n8n` · `n8nio/n8n:2.28.2-arm64` |
| Service | `n8n` NodePort **30900** (HTTP 5678) — **no DB TCP** |
| PVC | `n8n-data` · 5Gi |
| App API | SSM `N8N_API_URL` / `N8N_API_KEY` |
| Manifest | `infrastructure/n8n/k8s.yaml` |
| Local SQLTools | `omv · n8n SQLite` after `pnpm db:sqlite:pull` |

Snapshots under `.local/db/n8n.sqlite` are **copies** — re-pull after cluster writes.

---

### 9. Uptime Kuma — SQLite

| Field | Value |
|-------|--------|
| Purpose | Uptime monitoring |
| Engine | SQLite (`UPTIME_KUMA_DB_TYPE=sqlite`) |
| Path in pod | `/app/data/kuma.db` |
| Namespace | `uptime-kuma` |
| Workload / image | Deployment `uptime-kuma` · `louislam/uptime-kuma:2` |
| Service | `uptime-kuma` NodePort **32501** (HTTP 3001) — **no DB TCP** |
| PVC | `uptime-kuma-data` · 1Gi |
| Manifest | `infrastructure/uptime-kuma/k8s/uptime-kuma.yaml` |
| Backup | Not in daily R2 set yet (R10c) |
| Local SQLTools | `omv · Uptime Kuma SQLite` after `pnpm db:sqlite:pull` |

---

### 10. Grafana — SQLite

| Field | Value |
|-------|--------|
| Purpose | Monitoring UI (kube-prometheus-stack) |
| Engine | Grafana default SQLite |
| Path in pod | `/var/lib/grafana/grafana.db` |
| Namespace | `monitoring` |
| Workload / image | Deployment `kube-prom-grafana` · `grafana/grafana:13.1.1` |
| Service | `kube-prom-grafana` NodePort **30850** |
| Storage | **`emptyDir`** — DB is lost on pod restart (no PVC) |
| Secret | `kube-prom-grafana` keys `admin-user`, `admin-password`, `ldap-toml` |
| Local SQLTools | `omv · Grafana SQLite` after `pnpm db:sqlite:pull` |

Treat Grafana SQLite as disposable unless a PVC is added later.

---

## Cloudflare D1 (edge SQLite)

D1 has no localhost TCP port. Use snapshots for SQLTools:

| D1 name | UUID | Binding | Local SQLTools |
|---------|------|---------|----------------|
| `user-auth-db` | `7ca74513-23c3-412a-b9ca-b0c55835973d` | `AUTH_DB` / `NEXT_CACHE_D1_BINDING` (prod) | `cf · user-auth-db (D1 snapshot)` |
| `auth-db-preview` | `70d90155-12de-46d7-a0ea-113b3e7127cf` | preview env | `cf · auth-db-preview (D1 snapshot)` |
| `cloudless-auth` | `0c00f32c-374b-447a-8f0a-af337004449d` | unused / empty | `cf · cloudless-auth (D1 snapshot)` |

```bash
pnpm db:d1:pull                 # all three
pnpm db:d1:pull user-auth-db    # one
# live query without snapshot:
pnpm exec wrangler d1 execute user-auth-db --remote --command 'SELECT name FROM sqlite_master'
```

Snapshots under `.local/db/*.sqlite` are **copies** — re-pull after remote writes. For ad-hoc remote SQL, prefer `wrangler d1 execute` or the Cloudflare bindings MCP (`d1_database_query`).

---

## Platform / observability

| Store | Notes |
|-------|--------|
| **k3s etcd** | Control-plane on `omv`; hourly local snapshots + compressed S3/R2 mirror — `infrastructure/etcd-backup/` |
| **Prometheus** | TSDB on PVC under `monitoring` (`prometheus-operated`) |
| **Loki** | Log chunks/index on PVC (`storage-loki-0`) — not SQL |
| **ntfy** | File cache on PVC `ntfy-data`; optional `auth.db` via CLI — not a networked SQL DB |

These are not wired into SQLTools.

---

## Daily backups (R2)

See [infrastructure/backup/README.md](../../infrastructure/backup/README.md).

| App | Tool | Schedule (UTC) | R2 prefix |
|-----|------|----------------|-----------|
| AppFlowy Postgres | `pg_dump --format=custom` | 03:30 | `pvc-backups/appflowy/daily/` |
| EspoCRM MariaDB | `mariadb-dump` + gzip | 03:45 | `pvc-backups/espocrm/daily/` |
| Postiz Postgres | `pg_dump --format=custom` | 04:00 | `pvc-backups/postiz/daily/` |
| n8n SQLite | `sqlite3 .backup` + gzip | 04:15 | `pvc-backups/n8n/daily/` |

**Not covered yet:** AppFlowy MinIO, Kuma SQLite, Grafana, Meilisearch, Redis.

---

## Not live / do not use

| Item | Status |
|------|--------|
| `infrastructure/database/postgresql-ha.yaml` (ns `database`) | Manifest only — namespace **absent** |
| `infrastructure/database/redis-ha.yaml` (ns `cache`) | Manifest only — namespace **absent** |
| OnCall MariaDB / Redis PVCs | Orphan candidates — [orphan-k8s-resources-2026-06-21.md](../orphan-k8s-resources-2026-06-21.md) |
| Metabase H2 + DuckDB | Evicted; manifests under `infrastructure/espocrm/evicted-deployments/` |
| Home Assistant | Evicted; PVC `ha-config-pvc` retained |
| MongoDB / Elasticsearch / standalone MySQL | Not deployed |

---

## Related docs

- [kubectl via Tailscale / LAN](../kubectl-tailscale.md)
- [AppFlowy deploy](../appflowy-deploy.md)
- [Postiz](../POSTIZ.md)
- [Meilisearch ops (R21)](../roadmap/r21-meilisearch-operations.md)
- [PVC → R2 backups](../../infrastructure/backup/README.md)
- EspoCRM runbook: `infrastructure/espocrm/README.md`
- [Databases index](README.md)
- [Landscape diagrams](landscape.md)
