# Pending Infrastructure Actions Runbook

**Generated:** 2026-07-17
**For:** cloudless.gr k3s cluster (omv + omv-ha nodes)

## Overview

This document provides detailed procedures for the 4 pending infrastructure actions required to complete the migration and optimize the cluster.

---

## Action 1: Apply Monitoring Node Selector Fix

### Problem

Prometheus and Alertmanager pods are stuck in Pending state because they lack `nodeSelector` targeting the primary node (omv). The omv-ha node has `node-type=standby:NoSchedule` taint.

### Diagnose First

```bash
# Check current monitoring pod status
kubectl -n monitoring get pods -o wide

# Look for pending pods specifically
kubectl -n monitoring get pods --field-selector=status.phase!=Running -o wide

# Verify node taints
kubectl get nodes -o custom-columns=NAME,TAINTS
kubectl describe node omv-ha | grep -A5 Taints

# Check if helm release exists
helm -n monitoring list -f kube-prom
```

### Option A: GitHub Actions Workflow (Recommended)

The workflow `monitoring-node-selector-fix.yml` patches StatefulSets in-place:

```yaml
# File: .github/workflows/monitoring-node-selector-fix.yml
# Triggers:
#   - workflow_dispatch (manual)
#   - push to kube-prom-stack-values.yaml
```

**Steps:**

1. Go to GitHub → Actions → "Monitoring Node Selector Fix"
2. Click "Run workflow"
3. Click "Run workflow" button (no inputs required)
4. Wait for completion (~2-3 minutes)
5. Check results in issue #382 comments

**Or run via CLI:**

```bash
gh workflow run monitoring-node-selector-fix.yml --repo Themai128/cloudless.gr
```

### Option B: Manual Patch (Emergency/Fallback)

```bash
# Patch Prometheus StatefulSet
PROM_STS=$(kubectl -n monitoring get sts -l app.kubernetes.io/name=prometheus -o jsonpath='{.items[0].metadata.name}')
kubectl -n monitoring patch statefulset "$PROM_STS" \
  --type=strategic \
  -p '{"spec":{"template":{"spec":{"nodeSelector":{"kubernetes.io/hostname":"omv"}}}}}'

# Patch Alertmanager StatefulSet
AM_STS=$(kubectl -n monitoring get sts -l app.kubernetes.io/name=alertmanager -o jsonpath='{.items[0].metadata.name}')
kubectl -n monitoring patch statefulset "$AM_STS" \
  --type=strategic \
  -p '{"spec":{"template":{"spec":{"nodeSelector":{"kubernetes.io/hostname":"omv"}}}}}'

# Patch kube-state-metrics deployment
KSM_DEPLOY=$(kubectl -n monitoring get deploy -l app=kube-state-metrics -o jsonpath='{.items[0].metadata.name}')
kubectl -n monitoring patch deployment "$KSM_DEPLOY" \
  --type=strategic \
  -p '{"spec":{"template":{"spec":{"nodeSelector":{"kubernetes.io/hostname":"omv"}}}}}'

# Patch cloudwatch-exporter deployment
CW_DEPLOY=$(kubectl -n monitoring get deploy -l app=cloudwatch-exporter -o jsonpath='{.items[0].metadata.name}')
kubectl -n monitoring patch deployment "$CW_DEPLOY" \
  --type=strategic \
  -p '{"spec":{"template":{"spec":{"nodeSelector":{"kubernetes.io/hostname":"omv"}}}}}'

# Wait for rollouts
kubectl -n monitoring rollout status "sts/$PROM_STS" --timeout=3m
kubectl -n monitoring rollout status "sts/$AM_STS" --timeout=3m
```

### Verify After Patch

```bash
# All monitoring pods should be Running
kubectl -n monitoring get pods

# Check pod placement
kubectl -n monitoring get pods -o wide

# Verify Prometheus is accessible
kubectl -n monitoring port-forward svc/kube-prom-stack-kube-prome-prometheus 9090:9090 &
curl -s http://localhost:9090/-/healthy

# Verify Alertmanager is accessible
kubectl -n monitoring port-forward svc/kube-prom-stack-kube-pro-alertmanager 9093:9093 &
curl -s http://localhost:9093/api/v1/status
```

---

