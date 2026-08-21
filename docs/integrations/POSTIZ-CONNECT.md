# Connect P0 channels (operator checklist)

OAuth app credentials are restored on the Postiz pod for **LinkedIn, X, TikTok**
(+ `POSTIZ_API_KEY`). **Facebook/Instagram** are still missing from SSM —
add `FACEBOOK_APP_ID` + `FACEBOOK_APP_SECRET` then re-run
`bash scripts/postiz-restore-providers.sh`.

## Verify pod is ready

```bash
kubectl -n postiz exec deploy/postiz -- sh -c \
  'for k in LINKEDIN_CLIENT_ID X_API_KEY TIKTOK_CLIENT_ID FACEBOOK_APP_ID; do
     [ -n "$(printenv $k)" ] && echo OK $k || echo MISSING $k
   done'
```

## Redirect URIs (developer consoles)

For each OAuth app, whitelist:

`https://postiz.cloudless.gr/integrations/social/<provider>`

| Channel | provider path | Needs env |
| --- | --- | --- |
| LinkedIn / LinkedIn Page | `linkedin` | LINKEDIN_* ✅ |
| X | `x` | X_API_* ✅ |
| TikTok | `tiktok` | TIKTOK_CLIENT_* ✅ |
| Facebook Page | `facebook` | FACEBOOK_* ❌ until SSM |
| Instagram (FB) | `instagram` | same FACEBOOK_* ❌ |
| Bluesky | (dialog) | none — app password in UI |

## Connect steps

1. Open https://postiz.cloudless.gr (CF Access) → log in as admin.
2. Channels / Launches → connect **LinkedIn Page**, **X**, **TikTok**, **Bluesky**.
3. Skip Facebook/IG until FACEBOOK_* is in SSM.
4. Confirm:

```bash
# Tailscale NodePort
curl -sS -H "Authorization: $POSTIZ_API_KEY" \
  http://100.74.191.58:30500/api/public/v1/integrations | jq 'length'
kubectl -n postiz exec deploy/postiz-postgres -- \
  psql -U postiz -d postiz -tAc 'SELECT count(*) FROM "Integration";'
```

5. Cursor MCP → refresh Postiz → “List my Postiz integrations”.

## LinkedIn `inBetweenSteps` stuck (v2.11.2)

If page selection fails with a red `!`, see the avatar CDN hot-fix in
`skills/postiz/SKILL.md` (known LinkedIn avatar 403 abort).

## Postiz → cloudless webhook

In Postiz → Settings → Webhooks / Integrations → add:

`https://cloudless.gr/api/webhooks/postiz?secret=<POSTIZ_WEBHOOK_SECRET>`

Events: post published + post errored. Secret lives in SSM
`/cloudless/production/POSTIZ_WEBHOOK_SECRET`.
