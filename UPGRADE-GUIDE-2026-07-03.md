# App Upgrade Guide - 2026-07-03

**Report Date:** 2026-07-03  
**Cluster Status:** Monitoring Phase (Day 1/7)  
**Recommendation:** Wait until 2026-07-10 for critical upgrades

---

## TL;DR - Quick Answer

**12 apps can be upgraded** across 3 risk categories:

| Risk Level | Apps | Recommended Timing |
|-----------|------|------------------|
| 🟢 **LOW** (7 apps) | EspoCRM, Node-Exporter, Blackbox, KSM, Operator, Cloudwatch, Promtail | Anytime |
| 🟡 **MEDIUM** (3 apps) | n8n, Prometheus, Loki | Wait until 2026-07-10 |
| 🔴 **HIGH** (1 app) | AlertManager | Wait for investigation |

---

## Detailed App-by-App Analysis

### 🟢 LOW RISK UPGRADES (Can do anytime)

#### 1. **EspoCRM** - CRM System
```
Current:     espocrm/espocrm:9
Latest:      9.x.x (check for 9.4+)
Risk:        LOW
Status:      ✅ Healthy (12d uptime)
Downtime:    ~2 minutes (single pod rollout)

Upgrade:
$ kubectl set image deployment/espocrm -n espocrm \
  espocrm=espocrm/espocrm:9-latest
```

#### 2. **Node-Exporter** - Metrics Collection
```
Current:     quay.io/prometheus/node-exporter:v1.11.1
Latest:      v1.12+
Risk:        LOW
Status:      ✅ Healthy (27 restarts over time)
Note:        High restarts suggest update beneficial
Downtime:    ~1 minute per node (rolling update)

Upgrade:
$ kubectl set image daemonset/kube-prom-prometheus-node-exporter \
  -n monitoring node-exporter=quay.io/prometheus/node-exporter:v1.12.0
```

#### 3. **Blackbox-Exporter** - Endpoint Monitoring
```
Current:     quay.io/prometheus/blackbox-exporter:v0.27.0
Latest:      v0.28+
Risk:        LOW
Status:      ✅ Healthy
Downtime:    ~1 minute (no service disruption)

Upgrade:
$ kubectl set image deployment/blackbox-exporter -n monitoring \
  blackbox-exporter=quay.io/prometheus/blackbox-exporter:v0.28.0
```

#### 4. **Kube-State-Metrics** - K8S Metrics
```
Current:     kube-state-metrics:v2.18.0
Latest:      v2.19+
Risk:        LOW
Status:      ✅ Healthy
Downtime:    ~1 minute (no metrics loss)

Upgrade:
$ kubectl set image deployment/kube-prom-kube-state-metrics \
  -n monitoring kube-state-metrics=registry.k8s.io/kube-state-metrics/kube-state-metrics:v2.19.0
```

#### 5. **Prometheus-Operator** - Monitoring Orchestration
```
Current:     prometheus-operator:v0.90.1
Latest:      v0.91+
Risk:        LOW
Status:      ✅ Healthy
Impact:      Manages other monitoring components
Downtime:    ~1 minute

Upgrade:
$ kubectl set image deployment/kube-prom-operator -n monitoring \
  prometheus-operator=quay.io/prometheus-operator/prometheus-operator:v0.91.0
```

#### 6. **Cloudwatch-Exporter** - AWS Metrics
```
Current:     cloudwatch-exporter:v0.15.5
Latest:      v0.16+
Risk:        LOW
Status:      ✅ Healthy
Downtime:    ~1 minute

Upgrade:
$ kubectl set image deployment/cloudless-cloudwatch-exporter \
  -n monitoring cloudwatch-exporter=prom/cloudwatch-exporter:v0.16.0
```

#### 7. **Promtail** - Log Shipper
```
Current:     grafana/promtail:3.5.1
Latest:      3.6+
Risk:        LOW
Status:      ✅ Healthy
Downtime:    ~1 minute per node (rolling)

Upgrade:
$ kubectl set image daemonset/promtail -n monitoring \
  promtail=grafana/promtail:3.6.0
```

---

### 🟡 MEDIUM RISK UPGRADES (Wait until 2026-07-10)

#### 8. **n8n** - Workflow Automation ⚠️
```
Current:     n8nio/n8n:2.28.2-arm64
Latest:      2.30+ (check latest)
Risk:        MEDIUM
Status:      ✅ Healthy BUT just fixed memory leak (0 restarts)
Uptime:      56 days
Reason Wait:  Needs 2-3 days to stabilize after fix

Recommendation:
  - Monitor through 2026-07-05
  - If stable, upgrade 2026-07-06
  - Check release notes for breaking changes

Upgrade (after 2026-07-10):
$ kubectl set image deployment/n8n -n n8n \
  n8n=n8nio/n8n:latest-arm64
```

#### 9. **Prometheus** - Metrics Database ⚠️
```
Current:     quay.io/prometheus/prometheus:v3.11.3
Latest:      v3.12+
Risk:        MEDIUM
Status:      ✅ Fixed OOMKill, stable now (0 restarts)
Reason Wait:  Recently fixed memory limit, needs 7-day baseline
Critical:    Monitoring is core to cluster stability

Recommendation:
  - Monitor through 2026-07-10
  - Upgrade after baseline confirmed
  - Plan 5-minute downtime
  - Have rollback plan ready

Upgrade (after 2026-07-10):
$ kubectl set image statefulset/prometheus-monitoring-prometheus \
  -n monitoring prometheus=quay.io/prometheus/prometheus:v3.12.0
```

