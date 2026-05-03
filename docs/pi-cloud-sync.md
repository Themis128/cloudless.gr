# Pi K3s ↔ Serverless Cloud — Sync Reference

`cloudless.gr` is dual-homed:

- **Primary**: SST stack on AWS (Lambda + CloudFront + Route 53 alias)
- **Secondary**: APIGW HTTP API (`cloudless-pi-frontend`, id `dwtp9xt4dd`) →
  Lambda IPv6 proxy (`cloudless-pi-proxy`) → Raspberry Pi 5 on Starlink CGNAT
  via global IPv6, port 18443.

The Pi has **no public IPv4** (Starlink CGNAT). The SECONDARY path used to
point straight at the Pi WAN IP, but as of PR #100 it goes through APIGW
custom domains (`d-uy6dmk95il.execute-api.us-east-1.amazonaws.com` for apex,
`d-2msx2z5q7d…` for www) so dual-stack clients can reach it. The Lambda
proxy bridges from AWS-side dual-stack to Pi-side IPv6.

Route 53 failover flips DNS to the APIGW alias when the primary health check
on `/api/health` (probing CloudFront) goes red. A separate SECONDARY health
check (`30a69f1c-8d48-49bd-9067-cabec979478b`) probes the APIGW frontend
directly so a SECONDARY-path outage isn't masked by the PRIMARY check. Both
surfaces serve the same Next.js bundle, but they run independently — so
anything stateful or version-sensitive can drift.

This doc is the contract for what's kept in sync, how, and what to monitor.

## Sync surfaces

