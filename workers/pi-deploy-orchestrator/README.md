# pi-deploy-orchestrator

Cloudflare Worker + Workflow that coordinates **pull-based** Pi deploys.

## Flow

1. GitHub Actions builds standalone → uploads `releases/<sha>.tar.zst` to R2 `cloudless-pi-releases`.
2. Actions `POST /trigger` with bearer token → starts Workflow instance.
3. Workflow writes `desired.json` to R2 and polls `pi-origin` `/api/health` until `version` matches (or 45m timeout).
4. omv `pi-release-pull.timer` reads `/desired`, downloads via `GET /artifact` when load is low, promotes hostPath.

## Tracking

All layers share: `sha`, `sha12`, `artifactKey`, `workflowInstanceId`, `githubRunId`.

- Terminal Workflow states → Slack webhook + ntfy (optional secrets).
- Agent ticks → `journalctl -t pi-release-pull` + `POST /agent-event`.
- GH job → step summary + comment on issue #382.

## Routes

| Method | Path             | Auth   | Purpose                                                          |
| ------ | ---------------- | ------ | ---------------------------------------------------------------- |
| GET    | `/health`        | no     | Liveness                                                         |
| GET    | `/desired`       | bearer | Current desired release JSON                                     |
| GET    | `/artifact?key=` | bearer | Stream release tarball from R2 (omv uses this; no R2 keys on Pi) |
| POST   | `/trigger`       | bearer | Start Workflow after R2 upload                                   |
| POST   | `/agent-event`   | bearer | Agent tracking events                                            |

## Deploy

```bash
cd workers/pi-deploy-orchestrator
npx wrangler r2 bucket create cloudless-pi-releases   # once
npx wrangler deploy --config wrangler.jsonc
npx wrangler secret put DEPLOY_ORCHESTRATOR_TOKEN --config wrangler.jsonc
npx wrangler secret put SLACK_WEBHOOK_URL --config wrangler.jsonc   # optional
npx wrangler secret put NTFY_URL --config wrangler.jsonc            # optional
npx wrangler secret put NTFY_TOKEN --config wrangler.jsonc          # optional
```

Always pass `--config wrangler.jsonc` (or `cd` into this dir **and** ensure no parent
`workers/wrangler.json` is picked up).

Set GitHub repo variable `PI_DEPLOY_ORCHESTRATOR_URL` to the workers.dev URL
and secret `DEPLOY_ORCHESTRATOR_TOKEN` to the same token.

## omv agent

```bash
# /etc/cloudless/pi-release-pull.env — URL + token only (R2 keys optional fallback)
sudo python3 infrastructure/omv/install-pi-release-pull.py
journalctl -t pi-release-pull -f
```

## force_rebuild (same-SHA redeploy)

`deploy-pi.yml` accepts `force_rebuild` for rebuilding + redeploying a SHA that
is already live — needed when a build-time `NEXT_PUBLIC_*` env/secret changed
after the SHA first deployed (e.g. enabling a new analytics ID without new
code). The flag flows trigger → orchestrator → `desired.json` → pull agent.

A forced run needs BOTH updated components, in this order:

1. This worker redeployed (`npx wrangler deploy --config wrangler.jsonc`) — it
   forwards `forceRebuild` into `desired.json` and verifies the rebuilt bundle
   via the `-f<instanceId>` APP_VERSION stamp instead of accepting the live SHA.
2. The omv pull agent updated (`sudo python3 infrastructure/omv/install-pi-release-pull.py`)
   — it dedupes forced runs per workflowInstanceId (`.done` marker, max 3
   tries), extracts to `releases/<sha12>-f<id>` so the live build and rollback
   stay intact, and stamps `APP_VERSION=<sha>-f<id>` so probes can't pass on
   the old bundle.
