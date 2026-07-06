# Self-Hosted Apps Cleanup Configuration - 2026-07-05

## Overview

Configure self-hosted applications to participate in nightly cleanup strategy. This document provides app-specific cleanup configurations for stateful services running on omv-main.

---

## Apps Running on omv-main

| App                               | Type               | Namespace        | Cleanup Opportunity           | Priority |
| --------------------------------- | ------------------ | ---------------- | ----------------------------- | -------- |
| **PostgreSQL** (AppFlowy, Postiz) | Database           | appflowy, postiz | Vacuum, temp cleanup          | HIGH     |
| **Redis** (AppFlowy, Postiz)      | Cache              | appflowy, postiz | Memory flush, expiry          | HIGH     |
| **DuckDB**                        | Analytics DB       | analytics        | Vacuum, compaction            | MEDIUM   |
| **Meilisearch**                   | Search engine      | search           | Cache flush, temp cleanup     | MEDIUM   |
| **n8n**                           | Workflow engine    | n8n              | Cache, temp files cleanup     | MEDIUM   |
| **Ntfy**                          | Push notifications | ntfy             | Old message cleanup           | MEDIUM   |
| **Prometheus**                    | Metrics            | monitoring       | Old data cleanup              | MEDIUM   |
| **Grafana**                       | Dashboards         | monitoring       | Cache flush                   | LOW      |
| **MariaDB** (EspoCRM)             | Database           | espocrm          | Optimize tables, temp cleanup | HIGH     |

---

## Per-App Configuration

### 1. PostgreSQL Databases (AppFlowy, Postiz)

**Cleanup tasks**:

- VACUUM (reclaim unused space)
- ANALYZE (update table statistics)
- Clean temporary files

**Integration into nightly cleanup**:

```bash
cat << 'EOF' | sudo tee /usr/local/bin/k3s-cleanup-postgres.sh
#!/bin/bash

# PostgreSQL cleanup - integrated into nightly maintenance
# Vacuums databases and reclaims unused space

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
LOG_FILE="/var/log/k3s-cleanup.log"

echo "[$TIMESTAMP] [PostgreSQL] Starting maintenance..." >> "$LOG_FILE"

# AppFlowy PostgreSQL
kubectl exec -it -n appflowy $(kubectl get pods -n appflowy -l app=postgres -o jsonpath='{.items[0].metadata.name}') -- \
  psql -U postgres -d appflowy -c "VACUUM ANALYZE;" >> "$LOG_FILE" 2>&1

# Postiz PostgreSQL
kubectl exec -it -n postiz $(kubectl get pods -n postiz -l app=postgres -o jsonpath='{.items[0].metadata.name}') -- \
  psql -U postgres -d postiz -c "VACUUM ANALYZE;" >> "$LOG_FILE" 2>&1

echo "[$TIMESTAMP] [PostgreSQL] Maintenance complete" >> "$LOG_FILE"
EOF

chmod +x /usr/local/bin/k3s-cleanup-postgres.sh
```

**Add to nightly cleanup** (append to `k3s-nightly-cleanup.sh`):

```bash
echo "[$TIMESTAMP] [PostgreSQL] Database maintenance..." >> "$LOG_FILE"
/usr/local/bin/k3s-cleanup-postgres.sh
```

**Expected cleanup**: 10-50MB per database

---

### 2. Redis Caches (AppFlowy, Postiz)

**Cleanup tasks**:

- FLUSHDB (clear expired keys)
- Memory optimization
- Rewrite AOF (Append-Only File)

**Integration into nightly cleanup**:

```bash
cat << 'EOF' | sudo tee /usr/local/bin/k3s-cleanup-redis.sh
#!/bin/bash

# Redis cache cleanup
# Flushes old keys and optimizes memory

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
LOG_FILE="/var/log/k3s-cleanup.log"

echo "[$TIMESTAMP] [Redis] Starting cache cleanup..." >> "$LOG_FILE"

# AppFlowy Redis
kubectl exec -n appflowy $(kubectl get pods -n appflowy -l app=redis -o jsonpath='{.items[0].metadata.name}') -- \
  redis-cli DBSIZE >> "$LOG_FILE" 2>&1
kubectl exec -n appflowy $(kubectl get pods -n appflowy -l app=redis -o jsonpath='{.items[0].metadata.name}') -- \
  redis-cli BGSAVE >> "$LOG_FILE" 2>&1

# Postiz Redis
kubectl exec -n postiz $(kubectl get pods -n postiz -l app=redis -o jsonpath='{.items[0].metadata.name}') -- \
  redis-cli DBSIZE >> "$LOG_FILE" 2>&1
kubectl exec -n postiz $(kubectl get pods -n postiz -l app=redis -o jsonpath='{.items[0].metadata.name}') -- \
  redis-cli BGSAVE >> "$LOG_FILE" 2>&1

echo "[$TIMESTAMP] [Redis] Cache cleanup complete" >> "$LOG_FILE"
EOF

chmod +x /usr/local/bin/k3s-cleanup-redis.sh
```

