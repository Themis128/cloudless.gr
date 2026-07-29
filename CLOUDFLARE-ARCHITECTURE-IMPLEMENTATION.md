# Cloudflare Architecture Implementation Plan

## Overview

Replace AWS-dependent infrastructure files with Cloudflare-native alternatives after successful AWS → Cloudflare migration.

## AWS Components to DELETE

These components are no longer needed since migration is 100% complete:

### 1. Athena Analytics (`infrastructure/athena/`)

- `selfhosted.sql` - Athena SQL queries
- **Reason**: Replaced by DuckDB-Wasm + R2 parquet in Workers

### 2. R20 Replication (`infrastructure/r20-replication/`)

- `subscriber.ts` - DynamoDB replication subscriber
- `wal2json-config.yaml` - Postgres→DDB replication config
- `README.md` - AWS DR documentation
- **Reason**: R20 was for AWS cross-region DR; now uses R2 native

### 3. SES-to-EspoCRM Bridge (`infrastructure/ses-to-espocrm/`)

- Lambda function and deploy scripts
- **Reason**: Replaced by Cloudflare Email binding (SES → Email)

### 4. IAM Policies (`infrastructure/iam/`)

- `policies/ses-provisioner.json` - AWS SES permissions
- **Reason**: All IAM roles/polices deprecated

### 5. Backup to S3 (`infrastructure/backup/`)

- `cronjob-appflowy.yaml` - S3 backup target
- `cronjob-espocrm.yaml` - S3 backup target
- `cronjob-n8n.yaml` - S3 backup target
- `cronjob-postiz.yaml` - S3 backup target
- `lifecycle-policy.json` - AWS S3 lifecycle rules
- **Reason**: Replace with R2 backup targets

### 6. K3s Snapshot Mirror (`infrastructure/etcd-backup/`)

- Uses AWS S3 for snapshot storage
- **Reason**: Change to R2 for k3s snapshots

## New Cloudflare Architecture to CREATE

### 1. R2 Backup CronJobs (replacing S3 backups)

```yaml
# infrastructure/backup-r2/
# - cronjob-appflowy-r2.yaml
# - cronjob-espocrm-r2.yaml
# - Uses R2 S3-compatible API instead of AWS
```

### 2. Database Failover Updates

```yaml
# infrastructure/database/postgresql-ha.yaml - UPDATE
# Change backup target from S3 to R2
# Use Cloudflare R2 for WAL archive
```

### 3. K3s Snapshot Updates

```yaml
# infrastructure/etcd-backup/ - UPDATE
# Use R2 instead of S3 for snapshots
```

## Files to Keep AS-IS

### Core Analytics Stack (Cloudflare + k3s)

- `infrastructure/appflowy/` - CMS stack (needs tunnel updates only)
- `infrastructure/n8n/` - Workflow automation
- `infrastructure/espocrm/` - CRM system
- `infrastructure/postiz/` - Social scheduler
- `infrastructure/database/` - PostgreSQL (auth failover)
- `infrastructure/monitoring/` - Analytics stack
- `infrastructure/omv-sdb1/` - 2TB SSD for analytics

## Execution Steps

1. [ ] Delete `infrastructure/athena/` directory
2. [ ] Delete `infrastructure/r20-replication/` directory
3. [ ] Delete `infrastructure/ses-to-espocrm/` directory
4. [ ] Delete `infrastructure/iam/` directory
5. [ ] Update `infrastructure/backup/` to use R2 endpoints
6. [ ] Update `infrastructure/etcd-backup/` for R2 snapshots
7. [ ] Create R2 backup verification script
8. [ ] Update documentation to reflect Cloudflare architecture
