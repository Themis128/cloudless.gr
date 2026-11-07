# funnel-events

Streams funnel events into a Cloudflare Pipeline → R2
(`cloudless-datalake` bucket, `events/` prefix, JSON+gzip
day-partitioned) so the omv DuckDB/Metabase stack can query funnel
history (paid plan feature).

## Setup (DONE 2026-11-03 — live)

Pipeline resource names must be letters/numbers/underscores
(wrangler 4 rejects dashes). `cloudless_funnel_events_pipe` is live:

```bash
wrangler pipelines streams create cloudless_funnel_events_stream
wrangler pipelines sinks create cloudless_funnel_events_sink \
  --type r2 --bucket cloudless-datalake --format json \
  --compression gzip --path events/
wrangler pipelines create cloudless_funnel_events_pipe \
  --sql "INSERT INTO cloudless_funnel_events_sink SELECT * FROM cloudless_funnel_events_stream"
wrangler secret put EVENTS_TOKEN --config workers/funnel-events/wrangler.jsonc
wrangler deploy --config workers/funnel-events/wrangler.jsonc --minify
```

Live endpoint: `https://funnel-events.baltzakis-themis.workers.dev/event`
(Bearer `EVENTS_TOKEN`). Sink: R2 `cloudless-datalake/events/` —
JSON+gzip, `year=%Y/month=%m/day=%d` partitions, 300s roll interval.

## Events

`POST /event` `{type, payload}` — types: `lead.created`,
`audit.booked`, `nurture.sent`, `quiet.sent`, `post.published`,
`site.pageview`. Rows land as `events/` JSON+gzip partitions; query via
the DuckDB API, e.g.
`read_json_auto('r2://cloudless-datalake/events/**/*.json.gz', hive_partitioning = true)`.
