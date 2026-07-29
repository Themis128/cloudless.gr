# Analytics Implementation Strategy

## Overview

Step-by-step pod deployment plan for building a customer acquisition analytics platform on the omv k3s cluster. This analytics stack complements the Cloudflare Workers migration, providing deeper insights via DuckDB, Metabase, and workflow automation.

---

## Phase 1: AppFlowy Stack (Week 1-2)

### Step 1: Deploy Core Services (Day 1)

```bash
# Apply namespace + secrets first
kubectl apply -f infrastructure/appflowy/k8s/appflowy.yaml --dry-run=client -o yaml | head -50
kubectl apply -f infrastructure/appflowy/k8s/appflowy.yaml

# Monitor rollout
kubectl get pods -n appflowy -w
kubectl top nodes
```

| Pod | Command | Resource Target |
|-----|---------|-----------------|
| postgres | `kubectl get pods -n appflowy -l app=postgres` | 200Mi RAM |
| redis | `kubectl get pods -n appflowy -l app=redis` | 64Mi RAM |

### Step 2: Deploy Auth + API (Day 1-2)

| Pod | Command | Resource Target |
|-----|---------|-----------------|
| gotrue | `kubectl get pods -n appflowy -l app=gotrue` | 96Mi RAM |
| appflowy-cloud | `kubectl get pods -n appflowy -l app=appflowy-cloud` | 320Mi RAM |

### Step 3: Deploy Frontend + Router (Day 2)

| Pod | Command | Resource Target |
|-----|---------|-----------------|
| appflowy-web | `kubectl get pods -n appflowy -l app=appflowy-web` | 96Mi RAM |
| admin-frontend | `kubectl get pods -n appflowy -l app=admin-frontend` | 96Mi RAM |
| nginx | `kubectl get pods -n appflowy -l app=nginx` | 64Mi RAM |

### Step 4: Offload Worker (Day 2)

| Pod | Command | Target Node |
|-----|---------|-------------|
| appflowy-worker | `kubectl get pods -n appflowy -l app=appflowy-worker` | omv-ha (NoSchedule taint allows this) |

### Verification

```bash
kubectl get pvc -n appflowy  # Should show appflowy-postgres, appflowy-minio
kubectl get svc -n appflowy nginx-nodeport  # Port 30810
```

---

## Phase 2: n8n Analytics Workflows (Week 2-3)

### Step 1: Deploy n8n

```bash
kubectl apply -f infrastructure/n8n/k8s.yaml
kubectl get pods -n n8n -w
```

### Step 2: Create Analytics Workflows

| Workflow | Trigger | Action |
|----------|---------|--------|
| `funnel-daily-rollup` | Cron (midnight) | Query R2 parquet → DuckDB → Metabase |
| `lead-enrichment` | Webhook | Lookup company → Update EspoCRM |
| `hot-lead-alert` | Webhook | Score >65 → Slack #notifications |
| `rfm-cohort-update` | Cron (weekly) | Recency/Frequency/Monetary scoring |

### Step 3: Connect to Data Lake

```bash
# Use existing R2 buckets
BUCKETS: cloudless-analytics, datalake-bucket
# Add n8n credentials for R2 access
```

---

## Phase 3: EspoCRM Lead Lifecycle (Week 3-4)

### Step 1: Deploy EspoCRM

```bash
kubectl apply -f infrastructure/espocrm/k8s/
kubectl get pods -n espocrm -w
```

### Step 2: Configure Webhooks

| Endpoint | Event | Integration |
|----------|-------|------------|
| /api/webhooks/espocrm | Contact Created | Slack #contacts |
| /api/webhooks/espocrm | Deal Created | Lead scoring + R2 log |
| /api/webhooks/espocrm | Deal Won | Stripe webhook correlation |

### Step 3: Lead Scoring Pipeline

```
Contact Form → scoreLead() → Band (hot/warm/cold)
    ↓
D1 admin_notification (with score)
    ↓
EspoCRM webhook → Deal stage
    ↓
Slack alert (🔥 hot / 🌤️ warm / ❄️ cold)
```

---

## Phase 4: Analytics Stack (Week 4-5)

### Step 1: DuckDB Integration

| Service | Storage | Purpose |
|---------|---------|---------|
| DuckDB | 50Gi (2TB SSD) | Parquet query engine |
| Parquet files | R2/datalake-bucket | Partition: year/month/day |

### Step 2: Metabase Dashboard

```bash
# Deploy Metabase for SQL analytics
kubectl apply -f infrastructure/analytics/metabase.yaml
```

### Step 3: Create Views

| View | Query |
|------|-------|
| `v_funnel_metrics` | Daily leads → SQL → customers |
| `v_lead_sources` | UTM breakdown |
| `v_deal_velocity` | Time in stage |
| `v_clv_cohorts` | Monthly cohort analysis |

