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
