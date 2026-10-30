# auth-central-ops

One pane for every authentication surface in the Cloudless stack — the
self-hosted authentik IdP (`auth.cloudless.gr`), Cloudflare Access (ZT), app
logins, stored social-platform OAuth tokens, TOTP secrets, and API tokens.

## When to use

- "what's the state of all auth" / one dashboard across every login surface
- wire an app (Grafana, Portainer, Metabase, n8n, FileBrowser, EspoCRM) into
  authentik OIDC instead of its own login
- audit which OAuth/TOTP/API credentials are live vs expired

## The auth map (2026-10-30)

| Layer        | Where                                                             | Gate                               |
| ------------ | ----------------------------------------------------------------- | ---------------------------------- |
| IdP          | authentik on omv k3s, `auth.cloudless.gr`, NodePort :30910        | akadmin users, MFA, proxy outposts |
| CF Access    | Zero Trust on the OTHER account (API can't reach)                 | omv tunnel hostnames               |
| App logins   | per-app (social, EspoCRM, Grafana, Metabase…)                     | own user DB                        |
| OAuth tokens | `social_accounts` table (X, Meta, LinkedIn, TikTok, IG, WA)       | bearer per platform                |
| TOTP         | `TWITTER_TOTP_SECRET` (in progress), `META_TOTP_SECRET` (pending) | `.env`                             |
| API tokens   | `CLOUDFLARE_API_TOKEN`, authentik `ops-api`, outpost token        | `.env` / k8s secret                |

## Tools

`scripts/auth_status.py` — SSHes to omv + queries social-api env:

```bash
python3 auth_status.py          # every surface, one report
python3 auth_status.py --short  # names only
```

`scripts/oidc_wire.py` — create an authentik OIDC provider + print the app's
oauth config to paste in (Grafana env, Portainer oauth, Metabase jwt…):

```bash
python3 oidc_wire.py grafana    # creates provider + prints grafana env
python3 oidc_wire.py metabase
```

## Gotchas

- `AUTHENTIK_BOOTSTRAP_TOKEN` env does NOT mint an API token — `ops-api` key is
  in k8s secret `authentik-secret` → `ops-api-token`
- CF Access lives on a different CF account — the API token can only read the
  zone + tunnels, NOT the ZT org. Use `cf-access-ops` for the ZT side.
- authentik proxy outposts gate at HTTP — for REAL app SSO, wire OIDC at the
  app layer (this tool) — the outpost stays as outer boundary.
