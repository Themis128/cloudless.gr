# omv-main (Pi 5) Node — Cluster Architecture

> The `omv-main` node is a Raspberry Pi 5 (8GB RAM, NVMe boot) running k3s for the cloudless.gr HA failover cluster.

---

## Architecture Overview

```
                      ┌─────────────────────────────────────────┐
                      │           Users / Clients                 │
                      └─────────────────────────────────────────┘
                                       │
                                       ▼
                      ┌─────────────────────────────────────────┐
                      │        cloudless.gr (DNS via CF)          │
                      └─────────────────────────────────────────┘
                        ╱                              ╲
           PRIMARY    ╱                                ╲     FAILOVER
    ┌───────────────────────┐                    ┌───────────────────────┐
    │    AWS Lambda         │                    │    Pi k3s Cluster     │
    │  (arm64, 1GB, 5 warm)│                    │   omv-main Pi 5       │
    │      SST v4           │                    │   8GB RAM NVMe        │
    └───────────────────────┘                    └───────────────────────┘
                                       │                │
                                       ▼                ▼
                      ┌─────────────────────────────────────────┐
                      │         Shared AWS Services               │
                      │  DynamoDB • SSM • S3 • SES • Cognito    │
                      └─────────────────────────────────────────┘
```

---

## Optimal Configuration

### Resource Sizing (Current)

| Component | Request | Limit | Rationale |
|-----------|---------|-------|-----------|
| **Next.js App** | 100m CPU / 128Mi | 500m CPU / 256Mi | Conservative for single-node operation; prevents OOM on Pi |
| **DuckDB API** | 100m CPU / 256Mi | 500m CPU / 512Mi | Analytics queries need more memory |
| **Metabase** | 200m CPU / 512Mi | 1000m CPU / 1Gi | JVM-based, needs more RAM |
| **Grafana** | 100m CPU / 128Mi | 250m CPU / 256Mi | Lightweight dashboarding |
| **Prometheus** | 100m CPU / 256Mi | 500m CPU / 512Mi | Time-series storage |
| **Meilisearch** | 100m CPU / 256Mi | 500m CPU / 512Mi | Search index in RAM |

### High Availability Settings

```yaml
# Recommended for production workloads
replicas: 1  # minReplicas: 2 if omv-main has 4GB+ free RAM

autoscaling:
  minReplicas: 1
  maxReplicas: 5  # Increased from 3 for traffic spikes
  targetCPU: 70%
  targetMemory: 75%

# Add node affinity to prefer omv-main for performance
affinity:
  nodeAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      preference:
        matchExpressions:
        - key: kubernetes.io/hostname
          operator: In
          values: ["omv-main"]
```

---

## Quick Wins Implementation

### 1. Check Current Resource Usage

```bash
# Run on omv-main to see available memory
ssh tbaltzakis@omv-main
free -h

# Check pod resource usage
kubectl top pods -n cloudless

# If > 4GB available, increase replicas
kubectl scale deployment cloudless-app --replicas=2 -n cloudless
```

### 2. Add Persistent Storage for Analytics

```yaml
# Add to k8s/cloudless-app-optimized.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: duckdb-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
  - ReadWriteOnce
  hostPath:
    path: /var/lib/duckdb
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: duckdb-pvc
  namespace: cloudless
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

### 3. Increase Memory Limits Safely

```bash
# Edit deployment to increase limits
kubectl patch deployment cloudless-app -n cloudless -p '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "app",
          "resources": {
            "limits": {
              "memory": "512Mi"
            }
          }
        }]
      }
    }
  }
}'
```

### 4. Enable Horizontal Pod Autoscaling Improvements

```yaml
# Enhanced HPA configuration
behavior:
  scaleDown:
    stabilizationWindowSeconds: 300
    policies:
    - type: Percent
      value: 50
      periodSeconds: 60
  scaleUp:
    stabilizationWindowSeconds: 0
    policies:
    - type: Percent
      value: 100
      periodSeconds: 15
    - type: Pods
      value: 2
      periodSeconds: 15
```

### 5. Pre-pull Images on Both Nodes

```bash
# Run on each Pi node
docker pull 278585680617.dkr.ecr.us-east-1.amazonaws.com/cloudless-pi-app:latest

# Or via k3s
kubectl run prepull --image=278585680617.dkr.ecr.us-east-1.amazonaws.com/cloudless-pi-app:latest \
  --command -- sleep 300 -n cloudless
```

---

## Monitoring Commands

```bash
# Check cluster health
kubectl get nodes
kubectl get pods -n cloudless -o wide

# Check specific pod resources
kubectl top pod -n cloudless cloudless-app-xxx

# Check OOM events
kubectl get events -n cloudless --field-selector reason=OOMKilled

# Check probe failures
kubectl describe pod -n cloudless cloudless-app-xxx
```

---

## Architecture Decision Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-06-23 | Conservative memory limits (256Mi) | Pi 5 has 8GB total, k3s + other services need headroom |
| 2026-06-23 | Single replica on Pi | Simpler ops, acceptable risk for failover surface |
| 2026-06-23 | No PVCs initially | Simpler deployment, analytics can rebuild from S3 |
| 2026-06-23 | HPA max 3 pods | Prevents resource exhaustion during scaling |

---

## When to Re-evaluate

- ✅ Traffic > 10K monthly visitors
- ✅ Memory OOM events in `kubectl logs`
- ✅ Manual intervention needed during failover
- ✅ Analytics data persistence becomes critical

See also: `infrastructure/omv-ha/` for standby node configuration

## GitHub Actions runner heal

After power-cycles, runners can go ghost-busy on GitHub. Install:

```bash
sudo bash infrastructure/omv/install-gha-runner-heal.sh
```

See `docs/deploy/runners.md`.

## Postfix supervision (Daily Health Check alerts)

Fixes the recurring `[OMV] Daily Health Check` alerts ("Service postfix is NOT
running!" + "High number of system errors …"). postfix was `disabled` at boot and
effectively unsupervised by monit, so it stayed down until the nightly
`nas-health-check` restarted it (up to ~13h), while monit's own 127.0.0.1:25 alert
handler looped and inflated the error count.

```bash
# preview (no changes), then:
sudo bash infrastructure/omv/install-monit-postfix-fix.sh --apply
# optional: also point monit alerts at the external relay (see caveats in the script)
sudo bash infrastructure/omv/install-monit-postfix-fix.sh --apply --mail-relay
```

See the script header for the full root-cause writeup.
