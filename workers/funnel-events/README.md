# funnel-events

Streams funnel events into a Cloudflare Pipeline → R2
(`cloudless-datalake` bucket, Iceberg table format) so the omv
DuckDB/Metabase stack can query funnel history (paid plan feature).

## Setup (one-time)

```bash
wrangler pipelines create cloudless-funnel-events \
  --r2-bucket cloudless-datalake --compression gzip
cd workers/funnel-events
wrangler secret put EVENTS_TOKEN
pnpm deploy
```

## Events

`POST /event` `{type, payload}` — types: `lead.created`,
`audit.booked`, `nurture.sent`, `quiet.sent`, `post.published`,
`site.pageview`. Rows land as `events/` Iceberg partitions; query via
`iceberg_scan` in the DuckDB API.