## Action 2: Disable metoro-node-agent eBPF on Pi

### Problem

The metoro-node-agent requires BTF (kernel 6.18.34+) with eBPF support, which is not available on the Pi kernel. It's in CrashLoopBackOff state.

### Approach A: Remove via Helm Values (Cleanest - Preserves Release)

Create a values override file:

```yaml
# File: infrastructure/monitoring/metoro-disable-node-agent.yaml
metoro-node-agent:
  enabled: false
```

Then upgrade:

```bash
helm -n metoro upgrade metoro-exporter \
  ./helm-charts/metoro-exporter \
  -f infrastructure/monitoring/metoro-disable-node-agent.yaml
```

### Approach B: Delete Deployment Only (Quick Fix)

```bash
# Scale down to 0 replicas
kubectl -n metoro scale deployment metoro-node-agent --replicas=0

# Or delete the deployment entirely
kubectl -n metoro delete deployment metoro-node-agent

# Verify other metoro components are still running
kubectl -n metoro get pods
# Should show: metoro-exporter (2/2), metoro-exporter-sm-scraper, metoro-redis-master still running
```

### Approach C: Disable via Annotations (If Helm Chart Supports)

```bash
# Add annotation to disable
kubectl -n metoro patch deployment metoro-node-agent \
  -p '{"metadata":{"annotations":{"metoro.io/disable":"true"}}}'
```

### Verify After Fix

```bash
# Check metoro namespace status
kubectl -n metoro get pods

# Expected: All pods Running except node-agent (should be gone)
kubectl -n metoro get pods -o custom-columns=NAME,STATUS,NODE

# Check for any CrashLoopBackOff pods
kubectl -n metoro get pods | awk '/CrashLoopBackOff/ {print $1}'
```

**Note:** The metoro-node-agent is optional for basic metric collection. The exporter sidecar on application pods is sufficient for most observability needs.

---

## Action 3: Create CLOUDFLARE_API_TOKEN Secret

### Prerequisites

1. Cloudflare API token with these permissions:
   - **Zone → Zone → Read** (for cloudless.gr)
   - **Zone → Load Balancing: Monitors and Pools → Edit**
   - **Zone → Load Balancers → Edit**
   - **Zone → DNS → Edit**

### Step 1: Generate Token in Cloudflare Dashboard

1. Go to Cloudflare → My Profile → API Tokens
2. Click "Create Token"
3. Use custom token template:

   ```
   Permissions:
   - Zone → Zone → Read
   - Zone → Load Balancing: Monitors and Pools → Edit
   - Zone → Load Balancers → Edit
   - Zone → DNS → Edit
   Zone Resources:
   - Include → Specific zone → cloudless.gr
   TTL: Never (or set expiration as needed)
   ```

### Step 2: Store Token via GitHub Actions

```bash
# Using the workflow_dispatch
gh workflow run store-cloudflare-token.yml --repo Themai128/cloudless.gr \
  -f cloudflare_token="YOUR_API_TOKEN_HERE" \
  -f apply=true
```

### Step 3: Verify Storage

```bash
# Run verification workflow
gh workflow run verify-cloudflare-token.yml --repo Themai128/cloudless.gr

# Check SSM parameter exists (from a cloud session with OIDC)
aws ssm get-parameter \
  --name /cloudless/production/CLOUDFLARE_API_TOKEN \
  --with-decryption \
  --query Parameter.Value \
  --output text | head -c 10
# Should output first 10 chars of token (valid format)
```

### Alternative: Manual Verification via Script

```bash
# scripts/cf-token-smoketest.sh (already exists)
# Tests zone read, LB pool access, and DNS edit scopes

# Run locally (requires awscli + jq):
CF_TOKEN=$(aws ssm get-parameter \
  --name /cloudless/production/CLOUDFLARE_API_TOKEN \
  --with-decryption \
  --query Parameter.Value --output text)

# Zone read test
curl -s -X GET "https://api.cloudflare.com/client/v4/zones" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" | jq '.success'

# Should return: true
```

### Verify Cloudflare MCP Integration

```bash
# Check mcp.json has CLOUDFLARE_API_TOKEN reference
grep -A2 '"cloudflare"' mcp.json

# Test MCP connectivity (after restart)
# The MCP should connect without "Invalid access token" errors
```

