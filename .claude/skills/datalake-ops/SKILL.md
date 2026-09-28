---
name: datalake-ops
description: Operate and debug the cloudless.gr R2 datalake + gold snapshot pipeline (lake/* bronze objects → lake/snapshots/admin-datalake.json + freshness.json). Use when AI insights flag stale freshness, null fields, missing sections, or "size: null" rows; when checking ETL health; or when reading the snapshot directly. Covers per-source refresh cadences, the freshness section semantics, the REST-upload gzip/HEAD gotcha, and how to read lake objects from the Pi.
---

# Datalake ops — R2 lake + gold snapshot

Layout: bronze objects under `lake/<source>/` in bucket `datalake-bucket`;
gold snapshot at `lake/snapshots/admin-datalake.json`, freshness sidecar at
`lake/snapshots/freshness.json`. Built hourly by
`.github/workflows/etl-materialize-snapshots.yml` →
`scripts/etl/materialize-datalake-snapshots.mjs`.

## Refresh cadences — "stale" is usually scheduled, not broken

| Source | Cadence | Typical last_etl_at |
|---|---|---|
| GSC / transactions / sentry / n8n / postiz / linkedin-ads | daily, 06:00–06:45 UTC | ~11:00–14:40 prev day is normal |
| espocrm | hourly at :20 | fresh |
| socialauto-* (from Pi `datalake_export` celery) | ~every 6h at :10 | up to 6h old |
| gold snapshot itself | hourly | `generated_at` should be <2h |

Freshness `last_etl_at` = when the **upstream ingestion** last wrote the lake
object — NOT the hourly materialization. An insight reporting "last ETL 11:54"
at ~01:00 UTC just means today's daily batch hasn't run yet.

## Gotcha: REST-uploaded objects have no content-length on HEAD

Objects PUT via the Cloudflare **REST objects API**
(`api.cloudflare.com/.../objects/`, used by SocialAuto's `r2_storage`)
arrive with `content-encoding: gzip`; S3 HEAD then **omits
`content-length`** → freshness reported `size: null` for all socialauto-*.
Fixed in `_r2-config.mjs::r2Head` with a `Range: bytes=0-0` probe that reads
`content-range` total (verified: `bytes 0-0/5538`).

## Reading the snapshot

From the Pi (social-worker containers have CF creds):

```python
# S3 API (datalake-bucket):
s3 = boto3.client("s3",
    endpoint_url=f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    config=Config(signature_version="s3v4"), region_name="auto")
s3.get_object(Bucket="datalake-bucket", Key="lake/snapshots/admin-datalake.json")
# Or Cloudflare REST: GET /client/v4/accounts/{acct}/r2/buckets/datalake-bucket/objects/{key}
```

Snapshot shape: `{generated_at, cache, sections: [{section, rows, rowCount,
fromCache}], freshness: {sources}}`. `fromCache: true` = serving a cached
section, not an error.

## Interpreting sections

- `social_engagement`: `er_by_followers_pct`/`benchmark_verdict` nulls are
  **sentinels** — gated at ≥50 followers; see materialize `sectionOk` notes.
- `socialauto-web-events`: `session_id`/`referrer`/`utm_*` populated by PR
  #1989 (first-touch UTM in sessionStorage + page_view mirror to SocialAuto).
  All-null columns after that deploy = genuinely untagged traffic.
- `attribution`, `social_attribution`, `social_leads`, `acquisition_funnel`,
  `rfm_churn`: 0 rows is honest (no tagged traffic / no leads / too few
  customers) — distinguish "empty" from "broken" via freshness `exists`.
- Top keywords rowCount 5 with 0 clicks = real GSC state, not a pipeline bug.

## Schema contracts

`LAKE_SCHEMA_CONTRACTS` in `scripts/etl/_r2-config.mjs` — required parquet
columns per key, validated by `validate-lake-contracts.mjs` after materialize.
