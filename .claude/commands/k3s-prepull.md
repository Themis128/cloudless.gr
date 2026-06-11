# /k3s-prepull — pre-pull ECR image into k3s containerd on omv

Pulls a given ECR image directly into the k8s.io containerd namespace on omv-main
*before* triggering a kubectl rollout. Pod startup becomes near-instant (~10s) instead
of waiting 4+ minutes for the in-rollout ECR pull.

## When to use

- Before manually triggering a deployment update (avoids rollout timeout)
- After `build-pi-image.yml` completes but before the rollout step
- Any time the deploy-pi workflow fails in the rollout step with "timed out waiting for the condition"

## Steps

1. **Resolve the target image URI** — if no image is given, read the latest deployed SHA from SSM:

   ```powershell
   aws ssm get-parameter --name "/cloudless/production/pi-sha" --query "Parameter.Value" --output text
   ```

   Construct the full image: `278585680617.dkr.ecr.us-east-1.amazonaws.com/cloudless-pi-app:<sha>`

2. **Pre-pull via MCP tool** — call `mcp__cloudless-infra__k3s_prepull_image` with:
   - `image`: the full image URI from step 1
   - `aws_region`: `us-east-1`

   This runs `sudo ctr -n k8s.io images pull -u "AWS:$TOKEN" $IMAGE` on omv-main via SSH.
   Expected duration: 2–4 min on first pull, <5s for a cached SHA.

3. **Report result** — confirm the image tag appears in `sudo ctr -n k8s.io images ls` output.

4. **Optional rollout** — if the user wants to trigger the rollout immediately after:

   ```powershell
   gh workflow run "Deploy to Pi (ECR + k3s rollout)" --repo Themis128/cloudless.gr --ref main
   ```

## Notes

- Do NOT use `k3s ctr` or `crictl` — they ignore ECR credentials for the k8s.io namespace.
- The MCP tool runs on omv-main which has the `pi-standby-aws-creds` secret mounted, so
  AWS authentication is available even without passing keys explicitly.
- After a successful pre-pull, `kubectl rollout status` completes in <30s.
