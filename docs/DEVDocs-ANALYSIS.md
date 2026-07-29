# DevDocs Integration Analysis - AWS to Cloudflare Migration & Self-Hosted App Tuning

## Executive Summary

**Updated: 2026-07-17** - This analysis provides a comprehensive cross-reference between:

1. The existing infrastructure manifests (AppFlowy, n8n, Postiz, EspoCRM)
2. DevDocs MCP server capabilities (crawling, extraction, organized knowledge)
3. Outstanding migration tasks and self-hosted app tuning

The goal is to use DevDocs to **accelerate completion of the Cloudflare migration** and **optimize all self-hosted applications** on the omv k3s cluster.

---

## Current Migration Status Matrix

| Component | Status | DevDocs Benefit | Priority |
|-----------|--------|-----------------|----------|
| D1 Auth (Workers) | ✅ Complete | Query D1/PostgreSQL patterns | HIGH |
| R2 Storage | ✅ Complete | Validate R2 parquet setup | MEDIUM |
| Workers AI | ✅ Complete | Optimize AI endpoint patterns | MEDIUM |
| AppFlowy Stack | ⚠️ Partial | DevDocs can extract AppFlowy docs for tuning | HIGH |
| n8n Workflows | ⚠️ Needs import | DevDocs can crawl n8n.io docs for workflow patterns | HIGH |
| EspoCRM Webhooks | ⚠️ Needs config | DevDocs can extract EspoCRM API patterns | HIGH |
| Postiz Analytics | ⚠️ Image pulling | DevDocs can extract Postiz docs for optimization | MEDIUM |
| DuckDB/Metabase | ⚠️ Pending | DevDocs critical for analytics stack | HIGH |

---

## DevDocs MCP Integration Points

### 1. Documentation Sources to Crawl (Priority Order)

```yaml
Phase 1 - Core Migration Completion:
  - https://developers.cloudflare.com/
  - https://developers.cloudflare.com/r2/platform/r2-api
  - https://developers.cloudflare.com/d1/best-practices

Phase 2 - Self-Hosted App Tuning:
  - https://docs.n8n.io/integrations/builtin
  - https://github.com/nocobase/nocobase
  - https://github.com/appflowy-io/appflowy

Phase 3 - Analytics Stack:
  - https://duckdb.org/docs/api
  - https://www.metabase.com/docs/latest/
  - https://postiz.com/docs
```

### 2. Current MCP Servers Cross-Reference

| MCP Server | Used For | DevDocs Enhancement |
|------------|----------|---------------------|
| cloudflare | Workers/R2/D1 API | DevDocs provides docs context |
| playwright | Browser automation | DevDocs provides documentation knowledge |
| docker | Container management | DevDocs provides container optimization patterns |
| tailscale | Network access | DevDocs provides tunnel configuration patterns |

---

## Migration Completion Tasks - DevDocs Accelerated

### Task 1: Complete n8n Analytics Workflows Import

**Current State:** n8n is deployed (k8s.yaml) but workflows need to be imported.

**DevDocs Value:**

- Crawl https://docs.n8n.io/workflows for workflow creation patterns
- Extract Slack integration docs for `#alerts` channel configuration
- Get R2 access patterns for analytics data pipeline

**Action Items:**

- [ ] Use DevDocs to extract n8n workflow best practices
- [ ] Create `funnel-daily-rollup` workflow (Cron → DuckDB → Slack)
- [ ] Create `lead-enrichment` workflow (Webhook → HTTP → EspoCRM)
- [ ] Create `hot-lead-alert` workflow (Score >65 → Slack notification)

### Task 2: EspoCRM Webhook Configuration

**Current State:** EspoCRM namespace created, webhook endpoint defined but not verified.

**DevDocs Value:**

- Extract EspoCRM API patterns for contact/deal creation
- Get webhook payload structure for real-time sync
- Understand EspoCRM field mapping for lead scoring

**Action Items:**

- [ ] Crawl EspoCRM docs via DevDocs for webhook patterns
- [ ] Configure `/api/webhooks/espocrm` with proper authentication
- [ ] Test contact → lead → deal flow end-to-end

### Task 3: DuckDB/Metabase Analytics Stack

**Current State:** Metabase running, DuckDB pending.

**DevDocs Value:**

- Extract DuckDB parquet query patterns for R2 data
- Get Metabase dashboard creation patterns
- Understand SQL views for funnel metrics

**Action Items:**

- [ ] Use DevDocs to get DuckDB-Wasm R2 integration patterns
- [ ] Create `v_funnel_metrics` SQL view
- [ ] Create `v_lead_sources` UTM breakdown view
- [ ] Deploy Metabase dashboard via Helm

---

## Self-Hosted App Tuning - DevDocs Recipes

### AppFlowy Fine-Tuning

**Current Configuration (appflowy-complete.yaml):**

