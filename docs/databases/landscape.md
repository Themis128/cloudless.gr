# Database landscape

Architect view of every durable and ephemeral store for cloudless.gr.
Inventory detail: [omv-cluster.md](omv-cluster.md). Folder index: [README.md](README.md).

**Principles**

1. **No public DB TCP** — ClusterIP only; apps reach the edge via Cloudflare, not the engines.
2. **One store per product domain** — no shared `database` / `cache` namespaces on the live cluster.
3. **Edge SQLite (D1) for auth/session** — Workers path; not on the Pi.
4. **R2 is the off-box backup plane** — daily logical dumps for the primary RDBMS + n8n.
5. **Developer access is mediated** — `kubectl port-forward` or snapshot pull; never tunnel DB ports through Cloudflare.

---

## 1. Logical landscape

Systems of record vs caches / indexes vs edge vs platform control plane.

```mermaid
flowchart TB
  subgraph Edge["Cloudflare edge"]
    D1["D1 · user-auth-db<br/>sessions / auth / app config"]
    D1p["D1 · auth-db-preview"]
    R2["R2 · datalake + pvc-backups"]
  end

  subgraph Clients["Clients"]
    Web["cloudless.gr / Workers"]
    Admin["Admin + apps via CF Tunnel"]
  end

  subgraph Apps["Product apps on k3s"]
    Espo["EspoCRM"]
    AF["AppFlowy Cloud"]
    PZ["Postiz"]
    N8N["n8n"]
    MeiliApp["Site search"]
  end

  subgraph SOR["Systems of record"]
    Maria["MariaDB 11<br/>espocrm"]
    PGaf["Postgres 16 + pgvector<br/>appflowy"]
    PGpz["Postgres 17<br/>postiz"]
    SQn8n["SQLite<br/>n8n"]
  end

  subgraph Aux["Auxiliary / non-SOR"]
    RedisAF["Redis · AppFlowy"]
    RedisPZ["Redis · Postiz AOF"]
    MinIO["MinIO · AppFlowy blobs"]
    Meili["Meilisearch"]
    SQkuma["SQLite · Uptime Kuma"]
    SQg["SQLite · Grafana emptyDir"]
  end

  subgraph Platform["Platform"]
    Etcd["k3s etcd"]
    Prom["Prometheus TSDB"]
    Loki["Loki chunks"]
  end

  Web --> D1
  Web --> MeiliApp
  Admin --> Espo
  Admin --> AF
  Admin --> PZ
  Admin --> N8N

  Espo --> Maria
  AF --> PGaf
  AF --> RedisAF
  AF --> MinIO
  PZ --> PGpz
  PZ --> RedisPZ
  N8N --> SQn8n
  MeiliApp --> Meili

  Maria -.->|daily dump| R2
  PGaf -.->|daily dump + WAL-G| R2
  PGpz -.->|daily dump| R2
  SQn8n -.->|daily backup| R2
```

| Tier | Stores | Durability expectation |
|------|--------|------------------------|
| System of record | MariaDB, AppFlowy PG, Postiz PG, n8n SQLite, D1 | Daily R2 (cluster) or CF-managed (D1) |
| Blob / object | MinIO | PVC; R2 backup **not yet** (R10b) |
| Cache / queue | Redis ×2 | Ephemeral or AOF-local; rebuildable |
| Search index | Meilisearch | Rebuildable from source |
| Ops UI state | Kuma SQLite, Grafana SQLite | Kuma PVC; Grafana **lost on restart** |
| Control plane | etcd, Prometheus, Loki | Separate platform backup story |

---

## 2. Physical topology (Pi k3s + edge)

```mermaid
flowchart LR
  subgraph Office["Office / WSL developer"]
    Cursor["Cursor + SQLTools"]
    Kubectl["kubectl"]
  end

  subgraph LAN["LAN / Tailscale"]
    API["kube-apiserver<br/>192.168.1.128:6443"]
  end

  subgraph omv["omv · Pi 5 control plane"]
    subgraph sda["sda1 · k3s SSD"]
      PVCs["local-path PVs<br/>MariaDB · PG · Redis PVC · MinIO · Meili · n8n · Kuma"]
      EtcdDisk["etcd + containerd"]
    end
    subgraph sdb["sdb1 · user data SSD"]
      BackupsWin["Windows backups / media<br/>not cluster DBs"]
    end
  end

  subgraph omvha["omv-ha · Pi 4 worker"]
    Workloads["Scheduled pods<br/>per affinity / capacity"]
  end

  subgraph CF["Cloudflare"]
    Tunnel["Tunnel → app HTTP only"]
    D1edge["D1"]
    R2edge["R2 backups"]
  end

  Cursor -->|port-forward| Kubectl
  Kubectl --> API
  API --> omv
  API --> omvha
  Tunnel -.->|no DB ports| omv
  PVCs -.->|CronJob dumps| R2edge
  D1edge --- CF
```