| Surface | Mechanism | Drift risk |
|---|---|---|
| **Code (image)** | Both sides use `cloudless-pi-app` from ECR (us-east-1). Cloud builds via SST, Pi pulls via K3s. | Until both pin to the same SHA, Pi can lag arbitrarily. |
| **Public env** | `NEXT_PUBLIC_*` baked into the image at build time (see [Dockerfile](../Dockerfile)). | Identical because identical image. |
| **Runtime secrets** | Both read from SSM at `/cloudless/production/*` (see [sst.config.ts:31-32](../sst.config.ts)). | Pi must have `ssm:GetParametersByPath` on that prefix via `cloudless-pi-standby`. |
| **Notion content** | Both fetch live from Notion API; ISR per-process. | Pi cache lags by up to its ISR TTL after Notion edits. |
| **Cognito sessions** | Same User Pool; JWT verification fetches JWKS from Cognito. | None — federation is shared. |
| **Webhooks (Stripe/Notion/HubSpot)** | Hit `cloudless.gr` and route to whichever is live. | Pi must hold the same webhook secrets in SSM. |
| **TLS cert** | Cloud uses ACM; Pi uses its own (Let's Encrypt / cert-manager). | Independent expiry. **Highest silent-failure risk.** |
| **Outbound IP / source reputation** | Differs (CloudFront IP vs WAN `150.228.63.192`). | Anything with IP allowlists — outbound APIs, SES — must allowlist both. |

## What's enforced today

### 1. Image SHA pin via SSM `/cloudless/production/current-image-sha`

After every successful production deploy, [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) writes the just-deployed commit SHA to:

```
arn:aws:ssm:us-east-1:278585680617:parameter/cloudless/production/current-image-sha
```

The Pi K3s side reads this and pins its `image:` tag accordingly. The publish
step is `continue-on-error: true` — a transient SSM hiccup will not block
deploy; Pi just doesn't know about that revision until the next deploy.

**Pi-side reader (out of repo, lives in K3s):** an init container or sidecar
runs every N minutes:

```bash
SHA=$(aws ssm get-parameter \
  --name /cloudless/production/current-image-sha \
  --query 'Parameter.Value' --output text)
kubectl set image deployment/cloudless cloudless=278585680617.dkr.ecr.us-east-1.amazonaws.com/cloudless-pi-app:${SHA} \
  --record
```

### 2. SECONDARY-path health monitoring — `Pi TLS Cert Check` workflow

[.github/workflows/pi-tls-cert-check.yml](../.github/workflows/pi-tls-cert-check.yml)
runs every 6h (00:30, 06:30, 12:30, 18:30 UTC) against the APIGW SECONDARY frontend
(`d-uy6dmk95il.execute-api.us-east-1.amazonaws.com`) and asserts:

- TCP/443 reachable
- TLS handshake succeeds with SNI `cloudless.gr` (chain valid, ACM cert)
- Cert SAN includes `cloudless.gr`
- `notAfter` is more than **14 days** away (ACM auto-renews; this catches
  rotation failures)
- **End-to-end** `GET /api/health` returns 200 — exercising the full path:
  client → APIGW → Lambda proxy → Pi (over IPv6:18443) → response

Failure modes this catches:

- APIGW custom domain disabled / detached
- ACM cert rotation broke
- Lambda proxy errored out (cold-start failure, code regression, IAM drift)
- Pi unreachable on its IPv6:18443 socket (Starlink IPv6 lease changed,
  firewall, K3s pod down, listener not bound)

Because this probes the SECONDARY path *directly*, it surfaces issues
*before* a real PRIMARY outage forces failover. The job is included in the
weekly CI health routine, so any failure is reported in the Monday summary.

### 3. Weekly CI health routine

[docs/ci-health-routine.md](ci-health-routine.md) — Claude Code routine
`trig_01WQ7NdStiHu4Ab3DpBrRuiV` checks all six monitored workflows on Monday
morning Athens time. Output is `ALL_HEALTHY` or a per-workflow failure report.

### 4. SNS failover alerts

CloudWatch alarms on the two R53 health checks publish to SNS topic
`arn:aws:sns:us-east-1:278585680617:cloudless-failover-alerts`. Email
subscriber: `tbaltzakis@cloudless.gr`. Notifications fire **only on edge
events** — i.e. PRIMARY → SECONDARY transitions and back — not on every
probe failure, so a flapping check doesn't spam the inbox.

Together with #2 (daily proactive APIGW probe) this gives both
*pre-incident* and *during-incident* signals:

- 6-hourly TLS+health check (00:30, 06:30, 12:30, 18:30 UTC): "the failover path is currently usable"
- SNS edge alert: "we just flipped to (or from) failover RIGHT NOW"

The CI health routine catches workflow-level regressions on a weekly cadence;
SNS catches the production-traffic-level state change in real time.

## What's not yet enforced

These were proposed but not shipped — see the conversation that generated this
doc for context. Listed in priority order:

1. **Independent Pi health probe** — finish the half-built `cloudless-failover-monitor` IAM user. Add a Route 53 health check pointed directly at Pi WAN IP (not failover-tied) and a CloudWatch alarm when it goes red. Today's primary check only validates whatever is currently routed — it never validates Pi while CloudFront is healthy.

2. **Pi-side SSM scope assertion** — extend the routine to verify `cloudless-pi-standby` IAM user has `ssm:GetParametersByPath` on the full `/cloudless/production/*` tree. Catches the case where someone adds a new SSM prefix and forgets the Pi.

3. **SHA drift detector** — weekly job that compares the SSM-published SHA with what `kubectl get deploy cloudless` actually shows on the Pi. Alert if drift > 24h.

4. **Sentry environment tagging** — confirm Pi runs with `SENTRY_ENVIRONMENT=pi-standby` so Pi errors don't false-blame the cloud during failover.

5. **Periodic failover drill** — monthly automated test that disables the primary R53 health check for 90 seconds, hits `cloudless.gr` from outside, asserts Pi served correctly, then re-enables. Risky — keep behind manual-dispatch first.

6. **Cron de-duplication during failover** — audit `src/app/api/webhooks/*` for handlers that depend on local persistence (none today, but worth a check before adding queue-based features).

7. **CDN fallback** — `${NEXT_PUBLIC_CDN_URL}` resolves to CloudFront. During a CloudFront outage that triggered failover, embedded asset URLs would 404. A Pi-side nginx that proxies `/_next/static/*` to S3 origin would close this gap. Low priority; rare scenario.

## Operational pointers

- **APIGW HTTP API**: `cloudless-pi-frontend` (id `dwtp9xt4dd`, us-east-1)
- **APIGW custom domains** (SECONDARY targets):
  - apex: `d-uy6dmk95il.execute-api.us-east-1.amazonaws.com`
  - www:  `d-2msx2z5q7d.execute-api.us-east-1.amazonaws.com`
- **APIGW regional zone ID**: `Z1UJRXOUMOOFQ8` (well-known)
- **Pi backend**: IPv6:18443 (Starlink global v6 lease — current address
  is whatever `cloudless-ddns-updater` last wrote into the Lambda env)
- **PRIMARY R53 health check**: `e239ad5c-dd17-40d7-8045-a153715168cf` (probes CloudFront)
- **SECONDARY R53 health check**: `30a69f1c-8d48-49bd-9067-cabec979478b` (probes APIGW frontend)
- **R53 hosted zone**: `Z079608614L53CC4EAZM3`
- **SNS failover alerts topic**: `arn:aws:sns:us-east-1:278585680617:cloudless-failover-alerts` (edge-event only, fires on PRIMARY↔SECONDARY transitions)
- **ECR repo**: `278585680617.dkr.ecr.us-east-1.amazonaws.com/cloudless-pi-app` (tag-immutable)
- **IAM users in the Pi orbit**: `cloudless-pi-standby`, `cloudless-pi-proxy`, `cloudless-failover-monitor`, `cloudless-ddns-updater`
- **SSM SHA pointer**: `/cloudless/production/current-image-sha`

## Cryptography parity

Primary and secondary paths should maintain equivalent cryptographic posture:

- In transit
  - TLS termination on both paths (CloudFront and APIGW custom domain).
  - Strict transport handling in app middleware (HTTPS redirect + HSTS).
  - Automated secondary checks now assert legacy TLS 1.0/1.1 are rejected and TLS 1.2 is accepted.

- At rest
  - Shared secrets for both paths stay in SSM SecureString under /cloudless/production/*.
  - Both runtime paths read the same encrypted values from SSM.

Operational rule:
- Any new secret, webhook token, or API credential required for failover must be stored as SecureString in SSM before rollout.
