# authentik-ops

Operate the self-hosted authentik IdP (omv k3s `authentik` ns, `auth.cloudless.gr`) — the SSO gate replacing CF Access for internal GUIs. Covers health/status, adding a gated host end-to-end, outpost health, API token ops, and the `.env` `AUTHENTIK_OUTPOST_TOKEN` injection.

## When to use

- "is authentik up" / check outpost/provider health
- gate a new host behind SSO (omv service or cu130 docker service)
- the cu130 `authentik-outpost` container needs its token in `.env`
- rotate the ops API token / bootstrap password

## State (verified 2026-10-30)

- Pods: `authentik-server` (NodePort :30910), `-worker`, `-postgres`, `-redis`
- Admin: `auth.cloudless.gr/if/admin/` → `akadmin` / `bootstrap-password` in k8s secret `authentik-secret`
- API token identifier `ops-api` (created via `ak shell`, not `AUTHENTIK_BOOTSTRAP_TOKEN` — that env doesn't mint an API key on 2025.10)
- Embedded outpost gates omv hosts; `cu130` remote outpost (`authentik-outpost` container on `cu130-backend`) gates docker services
- Worker OOMKilled at 384Mi — now 640Mi; server 896Mi

## Tools

`scripts/ak_ops.py` — one entrypoint (SSHes to omv `tbaltzakis@100.74.191.58`, `~/.ssh/id_rsa_win`):

```bash
python3 ak_ops.py status                     # pods, outposts, providers, tunnel gate check
python3 ak_ops.py add omv files.cloudless.gr http://192.168.1.128:3671   # gate omv host
python3 ak_ops.py add cu130 foo.cloudless.gr http://stack-ops:8080       # gate cu130 host
python3 ak_ops.py env-token                  # print the cu130 outpost token for .env
python3 ak_ops.py outposts                   # list outposts + assigned providers
python3 ak_ops.py health                     # pod restarts + OOM check
```

`add` does the full chain: proxy provider → application → outpost assign → tunnel repoint → DNS CNAME. `omv` = embedded outpost (origin `192.168.1.128:PORT`), `cu130` = remote outpost (docker name).

## Gotchas

- NodePorts not reachable via `localhost` on omv — always `192.168.1.128`
- Two cloudflared replicas serve the omv tunnel (omv + omv-ha) — every origin must be a LAN IP
- `AUTHENTIK_BOOTSTRAP_TOKEN` env does NOT create an API token — mint via `ak shell` (see `ak_token` path)
- cu130 docker pull needs `DOCKER_CONFIG` with empty credsStore (Windows `docker-credential-desktop.exe` absent on WSL)
- `.env` `AUTHENTIK_OUTPOST_TOKEN` required before next `docker compose up` — get it via `ak_ops.py env-token`

## Adding app-level OIDC (separate from proxy gate)

For apps supporting OAuth2 (Grafana, Portainer, Metabase, n8n): create a Provider
`OIDC/OAuth2` instead of proxy → wire the app's oauth config to
`https://auth.cloudless.gr/application/o/<slug>/`. Proxy gate stays as outer layer.
