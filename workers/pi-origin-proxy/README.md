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

## Current status

`cloudless2` is a transparent reverse proxy in front of your k3s cluster via the
Cloudflare Tunnel. It does not touch D1, KV, R2, AI, or any data store — the
proxy only reads two `vars` (`PI_ORIGIN_HOST`, `PI_TIMEOUT_MS`) and forwards the
request. Any Cloudflare dashboard banner about an unbound "Auth DB" / D1 binding
is irrelevant to this Worker; **ignore it**.

Verified live (HEAD `78acfd07`, deployed from `main`):

| Component | Status |
| --- | --- |
| `cloudless2` Worker | ✅ Live, 0 errors, proxying `pi-origin.cloudless.gr` → Tunnel → k3s |
| Code fixes | ✅ WebSocket pass-through, response hop-by-hop filtering, `Location` rewriting deployed |
| `manage.cloudless.gr` route | ✅ Deleted — Tunnel-only, no double-hop (cron callers use the Tunnel host) |
| Custom domains | ✅ `cloudless.gr` and `www.cloudless.gr` active (`x-served-by: pi-tunnel-proxy`) |
| Auth DB binding | ✅ Not needed — proxy doesn't reference D1; ignore the dashboard banner |

### Reproduction / verification

```bash
# Worker is serving apex + www
curl -sI https://cloudless.gr      | grep -i x-served-by   # pi-tunnel-proxy
curl -sI https://www.cloudless.gr  | grep -i x-served-by   # pi-tunnel-proxy

# manage.cloudless.gr bypasses the Worker entirely (direct Tunnel → app)
curl -sI https://manage.cloudless.gr; curl -sI https://manage.cloudless.gr | grep -i x-served-by   # (no output)

# Unit tests for the header / Location / WebSocket helpers
cd /home/tbaltzakis/cloudless.gr && npx vitest run __tests__/pi-origin-proxy.test.ts   # 18/18 pass
```

### Keeping your deploy in sync

The Cloudflare-Dashboard AI worker export is a duplicate of this repo, so you do
not need to upload it separately. The next `wrangler deploy` from `main` produces
a bundle equivalent to what's live:

```bash
npx wrangler deploy --config workers/pi-origin-proxy/wrangler.jsonc --minify
```

> Note: a Dashboard-exported clone of this Worker was fetched during triage. It is
> equivalent to `main`, but the one-off clone expires in ~36 hours — push any
> code to your Git repo and merge to `main` so the committed config stays the
> source of truth and the next deploy stays in sync with the live Worker.
