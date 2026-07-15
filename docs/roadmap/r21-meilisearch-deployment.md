# R21 Meilisearch deployment requirements

## Goal

Support the R21 AI baseline by running Meilisearch as the product search backend for cloudless.gr.

## Runtime model

- `/api/search` uses Meilisearch + Bedrock embeddings when Meilisearch is configured.
- `/api/search` falls back to local product search when Meilisearch is unavailable or throws.
- `/api/admin/search/reindex` rebuilds the product search index with Bedrock Titan embeddings.

## Required environment variables

- `MEILI_HOST` — Meilisearch base URL.
- `MEILI_SEARCH_KEY` — read/search key used by public search runtime.
- `MEILI_ADMIN_KEY` or `MEILI_MASTER_KEY` — admin key used by reindexing.
- `BEDROCK_EMBED_MODEL_ID` — optional override; defaults to `amazon.titan-embed-text-v2:0`.
- `BEDROCK_EMBED_DIMENSIONS` — optional override; defaults to `512`.
- `CRON_SECRET` — required for `/api/admin/search/reindex`.

## k3s persistence rule

Meilisearch is a persistent workload.

All Meilisearch persistent data must use the dedicated 120GB SSD on the OMV-MAIN node.

Do not place Meilisearch persistent data on SD-card-backed storage.

## Reindexing

The reindex endpoint is:

    POST /api/admin/search/reindex

It requires either:

    x-cron-secret: <CRON_SECRET>

or:

    x-admin-secret: <CRON_SECRET>

## Fallback behavior

If Meilisearch is not configured or search fails, `/api/search` returns fallback results from local product data.

This keeps search available even when the Meilisearch service is unavailable.

## Validation commands

    bash scripts/check_r21_search_baseline.sh

    pnpm vitest run \
      __tests__/r21-ai-baseline.test.ts \
      __tests__/product-search.test.ts \
      __tests__/api-search-route.test.ts \
      __tests__/admin-search-reindex-route.test.ts

    pnpm run ai:skills-check
    pnpm run ai:test:api
    pnpm run ai:check

## Non-goals

- Do not commit Meilisearch secrets.
- Do not modify `.env.local`.
- Do not create persistent volumes outside the OMV-MAIN 120GB SSD.
- Do not remove the fallback search path.

## k3s manifest

The Meilisearch k3s manifest lives at:

    k8s/search/meilisearch.yaml

The PVC must carry these audit labels:

    cloudless.gr/storage-node: OMV-MAIN
    cloudless.gr/storage-tier: dedicated-ssd
    cloudless.gr/storage-purpose: r21-search

The manifest must document that persistent data uses the dedicated 120GB SSD on OMV-MAIN.

Validate with:

    bash scripts/check_r21_meilisearch_k3s_storage.sh
