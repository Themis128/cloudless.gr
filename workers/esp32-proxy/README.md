# cloudless-esp32-proxy

Cloudflare Worker that proxies ESP32 management commands to the Pi alert-API (`192.168.1.128:30800`).

Mirrors the logic in `src/app/api/admin/esp32/route.ts` but runs at the Cloudflare edge instead of
the Next.js server. Useful when you want lower-latency ESP32 control without hitting the Next.js runtime.

## Routes

| Method | Path | Pi target |
|--------|------|-----------|
| GET | `/api/esp32/devices` | `/api/esp32/status` (wrapped as array) |
| GET | `/api/esp32/config?device_id=X` | `/api/esp32/{device_id}/config` |
| POST | `/api/esp32/command?device_id=X` | `/api/esp32/{device_id}/command` |
| POST | `/api/esp32/ota` | `/api/esp32/ota` |
| PUT | `/api/esp32/config?device_id=X` | `/api/esp32/{device_id}/config` |

All routes require `Authorization: Bearer <ADMIN_TOKEN>`.

## Local dev

```bash
cd workers/esp32-proxy
npx wrangler dev          # → http://localhost:8787
# or via VS Code task: "Workers: local dev server"
```

## Secrets

```bash
npx wrangler secret put ADMIN_TOKEN   # set the same token the Next.js app uses
```

## Deploy

```bash
npx wrangler deploy
# or via VS Code task: "Workers: deploy to Cloudflare"
```

Uncomment the `routes` block in `wrangler.toml` to bind the Worker to `cloudless.gr/workers/esp32/*`.