---

## Phase 5: Postiz Social Analytics (Week 5-6)

### Step 1: Deploy Postiz

```bash
kubectl apply -f infrastructure/postiz/
```

### Step 2: Configure 2TB SSD Storage

| PVC | Size | Mount |
|-----|------|-------|
| postiz-postgres | 20Gi | /var/lib/postgresql/data |
| postiz-media | 50Gi | /var/lib/postiz/uploads |

### Step 3: Connect to Analytics

| Integration | Purpose |
|-------------|---------|
| R2 parquet | Export engagement metrics |
| DuckDB | Social performance analysis |
| Metabase | Engagement dashboard |

---

## Resource Checkpoints

| Phase | RAM After | CPU After | Notes |
|-------|-----------|-----------|-------|
| Baseline | 29% | ~30% | Running pods |
| +AppFlowy | 45% | ~40% | Phase 1 complete |
| +n8n | 55% | ~50% | Phase 2 complete |
| +EspoCRM | 65% | ~60% | Phase 3 complete |
| +Analytics | 70% | ~65% | DuckDB + Metabase |
| +Postiz | 80%+ | ~70% | Needs evaluation |

---

## Analytics Implementation Commands

```bash
# After each deployment, run verification
./scripts/verify-analytics.sh

# DuckDB parquet export (daily)
npx tsx etl/analytics-to-parquet.ts

# Lead cohort analysis
npx tsx etl/lead-rfm-calc.ts

# Sales dashboard refresh
./scripts/refresh-metabase.sh
```

---

## Cluster Resource Analysis

### Current Available Headroom (Pi 5 8GB)

- Used: 2.4Gi RAM (29%)
- Available: ~5.6Gi RAM
- All services can fit with room to spare

### Storage Allocation (2TB SSD)

```
/ (sda1 120GB) - Operating System + AppFlowy MinIO
/sdb1 (2TB) - Dedicated analytics storage
├── DuckDB parquet files (50Gi)
├── Postiz media uploads (20Gi)
├── Backup archive (100Gi+)
└── Future expansion
```

---

## Data Flow Architecture

```
Cloudflare Workers (Primary)
├── Auth events → D1
├── Analytics events → R2/datalake-bucket/parquet
├── DuckDB-Wasm client queries
│
v8
Fly.io Failover (Secondary)
└── Routes to Pi/k3s for redundancy
    ├── EspoCRM (lead lifecycle)
    ├── n8n (workflow automation)
    ├── Metabase (dashboards)
    └── DuckDB (deep analytics)
```

---

## Integration Points

### Cloudflare Workers → k3s Analytics

| Workers Event | k8s Consumer | Action |
|---------------|--------------|--------|
| contact form submit | n8n webhook | Lead enrichment |
| newsletter subscribe | n8n webhook | Tag assignment |
| stripe webhook | n8n workflow | Revenue attribution |
| chat start | n8n webhook | Engagement scoring |

### Schedule Alignment

| Workers Cron | k8s Counterpart | Sync Point |
|--------------|-----------------|-----------|
| gsc-cache-refresh (hourly) | Metabase query cache | Shared R2 data |
| analytics-rollup (daily) | DuckDB parquet gen | Data freshness |
| voice-brief (Mondays) | n8n workflow | Content pipeline |

---

## Deployment Checklist

- [x] AppFlowy namespace created
- [x] AppFlowy PVC claims configured (30Gi total)
- [x] AppFlowy pods running (postgres, redis, gotrue, cloud, web, admin, nginx, worker)
- [x] n8n namespace created
- [ ] n8n analytics workflows imported
- [x] EspoCRM namespace created
- [ ] EspoCRM webhooks configured
- [x] Analytics namespace with DuckDB/Metabase (Metabase running, DuckDB pending)
- [ ] 2TB SSD mounted and configured
- [ ] R2 → DuckDB sync verified
- [ ] Metabase dashboards created
- [x] Postiz deployed (fixing node selector: omv-main → omv)
- [ ] Postiz-liteLLM service deployed (optional - AI features)
- [ ] Postiz Cloudflare Tunnel configured
- [ ] Postiz PVC claims completed (currently pending - node selector fix in progress)

## Completed Today (2026-07-17)

### Fixed Issues

- **Postiz node selector**: Changed `omv-main` → `omv` in both values.yaml and values-prod.yaml
- **Postiz redeployed**: Helm upgrade completed successfully, postgres/redis running
- **Postiz IngressRoute**: Applied traefik ingress route for postiz.cloudless.gr

### Pending/Blocked

- **cloudless-app (Pi)**: ImagePullBackOff - 403 Forbidden from ECR (AWS migration complete, Workers is primary)
- **Postiz main pod**: Still pulling image (ghcr.io/gitroomhq/postiz-app:v2.11.2) - large image, will take time
