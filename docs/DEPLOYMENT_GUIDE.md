# Infrastructure Optimization Deployment Guide

## Overview

This guide walks you through deploying the infrastructure optimization for Lighthouse performance improvement. The deployment uses a GitHub Actions workflow with secure OIDC authentication to AWS.

**Expected outcome:** Lighthouse scores /services 64→71 (+7), /store 63→70 (+7), both passing threshold of 65.

---

## Quick Start

### Option A: GitHub Actions Workflow (Recommended)

1. Go to: https://github.com/Themis128/cloudless.gr/actions
2. Select **"Deploy Infrastructure"** workflow from the left sidebar
3. Click **"Run workflow"** button (top right)
4. Select phase from dropdown:
   - `cloudfront` — Phase 1 (highest ROI)
   - `lambda-concurrency` — Phase 2
   - `rds-proxy` — Phase 4
   - `all` — Deploy everything at once

5. Click **"Run workflow"** to start
6. Monitor progress in the workflow logs

**Estimated time:** 5-10 minutes per phase

---

## Deployment Phases (In Order)

### Phase 1: CloudFront + Lambda@Edge (HIGHEST ROI)

**What:** Edge CDN with redirect rewriting and compression
**Expected impact:** 600ms LCP improvement, +5-6 Lighthouse points
**Cost:** ~$50/month
**Time:** 5 minutes
**Risk:** Low (pure caching layer, easy rollback)

**Trigger:**

```bash
gh workflow run deploy-infrastructure.yml -f phase=cloudfront -R Themis128/cloudless.gr
# OR via UI: Select "cloudfront" phase
```

**Post-deployment:**

1. Get CloudFront domain from workflow output (Action Summary)
2. Update DNS CNAME to CloudFront domain:

   ```bash
   # Current: cloudless.gr CNAME → [Lambda function URL]
   # New: cloudless.gr CNAME → [CloudFront domain from output]
   ```

3. Wait 5-10 minutes for DNS propagation
4. Test: `curl -I https://cloudless.gr/en` (should show CloudFront headers)
5. Re-run Lighthouse: Expect +5-6 point improvement immediately

---

### Phase 2: Lambda Provisioned Concurrency

**What:** Keep 10 Lambda instances warm 24/7 to eliminate cold-starts
**Expected impact:** 800ms TTFB improvement, +2-3 Lighthouse points
**Cost:** ~$240/month
**Time:** 2 minutes
**Risk:** Low (just provisioning, no code changes)

**Trigger:**

```bash
gh workflow run deploy-infrastructure.yml -f phase=lambda-concurrency -R Themis128/cloudless.gr
# OR via UI: Select "lambda-concurrency" phase
```

**Post-deployment:**

- No manual action needed
- Instances automatically warm up
- Monitor in AWS console: Lambda → Provisioned Concurrency
- Re-run Lighthouse: Expect +2-3 point improvement

---

### Phase 3: k8s App Tuning (Manual)

**What:** Increase pod resources, enable HPA, add health checks
**Expected impact:** 300ms app improvement, +1-2 Lighthouse points
**Cost:** ~$100/month (2 extra vCPU hours/day)
**Time:** 10 minutes
**Risk:** Medium (requires pod restart, but rolling update)

**Deploy manually:**

```bash
kubectl apply -f k8s/cloudless-app-optimized.yaml
```

**Monitor:**

```bash
# Watch pods restart
kubectl rollout status deployment/cloudless-app -n cloudless

# Monitor resources
kubectl top pod -n cloudless

# Check HPA
kubectl get hpa -n cloudless -w
```

**Verify:**

```bash
# Pods should have 512Mi memory (was 256Mi)
kubectl describe pod -n cloudless | grep -A 2 "Requests:"

# HPA should be active
kubectl get hpa -n cloudless
# Should show: min 3, max 10, current scaling based on CPU/memory
```

---

### Phase 4: RDS Proxy (Connection Pooling)

**What:** Reduce database connection count from 50+ to <10
**Expected impact:** 200ms TTFB improvement, final scores 70+
**Cost:** ~$200/month (RDS Proxy minimum)
**Time:** 5 minutes
**Risk:** Medium (requires app config change)

**Trigger:**

```bash
gh workflow run deploy-infrastructure.yml -f phase=rds-proxy -R Themis128/cloudless.gr
# OR via UI: Select "rds-proxy" phase
```

**Post-deployment:**

1. Get RDS Proxy endpoint from workflow output
2. Update app DATABASE_URL in k8s secrets:

   ```bash
   kubectl set env deployment/cloudless-app \
     -n cloudless \
     DATABASE_URL=[PROXY_ENDPOINT]
   ```

3. Restart pods:

   ```bash
   kubectl rollout restart deployment/cloudless-app -n cloudless
   kubectl rollout status deployment/cloudless-app -n cloudless
   ```

4. Verify DB connections dropped:

   ```bash
   # Connect to database and check
   SELECT count(*) FROM pg_stat_activity;
   # Should be <10 (was 50+)
   ```

---

## Full Deployment (All Phases)

To deploy everything at once:

```bash
gh workflow run deploy-infrastructure.yml -f phase=all -R Themis128/cloudless.gr
# OR via UI: Select "all" phase
```

**Total time:** 10-15 minutes
**Expected outcome:**

