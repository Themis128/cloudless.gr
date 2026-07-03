# Log-Based Alerting Setup - 2026-07-03

**Date:** 2026-07-03  
**Status:** Configuration Complete - Ready for Testing

---

## Overview

Log-based alerting enables AlertManager to trigger alerts based on **log content** rather than just metrics.

### What We Have
- ✅ **Loki** - Log aggregation (running)
- ✅ **Promtail** - Log collector (running)
- ✅ **Grafana** - Alerting (running, unified alerting enabled)
- ✅ **AlertManager** - Alert routing (just fixed, 0 restarts)

### What We Configured
- ✅ Grafana alert rules for log-based alerting
- ✅ ConfigMap created at: `monitoring/provisioning/alerts/01-log-alerts.yml`

---

## Alert Rules Created

### 1. n8n Workflow Error
**Pattern:** `{app="n8n", container="n8n"} |~ "error|failed"`  
**Severity:** Critical  
**Threshold:** >0 errors in 5 minutes  
**Description:** Detects workflow failures in n8n

### 2. EspoCRM Database Error  
**Pattern:** `{app="espocrm", container="espocrm"} |~ "SQL|error|connection refused|timeout"`  
**Severity:** Critical  
**Threshold:** >0 errors in 5 minutes  
**Description:** Detects database connectivity issues

### 3. Meilisearch Indexing Error
**Pattern:** `{app="meilisearch", container="meilisearch"} |~ "indexing error|timeout|failed"`  
**Severity:** High  
**Threshold:** >0 errors in 5 minutes  
**Description:** Detects search indexing issues

### 4. Uptime Kuma Service Down
**Pattern:** `{app="uptime-kuma", container="uptime-kuma"} |~ "down|unreachable|failed"`  
**Severity:** High  
**Threshold:** >0 errors in 5 minutes  
**Description:** Detects service monitoring failures

### 5. Ntfy Notification Error
**Pattern:** `{app="ntfy", container="ntfy"} |~ "error|failed|delivery"`  
**Severity:** High  
**Threshold:** >0 errors in 5 minutes  
**Description:** Detects notification delivery failures

### 6. Postiz Platform Error
**Pattern:** `{app="postiz", container="postiz"} |~ "error|connection|timeout"`  
**Severity:** High  
**Threshold:** >0 errors in 5 minutes  
**Description:** Detects platform connection issues

### 7. AppFlowy Auth Error
**Pattern:** `{app="appflowy-gotrue", container="gotrue"} |~ "error|failed|unauthorized"`  
**Severity:** High  
**Threshold:** >0 errors in 5 minutes  
**Description:** Detects authentication service issues

### 8. Application Error Spike
**Pattern:** `{namespace=~"cloudless|n8n|espocrm|meilisearch|monitoring|appflowy"} |~ "error|failed|exception"`  
**Severity:** Warning  
**Threshold:** >5 total errors in 5 minutes  
**Description:** General error rate spike detection

---

## How It Works

```
User Application → Logs → Promtail → Loki
                              ↓
                        Grafana Alert
                              ↓
                        AlertManager
                              ↓
                        Your Receivers (Slack, Email, etc.)
```

1. **Logs** are collected by Promtail from all pods
2. **Loki** stores the logs with labels for querying
3. **Grafana** evaluates alert rules against Loki queries
4. **AlertManager** receives alerts and routes them to configured receivers

---

## Alert Configuration

### Location
- **ConfigMap:** `grafana-log-alerts` in `monitoring` namespace
- **Provisioning File:** `/home/tbaltzakis/cloudless.gr/monitoring/provisioning/alerts/01-log-alerts.yml`

### Format
Alert rules use **Grafana's unified alerting** syntax with **Loki query language**:

```yaml
expression: count_over_time({app="n8n"} |~ "error" [5m]) > 0
```

### Query Syntax
- `{app="n8n"}` - Filter by app label
- `|~ "error"` - Regex match for "error"
- `[5m]` - Time range (last 5 minutes)
- `count_over_time()` - Count log lines matching pattern

---

## Testing

### Step 1: Verify ConfigMap
```bash
kubectl get configmap grafana-log-alerts -n monitoring -o yaml
```

### Step 2: Check Grafana UI
1. Navigate to Grafana: `https://grafana.cloudless.online`
2. Go to **Alerting** → **Alert Rules**
3. Look for new rules under **Self-Hosted Apps** folder

### Step 3: Simulate Test Alert
To test, you can create a log entry that matches one of the patterns:

```bash
# Example: Create a test error in a pod
kubectl exec -it -n n8n deployment/n8n -- logger "Test error message for alerting"
```

Wait 5+ minutes for the alert to evaluate, then check:
- Grafana: Alerting → Alert Rules
- AlertManager: `/admin/alerts` (if accessible)
- Your receivers (Slack, etc.)

---

## Alert Routing

Alerts are routed through AlertManager to your configured receivers:

**Current Receivers:**
1. **oncall** - Webhook to oncall-engine (currently not found)
2. **alert-api** - Webhook to alert-api service (working)

**AlertManager Configuration:**
- Log-based alerts with `severity: critical` → `alert-api` webhook
- Logs are sent to Slack via alert-api

---

## Files Created

| File | Purpose |
|------|---------|
| `monitoring/provisioning/alerts/01-log-alerts.yml` | Grafana alert rules config |
| `LOG-BASED-ALERTING-SETUP.md` | This documentation |

---

## Troubleshooting

### Alerts Not Triggering

1. **Check Promtail is collecting logs:**
   ```bash
   kubectl logs -n monitoring daemonset/promtail
   ```

2. **Check Loki has logs:**
   ```bash
   # Query Loki directly
   kubectl port-forward -n monitoring svc/loki 3100:3100
   curl http://localhost:3100/loki/api/v1/query?query='{app="n8n"}'
   ```

3. **Check Grafana alert evaluation:**
   - Grafana UI → Alerting → Alert Rules
   - Check "Last evaluation" and "State"

4. **Check AlertManager is receiving:**
   ```bash
   kubectl logs -n monitoring statefulset/alertmanager-monitoring-alertmanager-0
   ```

### false positives

Adjust threshold or time range in alert rule:
- Increase threshold: `> 0` → `> 5`
- Increase time range: `[5m]` → `[10m]`

---

## Maintenance

### Updating Alert Rules
1. Edit: `/home/tbaltzakis/cloudless.gr/monitoring/provisioning/alerts/01-log-alerts.yml`
2. Update ConfigMap:
   ```bash
   kubectl create configmap grafana-log-alerts \
     --from-file=01-log-alerts.yml \
     --dry-run=client -o yaml | kubectl apply -f -
   ```

### Removing Alert Rules
```bash
kubectl delete configmap grafana-log-alerts -n monitoring
```

---

## Next Steps

1. **Test alerts** by simulating error logs
2. **Verify routing** to your receivers
3. **Tune thresholds** based on false positive/negative rates
4. **Add more patterns** for other self-hosted apps as needed

---

## Summary

✅ Log-based alerting configured for 8 alert rules  
✅ ConfigMap created and applied  
✅ Grafana unified alerting enabled  
✅ Alerts routed through AlertManager  

**Alert Evaluation:** Every 30 seconds (default)  
**Notification:** Via alert-api webhook → Slack  

Ready for testing!
