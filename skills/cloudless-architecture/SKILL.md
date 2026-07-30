# cloudless.gr architecture skill

Use this skill whenever answering architecture, deployment, failover, or infrastructure questions for cloudless.gr.

## Core architecture (2026-07-30)

- **Production web app:** Cloudflare edge → `workers/pi-origin-proxy` → Tunnel
  `pi-origin.cloudless.gr` → Pi k3s `cloudless-app` (NodePort 30300).
- **App deploys:** `.github/workflows/deploy-pi.yml` (not OpenNext on Workers Free).
- **Workers Free:** Full OpenNext SSR ~5.5 MiB gzip cannot deploy (3 MiB limit).
  Keep the edge Worker as the tiny proxy only.
- **Data plane:** Cloudflare D1 (`user-auth-db`) + R2 (`datalake-bucket`).
- **Auth default:** D1 sessions. Cognito JWKS only when
  `NEXT_PUBLIC_AUTH_PROVIDER=cognito`.
- **Config default:** D1 `app_config` + k8s secrets (`SSM_DISABLED=1` on Pi).
  AWS SSM / Lambda / CloudFront / Athena are **legacy — do not expand**.
- **Self-hosted on Pi only** (no AWS replicas):
  - AppFlowy, EspoCRM, Postiz, n8n, Mosquitto, Grafana, Uptime Kuma, ntfy, Meilisearch

## Important constraints

- Prefer Cloudflare (Workers / R2 / D1 / Access / Tunnel) over new AWS work.
- Do **not** install AWS CLI or add AWS SDK for agent/operator work.
- Do not assume Pi-hosted apps have AWS replicas.
- Hardware: omv + omv-ha only (no third Pi).
- For production changes, prefer incremental checklist-aligned work
  (`docs/current-source-of-truth-checklist.md`).
- Keep secrets out of responses and patches.

## Recommended reasoning

When suggesting changes:

1. Identify whether the change affects edge proxy, Pi app, D1/R2, self-hosted apps, or legacy AWS.
2. Check if the change touches persistent k3s storage (prefer sda1 k3s disk).
3. Check if the change requires secret rotation or new env / D1 config keys.
4. Propose tests and rollback steps.
5. Canonical docs: `docs/ARCHITECTURE.md`, `docs/CLOUDFLARE-ARCHITECTURE.md`, `docs/HA-ARCHITECTURE.md`.
