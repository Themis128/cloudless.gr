# Analytics Pipeline Implementation

## Overview

This document describes the analytics implementation strategy for the Cloudless.gr k3s cluster, covering the 5-phase deployment plan for building a customer acquisition analytics platform.

## Phase Summary

| Phase | Service | Status | RAM Impact |
|-------|---------|--------|------------|
| 1 | AppFlowy Stack | Ready to deploy | ~700Mi → +16% RAM |
| 2 | n8n Analytics Workflows | Workflows ready | ~1Gi → +10% RAM |
| 3 | EspoCRM Lead Lifecycle | Ready to deploy | ~512Mi-1Gi → +10% RAM |
| 4 | DuckDB + Metabase | Pending | +5-10% RAM |
| 5 | Postiz Social Analytics | Ready to deploy | +512Mi-1Gi → +10% RAM |

## Phase 1: AppFlowy Stack (Week 1-2)

### Deployment Commands

```bash
# Create secrets first (run on omv node)
kubectl create namespace appflowy
kubectl -n appflowy create secret generic appflowy-secrets \
  --from-literal=POSTGRES_PASSWORD="$(openssl rand -hex 32)" \
  --from-literal=GOTRUE_JWT_SECRET="$(openssl rand -hex 64)" \
  --from-literal=GOTRUE_ADMIN_EMAIL="tbaltzakis.themis@gmail.com" \
  --from-literal=GOTRUE_ADMIN_PASSWORD="$(openssl rand -base64 18)" \
  --from-literal=APPFLOWY_S3_ACCESS_KEY="minioadmin" \
  --from-literal=APPFLOWY_S3_SECRET_KEY="minioadmin"

# Deploy
kubectl apply -f infrastructure/appflowy/k8s/appflowy.yaml

# Verify
kubectl get pods -n appflowy -w
kubectl get pvc -n appflowy
kubectl get svc -n appflowy nginx-nodeport  # Should show port 30810
```

### Resource Allocation

| Pod | CPU Request | Memory Request | Memory Limit |
|-----|-------------|--------------|------------|
| postgres | 50m | 200Mi | 400Mi |
| redis | 10m | 16Mi | 64Mi |
| gotrue | 10m | 32Mi | 96Mi |
| appflowy-cloud | 50m | 128Mi | 320Mi |
| appflowy-web | 10m | 48Mi | 96Mi |
| admin-frontend | 10m | 48Mi | 96Mi |
| nginx | 10m | 16Mi | 64Mi |
| minio | 25m | 80Mi | 200Mi |
| appflowy-worker (omv-ha) | 25m | 80Mi | 200Mi |

**Total RAM estimate: ~700Mi**

## Phase 2: n8n Analytics Workflows (Week 2-3)

### Deployment Commands

```bash
# Deploy n8n
kubectl apply -f infrastructure/n8n/k8s.yaml

# Verify
kubectl get pods -n n8n -w
kubectl get svc -n n8n n8n  # Should show NodePort 30900
```

### Available Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `lead-enrich.json` | Webhook | Round-robin owner assignment, update EspoCRM, Slack DM |
| `newsletter-nurture.json` | Webhook | Tag contacts in EspoCRM, add to nurture sequence |
| `postiz-utm-guard.json` | Webhook | Check post URLs for UTM params, alert #campaigns if missing |
| `funnel-daily-rollup.json` | Cron (daily) | Fetch analytics, post digest to #analytics, upload to DuckDB |
| `hot-lead-alert.json` | Webhook | Alert #notifications when lead score >65 |
| `rfm-cohort-update.json` | Cron (weekly) | Trigger RFM compute, post results to #analytics |

### Operator Bootstrap for Analytics Workflows

```bash
# After importing workflows in n8n UI:
aws ssm put-parameter \
  --name /cloudless/production/N8N_WORKFLOW_FUNNEL_DAILY_ROLLUP_ID \
  --type String --value '<UUID>' --overwrite

aws ssm put-parameter \
  --name /cloudless/production/N8N_WORKFLOW_HOT_LEAD_ALERT_ID \
  --type String --value '<UUID>' --overwrite

aws ssm put-parameter \
  --name /cloudless/production/N8N_WORKFLOW_RFM_COHORT_ID \
  --type String --value '<UUID>' --overwrite
```

## Phase 3: EspoCRM Lead Lifecycle (Week 3-4)

### Deployment Commands

```bash
# Create secrets first
kubectl create namespace espocrm
kubectl -n espocrm create secret generic espocrm-secrets \
  --from-literal=mariadb-root-password="$(openssl rand -hex 24)" \
  --from-literal=mariadb-password="$(openssl rand -hex 24)" \
  --from-literal=admin-username="admin" \
  --from-literal=admin-password="$(openssl rand -hex 16)"

# Deploy
kubectl apply -f infrastructure/espocrm/k8s/espocrm.yaml

# Verify
kubectl get pods -n espocrm -w
kubectl get svc -n espocrm espocrm  # Should show NodePort 30700
```

### Webhooks Configuration

| Endpoint | Event | Integration |
|----------|-------|------------|
| `/api/webhooks/espocrm` | Contact Created | Slack #contacts |
| `/api/webhooks/espocrm` | Deal Created | Lead scoring + R2 log |
| `/api/webhooks/espocrm` | Deal Won | Stripe webhook correlation |

## Phase 4: Analytics Stack (Week 4-5)

### DuckDB Integration

DuckDB runs on the 2TB SSD (sdb1) and queries parquet files from R2.

