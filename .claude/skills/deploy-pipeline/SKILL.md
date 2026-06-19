---
name: deploy-pipeline
description: Monitor and debug the full cloudless.gr deploy pipeline — GitHub Actions deploy, ha-sync-orchestrator, Pi image build, and k3s rollout. Use when the user asks about deploy status, whether Lambda/Pi are in sync, orchestrator failures, SHA drift, or "is the deploy done?". Triggers on "deploy", "pipeline", "orchestrator", "Pi image", "ha-sync", "SHA drift", "in sync", "rollout".
argument-hint: "SHA or 'latest'"
allowed-tools: mcp__cloudless-infra__aws_get_ssm_parameters, mcp__cloudless-infra__k3s_get_pods, mcp__cloudless-infra__cluster_run_command, mcp__cloudless-infra__k3s_get_pod_logs
---

# Deploy Pipeline — cloudless.gr

## Architecture

```
git push main
  └─▶ Deploy to Production (GH Actions)
        ├─▶ Type Check + Unit Tests + Lint
        ├─▶ pnpm sst deploy --stage production   → Lambda + CloudFront (PRIMARY)
        ├─▶ Publish current SHA to SSM            → /cloudless/production/cloud-sha
        └─▶ [on success] HA sync orchestrator
              ├─▶ inspect existing pi build runs for deploy SHA
              ├─▶ dispatch build-pi-image.yml (if no existing build)
              └─▶ wait for pi build completion (15 min timeout)

build-pi-image.yml
  └─▶ Docker build arm64 → ECR cloudless-pi-app:latest
      └─▶ [on success] update SSM ECR_LATEST_DIGEST

deploy-pi.yml
  └─▶ kubectl set image deployment/cloudless to new tag
      └─▶ [on success] update SSM pi-sha (12-char short SHA)

k3s auto-healer (CronJob, every ~5 min)
  └─▶ detects new ECR digest → kubectl rollout restart deployment/cloudless -n cloudless
```

## Key SSM Parameters

| Parameter | Purpose | Written by |
|-----------|---------|-----------|
| `cloud-sha` | Full SHA of the last successful Lambda deploy | `deploy.yml` |
| `pi-sha` | 12-char short SHA of the last successful Pi rollout | `deploy-pi.yml` |
| `ECR_LATEST_DIGEST` | Digest of the latest Pi Docker image in ECR | `build-pi-image.yml` |

> ⚠️ The legacy `current-image-sha` parameter is **orphaned** — last written
> 2026-05-25 by code that no longer exists. Don't use it. Use `cloud-sha` for
> Lambda and `pi-sha` for Pi.

Check both with:

```
mcp__cloudless-infra__aws_get_ssm_parameters (parameter_name: "cloud-sha")
mcp__cloudless-infra__aws_get_ssm_parameters (parameter_name: "pi-sha")
mcp__cloudless-infra__aws_get_ssm_parameters (parameter_name: "ECR_LATEST_DIGEST")
```

## Checking Pipeline Status

### 1. Lambda SHA

```bash
# GH Actions — list recent runs
gh run list --limit 8 --json status,conclusion,name,headSha \
  --jq '.[] | "\(.status)\t\(.conclusion)\t\(.headSha[0:8])\t\(.name)"'
```

### 2. Pi / k3s SHA

```bash
# Health endpoint reports running SHA
curl -s https://pi-origin.cloudless.gr/api/health | python3 -m json.tool
# Expected: {"status":"ok","version":"<sha>"}
```

Or via cluster:

```
cluster_run_command(node: "omv-main", command: "curl -s http://localhost:3000/api/health")
```

### 3. Are they in sync?

Compare `version` from `/api/health` on `pi-origin.cloudless.gr` with `pi-sha` in SSM
(or with `cloud-sha` for the Lambda side). The Lambda and Pi can be on different
SHAs intentionally when a commit only touches paths excluded by `deploy-pi.yml`'s
path filter (k8s/, docs/, .github/) — that's working as designed.

## Common Failures

### "No ref found for: <sha>" in ha-sync-orchestrator

- **Cause**: `createWorkflowDispatch` was called with a commit SHA as `ref` — GitHub API only accepts branch/tag names.
- **Fix**: Orchestrator must use `ref: deployBranch`, not `ref: deploySha`. The `target_sha` input carries the exact SHA for checkout.
- **File**: `.github/workflows/ha-sync-orchestrator.yml` — dispatch step.

### Orchestrator skipped (conclusion: skipped)

- **Cause**: Deploy workflow `conclusion !== 'success'` — orchestrator only fires on successful deploys.
- **Fix**: Fix the deploy failure first, then redeploy.

### Pi image built but pod still running old version

- Auto-healer runs every ~5 min. If urgent, trigger manually:

```
cluster_run_command(node: "omv-main", command: "kubectl rollout restart deployment/cloudless -n cloudless")
```

Then verify:

```
k3s_get_pods(namespace: "cloudless")
```

New pod takes ~90s to become Ready (60s readiness probe delay + startup).

### Type Check fails in CI

- Local `.next/dev/types/` can have stale parse errors — these don't appear in CI (clean checkout).
- Check for real errors: `pnpm exec tsc --noEmit 2>&1 | Select-String -NotMatch '\.next.dev'`

### Lint fails — console.info not allowed

- Only `console.warn` and `console.error` are permitted by ESLint.
- Replace any `console.info` or `console.log` with `console.warn`.

## IAM Permissions Required

### Lambda execution role

Granted automatically via `sst.config.ts` `permissions` field:

```typescript
permissions: [
  {
    actions: ["bedrock:InvokeModel", "bedrock:Converse"],
    resources: [
      "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
      "arn:aws:bedrock:us-east-1:278585680617:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0",
    ],
  },
],
```

### omv-main-cli (Pi IAM user)

**Must be applied manually** — the GH Actions OIDC role and omv-main-cli itself cannot call `iam:PutUserPolicy`. Run once with admin credentials:

```bash
aws iam put-user-policy \
  --user-name omv-main-cli \
  --policy-name BedrockChatAccess \
  --policy-document '{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Action":["bedrock:InvokeModel","bedrock:Converse"],
      "Resource":[
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
        "arn:aws:bedrock:us-east-1:278585680617:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0"
      ]
    }]
  }'
```

## Quick Full-Pipeline Check

```
1. gh run list --limit 5  → look for "Deploy to Production" success
2. aws_get_ssm_parameters(cloud-sha)  → note the SHA
3. curl https://pi-origin.cloudless.gr/api/health  → compare version
4. If version != SHA → trigger rollout restart (see pi-image-rollout skill)
```