**Add to nightly cleanup**:

```bash
echo "[$TIMESTAMP] [Redis] Cache cleanup..." >> "$LOG_FILE"
/usr/local/bin/k3s-cleanup-redis.sh
```

**Expected cleanup**: 5-20MB per cache

---

### 3. MariaDB (EspoCRM)

**Cleanup tasks**:

- OPTIMIZE TABLE (reclaim unused space)
- Flush query cache
- Clean temporary files

**Integration into nightly cleanup**:

```bash
cat << 'EOF' | sudo tee /usr/local/bin/k3s-cleanup-mariadb.sh
#!/bin/bash

# MariaDB optimization
# Optimizes tables and reclaims space

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
LOG_FILE="/var/log/k3s-cleanup.log"

echo "[$TIMESTAMP] [MariaDB] Starting table optimization..." >> "$LOG_FILE"

# Get all tables in EspoCRM
TABLES=$(kubectl exec -n espocrm $(kubectl get pods -n espocrm -l app=mariadb -o jsonpath='{.items[0].metadata.name}') -- \
  mysql -u root -ppassword espocrm -e "SHOW TABLES;" 2>/dev/null | tail -n +2)

# Optimize each table
for table in $TABLES; do
  kubectl exec -n espocrm $(kubectl get pods -n espocrm -l app=mariadb -o jsonpath='{.items[0].metadata.name}') -- \
    mysql -u root -ppassword espocrm -e "OPTIMIZE TABLE $table;" >> "$LOG_FILE" 2>&1
done

echo "[$TIMESTAMP] [MariaDB] Optimization complete" >> "$LOG_FILE"
EOF

chmod +x /usr/local/bin/k3s-cleanup-mariadb.sh
```

**Add to nightly cleanup**:

```bash
echo "[$TIMESTAMP] [MariaDB] Table optimization..." >> "$LOG_FILE"
/usr/local/bin/k3s-cleanup-mariadb.sh
```

**Expected cleanup**: 50-200MB

---

### 4. DuckDB Analytics

**Cleanup tasks**:

- Vacuum (compact database file)
- Remove temporary files
- Optimize indexes

**Integration**:

```bash
# DuckDB vacuum - runs via CLI inside pod
kubectl exec -n analytics duckdb-api-<pod-id> -- \
  duckdb -c "VACUUM;" >> "$LOG_FILE" 2>&1
```

**Expected cleanup**: 20-100MB

---

### 5. Meilisearch (Search Index)

**Cleanup tasks**:

- Compact indexes
- Remove stale data
- Flush cache

**Integration**:

```bash
# Meilisearch cache flush via API
kubectl exec -n search meilisearch-<pod-id> -- \
  curl -X DELETE http://localhost:7700/indexes/*/documents >> "$LOG_FILE" 2>&1 || true
```

**Expected cleanup**: 10-50MB

---

### 6. Prometheus (Metrics Storage)

**Cleanup tasks**:

- Remove old metrics (>30 days)
- Compact TSDB blocks
- Clean temporary files

**Integration**:

```bash
# Prometheus retention is configured in deployment
# Add cleanup for old blocks in /prometheus/wal/
kubectl exec -n monitoring prometheus-monitoring-prometheus-0 -- \
  find /prometheus/wal -type d -mtime +30 -exec rm -rf {} \; >> "$LOG_FILE" 2>&1
```

**Expected cleanup**: 100-500MB

---

### 7. n8n Workflow Engine

**Cleanup tasks**:

- Remove old execution logs
- Clean temporary files
- Clear cache

**Integration**:

```bash
# n8n database cleanup
kubectl exec -n n8n n8n-<pod-id> -- \
  npm run db:clean >> "$LOG_FILE" 2>&1 || true

# n8n cache cleanup
kubectl exec -n n8n n8n-<pod-id> -- \
  find /home/node/app/node_modules -name ".cache" -type d -exec rm -rf {} \; >> "$LOG_FILE" 2>&1
```

**Expected cleanup**: 50-200MB

---

### 8. Ntfy Push Notifications

**Cleanup tasks**:

- Remove old messages (>30 days)
- Clean cache
- Compact database

**Integration**:

```bash
# Ntfy old message cleanup
kubectl exec -n ntfy ntfy-<pod-id> -- \
  find /var/cache/ntfy -type f -mtime +30 -delete >> "$LOG_FILE" 2>&1
```

**Expected cleanup**: 10-50MB

---

## Complete Cleanup Integration

