# R21 Meilisearch operations runbook

## Purpose

Operate the R21 Meilisearch search backend safely on the Pi k3s cluster.

## Safety rules

- Do not delete the `meilisearch-data` PVC unless intentionally destroying the index.
- Do not move Meilisearch persistent data off the OMV-MAIN dedicated 120GB SSD.
- Do not commit Meilisearch secrets.
- Do not modify `.env.local`.
- Prefer read-only checks before apply/restart actions.

## Files

- `k8s/search/meilisearch.yaml`
- `docs/roadmap/r21-meilisearch-deployment.md`
- `scripts/check_r21_search_baseline.sh`
- `scripts/check_r21_meilisearch_k3s_storage.sh`
- `scripts/check_r21_meilisearch_live_readiness.sh`

## Read-only readiness check

Run:

    bash scripts/check_r21_meilisearch_live_readiness.sh

Expected:

    Summary: 11 passed, 0 warnings, 0 failures

## Verify Kubernetes objects

Run:

    kubectl get namespace search
    kubectl -n search get secret meilisearch-master-key
    kubectl -n search get pvc meilisearch-data
    kubectl -n search get pod -l app.kubernetes.io/name=meilisearch -o wide
    kubectl -n search get svc meilisearch

Expected:

- PVC `meilisearch-data` is `Bound`.
- Pod is `Running`.
- Pod is scheduled on OMV node.
- Service `meilisearch` exposes port `7700`.

## Port-forward health check

Run:

    kubectl -n search port-forward svc/meilisearch 7700:7700

In another terminal:

    curl -fsS http://127.0.0.1:7700/health

Expected response includes:

    available

## Runtime environment

App search uses:

- `MEILI_HOST`
- `MEILI_SEARCH_KEY`
- `MEILI_ADMIN_KEY` or `MEILI_MASTER_KEY`
- `BEDROCK_EMBED_MODEL_ID`
- `BEDROCK_EMBED_DIMENSIONS`
- `CRON_SECRET`

## Reindex

The app reindex endpoint is:

    POST /api/admin/search/reindex

It requires either:

    x-cron-secret: <CRON_SECRET>

or:

    x-admin-secret: <CRON_SECRET>

Do not put real secrets in committed files or shell history.

## Rollout

Apply the manifest only after read-only checks pass:

    kubectl apply -f k8s/search/meilisearch.yaml

Then verify:

    bash scripts/check_r21_meilisearch_live_readiness.sh

## Restart

To restart without deleting data:

    kubectl -n search rollout restart deployment/meilisearch
    kubectl -n search rollout status deployment/meilisearch

## Rollback

Before commit:

    git restore k8s/search/meilisearch.yaml

Kubernetes rollback:

    kubectl -n search rollout undo deployment/meilisearch

Do not delete:

    pvc/meilisearch-data

unless intentionally destroying the Meilisearch index.

## Validation

Run:

    bash scripts/check_r21_search_baseline.sh
    bash scripts/check_r21_meilisearch_k3s_storage.sh
    bash scripts/check_r21_meilisearch_live_readiness.sh

    pnpm run ai:skills-check
    pnpm run ai:test:api
    pnpm run ai:check
