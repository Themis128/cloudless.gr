# Fly.io Analytics Stack Deployment

## Overview

This directory contains configuration for deploying Metabase analytics on Fly.io, part of the Tier 2 Analytics Services in the Cloudflare + Fly.io migration strategy.

## Deployment Steps

### 1. Create Volume for Metabase Data

```bash
# Create persistent volume for Metabase SQLite database
fly volumes create metabase_data --size 1 --region fra
```

### 2. Deploy Metabase

```bash
# Deploy the analytics stack
fly deploy --app cloudless-analytics --config fly-analytics.toml

# Or first create the app
fly apps create cloudless-analytics --org cloudless
fly deploy --app cloudless-analytics
```

### 3. Configure Secrets

```bash
# Set R2 credentials for parquet access (optional)
fly secrets set R2_ACCESS_KEY_ID=your-key \
  R2_SECRET_ACCESS_KEY=your-secret \
  --app cloudless-analytics
```

### 4. Generate Analytics Token

After deployment, visit the Metabase URL and create an admin account. Then:

```bash
# Get the Fly.io app URL
fly status --app cloudless-analytics

# The URL will be https://cloudless-analytics.fly.dev
# Configure Metabase to connect to R2 parquet files via DuckDB
```

## Architecture

```
Cloudflare Workers (Primary)
├── Analytics Engine → Real-time metrics (10M records/month free)
├── R2 → Parquet storage (datalake-bucket)
│
Fly.io Analytics (Secondary)
└── Metabase → SQL analytics dashboard
    └── DuckDB → Queries parquet from R2
```

## DuckDB Integration

Metabase can connect to R2-hosted parquet files using DuckDB:

1. In Metabase, add a **DuckDB** database
2. Configure the parquet path: `r2://datalake-bucket/analytics/`
3. Create views for:
   - `v_funnel_metrics` - Daily leads → SQL → customers
   - `v_lead_sources` - UTM breakdown
   - `v_deal_velocity` - Time in stage
   - `v_clv_cohorts` - Monthly cohort analysis

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `MB_DB_FILE` | SQLite database location |
| `TZ` | Timezone (Europe/Athens) |
| `DUCKDB_PARQUET_PATH` | Path to parquet data |
| `DUCKDB_R2_ENDPOINT` | R2 endpoint URL |

## Resource Allocation

- **CPU**: 1 shared (ARM64 compatible)
- **Memory**: 1GB
- **Storage**: 1GB persistent volume

## Health Check

The health endpoint `/api/health` is provided by Metabase's built-in health check at `/api/health`.

## Local Development

```bash
# Run Metabase locally with Docker
docker run -d -p 3000:3000 \
  -e MB_DB_FILE=/metabase-data/metabase.db \
  -v ./metabase-data:/metabase-data \
  metabase/metabase:v0.53.3
```

## Troubleshooting

### Check Logs
```bash
fly logs --app cloudless-analytics
```

### Restart App
```bash
fly restart --app cloudless-analytics
```

### Scale Resources
```bash
# Note: Free tier has limits
# Upgrade if needed:
fly scale memory 2048 --app cloudless-analytics