# Cloudflare Access — R15: Admin tunnel hosts

Protects self-hosted admin interfaces (grafana, kuma, appflowy, n8n) behind
Cloudflare Access with Service Tokens for zero-trust authentication.

## Prerequisites

- Cloudflare API token with Zone.Zone (read) + Account.Access: Apps (edit) scopes
- CLOUDFLARE_API_TOKEN stored in Cloudflare Secrets (wrangler secret)

## Architecture

Each admin app gets a dedicated Access Application with:

- Service Token authentication (for programmatic access from cloudless.gr)
- Allowed identity: tbaltzakis@cloudless.gr (the unified admin)
- Cookie session timeout: 1 hour (auto-refresh)

DNS routing stays the same — Access policies are enforced at the tunnel level.
See: `infrastructure/cloudflare-tunnels/logs-cloudless-gr.yaml` for existing tunnel pattern.

## Access Applications to create

| Hostname | Service Token Name |
|----------|-------------------|
| grafana.cloudless.gr | cloudless-grafana-access |
| kuma.cloudless.gr | cloudless-kuma-access |
| appflowy.cloudless.gr | cloudless-appflowy-access |
| n8n.cloudless.gr | cloudless-n8n-access |

### Policy template

- Decision: allow
- Precedence: 1
- Include: tbaltzakis@cloudless.gr

## Session duration

1h means users stay logged in for 1 hour.
auto_redirect=true means unauthenticated requests are redirected to Access login.

## Service tokens

Allow programmatic access without interactive login (for Slack integrations, automated checks).

## Secret storage (post-deployment)

After creating Service Tokens via Cloudflare dashboard, store in wrangler secrets:

```bash
wrangler secret put CLOUDFLARE_ACCESS_CLIENT_ID_GRAFANA
wrangler secret put CLOUDFLARE_ACCESS_CLIENT_SECRET_GRAFANA
```

For multiple apps, use a naming convention and store as secrets:

```bash
# Example for grafana access token pair
wrangler secret put CLOUDFLARE_ACCESS_TOKENS
```

Or create a D1 binding for token storage if using multiple tokens.

## Tunnel configuration

The existing tunnel (ID: e977a490-58c5-4fdb-9155-86832e3e636a) already routes to these hosts.
Access policies are enforced at the application level, not tunnel level.
No changes needed to `/etc/cloudflared/config.yml` on omv nodes for Access.
