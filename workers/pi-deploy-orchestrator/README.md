# pi-deploy-orchestrator

Cloudflare Worker + Workflow that coordinates **pull-based** Pi deploys.

## Flow

1. GitHub Actions builds standalone → uploads `releases/<sha>.tar.zst` to R2 `cloudless-pi-releases`.
2. Actions `POST /trigger` with bearer token → starts Workflow instance.
3. Workflow writes `desired.json` to R2 and polls `pi-origin` `/api/health` until `version` matches (or 45m timeout).
4. omv `pi-release-pull.timer` reads `/desired`, downloads when load is low, promotes hostPath.

## Tracking

All layers share: `sha`, `sha12`, `artifactKey`, `workflowInstanceId`, `githubRunId`.

- Terminal Workflow states → Slack webhook + ntfy (optional secrets).
- Agent ticks → `journalctl -t pi-release-pull` + `POST /agent-event`.
- GH job → step summary + comment on issue #382.

## Deploy

```bash
cd workers/pi-deploy-orchestrator
npx wrangler r2 bucket create cloudless-pi-releases   # once
npx wrangler deploy
npx wrangler secret put DEPLOY_ORCHESTRATOR_TOKEN
npx wrangler secret put SLACK_WEBHOOK_URL             # optional
npx wrangler secret put NTFY_URL                      # optional
npx wrangler secret put NTFY_TOKEN                    # optional
```

Set GitHub repo variable `PI_DEPLOY_ORCHESTRATOR_URL` to the workers.dev URL
and secret `DEPLOY_ORCHESTRATOR_TOKEN` to the same token.
