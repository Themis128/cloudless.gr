---
name: appflowy-operator
description: |
  Deploy, debug, and operate the self-hosted AppFlowy Cloud stack on the
  cloudless.gr k3s cluster (Notion replacement). Triggered by phrases like
  "AppFlowy is down", "redeploy AppFlowy", "add an AppFlowy user", "import a
  Notion DB into AppFlowy", "AppFlowy worker crashed", "check appflowy.cloudless.gr",
  "scale AppFlowy", "rotate the AppFlowy admin password", "back up AppFlowy",
  "AppFlowy migration", "AppFlowy 5xx", or any operational task touching the
  `appflowy` k8s namespace.
---

# AppFlowy operator toolkit

AppFlowy Cloud is the **self-hosted Notion replacement** for cloudless.gr.
Phase 1 shipped 2026-06-21 (PR #1051) live at `https://appflowy.cloudless.gr`.

Always read the source-of-truth manifest before changing anything:
`infrastructure/appflowy/k8s/appflowy.yaml`. The deploy runbook lives at
`docs/appflowy-deploy.md`.

## Topology cheat sheet

9 pods on omv + 1 worker pinned to omv-ha:

| Pod | Node | Why pinned |
| --- | --- | --- |
| postgres (pgvector pg16) | omv | Stateful, on local-path PV (sda1) |
| redis | omv | Cache + outbox + collab streams |
| minio | omv | Stateful, on local-path PV (sda1) |
| gotrue | omv | Auth (issues JWT under `appflowy_admin` group) |
| appflowy-cloud | omv | REST/WebSocket API |
| appflowy-web | omv | Notion-like SPA UI |
| admin-frontend | omv | Workspace admin console at `/console` |
| nginx | omv | In-cluster path router |
| **appflowy-worker** | **omv-ha** | Custom image `ghcr.io/themis128/appflowy-worker:lg-page-14-a53` (16K page + A53 baseline). Pinned to omv-ha to save RAM on omv. See rebuild runbook below. |

## Tool selection — pick the most specific that fits

1. **Just want to check it's up?**

   ```bash
   curl -sI https://appflowy.cloudless.gr/api/health      # expect 200
   curl -sI https://appflowy.cloudless.gr/gotrue/health   # expect 200
   ```

2. **Pod state?** `mcp__Kubernetes_MCP_Server__kubectl_get` with
   `namespace=appflowy, resourceType=pods`. If something's not Running, jump
   straight to that pod's logs via `kubectl_logs` — boot-time errors
   (env-substitution, page-size, image-pull) dominate failures here.

3. **Need to edit cloudflared config or host-only stuff?**
   See `skills/cloudflare-tunnel-ops/SKILL.md` for the privileged-pod
   nsenter pattern; do NOT shell into the host directly.

4. **Two-Pi commands?** Use `skills/cluster-bash/SKILL.md`.

## The three load-bearing deploy gotchas (every one cost real time)

These are documented inline in `appflowy.yaml` so future-you doesn't repeat
them; collected here as the quick-read:

1. **`$(POSTGRES_PASSWORD)` env substitution requires POSTGRES_PASSWORD to
   come FIRST in the container's env list.** K8s does string substitution
   top-down; an undeclared/late variable expands to empty string and
   Postgres returns `password authentication failed for user "postgres"`.
   Affects: `gotrue`, `appflowy-cloud`, `appflowy-worker`. Same rule applies
   to any future pod using `$(VAR)` in env values.
2. **admin_frontend listens on port 3000, not 80.** Service must match.
3. **`APPFLOWY_WS_BASE_URL` ends in `/ws/v2`, not `/ws/v1`.** Only the
   upstream `deploy.env` reveals the bump; docker-compose.yml uses
   `${APPFLOWY_WEBSOCKET_BASE_URL}` so it's invisible there.

## Worker page-size pin (the most painful one)

omv (Pi 5) runs Raspberry Pi OS's `2712` kernel with **16 KiB pages**
(`getconf PAGE_SIZE` → 16384). The worker image's jemalloc was built for
4 KiB pages and panics at boot:

```
<jemalloc>: Unsupported system page size
memory allocation of 4 bytes failed
```

omv-ha (Pi 4) runs the `v8` kernel (4 KiB pages) and starts cleanly. The
arm64 image digest is identical to `latest` — there is no
"arm64-with-system-allocator" variant. **The worker Deployment's
`nodeSelector: { kubernetes.io/hostname: omv-ha }` MUST stay** until an
upstream image bumps jemalloc to support 16 KiB; check
`infrastructure/appflowy/k8s/appflowy.yaml` before you delete it.

## Daily operations

### Verify health from inside the cluster (production-safe)

```bash
NGINX=$(kubectl -n appflowy get pod -l app=nginx -o jsonpath='{.items[0].metadata.name}')
for p in / /api/health /gotrue/health /gotrue/settings /console; do
  CODE=$(kubectl -n appflowy exec "$NGINX" -- \
    wget -q -O /dev/null -S http://127.0.0.1$p 2>&1 \
    | grep -oE 'HTTP/[0-9.]+ [0-9]+' | head -1)
  printf '%-22s %s\n' "$p" "$CODE"
done
```

Expected: `/` 302, `/api/health` 200, `/gotrue/health` 200,
`/gotrue/settings` 200, `/console` 200.

### Rotate the admin password

The admin email/password live in the `appflowy-secrets` k8s Secret
(`GOTRUE_ADMIN_EMAIL`, `GOTRUE_ADMIN_PASSWORD`). GoTrue re-applies them
on every restart **only if the user already exists** (Supabase semantics).
To rotate:

1. Set the new password in the Secret via `kubectl edit secret -n appflowy
   appflowy-secrets` (base64-encoded).
2. `kubectl -n appflowy rollout restart deploy/gotrue`.
3. Verify with `curl -X POST https://appflowy.cloudless.gr/gotrue/token?grant_type=password ...`.

### Re-roll a pod cleanly

```bash
kubectl -n appflowy rollout restart deploy/<name>
kubectl -n appflowy rollout status deploy/<name> --timeout=180s
```

If `appflowy-cloud` won't come up after a config change, **check env-var
ordering first** — the most common regression is reintroducing the
`$(POSTGRES_PASSWORD)` ordering bug.

### Wipe + redeploy from scratch (data-loss; only in disaster)

```bash
kubectl delete namespace appflowy --wait     # ~30s
# Recreate secret (see docs/appflowy-deploy.md for openssl rand recipe)
kubectl apply -f infrastructure/appflowy/k8s/appflowy.yaml
```

PVCs (`appflowy-postgres`, `appflowy-minio`) are removed with the namespace
— there is no auto-restore yet. Backup strategy is "lean on the existing
hourly etcd snapshot + a planned `pg_dump` cron" (see Phase 4 roadmap).

### Add a CronJob or scrape target

When adding new workloads in the `appflowy` namespace, reuse the existing
`local-path` storage class and **always set `nodeSelector: { kubernetes.io/hostname: omv }`**
unless you have a hard reason to live on omv-ha (workers, page-size pins).
Default scheduling will land it on whichever node has CPU room, which can
fragment locality with the PVCs.

## Resource budget

Total cluster footprint ~700 MiB across all 9 pods at idle. Postiz LiteLLM
was evicted to free ~990 MiB on omv; its manifest is preserved at
`infrastructure/appflowy/evicted-deployments/postiz-litellm.yaml`. Both
can't fit simultaneously — if Postiz AI features are needed back, you must
shed something else.

## Cloudflare tunnel exposure

Single tunnel (UUID `e977a490-58c5-4fdb-9155-86832e3e636a`, shared with
espocrm/postiz/logs) → NodePort 30810 on omv → in-cluster nginx → 8 backend
pods via path routing. The fragment is at
`infrastructure/appflowy/cloudflare-tunnel.yaml`; the per-domain DNS CNAME
is at Cloudflare (zone `cloudless.gr`, zone_id
`7025298073d6a5c645a6ad9add0cbf0e`, created via API on 2026-06-21).

To add/remove an ingress rule, see
`skills/cloudflare-tunnel-ops/SKILL.md` — never edit `config.yml` by hand
without using that runbook (cloudflared SIGHUP is unreliable and a bad
restart drops every cloudless.gr tunnel host).

## Phase roadmap (where this skill fits)

- Phase 1 (DONE 2026-06-21): deploy + first-login. PR #1051.
- Phase 2 (DONE 2026-06-21 cluster side): Cloudflare DNS + tunnel ingress.
  Operator-pending: first human UI login at `/console` to validate.
- Phase 3 (NEXT): import 10 Notion DBs via AppFlowy's `/api/import`
  endpoint; build `src/lib/appflowy.ts` HTTP client; rewrite
  `src/lib/notion-*.ts` readers to AppFlowy API.
- Phase 4: switch env routing, validate public pages, retire `NOTION_*`
  SSM keys (operator-side `aws ssm delete-parameters`).

## Worker image rebuild runbook

The cluster runs a **custom worker image** instead of the upstream
`appflowyinc/appflowy_worker:latest` to fix two incompatibilities:

| Fix | Env var set at build time | Why |
|-----|--------------------------|-----|
| 16K jemalloc page size | `JEMALLOC_SYS_WITH_LG_PAGE=14` | Pi 5 kernel uses 16 KiB pages; upstream jemalloc compiled for 4 KiB → abort on Pi 5 |
| A53 ISA baseline | `RUSTFLAGS="-C target-cpu=cortex-a53 -C target-feature=-lse,-crypto,-sve"` | Pi 3 (omv-ha) has Cortex-A53; upstream binary uses LSE/crypto absent on A53 → SIGILL |

**Dockerfile:** `infrastructure/appflowy/worker-build/Dockerfile`
**CI workflow:** `.github/workflows/build-appflowy-worker.yml` (triggered on Dockerfile changes or `workflow_dispatch`)
**Registry:** `ghcr.io/themis128/appflowy-worker:lg-page-14-a53`

### Rebuild when upstream AppFlowy-Cloud bumps

```bash
# Trigger a rebuild manually pointing at the new upstream tag or SHA:
gh workflow run build-appflowy-worker.yml \
  -f appflowy_version=<new-tag-or-sha>

# Once the workflow completes and the image is pushed, update the manifest:
# infrastructure/appflowy/k8s/appflowy.yaml → image tag → new dated tag
# e.g.: ghcr.io/themis128/appflowy-worker:lg-page-14-a53-20261001-abc12345

# Then rollout:
kubectl -n appflowy set image deploy/appflowy-worker \
  appflowy-worker=ghcr.io/themis128/appflowy-worker:lg-page-14-a53-<new-tag>
kubectl -n appflowy rollout status deploy/appflowy-worker
kubectl -n appflowy logs deploy/appflowy-worker --tail=50
```

### Verify worker health after rollout

```bash
kubectl -n appflowy get pod -l app=appflowy-worker
kubectl -n appflowy logs deploy/appflowy-worker --tail=50
# Healthy: lines like "snapshot worker processing collabs" — NO "SIGILL" or "Unsupported system page size"
```

### Estimated rebuild time

- Pi 5 native (arm64, no QEMU): ~15-20 min first build, ~5 min with GHA cache warm
- x86_64 cross-compile via QEMU: not recommended (pnpm install + cargo under emulation OOMs)

## See also

- `docs/appflowy-deploy.md` — full operator runbook
- `infrastructure/appflowy/k8s/appflowy.yaml` — source of truth
- `infrastructure/appflowy/cloudflare-tunnel.yaml` — tunnel fragment
- `infrastructure/appflowy/evicted-deployments/postiz-litellm.yaml`
- `skills/cluster-bash/SKILL.md` — two-Pi command runner
- `skills/cloudflare-tunnel-ops/SKILL.md` — ingress add/remove + DNS API
- `skills/espocrm-operator/SKILL.md` — sibling CRM stack on the same cluster
- Memory: `project_appflowy_phase1_deployed.md`