```bash
# Current S3 buckets (R2/Datalake)
# - cloudless-analytics (main analytics bucket)
# - datalake-bucket (legacy, mirrors cloudless-analytics)

# R2 bucket structure:
# lake/
#   transactions/transactions.parquet  (Stripe data via stripe-to-lake.mjs)
#   clients/clients.parquet              (Cognito + portals + scores via clients-to-lake.mjs)
#   leads/leads.parquet                  (EspoCRM leads via espocrm-to-lake.mjs)
#   gsc/                                 (Google Search Console via gsc-to-lake.mjs)
# ml-parquet/
#   scores_rfm.parquet                   (RFM scores via compute-rfm-churn.mjs)
#   scores_churn.parquet                 (Churn risk via compute-rfm-churn.mjs)
```

### Metabase Views

Create these views in Metabase after connecting to DuckDB/R2:

```sql
-- v_funnel_metrics: Daily leads → SQL → customers
CREATE OR REPLACE VIEW v_funnel_metrics AS
SELECT
  date,
  visitors,
  leads,
  mql,
  sql,
  opportunities,
  customers,
  revenue,
  conversionRate
FROM funnel_daily
ORDER BY date DESC;

-- v_lead_sources: UTM breakdown
CREATE OR REPLACE VIEW v_lead_sources AS
SELECT
  utm_source,
  utm_campaign,
  COUNT(*) as lead_count,
  COUNT(CASE WHEN deal_id IS NOT NULL THEN 1 END) as converted_count
FROM leads
GROUP BY utm_source, utm_campaign
ORDER BY lead_count DESC;

-- v_deal_velocity: Time in stage
CREATE OR REPLACE VIEW v_deal_velocity AS
SELECT
  stage,
  AVG(time_in_stage_days) as avg_days,
  PERCENTILE_CONT(0.5, time_in_stage_days) as median_days
FROM deal_history
GROUP BY stage;

-- v_clv_cohorts: Monthly cohort analysis
CREATE OR REPLACE VIEW v_clv_cohorts AS
SELECT
  signup_month,
  COUNT(DISTINCT email) as customers,
  AVG(rfm_score) as avg_rfm,
  AVG(churn_risk) as avg_churn,
  SUM(lifetime_value) as total_ltv
FROM clients
GROUP BY signup_month
ORDER BY signup_month DESC;
```

## Phase 5: Postiz Social Analytics (Week 5-6)

### Deployment Commands

```bash
# Create secrets first
kubectl create namespace postiz
kubectl -n postiz create secret generic postiz-secrets \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=POSTGRES_PASSWORD="$(openssl rand -hex 32)"

# Deploy
kubectl apply -f infrastructure/postiz/k8s/postiz.yaml

# Verify
kubectl get pods -n postiz -w
kubectl get svc -n postiz postiz  # Should show NodePort 30500
```

### Engagement Metrics Export

Postiz tracks social media engagement that feeds into the analytics pipeline:

| Metric | Source | Destination |
|--------|--------|-------------|
| Posts published | Postiz DB | S3 `lake/social/` parquet |
| Engagement rate | Postiz DB | S3 `lake/social/` parquet |
| Click-through rate | Postiz DB | S3 `lake/social/` parquet |

## Verification Scripts

### verify-analytics.sh

Checks all analytics-related services and their status:

```bash
./scripts/verify-analytics.sh          # One-time check
./scripts/verify-analytics.sh --watch  # Continuous monitoring
```

### refresh-metabase.sh

Triggers ETL sync and Metabase refresh:

```bash
./scripts/refresh-metabase.sh --sync-only    # Run ETL scripts only
./scripts/refresh-metabase.sh --dashboards   # Trigger Metabase refresh
./scripts/refresh-metabase.sh                  # Full pipeline
```

## Resource Checkpoints

After each deployment, run verification:

```bash
# Check RAM usage
kubectl top nodes

# Expected RAM after full deployment:
# - Baseline: 29% (before any analytics services)
# - +AppFlowy: 45%
# - +n8n: 55%
# - +EspoCRM: 65%
# - +Analytics: 70%
# - +Postiz: 80%+ (evaluate if 3rd node needed)
```

## ETL Scripts

Located in `scripts/etl/`:

| Script | Purpose | Schedule |
|--------|---------|----------|
| `stripe-to-lake.mjs` | Stripe → transactions.parquet | Daily |
| `clients-to-lake.mjs` | Cognito + portals → clients.parquet | Daily |
| `compute-rfm-churn.mjs` | Compute RFM + churn scores | Daily |
| `espocrm-to-lake.mjs` | EspoCRM leads/deals → leads.parquet | Daily |
| `gsc-to-lake.mjs` | GSC clicks/impressions → gsc.parquet | Daily |
| `postiz-to-lake.mjs` | Postiz engagement → social.parquet | Daily |

## Next Steps

1. **Deploy Phase 1 (AppFlowy)**: Run deployment commands above
2. **Monitor resources**: Verify RAM stays under 75%
3. **Deploy Phase 2 (n8n)**: Import workflows, configure SSM parameters
4. **Deploy Phase 3 (EspoCRM)**: Configure webhooks, test lead flow
5. **Deploy Phase 4 (DuckDB/Metabase)**: Connect to R2, create views
6. **Deploy Phase 5 (Postiz)**: Configure social integrations

## Troubleshooting

### Common Issues

1. **Pod stuck in Pending**: Check node taints and resource quotas

   ```bash
   kubectl describe pod -n <namespace> <pod-name>
   kubectl describe nodes  # Check taint tolerations
   ```

2. **PVC pending**: Check local-path storage

   ```bash
   kubectl get pvc -A
   ssh omv 'df -h /srv'  # Check SSD space
   ```

3. **Workflow not triggering**: Check n8n webhook URL and SSM IDs

   ```bash
   aws ssm get-parameter --name /cloudless/production/N8N_WORKFLOW_*/ --with-decryption
