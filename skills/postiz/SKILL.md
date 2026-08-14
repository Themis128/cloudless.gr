---
name: postiz
description: |
  Operate the self-hosted Postiz social-media scheduler that powers the
  cloudless.gr publishing flow — deploy, upgrade, configure social-provider
  channels, post via the Public API, and integrate from the admin UI. Use
  whenever the user mentions "Postiz", "schedule a post", "social channel",
  "publish to facebook/instagram/linkedin/x/tiktok", "POSTIZ_API_KEY",
  "/admin/postiz", or any Postiz Helm/manifest/Cloudflare-tunnel concern.
  Pair with `postiz-doctor` for failures.
---

# Postiz — operations skill

Postiz is a self-hosted social publishing engine pinned at **v2.11.2** on the
omv-main Pi 5 in our k3s cluster. It owns the OAuth connections to the social
platforms; cloudless.gr uses its Public API to push posts from the calendar
and the `/admin/postiz` console.

## Architecture at a glance

```
Cloudflare DNS                                                   k3s on omv-main
└─ postiz.cloudless.gr (CNAME → cloudflared tunnel)              ┌──────────────────────────┐
   └─ cloudflared on omv-main                                    │ Service postiz NodePort  │
      └─ http://192.168.1.128:30500 ────────────────────────────►│   30500 → pod 5000       │
                                                                 │ Deployment postiz        │
                                                                 │ Deployment postiz-postgres
cloudless.gr Next.js ──── Public API (Authorization header) ────►│ Deployment postiz-redis  │
   ▲ POSTIZ_API_URL=https://postiz.cloudless.gr                  └──────────────────────────┘
   ▲ POSTIZ_API_KEY=<from Postiz UI → Settings → Public API>          PVCs (local-path):
   │                                                                  - postiz-postgres-data 2Gi
   │   /admin/postiz page    →  /api/admin/postiz/* proxies            - postiz-redis-data 512Mi
   │   /admin/calendar   →  /api/admin/calendar/[id]/publish           - postiz-uploads 2Gi
```

## Where things live

| Concern | Path |
|---|---|
| Helm chart (canonical) | `infrastructure/postiz/helm/postiz/` |
| Legacy raw manifest (kept 1:1 in sync) | `infrastructure/postiz/k8s/postiz.yaml` |
| Cloudflare tunnel ingress rule | `infrastructure/postiz/cloudflare-tunnel.yaml` |
| Server-side client | `src/lib/postiz.ts` |
| API proxy routes | `src/app/api/admin/postiz/**` |
| Admin console UI | `src/app/[locale]/admin/postiz/page.tsx` |
| App-side docs | `docs/POSTIZ.md` |

**Pin rationale (v2.11.2):** v2.12+ made the Temporal workflow server
mandatory. Adding Temporal + its own Postgres + Elasticsearch caused
disk-pressure incidents on the Pi 5. Stay on v2.11.2 until we have either a
beefier node or a managed Temporal endpoint.

## Common ops

### Install / upgrade the Helm release

```bash
cd infrastructure/postiz/helm/postiz
./install.sh
```

Idempotent. Creates `postiz-secrets` if missing (generates JWT + Postgres
password via `openssl rand`), populates `postiz-providers` from SSM
`/cloudless/production/*` if AWS CLI is available, then `helm upgrade --install`.

### Tail logs

```bash
kubectl -n postiz logs deploy/postiz          -f --tail=200
kubectl -n postiz logs deploy/postiz-postgres -f --tail=200
kubectl -n postiz logs deploy/postiz-redis    -f --tail=200
```

From a Cowork session without local `kubectl`, the same via MCP:
`mcp__cloudless-infra__k3s_get_pod_logs({ namespace: "postiz", deployment: "postiz" })`.

### Restart Postiz only (postgres/redis untouched)

```bash
kubectl -n postiz rollout restart deploy/postiz
kubectl -n postiz rollout status  deploy/postiz --timeout=120s
```

### Bump the Postiz image tag

Edit `image.postiz.tag` in `infrastructure/postiz/helm/postiz/values-prod.yaml`,
then re-run `./install.sh`. **Do not skip past v2.11.2** without first
deploying a Temporal stack — see the migration guide in
`docs/POSTIZ.md` and Postiz upstream docs.

### Rotate JWT (forces all sessions to log out)

```bash
kubectl -n postiz patch secret postiz-secrets \
  -p "{\"data\":{\"JWT_SECRET\":\"$(openssl rand -hex 32 | base64 -w0)\"}}"
kubectl -n postiz rollout restart deploy/postiz
```

### Back up the database

```bash
kubectl -n postiz exec deploy/postiz-postgres -- \
  pg_dump -U postiz postiz > postiz-$(date +%Y%m%d).sql
```

## Wiring a new social provider

1. **Create the developer app** with the provider (Meta, LinkedIn, X, TikTok,
   Pinterest, YouTube, Reddit, …). Each one has its own setup page on the
   Postiz docs — `https://docs.postiz.com/providers/<provider>`.
2. **Whitelist the redirect URI**
   `https://postiz.cloudless.gr/integrations/social/<provider>`.
