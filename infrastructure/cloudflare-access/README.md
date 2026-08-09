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
- **One-time PIN (OTP) identity provider** — Cloudflare emails a 6-digit code to
  the address entered at login, so no third-party IdP is required
- Cookie session timeout: 1 hour (auto-refresh)

DNS routing stays the same — Access policies are enforced at the tunnel level.
See: `infrastructure/cloudflare-tunnels/logs-cloudless-gr.yaml` for existing tunnel pattern.

## One-time PIN (OTP) login

Cloudflare Access can authenticate users via an emailed one-time PIN **without**
a third-party identity provider. This is how `Enter your code` / `cloudless-gr`
works.

**Why the code wasn't arriving:** the Access applications referenced email
policies but had **no identity provider attached**. Without an `onetimepin`
IdP wired into `allowed_idps`, Cloudflare never generates or sends the OTP
email — the login page just sits at "Enter your code".

**The fix** is in `access-apps.tf`:

```terraform
resource "cloudflare_zero_trust_access_identity_provider" "onetimepin" {
  account_id = var.cloudflare_account_id   # e.g. fb7dc7b69b662480cd5961a4d1913c78
  name       = "One-time PIN login"
  type       = "onetimepin"
  config     = {}
}
```

Each Access Application now lists the OTP IdP in `allowed_idps`.

### How OTP login works

1. Go to the protected app (e.g. grafana.cloudless.gr).
2. On the Access login page, enter your email (tbaltzakis@cloudless.gr) and
   select **Send login code**.
3. Cloudflare emails a 6-digit PIN to that address.
4. The PIN expires **10 minutes** after the request and is **single-use**.
5. Paste the PIN into the page and select **Sign in**.

### OTP email deliverability

Cloudflare sends the OTP from its own mail infrastructure to the address you
entered. Two things must hold for delivery:

- The address you enter MUST be allowed by an Access policy (the include rule).
- If that address is `@cloudless.gr` (e.g. `tbaltzakis@cloudless.gr`), the
  mailbox must actually exist & be able to receive mail — see
  `scripts/configure-email-routing.sh` to configure Email Routing and verify the
  destination address. If the inbox is elsewhere (e.g. Gmail), just enter that
  address and ensure it's listed in the policy include rules.

## Access Applications

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

## Deploying

```bash
cd infrastructure/cloudflare-access
terraform init
terraform plan \
  -var="cloudflare_account_id=fb7dc7b69b662480cd5961a4d1913c78"
terraform apply \
  -var="cloudflare_account_id=fb7dc7b69b662480cd5961a4d1913c78"
```

After apply, store any output client secrets where needed (wrangler secrets /
D1 config).

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

## Troubleshooting: OTP email not arriving

1. **Confirm the `onetimepin` IdP exists** in the account:
   ```bash
   curl -s "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/access/identity_providers" \
     -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
     | jq -r '.result[] | select(.type=="onetimepin") | .name'
   ```
2. **Confirm the app has `allowed_idps`** pointing at that IdP.
3. **Confirm the policy includes your email address** in its include rules.
4. **Verify the destination inbox can receive mail** — check spam, and that
   Email Routing destination is verified (`scripts/configure-email-routing.sh`).
5. **Check Cloudflare audit logs** — Zero Trust → Logs → Access for the attempted login.