**Storage rule of thumb:** all k3s PVs live on **sda1**. Filling **sdb1** (Windows backups) must not take down databases.

---

## 3. Trust boundary — how traffic reaches data

```mermaid
flowchart TB
  Internet((Internet))

  Internet -->|HTTPS| CF["Cloudflare CDN / Access / Tunnel"]
  CF -->|HTTP to NodePort / ClusterIP apps| AppPods["App pods"]
  AppPods -->|ClusterIP| Engines["DB engines<br/>3306 / 5432 / 6379 / 9000 / 7700"]

  Dev["Developer WSL"] -->|kubectl port-forward| Engines
  Dev -->|wrangler d1 / db:d1:pull| D1["Cloudflare D1"]

  CF -.->|blocked by design| Engines
```

| Path | Allowed? |
|------|----------|
| Public → Cloudflare → app HTTP | Yes |
| Public → MariaDB / Postgres / Redis | **No** |
| Developer → `pnpm db:forward` → localhost | Yes (cluster auth required) |
| Developer → D1 via Wrangler / snapshot | Yes (CF account auth) |

---

## 4. Per-product data planes

### EspoCRM (CRM SOR)

```mermaid
flowchart LR
  UI["espocrm.cloudless.gr"] --> App["EspoCRM PHP"]
  App --> MDB[(MariaDB 11<br/>db/user espocrm)]
  App --> Slack["Slack webhooks"]
  MDB -->|CronJob mariadb-dump| R2[(R2 pvc-backups/espocrm)]
```

### AppFlowy (collab SOR + blobs)

```mermaid
flowchart LR
  UI["appflowy.cloudless.gr"] --> Cloud["AppFlowy Cloud"]
  Cloud --> PG[(Postgres 16 + pgvector)]
  Cloud --> Redis[(Redis ephemeral)]
  Cloud --> S3[(MinIO)]
  PG --> GoTrue["GoTrue auth schema"]
  PG -->|pg_dump + WAL-G sidecar| R2[(R2)]
```

### Postiz (social publisher)

```mermaid
flowchart LR
  UI["postiz.cloudless.gr"] --> App["Postiz"]
  App --> PG[(Postgres 17<br/>db/user postiz)]
  App --> Redis[(Redis AOF)]
  PG -->|pg_dump| R2[(R2 pvc-backups/postiz)]
```

### Cloudflare D1 (edge auth / config)

```mermaid
flowchart LR
  Worker["Workers / OpenNext"] --> AUTH["AUTH_DB binding"]
  AUTH --> D1[(user-auth-db · EU)]
  Preview["Preview env"] --> D1p[(auth-db-preview)]
  Orphan[(cloudless-auth)] -.->|empty / unused| X[ ]
  Dev["pnpm db:d1:pull"] -->|export snapshot| Local[".local/db/*.sqlite"]
```

### Embedded SQLite apps

```mermaid
flowchart LR
  N8N["n8n pod"] --> F1["/home/node/.n8n/database.sqlite"]
  Kuma["Uptime Kuma"] --> F2["/app/data/kuma.db"]
  Graf["Grafana"] --> F3["grafana.db on emptyDir"]
  F1 -->|sqlite3 .backup| R2[(R2)]
  F2 -.->|R10c pending| R2
  F3 -.->|disposable| Trash["lost on pod restart"]
```

---

## 5. Backup & recovery posture

```mermaid
gantt
  title Daily logical backups to R2 (UTC)
  dateFormat HH:mm
  axisFormat %H:%M

  section AppFlowy PG
  pg_dump custom     :a1, 03:30, 15m
  section EspoCRM
  mariadb-dump gzip  :a2, 03:45, 15m
  section Postiz PG
  pg_dump custom     :a3, 04:00, 15m
  section n8n
  sqlite3 .backup    :a4, 04:15, 15m
```

