# cloudless-failover

Cloudflare Worker that implements request-level HA failover between Pi (primary) and AWS CloudFront (fallback).

## Traffic Flow

```
User → Cloudflare → this Worker
  → Try Pi (pi-origin.cloudless.gr via Tunnel)
    → Pi < 400: serve response (x-served-by: pi-origin)
    → Pi >= 400 or timeout: fall through
  → AWS CloudFront (d3k7muo3c6lw6s.cloudfront.net)
    → x-served-by: aws-fallback
```

**All HTTP methods** (including POST/PUT/DELETE) fail over. The request body is buffered once and replayed on retry.

## Deploy

```bash
cd workers/cloudless-failover
npx wrangler deploy
```

## Local Dev

```bash
npx wrangler dev
```

## Environment Variables

Set in `wrangler.toml` `[vars]` or via Cloudflare dashboard:

| Variable | Description |
|----------|-------------|
| `AWS_FALLBACK_HOST` | CloudFront distribution hostname |
| `PI_ORIGIN_HOST` | Pi origin DNS (via Cloudflare Tunnel) |
| `PI_TIMEOUT_MS` | Timeout before falling through to AWS (default: 10000) |