- /services: 64 → 71 (+7 points) ✅
- /store: 63 → 70 (+7 points) ✅
- LCP: 6.4s → 4.8s (-1.6s, -25%)
- TTFB: 2.1s → 1.3s (-0.8s, -38%)

---

## Monitoring & Verification

### Real-time Monitoring

**GitHub Actions:**

- Go to Actions tab → Deploy Infrastructure workflow → latest run
- Watch logs in real-time
- See deployment summary in "Summary" section

**AWS Console:**

- CloudFront: https://console.aws.amazon.com/cloudfront/
- Lambda: https://console.aws.amazon.com/lambda/ → Provisioned Concurrency
- RDS: https://console.aws.amazon.com/rds/ → Proxies

**k8s:**

```bash
# Monitor pod rollout
kubectl rollout status deployment/cloudless-app -n cloudless

# Watch CPU/memory
kubectl top pod -n cloudless --containers

# Check HPA scaling
kubectl get hpa -n cloudless -w
```

### Lighthouse Verification

After each phase:

```bash
# Local testing (requires Node.js + Chrome)
pnpm exec lighthouse https://cloudless.gr/en/services --throttle-method=devtools
pnpm exec lighthouse https://cloudless.gr/en/store --throttle-method=devtools

# OR trigger CI: Push a change to main (or manually trigger workflow)
```

**Expected scores after each phase:**

| Phase | /services | /store | Notes |
|-------|-----------|--------|-------|
| Before | 64 | 63 | Baseline |
| After CloudFront | 69 | 68 | DNS updated, 5-10min wait |
| After Lambda | 71 | 70 | Immediate, no DNS wait |
| After k8s | 71 | 70 | No Lighthouse change (internal tuning) |
| After RDS | 72 | 71 | Possible slight improvement |

---

## Rollback Procedures

If any phase causes issues:

### Rollback CloudFront

```bash
# Point DNS back to Lambda origin
# Update CNAME: cloudless.gr → [Lambda function URL]
# Takes 5-10 minutes
```

### Rollback Lambda Concurrency

```bash
terraform destroy -target=aws_lambda_provisioned_concurrency_config.main_app
# Cold-starts return immediately
```

### Rollback k8s Tuning

```bash
kubectl rollout undo deployment/cloudless-app -n cloudless
# Rolls back to previous pod spec
```

### Rollback RDS Proxy

```bash
# Update app DATABASE_URL to point to RDS directly (not proxy)
kubectl set env deployment/cloudless-app DATABASE_URL=[DIRECT_RDS_URL]
kubectl rollout restart deployment/cloudless-app -n cloudless

# Then destroy proxy
terraform destroy -target=aws_db_proxy.main
```

---

## Cost Breakdown

| Component | Cost/month | One-time | ROI |
|-----------|-----------|----------|-----|
| CloudFront | $50 | $0 | 600ms LCP |
| Lambda Concurrency | $240 | $0 | 800ms TTFB |
| k8s Nodes | $100 | $0 | 300ms app |
| RDS Proxy | $200 | $0 | 200ms DB |
| **Total** | **$590** | **$0** | **1.6s total** |

**Total cost: $7,080/year for 1.6s LCP improvement and passing Lighthouse scores.**

Recommendation: Deploy all 4 phases. ROI is excellent (cost per ms: $2.22/ms).

---

## Troubleshooting

### Workflow doesn't appear in GitHub Actions

GitHub takes a few minutes to index new workflow files. Try:

1. Refresh the page
2. Wait 5 minutes
3. Check if file exists: https://github.com/Themis128/cloudless.gr/blob/main/.github/workflows/deploy-infrastructure.yml

### "role-to-assume error" in workflow

The AWS_DEPLOY_ROLE_ARN secret is missing or invalid.

- Check: https://github.com/Themis128/cloudless.gr/settings/secrets/actions
- Should have: `AWS_DEPLOY_ROLE_ARN` secret
- Value: `arn:aws:iam::278585680617:role/cloudless-github-actions`

### CloudFront domain not working

1. Verify distribution is active: `aws cloudfront list-distributions`
2. Check DNS propagation: `nslookup cloudless.gr`
3. Should see CloudFront IP, not Lambda
4. Wait up to 15 minutes for global propagation

### Lambda concurrency not visible

Takes a few minutes to show in console. Check with AWS CLI:

```bash
aws lambda get-provisioned-concurrency-config \
  --function-name cloudless-app-production \
  --qualifier LIVE
```

### Pods not restarting with new config

Try manual restart:

```bash
kubectl delete pod -l app=cloudless-app -n cloudless
# New pods will be created with new spec
```

---

## Files & Documentation

- **Terraform IaC:** `infrastructure/terraform/lambda-optimization.tf`
- **k8s Manifests:** `k8s/cloudless-app-optimized.yaml`
- **Workflow:** `.github/workflows/deploy-infrastructure.yml`
- **Memory/Playbook:** `memory/project_infra_optimization.md`
- **Lighthouse Task:** Issue #773

---

## Support & Questions

If you encounter issues:

1. Check the GitHub Actions workflow logs for errors
2. Review the rollback procedures above
3. Check AWS console for resource details
4. Verify DNS with: `nslookup` or `dig`
5. Monitor k8s with: `kubectl describe` and `kubectl logs`

---

**Deployment Status: READY**

All infrastructure code is committed and the GitHub Actions workflow is live. You can begin deploying at any time following the phases above.