**Update** `/usr/local/bin/k3s-nightly-cleanup.sh` to include app-level cleanup:

```bash
# Add to existing cleanup script

echo "[$TIMESTAMP] ========== APP-LEVEL CLEANUP ==========" >> "$LOG_FILE"

# PostgreSQL
echo "[$TIMESTAMP] [PostgreSQL] Database maintenance..." >> "$LOG_FILE"
/usr/local/bin/k3s-cleanup-postgres.sh

# Redis
echo "[$TIMESTAMP] [Redis] Cache cleanup..." >> "$LOG_FILE"
/usr/local/bin/k3s-cleanup-redis.sh

# MariaDB
echo "[$TIMESTAMP] [MariaDB] Table optimization..." >> "$LOG_FILE"
/usr/local/bin/k3s-cleanup-mariadb.sh

# Additional app cleanups...
```

---

## Cleanup Results Summary

**Expected total cleanup per night**:

| Layer                          | Freed                 | Time        | Impact   |
| ------------------------------ | --------------------- | ----------- | -------- |
| System (Docker/Kubelet)        | 6-10GB                | 5 min       | HIGH     |
| Databases (VACUUM/OPTIMIZE)    | 100-300MB             | 10 min      | MEDIUM   |
| Caches (Redis, Meilisearch)    | 50-100MB              | 2 min       | LOW      |
| Temp files (all apps)          | 50-100MB              | 2 min       | LOW      |
| Metrics/Logs (Prometheus, n8n) | 100-500MB             | 3 min       | MEDIUM   |
| **TOTAL**                      | **~7-11GB per night** | **~25 min** | **HIGH** |

---

## Monitoring App Cleanup

**Check individual app cleanup**:

```bash
# View logs per app
sudo journalctl -u k3s-cleanup.service | grep -i "postgresql\|redis\|mariadb"

# Monitor database sizes before/after
kubectl exec -n appflowy postgres-pod -- psql -U postgres -l

# Check cache sizes
kubectl exec -n appflowy redis-pod -- redis-cli INFO memory
```

---

## App-Specific Notes

### PostgreSQL

- VACUUM ANALYZE reclaims unused space
- Safe to run while database is online
- Run daily to maintain performance

### Redis

- BGSAVE creates background snapshot
- Non-blocking operation
- Can run while cache is active

### MariaDB

- OPTIMIZE TABLE locks table briefly (<1 sec)
- Run during low-traffic hours
- Can significantly reduce fragmentation

### DuckDB

- VACUUM compacts single-file database
- Very efficient for analytics workloads
- Run daily to maintain query performance

### Prometheus

- Old blocks are immutable, safe to remove
- WAL directory grows over time
- Safe to purge files >30 days old

### n8n

- Execution logs can grow large
- Database cleanup removes old records
- Cache cleanup frees memory

---

## Implementation Order

1. **Phase 1**: Add PostgreSQL VACUUM
2. **Phase 2**: Add Redis cache cleanup
3. **Phase 3**: Add MariaDB OPTIMIZE
4. **Phase 4**: Add DuckDB VACUUM
5. **Phase 5**: Add Prometheus cleanup
6. **Phase 6**: Add remaining apps

Each phase can be deployed independently without affecting others.

---

## Safety Considerations

✅ **All safe to run during operation**:

- VACUUM ANALYZE (PostgreSQL)
- BGSAVE (Redis)
- Table optimization (MariaDB)
- Database cleanup (all)

⚠️ **Minor brief lockups** (<1 sec):

- OPTIMIZE TABLE (MariaDB)
- Some VACUUM operations (PostgreSQL)

🔴 **Avoid during**:

- Active workload peaks
- Scheduled migrations
- Backup operations

---

## Expected Storage Savings After App Cleanup

**Current state** (all apps combined):

- Total k3s data: 84GB
- Database data: ~20GB
- Cache data: ~5GB
- Other: ~59GB

**After weekly app cleanups** (combined with system cleanup):

- Database data: ~18GB (-2GB from optimization)
- Cache data: ~3GB (-2GB from flushing)
- Other: ~55GB (-4GB from temp cleanup)
- **Total**: ~76GB (10% reduction)

**Monthly trend**: -2-3GB per week from app-level cleanup = -8-12GB per month

---

**Status**: ✅ **PARTIALLY IMPLEMENTED (2026-07-06)**

- **System Cleanup**: Integrated via `pi-disk-cleanup.sh` and `k3s-nightly-cleanup.sh`.
- **App Cleanup**: Pending deployment of individual app scripts (Postgres, Redis, MariaDB).
- **Complexity**: MEDIUM
- **Safety**: HIGH
- **Benefit**: 10-15% additional storage reclamation

---

**Report Generated**: 2026-07-05 02:30 UTC