---

## Action 4: Update Postiz PVC to 20Gi

### Current State

From `infrastructure/postiz/k8s/postiz.yaml`:

- `postiz-uploads` PVC is 2Gi (line 53)
- Postiz media/images need more space

### Options

#### Option A: Patch Existing PVC (Non-disruptive if not in use)

```bash
# Patch the PVC request size
kubectl -n postiz patch pvc postiz-uploads -p \
  '{"spec":{"resources":{"requests":{"storage":"20Gi"}}}}'

# Verify patch applied
kubectl -n postiz get pvc postiz-uploads -o jsonpath='{.spec.resources.requests.storage}'

# Note: This only works if the storage class supports expansion
# and the PVC is not actively mounted. May require pod restart.
```

#### Option B: Recreate PVC (Clean Slate)

**⚠️ WARNING: This deletes all existing uploaded media. Backup first.**

```bash
# Backup existing uploads (if any)
kubectl -n postiz exec deployment/postiz -- tar czf - /uploads | tar tzf - > uploads-backup-list.txt

# Delete the deployment first (so PVC can be released)
kubectl -n postiz scale deployment postiz --replicas=0

# Wait for pod to terminate
kubectl -n postiz wait --for=delete pod -l app=postiz --timeout=60s

# Delete old PVC
kubectl -n postiz delete pvc postiz-uploads

# Apply updated manifest
kubectl apply -f infrastructure/postiz/k8s/postiz.yaml

# Or apply just the PVC portion:
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postiz-uploads
  namespace: postiz
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 20Gi
EOF
```

### Option C: Edit Manifest and Re-apply (Recommended)

First, edit the manifest:

```yaml
# File: infrastructure/postiz/k8s/postiz.yaml
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postiz-uploads
  namespace: postiz
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 20Gi  # Changed from 2Gi
---
```

Then apply:

```bash
kubectl apply -f infrastructure/postiz/k8s/postiz.yaml
```

### Verify PVC Update

```bash
# Check PVC size
kubectl -n postiz get pvc postiz-uploads -o jsonpath='{.spec.resources.requests.storage}'

# Check PVC binding
kubectl -n postiz get pvc postiz-uploads

# Check usage on host (via omv node)
ssh omv "df -h / | grep -E 'Size|120G'"
# PVCs use local-path storage on the SSD

# Verify Postiz pod can mount the volume
kubectl -n postiz exec deployment/postiz -- df -h /uploads
```

### Post-Verification

```bash
# Restart Postiz deployment to pick up new PVC
kubectl -n postiz rollout restart deployment/postiz

# Wait for rollout
kubectl -n postiz rollout status deployment/postiz --timeout=2m

# Check pod status
kubectl -n postiz get pods -o wide

# Test upload endpoint (if Postiz is running)
curl -I https://postiz.cloudless.gr/ | head -1
# Should return: HTTP/2 200
```

---

## Quick Reference Summary

| Action | Command | Verification |
|--------|---------|--------------|
| Monitoring fix | `gh workflow run monitoring-node-selector-fix.yml` | `kubectl -n monitoring get pods` |
| metoro-agent disable | `kubectl -n metoro scale deployment metoro-node-agent --replicas=0` | `kubectl -n metoro get pods` |
| Cloudflare token | `gh workflow run store-cloudflare-token.yml -f cloudflare_token=TOKEN` | `gh workflow run verify-cloudflare-token.yml` |
| Postiz PVC | Edit yaml to 20Gi, then `kubectl apply -f postiz.yaml` | `kubectl -n postiz get pvc postiz-uploads` |

## Related Files

- `.github/workflows/monitoring-node-selector-fix.yml` - Patches Prometheus/Alertmanager StatefulSets
- `.github/workflows/store-cloudflare-token.yml` - Stores token to SSM + applies LB
- `.github/workflows/verify-cloudflare-token.yml` - Smoke tests token scopes
- `infrastructure/postiz/k8s/postiz.yaml` - Postiz manifest (PVC definition)
- `infrastructure/monitoring/kube-prom-stack-values.yaml` - Helm values with nodeSelectors
- `mcp.json` - MCP configuration referencing CLOUDFLARE_API_TOKEN
