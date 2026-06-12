# Postiz — Social Publishing Engine

Postiz (open-source, self-hosted) is the publishing engine behind the content
calendar: it owns the OAuth connections to Facebook, Instagram, LinkedIn, X,
TikTok (28+ channels) and executes the posts. The app talks to it through
`src/lib/postiz.ts` (Public API v1).

## Architecture

```
/admin/calendar (social_post item, status=draft)
        │  click → POST /api/admin/calendar/[id]/publish
        ▼
src/lib/postiz.ts ── Authorization: POSTIZ_API_KEY ──► https://postiz.cloudless.gr/api/public/v1
        │                                                    │
        │  item.date future → type=schedule                  ▼
        │  item.date past   → type=now            Postiz posts to the connected
        ▼                                         FB/IG/LinkedIn/X/TikTok channels
calendar item status → scheduled / published
```

## Deploy on the k3s cluster

1. **Create namespace + secret** (on omv-main or via CI kubectl):

   ```bash
   kubectl create namespace postiz
   kubectl -n postiz create secret generic postiz-secrets \
     --from-literal=POSTGRES_PASSWORD="$(openssl rand -hex 24)" \
     --from-literal=JWT_SECRET="$(openssl rand -hex 32)"
   ```

2. **Apply the manifests**:

   ```bash
   kubectl apply -f infrastructure/postiz/k8s/postiz.yaml
   kubectl -n postiz get pods -w
   ```

   Pi sizing note: the Postiz pod requests 512Mi / limits 1536Mi. The limit is
   above the app's steady-state RSS on purpose — see the JVM lesson in
   CLAUDE.md: a low limit doesn't reduce real usage, it only invites OOMKills.

3. **Expose via the Cloudflare tunnel** — add the ingress rule from
   `infrastructure/postiz/cloudflare-tunnel.yaml` to
   `/etc/cloudflared/config.yml` on omv-main, add the
   `postiz.cloudless.gr` CNAME, then `sudo systemctl reload cloudflared`.

4. **First-run setup in the Postiz UI** (`https://postiz.cloudless.gr`):
   - Register the admin account, then set `DISABLE_REGISTRATION="true"` in the
     deployment and re-apply.
   - Connect channels (Settings → Channels): Facebook Page, Instagram,
     LinkedIn, X, TikTok. Each requires a platform developer app — Postiz docs
     cover the per-provider setup; the repo skills
     `.claude/skills/meta-business-help` and `instagram-graph-api` cover the
     Meta side.
   - Create an API key: Settings → Public API.

5. **Wire the app** — set SSM params (then the 5-min config cache picks them up):

   ```bash
   aws ssm put-parameter --name /cloudless/production/POSTIZ_API_URL \
     --type String --value "https://postiz.cloudless.gr" --overwrite
   aws ssm put-parameter --name /cloudless/production/POSTIZ_API_KEY \
     --type SecureString --value "<key from Postiz Settings → Public API>" --overwrite
   ```

## App integration surface

| Surface | Behaviour |
|---------|-----------|
| `GET /api/admin/postiz` | Health + connected channels. 503 until SSM params are set. |
| `POST /api/admin/calendar/[id]/publish` | Publishes a `social_post` calendar item. Body `{ content?, asDraft? }`. Content defaults to the item's notes, then title. 409 when no Postiz channel matches the item's platform. |
| `/admin/calendar` | Draft social posts show a ↗ marker — clicking offers one-click publish; × deletes. |

Platform mapping (`PLATFORM_TO_POSTIZ_IDENTIFIERS` in `src/lib/postiz.ts`):
calendar `meta` → Postiz `facebook` + `instagram`; `linkedin` → `linkedin` +
`linkedin-page`; `x` → `x`; `tiktok` → `tiktok`.

## Status flow

Publishing a draft moves the calendar item to `scheduled` (future date) or
`published` (past/today). Postiz is the source of truth for delivery; failures
on its side are visible in the Postiz UI. A nightly metrics pull-back into the
calendar is planned in the roadmap (Phase 2, item 5) but not yet implemented.

## Troubleshooting

- **503 from /api/admin/postiz** — SSM params missing or cache stale (wait ≤5 min).
- **409 on publish** — the item's platform has no connected channel in Postiz.
- **502 on publish** — Postiz rejected the post; check the Postiz container logs:
  `kubectl -n postiz logs deploy/postiz --tail=100`.
- **Pod OOMKilled on the Pi** — raise the memory limit; do not lower `requests`.