#### 10. **Loki** - Log Aggregation ⚠️
```
Current:     grafana/loki:2.9.8
Latest:      3.0+ (major version jump)
Risk:        MEDIUM
Status:      ✅ Healthy
Reason Wait:  Major version requires migration planning
Consideration: 2.x → 3.0 has breaking changes

Recommended Path:
  Phase 1: 2.9.8 → 2.10.x (minor, safe)
  Phase 2: 2.10.x → 3.0.x (major, requires testing)

Upgrade Phase 1 (2026-07-10):
$ kubectl set image deployment/loki -n monitoring \
  loki=grafana/loki:2.10.0

Upgrade Phase 2 (2026-07-20, after testing):
$ kubectl set image deployment/loki -n monitoring \
  loki=grafana/loki:3.0.0
```

---

### 🔴 HIGH RISK (DO NOT UPGRADE YET)

#### 11. **AlertManager** - Alert Routing 🚫
```
Current:     quay.io/prometheus/alertmanager:v0.32.1
Latest:      v0.32.2 or v0.33+
Risk:        HIGH
Status:      ⚠️  52 RESTARTS IN 28 DAYS
Uptime:      28 days
Why Wait:    High restart count indicates issues
            Upgrade could mask root cause
            Currently monitoring this component

Recommendation:
  ❌ DO NOT UPGRADE until:
     1. 7-day monitoring complete (2026-07-10)
     2. Root cause of 52 restarts identified
     3. Restart rate stabilizes at acceptable baseline
     4. Cluster health confirmed

Investigation Needed:
  - Review AlertManager logs
  - Check for configuration issues
  - Evaluate resource constraints
  - Determine if current version is problem

Upgrade (only after investigation, 2026-07-15+):
$ kubectl set image statefulset/alertmanager-monitoring-alertmanager \
  -n monitoring alertmanager=quay.io/prometheus/alertmanager:v0.32.2
```

---

## 📅 Upgrade Timeline

### Phase 1: WAIT (Now until 2026-07-10)
- Continue 7-day monitoring
- Let current fixes stabilize
- Complete daily health checks
- Do NOT upgrade during this phase

### Phase 2: LOW RISK (2026-07-10 onwards)
Upgrade anytime after confirming cluster health:
- EspoCRM
- Node-Exporter
- Blackbox-Exporter
- Kube-State-Metrics
- Prometheus-Operator
- Cloudwatch-Exporter
- Promtail

**How to upgrade safely:**
```bash
# 1. Check current version
kubectl get deployment/app-name -n namespace -o jsonpath='{.spec.template.spec.containers[0].image}'

# 2. Create backup (if applicable)
# (depends on app - check documentation)

# 3. Upgrade
kubectl set image deployment/app-name -n namespace \
  container-name=image:new-tag

# 4. Monitor rollout
kubectl rollout status deployment/app-name -n namespace

# 5. Verify health
./scripts/daily-health-check.sh all
```

### Phase 3: MEDIUM RISK (2026-07-10 onwards, with caution)
After confirming n8n, Prometheus, and Loki stability:
- n8n (2026-07-10 earliest)
- Prometheus (2026-07-10 earliest)
- Loki (2026-07-15 earliest, phased approach)

### Phase 4: INVESTIGATE FIRST (2026-07-15 onwards)
After investigating AlertManager restart root cause:
- AlertManager (only after investigation complete)

---

## Pre-Upgrade Checklist

Before upgrading ANY app:

- [ ] Confirm cluster is stable (daily health check passing)
- [ ] No critical alerts or warnings
- [ ] Memory usage normal (< 85%)
- [ ] All pods healthy
- [ ] Recent backups exist (for stateful apps)
- [ ] Rollback plan understood
- [ ] Maintenance window approved (if needed)

---

## Rollback Procedure (if upgrade fails)

```bash
# Check previous image
kubectl get deployment/app-name -n namespace -o jsonpath='{.status.conditions[0]}'

# Rollback to previous version
kubectl rollout undo deployment/app-name -n namespace

# Or specify previous image
kubectl set image deployment/app-name -n namespace \
  container-name=image:previous-tag

# Monitor rollback
kubectl rollout status deployment/app-name -n namespace
```

---

## Summary & Recommendations

### DO UPGRADE (Anytime, LOW RISK):
✅ EspoCRM (9.x minor)  
✅ Node-Exporter (v1.11 → v1.12)  
✅ Blackbox-Exporter (v0.27 → v0.28)  
✅ Kube-State-Metrics (v2.18 → v2.19)  
✅ Prometheus-Operator (v0.90 → v0.91)  
✅ Cloudwatch-Exporter (v0.15 → v0.16)  
✅ Promtail (3.5 → 3.6)  

### WAIT UNTIL 2026-07-10 (MEDIUM RISK):
⏳ n8n (stability confirmation needed)  
⏳ Prometheus (baseline confirmation needed)  
⏳ Loki (major version requires planning)  

### WAIT FOR INVESTIGATION (HIGH RISK):
🚫 AlertManager (52 restarts, root cause unknown)  

---

**Generated:** 2026-07-03  
**Next Review:** 2026-07-10  
**Maintenance Window:** 2026-07-15+ (after stabilization)
