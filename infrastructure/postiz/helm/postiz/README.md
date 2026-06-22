# Postiz Helm chart

Helm chart for [Postiz](https://postiz.com), tailored to the cloudless.gr
k3s cluster on omv-main. Replaces the broken upstream
[gitroomhq/postiz-helmchart](https://github.com/gitroomhq/postiz-helmchart),
which is stuck at `appVersion 1.3.0` and has no Temporal templates.

## Why this chart instead of upstream

| Concern | Upstream chart | This chart |
|---|---|---|
| appVersion | 1.3.0 (ancient) | 2.11.2 (matches the live deploy) |
| Temporal | Not templated (broken for v2.12+) | Skipped on purpose — pinned to v2.11.2 |
| Postgres / Redis | Bitnami subcharts | Plain Deployments (faithful to k3s manifest) |
| Service | ClusterIP + ingress | NodePort 30500 (Cloudflare Tunnel routes here) |
| Storage | bitnami default | `local-path` on omv-main (Pi-local SSD) |
| Image arch | best-effort | arm64 native (Pi 5) |

Why `v2.11.2`? `v2.12+` made the Temporal workflow server mandatory (extra
container + its own DB + optional Elasticsearch). The Pi cluster is already
running cloudless.gr + Prometheus + cloudflared + ML pipeline; adding a
Temporal stack pushed us into disk-pressure incidents. The plan is to revisit
once we have a beefier node — see CLAUDE.md "Cluster Incident Response".

## Layout

```
infrastructure/postiz/
├── cloudflare-tunnel.yaml          # ingress rule fragment for cloudflared
├── helm/
│   └── postiz/                     # ← this chart
│       ├── Chart.yaml
│       ├── values.yaml             # defaults (mirrors the live k8s manifest)
│       ├── values-prod.yaml        # cloudless.gr overrides
│       ├── install.sh              # idempotent installer
│       ├── uninstall.sh
│       ├── README.md
│       └── templates/
│           ├── _helpers.tpl
│           ├── pvcs.yaml           # postgres / redis / uploads PVCs
│           ├── postgres.yaml       # Deployment + Service
│           ├── redis.yaml          # Deployment + Service
│           ├── postiz.yaml         # Deployment + NodePort Service
│           └── ingress.yaml        # optional, disabled by default
└── k8s/
    └── postiz.yaml                  # legacy raw manifest — kept for reference
                                     # while the Helm migration is rolled out
```

## Install

```bash
cd infrastructure/postiz/helm/postiz
./install.sh
```

The script:

1. Creates the `postiz` namespace if missing.
2. Generates `postiz-secrets` (`JWT_SECRET` 32 bytes, `POSTGRES_PASSWORD`
   24 bytes — both `openssl rand`) if not already present. **Never overwrites
   existing secrets** — rotate via `kubectl edit` if you want fresh ones.
3. Best-effort populates `postiz-providers` from SSM
   `/cloudless/production/*` (Facebook / LinkedIn / X / TikTok app creds).
   Skipped quietly if SSM unreachable.
4. Runs `helm upgrade --install` against `values-prod.yaml`.
5. Waits for rollout and curl-checks the in-cluster endpoint.

Idempotent — safe to re-run.

## Verify

```bash
# Pods + secret
kubectl -n postiz get pods,secret
# In-cluster smoke
kubectl -n postiz exec deploy/postiz -- wget -qO- http://localhost:5000 | head -5
# Public smoke (through Cloudflare tunnel)
curl -I https://postiz.cloudless.gr
# Public API smoke (needs POSTIZ_API_KEY)
curl -H "Authorization: $POSTIZ_API_KEY" https://postiz.cloudless.gr/api/public/v1/integrations
```

## Uninstall

```bash
./uninstall.sh                # helm uninstall only (PVCs preserved)
./uninstall.sh --delete-pvcs  # ALSO wipes Postgres / Redis / uploads
./uninstall.sh --delete-ns    # ALSO deletes the namespace
```

## Operations

### Logs

```bash
kubectl -n postiz logs deploy/postiz -f --tail=100
kubectl -n postiz logs deploy/postiz-postgres -f --tail=100
kubectl -n postiz logs deploy/postiz-redis -f --tail=100
```

### Restart

```bash
kubectl -n postiz rollout restart deploy/postiz
```

### Upgrade Postiz

Bump `image.postiz.tag` in `values-prod.yaml`, then:

```bash
./install.sh
```

**Do not skip past v2.11.2 without first deploying a Temporal stack** —
the app will fail to start with `TEMPORAL_ADDRESS missing` errors. See
the upstream [Temporal migration guide](https://docs.postiz.com/installation/migration).

### Rotate JWT secret

Rotating invalidates every existing Postiz session (all users get logged
out). Worth it after any incident:

```bash
kubectl -n postiz patch secret postiz-secrets \
  -p "{\"data\":{\"JWT_SECRET\":\"$(openssl rand -hex 32 | base64 -w0)\"}}"
kubectl -n postiz rollout restart deploy/postiz
```

### Backup the database

```bash
kubectl -n postiz exec deploy/postiz-postgres -- \
  pg_dump -U postiz postiz > postiz-$(date +%Y%m%d).sql
```

## App integration

The cloudless.gr admin app (`src/lib/postiz.ts`,
`src/app/api/admin/postiz/**`, `src/app/[locale]/admin/postiz/page.tsx`)
talks to this instance via the Postiz Public API. Two SSM params drive it:

| SSM key | Value |
|---|---|
| `/cloudless/production/POSTIZ_API_URL` | `https://postiz.cloudless.gr` |
| `/cloudless/production/POSTIZ_API_KEY` | secret from Postiz UI → Settings → Public API |

See `docs/POSTIZ.md` for the full app-side architecture (calendar publish
flow, platform → channel mapping, troubleshooting).

## Skills

For repeatable troubleshooting, see the skill files at
`skills/postiz/SKILL.md` (general ops) and `skills/postiz-doctor/SKILL.md`
(staged debugging).
