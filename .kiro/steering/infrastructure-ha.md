---
inclusion: always
---

# Infrastructure & HA Failover Architecture

## Traffic Flow

```
User → Cloudflare (proxied CNAME) → Cloudflare Worker (cloudless-failover)
  → Try Pi first (pi-origin.cloudless.gr via Cloudflare Tunnel)
    → If Pi returns < 400: serve Pi response (x-served-by: pi-origin)
    → If Pi returns 400+ or timeout: fall through to AWS
  → AWS fallback: CloudFront (d3k7muo3c6lw6s.cloudfront.net) → Lambda
    → x-served-by: aws-fallback
```

## Key Configuration

| Component | Value |
|-----------|-------|
| Cloudflare Zone ID | `7025298073d6a5c645a6ad9add0cbf0e` |
| CloudFront Distribution | `ELGQBR8109MTM` / `d3k7muo3c6lw6s.cloudfront.net` |
| Lambda Function URL | `m7sdlezoxavhdmvq3ljra3kcda0rvhvm.lambda-url.us-east-1.on.aws` |
| Worker name | `cloudless-failover` |
| Worker env `AWS_FALLBACK_HOST` | `d3k7muo3c6lw6s.cloudfront.net` |
| Pi origin DNS | `pi-origin.cloudless.gr` → cfargotunnel |
| Pi k3s namespace | `cloudless` |
| Pi k3s deployment | `cloudless` |
| Pi image registry | `278585680617.dkr.ecr.us-east-1.amazonaws.com/cloudless-pi-app` |

## Pi k3s Requirements

- `SSM_DISABLED=1` — MUST be set; Pi has no IAM role for AWS SSM
- All config read from env vars (injected via k8s secret/configmap)
- The Pi serves as HA standby; AWS Lambda is primary

## CloudFront Function

- Name: `cloud-production-CloudlessSiteCloudfrontFunctionRequest-uaekaexc`
- The `cloudfront.net` host blocking check was DISABLED (set to `if (false)`) to allow the Cloudflare Worker to reach CloudFront directly
- If SST redeploys the function, this check may be re-enabled — monitor after deploys

## Cloudflare Worker Failover Logic

- Pi response < 400 (2xx, 3xx): served directly from Pi
- Pi response >= 400 (4xx, 5xx) OR timeout (10s): falls through to AWS CloudFront
- This means Pi 404s do NOT get served to users — AWS handles them

## HA Failover Watchdog (DNS-level)

- Workflow: `ha-failover-watchdog.yml` (runs every minute)
- Swaps CNAME between CloudFront and cfargotunnel if primary is down
- PRIMARY_TARGET: `d3k7muo3c6lw6s.cloudfront.net`
- STANDBY_TARGET: `e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com`
- Note: The Cloudflare Worker already handles failover at the request level, so the DNS failover is a second layer of protection

## Known Issues / Gotchas

- After SST redeploy: check if CloudFront Function re-enables cloudfront.net blocking
- Pi `ConsentGatedPixel` must be inside `CookieConsentProvider` (locale layout, not root layout)
- Pi serves portfolio site (baltzakisthemis.com) if the cloudless image isn't deployed — worker correctly falls through to AWS
