---
name: pi-image-rollout
description: Update the Pi k3s deployment to the latest ECR image. Use when the user asks to update the Pi, restart the app on the Pi, deploy a new version to the Pi, or after a Pi image build completes. Triggers on "update Pi", "rollout", "restart Pi app", "Pi deploy", "new image".
allowed-tools: mcp__cloudless-infra__k3s_get_pods, mcp__cloudless-infra__cluster_run_command, mcp__cloudless-infra__aws_get_ssm_parameters, mcp__cloudless-infra__k3s_get_pod_logs
---

# Pi Image Rollout — pi-origin.cloudless.gr

## Overview

The k3s `cloudless` deployment on `omv` runs the Pi standby image (`cloudless-pi-app:latest` from ECR).
It uses `imagePullPolicy: Always`, so a rollout restart always pulls the latest ECR image.

**Pod spec:**

- Image: `278585680617.dkr.ecr.us-east-1.amazonaws.com/cloudless-pi-app:latest`
- AWS creds: `pi-standby-aws-creds` secret (= `omv-main-cli` key)
- Readiness probe: `GET /api/health` — delay 60s, period 10s, failureThreshold 3
- Liveness probe: `GET /api/health` — delay 60s, period 30s, failureThreshold 3
- Node affinity: `omv` (Pi 5)
- Resources: 100m–500m CPU, 256–512Mi memory

## When to Roll Out

Roll out **after** a new Pi image has been built and pushed to ECR:

1. After `ha-sync-orchestrator` succeeds for the current deploy SHA
2. Or after manually running `build-pi-image.yml`
3. The auto-healer CronJob (`cloudless` namespace) detects new images every ~5 min — rollout may happen automatically

## Steps

### 1. Confirm new image is ready

```
aws_get_ssm_parameters(parameter_name: "pi-sha")
aws_get_ssm_parameters(parameter_name: "ECR_LATEST_DIGEST")
```

Both should reflect the intended SHA. (`pi-sha` is the 12-char short SHA of
the last deploy-pi.yml run; the legacy `current-image-sha` is orphaned.)

### 2. Check current pod version

```
cluster_run_command(node: "omv-main",
  command: "curl -s http://localhost:3000/api/health")
```

`version` field = running SHA. Compare with `pi-sha`.

### 3. Trigger rollout restart

```
cluster_run_command(node: "omv-main",
  command: "kubectl rollout restart deployment/cloudless -n cloudless")
```

### 4. Monitor rollout

```
k3s_get_pods(namespace: "cloudless")
```

Watch for a new pod in `Running` state. Old pod terminates once new pod passes readiness.
**Expected timeline: ~90 seconds** (60s readiness delay + ~30s startup).

### 5. Verify new version

```
cluster_run_command(node: "omv-main",
  command: "curl -s https://pi-origin.cloudless.gr/api/health | python3 -m json.tool")
```

`version` should now match `pi-sha`.

## Pod States During Rollout

```
cloudless-<old>   1/1 Running   ← serving traffic
cloudless-<new>   0/1 Running   ← starting (not yet ready — probe delay)
  ... ~90s later ...
cloudless-<new>   1/1 Running   ← passing readiness, now serving
cloudless-<old>   (terminated)
```

## Rollout Failure / Stuck Pod

If new pod stays `0/1` for >3 min:

```bash
# Get new pod name
kubectl get pods -n cloudless --no-headers | grep -v Completed

# Describe it for events
kubectl describe pod <pod-name> -n cloudless
```

Common causes:

- ECR image pull failure (check `omv-main-cli` ECR permissions)
- OOMKilled (check memory limits vs actual usage)
- Health check failing (check `/api/health` from inside pod)

## Auto-Healer

The `auto-healer` CronJob runs in the `cloudless` namespace approximately every 5 minutes.
It checks if the running image digest matches `ECR_LATEST_DIGEST` in SSM and triggers a rollout restart if stale.

If the auto-healer already ran (check for `auto-healer-*` pod in `Completed` state), the rollout may already be in progress.

## Logs After Rollout

```
k3s_get_pod_logs(namespace: "cloudless", selector: "app=cloudless", tail: 50)
```

Look for startup messages confirming the Next.js server started on port 3000.

## Bedrock Chat After Rollout

The new pod uses `cloudless-pi-standby` IAM credentials from `pi-standby-aws-creds` secret
(key `AKIAUBXIAELU7NG7LBAQ`). Note: `omv-main-cli` is the Pi **node's** own IAM user for CLI
operations — the k3s pod credentials belong to `cloudless-pi-standby`.
For Bedrock chat (`/api/chat`) to work on the Pi surface, `cloudless-pi-standby` must have
`bedrock:InvokeModel` + `bedrock:Converse`. Run this with admin credentials if not yet applied:

```bash
aws iam put-user-policy \
  --user-name cloudless-pi-standby \
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

IAM permissions are effective immediately — no pod restart required.
