# Pi-origin proxy (Workers Free)

Tiny Worker that keeps `cloudless2` under the free-plan **3 MiB gzip** limit by
proxying to `pi-origin.cloudless.gr` (Cloudflare Tunnel → Pi k3s NodePort).

Full OpenNext SSR on Free is not viable for this app (~5.5 MiB gzip after minify).

## Deploy

```bash
npx wrangler deploy --config workers/pi-origin-proxy/wrangler.jsonc --minify
```

## Prerequisites

1. Tunnel ingress for `pi-origin.cloudless.gr` → `http://192.168.1.128:30300`
   (`python3 scripts/cf-tunnel-set-pi-origin.py`)
2. App image rolled on Pi (`deploy-pi.yml`)

## Traffic

```
User → Cloudflare → cloudless2 (this Worker, <50 KiB)
  → https://pi-origin.cloudless.gr
    → Tunnel → omv:30300 → cloudless-app
```

Idempotent methods (`GET`/`HEAD`/`OPTIONS`) retry once on network failure or
upstream `502` (Tunnel flaps). Failures still return `502` with
`x-served-by: pi-tunnel-proxy` or `pi-tunnel-proxy-error`.

## Edge cache

Static-asset `GET` requests (anonymous — no `Cookie`/`Authorization`) are
looked up in `caches.default` before the tunnel hop and stored after a hit
via `ctx.waitUntil(cache.put(...))`. Paths that qualify:

- `/_next/static/*`, `/_next/image?...`, `/icons/*`, `/images/*`
- `/favicon.ico`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`
- any path ending in `.css` / `.js` / `.mjs` / `.map` / `.woff2` / image /
  video / `.txt` / `.xml`

Only 200 responses with an explicit `Cache-Control: max-age=N` (or
`s-maxage=N`) and no `Set-Cookie` are stored. Everything else — including
API routes, RSC prefetches (`?_rsc=…`), and pages with a session cookie —
bypasses cache entirely. Cache hits carry `x-served-by: pi-tunnel-proxy-cache`
so you can distinguish them from a fresh tunnel round-trip.

## GHA cron callers (Bot Fight bypass)

GitHub Actions runners hitting `https://cloudless.gr/api/cron/*` often get a
**Cloudflare Bot Fight Mode** interstitial (`403`) before the app can check
`CRON_SECRET`. Cron workflows therefore call the **tunnel hostname** instead:

```text
https://pi-origin.cloudless.gr/api/cron/...
```

That path is Tunnel → Pi NodePort (this Worker is not on that hop). The app
still enforces `CRON_SECRET`. See `platform-crons.yml`, `postiz-crons.yml`, and
`linkedin-poll.yml` (`BASE_URL` / `SITE_ORIGIN` defaulting to pi-origin).