| Store | Method | R2 prefix | Gap |
|-------|--------|-----------|-----|
| AppFlowy Postgres | `pg_dump` (+ WAL-G sidecar) | `pvc-backups/appflowy/daily/` | — |
| EspoCRM MariaDB | `mariadb-dump` | `pvc-backups/espocrm/daily/` | — |
| Postiz Postgres | `pg_dump` | `pvc-backups/postiz/daily/` | — |
| n8n SQLite | `sqlite3 .backup` | `pvc-backups/n8n/daily/` | — |
| MinIO | — | — | **R10b** |
| Uptime Kuma | — | — | **R10c** |
| Meilisearch / Redis / Grafana | — | — | rebuild or accept loss |
| D1 | Cloudflare Time Travel / export | — | use `wrangler d1` |

**RPO (covered stores):** ~24h for logical dumps (tighter for AppFlowy if WAL-G continuous path is healthy).  
**RTO:** restore dump into a new PVC + point Service; no automated multi-AZ DB failover (2-node k3s ≠ HA Postgres).

```mermaid
flowchart TB
  Fail["Engine or PVC loss"] --> Snap["Latest R2 object"]
  Snap --> NewPVC["New PVC + restore job"]
  NewPVC --> Verify["App health + row counts"]
  Verify --> Cut["Repoint Deployment / Secret"]
```

---

## 6. Developer access architecture

```mermaid
sequenceDiagram
  participant Dev as Developer Cursor
  participant PF as db:forward
  participant API as kube-apiserver
  participant Svc as ClusterIP Service
  participant Eng as DB engine
  participant ST as SQLTools

  Dev->>PF: pnpm db:forward
  PF->>API: kubectl port-forward
  API->>Svc: stream
  Svc->>Eng: 3306 / 5432 / …
  Dev->>Dev: pnpm db:passwords
  Dev->>ST: connect 127.0.0.1:13306|15432|15433
  ST->>Eng: query via forward

  Note over Dev,ST: SQLite / D1: pull snapshot to .local/db then open file
```

| Local | Engine | Auth source |
|-------|--------|-------------|
| `:13306` | EspoCRM MariaDB | `espocrm-secrets` |
| `:15432` | AppFlowy Postgres | `appflowy-secrets` |
| `:15433` | Postiz Postgres | `postiz-secrets` |
| `.local/db/*.sqlite` | n8n / Kuma / Grafana / D1 | file snapshot |

---

## 7. Capacity & placement notes

```mermaid
flowchart TB
  subgraph Critical["Keep healthy first"]
    sda["sda1 119GB<br/>all local-path PVs + etcd"]
  end
  subgraph Noncritical["May fill without killing k3s"]
    sdb["sdb1 916GB<br/>user backups / media"]
    sd["SD card root<br/>OS only"]
  end

  Alert["Disk pressure on sda1"] --> Action["crictl prune · check PV growth · etcd defrag"]
  Alert2["Disk pressure on sdb1"] --> Action2["prune Windows backup trees"]
```

| Engine | PVC size (declared) | Growth risk |
|--------|---------------------|-------------|
| AppFlowy Postgres | 20Gi | Highest — docs/blobs metadata + pgvector |
| AppFlowy MinIO | 10Gi | Blob growth |
| Meilisearch | 5Gi | Index size |
| n8n | 5Gi | Execution history |
| EspoCRM MariaDB | 4Gi | CRM volume |
| Postiz Postgres | 2Gi | Moderate |
| Postiz Redis | 512Mi | AOF |
| Grafana | none | emptyDir — not durable |

---

## 8. Target-state direction (Cloudflare-first)

AWS-shaped shared DB HA manifests under `infrastructure/database/` are **not live**. Prefer Cloudflare-native durability where the app already runs on Workers:

```mermaid
flowchart LR
  Today["Today<br/>Pi SOR + D1 auth"] --> Next["Migrate app state<br/>that fits edge → D1 / R2 / Queues"]
  Next --> Keep["Keep heavy collab / CRM<br/>on Pi until product move"]
  Keep --> CF["Document blockers in<br/>source-of-truth checklist"]
```

Do not expand AWS RDS / S3 backup paths for new work; R2 + existing CronJobs are the backup plane.

---

## Related

- [omv-cluster.md](omv-cluster.md) — field-level inventory, ports, secrets
- [README.md](README.md) — commands and SQLTools
- [../kubectl-tailscale.md](../kubectl-tailscale.md) — API access
- [../../infrastructure/backup/README.md](../../infrastructure/backup/README.md) — CronJob details