- NodePort: 30810
- PVC: 20Gi
- RAM: 1-2Gi limits

**DevDocs Recipe:**

```sql
-- Query DevDocs for AppFlowy backup optimization patterns
-- Extract WAL-G configuration for continuous backup
-- Get PostgreSQL tuning for ARM64 Pi
```

**Tuning Actions:**

- [ ] Extract AppFlowy backup best practices for 2TB SSD
- [ ] Optimize PostgreSQL connection pooling (pool: min_idle 5 / max_size 20)
- [ ] Configure Tailscale ingress properly for omv-ha offloading

### n8n Performance Tuning

**Current Configuration:**

- Image: n8nio/n8n:2.28.2-arm64 (native ARM)
- RAM: 256Mi request / 1Gi limit
- N8N_RUNNERS_ENABLED=false (reduces memory)

**DevDocs Recipe:**

```yaml
# Query DevDocs for n8n memory optimization patterns
# Extract SQLite tuning for embedded database
# Get webhook throughput settings
```

**Tuning Actions:**

- [ ] Extract n8n memory optimization patterns for Pi 5
- [ ] Configure webhook timeout for Pi latency
- [ ] Set up proper resource limits to prevent OOM

### Postiz Optimization

**Current State:** Redeployed (2026-07-17), waiting for image pull completion.

**DevDocs Recipe:**

- [ ] Extract Postiz media upload optimization for R2
- [ ] Get social media scheduling patterns for analytics
- [ ] Query Postiz API patterns for content pipeline

---

## Cluster Resource Analysis

### Current Headroom (Pi 5 8GB)

| Resource | Used | Available | Target for DevDocs |
|----------|------|-----------|-------------------|
| RAM | 29% (2.4Gi) | ~5.6Gi | 200-400Mi Docker container |
| SSD | 120GB used | 2TB available | Documentation storage |
| CPU | ~30% | ~60% available | Crawling workloads |

### DevDocs Deployment Resource Planning

```yaml
# DevDocs pod resource requirements
resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 400Mi

# Storage for crawled documentation
pvc:
  size: 10Gi
  mount: /app/data
```

---

## Implementation Plan - Using DevDocs MCP

### Week 1: Foundation

```bash
# Day 1: Deploy DevDocs alongside existing services
kubectl apply -f infrastructure/devdocs/k8s.yaml

# Day 2: Crawl Phase 1 docs
# Use DevDocs MCP to extract:
# - Cloudflare D1/R2 best practices
# - n8n workflow patterns
# - k3s deployment optimization
```

### Week 2: Migration Completion

```bash
# Import n8n workflows with DevDocs context
# Configure EspoCRM webhooks
# Validate analytics pipeline
```

### Week 3: Self-Hosted Optimization

```bash
# Use DevDocs for:
# - AppFlowy backup tuning
# - n8n memory patterns
# - Postiz media optimization
# - DuckDB query optimization
```

---

## MCP Server Architecture for DevDocs

```yaml
# Add to /mcp.json
"devdocs": {
  "command": "npx",
  "args": ["-y", "devdocs-mcp"],
  "env": {
    "DEVDOCS_DATA_DIR": "/app/data",
    "DEVDOCS_MAX_DEPTH": "3"
  }
}
```

---

## Success Metrics

| Metric | Target | DevDocs Measurement |
|--------|--------|----------------------|
| n8n workflows imported | 3 | Count via MCP tool |
| EspoCRM webhook response | <1s | Query DevDocs for patterns |
| DuckDB query time | <5s | Extract optimization patterns |
| Postiz media upload | <30s | Get upload tuning patterns |
| AppFlowy backup | <60s | Use DevDocs for WAL-G tuning |

---

## DevDocs Implementation Commands

```bash
# After DevDocs MCP is configured:

# Extract Cloudflare migration patterns
# "How do I optimize D1 queries for 100K+ users?"

# Extract n8n workflow patterns  
# "What are best practices for webhook error handling in n8n?"

# Extract analytics stack patterns
# "How do I query parquet files from DuckDB efficiently?"

# Extract self-hosted tuning patterns
# "How do I optimize PostgreSQL on ARM64 for low memory?"
```

---

## Next Steps

1. **Configure DevDocs MCP Server** in mcp.json
2. **Deploy DevDocs container** alongside existing services
3. **Crawl priority documentation** for migration completion
4. **Import n8n workflows** with DevDocs context
5. **Fine-tune all self-hosted apps** using DevDocs patterns

---

## Cross-References

- `infrastructure/appflowy/appflowy-complete.yaml` - AppFlowy deployment
- `infrastructure/n8n/k8s.yaml` - n8n workflow automation
- `infrastructure/postiz/` - Postiz social scheduler
- `ANALYTICS-IMPLEMENTATION-STRATEGY.md` - Analytics roadmap
- `documentation/master-todo-list.md` - Master TODO list
