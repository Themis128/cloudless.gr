# Postiz Service Token — Where it belongs

## What this token is for

`POSTIZ_SERVICE_TOKEN` is a **Cloudflare Access Service Token** (JWT) that lets
server-side code call the Postiz API (`postiz.cloudless.gr`) without hitting the
Access login page. It is consumed in exactly one place:

- [`src/lib/postiz.ts`](src/lib/postiz.ts) — `postizFetch()` reads
  `process.env.POSTIZ_SERVICE_TOKEN` and sets `Cf-Access-Client-Id` +
  `Cf-Access-Client-Secret` on every outbound request.

That code runs in the **Next.js app on the Pi k3s cluster**, not in a
Cloudflare Worker. The `cloudless2` Worker
([`workers/pi-origin-proxy`](workers/pi-origin-proxy/)) is a <50 KiB Free-tier
proxy that streams requests straight through to `pi-origin.cloudless.gr` — it
holds no secrets and never sees Postiz.

## Where the token goes

| Layer | Storage | Purpose |
|-------|---------|---------|
| Pi Next.js app (runtime) | k8s Secret `pi-standby-aws-creds` → hydrated by `getIntegrationsAsync()` from SSM `/cloudless/production/POSTIZ_SERVICE_TOKEN` | Server-side `postizFetch()` calls |
| GitHub Actions cron (`postiz-crons.yml`) | Repo secret `POSTIZ_SERVICE_TOKEN` if the workflow calls Postiz directly, otherwise not needed (crons hit `pi-origin.cloudless.gr/api/cron/...` and the app forwards) | Bypass Cloudflare Access from CI |
| Worker `cloudless2` | **nothing** — the proxy has no secrets | N/A |

## Setup

### 1. Create the Cloudflare Access Service Token

1. Cloudflare Dashboard → **Zero Trust** → **Access** → **Service Auth** → **Service Tokens**
2. **Create Service Token** — Name: `postiz-cron-worker`, Duration: 1 year (default)
3. Copy the **Client Secret** JWT immediately (shown once).

### 2. Add an Access Policy exception on the Postiz application

1. Zero Trust → **Access** → **Applications** → open `postiz.cloudless.gr`
2. Policies tab → edit the primary policy
3. Add an **Include** rule → **Service Token** → select `postiz-cron-worker`
4. Save.

### 3. Store the token in SSM (Pi runtime)

```bash
aws ssm put-parameter \
  --name /cloudless/production/POSTIZ_SERVICE_TOKEN \
  --type SecureString \
  --value "$(cat <<'EOF'
<paste the JWT>
EOF
)" \
  --overwrite
```

Next Pi rollout (`deploy-pi.yml`) will pick it up via
`pi-standby-aws-creds` and `getIntegrationsAsync()` — no code change needed.

### 4. (Optional) Store in GitHub for direct CI callers

Only needed if a workflow calls `postiz.cloudless.gr` directly instead of
routing through the app:

```bash
gh secret set POSTIZ_SERVICE_TOKEN --repo Themis128/cloudless.gr
```

## Verify

Local sanity check with the token in your shell env:

```bash
POSTIZ_SERVICE_TOKEN=<jwt> node verify-postiz-token.js
```

End-to-end check against the live Pi (uses the same code path as the crons):

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://pi-origin.cloudless.gr/api/cron/postiz-sync | jq .
```

A successful response returns the sync-stats JSON. A `502` or Cloudflare Access
HTML means the token isn't reaching Postiz — check the Access Audit Log in the
Cloudflare Dashboard.

## Security notes

- Never commit the JWT to git — SSM SecureString + `--type SecureString` only.
- Rotate every ~90 days: create a new token, add it to the Access policy,
  update SSM, wait for the next Pi rollout, then delete the old token.
- The token grants full access to `postiz.cloudless.gr` — keep the Access
  policy scoped tightly.