3. **Put the keys in SSM** under `/cloudless/production/<provider>_*`
   (e.g. `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`).
4. **Refresh the k8s secret** so the Postiz pod picks them up:

   ```bash
   cd infrastructure/postiz/helm/postiz
   ./install.sh        # re-pulls SSM into the postiz-providers secret
   kubectl -n postiz rollout restart deploy/postiz
   ```

5. **Connect the channel** in the Postiz UI: `https://postiz.cloudless.gr`
   → Settings → Channels → click the provider, run the OAuth flow.
6. **Verify** the channel shows up in the cloudless.gr admin:

   ```bash
   curl -H "Authorization: $POSTIZ_API_KEY" \
     https://postiz.cloudless.gr/api/public/v1/integrations | jq
   ```

   …and at `https://cloudless.gr/en/admin/postiz` (Channels tab).

## Cursor MCP

Postiz exposes streamable-HTTP MCP at `/api/mcp/<apiKey>` (9 tools on the
current image, including `integrationList` / `integrationSchedulePostTool`).

From this WSL/tailnet host, Cloudflare Access blocks the public hostname, so
Cursor is configured in `~/.cursor/mcp.json` against the Tailscale NodePort:

```text
http://100.74.191.58:30500/api/mcp/<POSTIZ_API_KEY>
```

See `scripts/cursor-mcp/README-postiz.md`. Reload Cursor MCP after key rotation.
`integrationList` returns `[]` until channels are connected in the Postiz UI.

## Ecosystem hub

For the full gitroomhq repo map (agent CLI, n8n node, agent-media, what to
skip) and implementation order, open **`postiz-hub`**. Related skills:
`postiz-agent-cli`, `postiz-agent-media`, `postiz-n8n-node`, `postiz-automation`,
`postiz-doctor`.

## Posting via the API

Smoke test (Bluesky needs no extra settings):

```bash
INTEGRATION_ID="..."   # from /integrations
curl -X POST https://postiz.cloudless.gr/api/public/v1/posts \
  -H "Authorization: $POSTIZ_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"now\",
    \"date\": \"$(date -u -d 'now' '+%Y-%m-%dT%H:%M:%S.000Z')\",
    \"shortLink\": false,
    \"tags\": [],
    \"posts\": [{
      \"integration\": { \"id\": \"$INTEGRATION_ID\" },
      \"value\": [{ \"content\": \"Hello from the API\", \"image\": [] }],
      \"settings\": { \"__type\": \"bluesky\" }
    }]
  }"
```

Provider-specific `settings.__type` and required fields are documented at
`https://docs.postiz.com/public-api/posts/create`. The admin UI's
`settingsFor()` helper in `page.tsx` is the source-of-truth for the
defaults we use.

Rate limits: 30 req/hr on `POST /posts` by default
(`API_LIMIT` env var). Batch multiple `posts` in one body to stay under it.

## Cloudflare tunnel — the network leg

The hostname `postiz.cloudless.gr` is routed by `cloudflared` running on
omv-main, configured at `/etc/cloudflared/config.yml`. The ingress rule
fragment is at `infrastructure/postiz/cloudflare-tunnel.yaml` —
append-paste it before the catch-all rule and reload:

```bash
sudo systemctl reload cloudflared
curl -I https://postiz.cloudless.gr   # 200 / 302 expected
```

If `curl` from outside returns 521/522/523, suspect the tunnel before
suspecting Postiz: `mcp__cloudless-infra__cloudflare_tunnel_status`.

## When things go wrong

→ Use `skills/postiz-doctor/SKILL.md`. It walks the stages in order
(reachability → DNS → tunnel → pod → DB → Redis → upstream).

## Shipping Postiz changes from a Cowork session

When you've edited Postiz files in a Cowork session and need to land them
on `main`, use `skills/postiz-apply/SKILL.md`. It wraps
`scripts/cowork-bundle.sh` with the canonical Postiz path set and a
ready-to-use PR body — produces a tarball + commit-message file +
`APPLY-*.md` that the user runs in `~/code/cloudless.gr` to commit /
push / squash-merge.

The underlying generic flow is `skills/cowork-wsl-handoff/SKILL.md` —
useful for any Cowork → WSL handoff, not just Postiz.

## Known v2.11.2 quirks (live)

- **`posts.0.value.0.image must be an array`** — the validator rejects post
  bodies without `image: []` on each `value` item. Always include it. Our
  `schedulePost()` already does this; don't remove it.
- **LinkedIn page connect: red `!` badge stuck** — `inBetweenSteps` stays
  true because the avatar download via the LinkedIn CDN returns 403 and
  aborts the save. Hot-fix in-pod (documented in `docs/POSTIZ.md`,
  Troubleshooting). Reverts on pod restart and only needed once per
  channel.

## Future work (don't do unsolicited)

- MCP tool wrappers (`mcp__cloudless-infra__postiz_*`) for status / logs /
  smoke from Cowork. Plumb through `tools/ssh-mcp/src/` once the shape is
  stable.
- Auto-restart watchdog like the k3s one (`Restart=always` on
  cloudflared if not already).
- Phase 2 nightly metrics pull-back into the content calendar.
