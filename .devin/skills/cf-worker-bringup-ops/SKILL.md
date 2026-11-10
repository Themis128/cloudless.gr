---
name: cf-worker-bringup-ops
description: Bring-up the three CF funnel workers (mail-outbound / lead-scheduler / funnel-events) past the dashboard/API-scope gates — Email Routing destination verification, CLOUDFLARE_WORKERS_DEPLOY_TOKEN, and .env merge + container restart. Each script automates the 90% and prints the exact residual human click.
---

# cf-worker-bringup-ops

The three paid-tier funnel workers are **deployed + secrets set**
(`<name>.baltzakis-themis.workers.dev`, pipeline
`cloudless_funnel_events_pipe` → `cloudless-datalake/events/`). What
remains are three gates that live partly behind the Cloudflare
dashboard or the local `.env`. Each script below compresses its gate
to the smallest human step. Scripts take credentials from env vars —
they never read `.env` and never print secrets.

## Gate 1 — Email Routing destination verification (`send_email`)

`send_email` rejects `to` with `destination address is not a verified
address` until recipients are verified Email Routing destinations.

```bash
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ZONE=cloudless.gr \
  python .devin/skills/cf-worker-bringup-ops/scripts/email_routing_verify.py \
  --add tbaltzakis@cloudless.gr
```

- Lists every destination + verified/pending, creates missing ones.
- The verify link lands in the omv mailbox — click it once, **or** feed
  it via the cu130-slim `mail-code-fetch` skill (poll mailbox → extract
  link → POST) for a headless close.
- **Decision point:** after your own address verifies, retry
  `POST /send` to a *non-verified* address. If it still fails,
  arbitrary-recipient transactional mail is unavailable on this tier —
  keep Resend/SMTP (omv-ha) as primary and restrict mail-outbound to
  `ops-alert`/`audit-confirm` traffic to verified addresses.

## Gate 2 — CLOUDFLARE_WORKERS_DEPLOY_TOKEN (repo secret)

CI `wrangler deploy` soft-skips on API 10000 because the shared
`CLOUDFLARE_API_TOKEN` lacks Workers Scripts:Edit.

```bash
CLOUDFLARE_API_TOKEN=... \
  python .devin/skills/cf-worker-bringup-ops/scripts/deploy_token_probe.py \
  Themis128/cloudless.gr
```

- Prints the token's real permission groups vs what's missing.
- The dashboard mint is the human step (My Profile → API Tokens →
  Account→Workers Scripts→Edit, account-scoped).
- The repo-side step is automatable — paste the minted token into:
  `gh secret set CLOUDFLARE_WORKERS_DEPLOY_TOKEN -R Themis128/cloudless.gr --body <token>`

## Gate 3 — .env values + container restart

```bash
python .devin/skills/cf-worker-bringup-ops/scripts/env_sync.py \
  ~/cf-worker-secrets.txt /mnt/c/Users/tbaltzakis/cu130-slim/.env --restart
```

- Idempotent update-or-append of `MAIL_OUTBOUND_*`,
  `LEAD_SCHEDULER_*`, `FUNNEL_EVENTS_*`, `CF_EMAIL_ENABLED`,
  `LEAD_SCHEDULER_ENABLED` into `.env` — prints only key names.
- `--restart` runs `docker compose restart social-api social-worker`
  when a docker-compose.yml sits beside the target.
- `~/cf-worker-secrets.txt` is the authoritative token list (last
  `wrangler secret put` wins — written 2026-11-03); delete it after
  merging.

## Ongoing ops — probe + rotation (cu130-slim `scripts/`)

Two scripts landed 2026-11-10 (cu130-slim PR #1654) automate the two
failure modes this bring-up surfaced:

- **`scripts/mail_pipeline_probe.py`** — synthetic round-trip probe:
  `mail-outbound /send` → CF Email Sending → Email Routing → mail-ingest
  → `webmail.cloudless.gr/ingest` → dovecot IMAP. Unique subject token,
  per-hop verdicts, best-effort CF GraphQL leg, tg_alert on failure.
  Cron'd every 15 min (`7,22,37,52`) → `~/logs/mail-pipeline-probe.log`.
  Run manually: `cd ~/cu130-slim && python3 scripts/mail_pipeline_probe.py`
  (`--no-alert` for dry runs, `MAIL_REPO=` to override the .env lookup).
- **`scripts/mail_secret_rotate.py`** — `MAIL_OUTBOUND_TOKEN` rotation
  end-to-end: generate → CF `secrets-bulk` PATCH → both `.env` checkouts
  (WSL + `/mnt/c/...`) → compose consumer recreate → `/send` smoke.
  `--dry-run` first; Infisical push warns-and-continues when
  `secrets.cloudless.gr` is behind CF 1010 — re-run
  `infisical-sync push` manually afterwards.

Gotchas baked into both:

- workers.dev sits behind bot protection — Python `urllib` **must** send
  a browser-like `User-Agent` or you get HTTP 403 error 1010 (not 401).
- After `.env` changes use `docker compose up -d` (recreate), never
  `restart` — restart keeps baked env.
- Compose `pull_policy: always` re-pulls `:latest` on `up`; big image
  pulls have crashed Docker Desktop twice — if the daemon dies mid-up,
  wait for recovery, `docker rm` hash-prefixed orphans + stale
  `Created` containers, then `up -d --pull never` the affected services.
- Consumer fingerprint check (no secrets printed):
  `docker exec <c> sh -c 'printf %s "$MAIL_OUTBOUND_TOKEN"' | sha256sum`
  vs `grep '^MAIL_OUTBOUND_TOKEN=' .env | cut -d= -f2- | tr -d '\n' | sha256sum`
  (the `tr -d '\n'` matters — grep output carries a newline).

## Smoke check (after Gate 1)

```bash
curl -s -X POST https://mail-outbound.baltzakis-themis.workers.dev/send \
  -H "Authorization: Bearer $MAIL_OUTBOUND_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":"tbaltzakis@cloudless.gr","subject":"smoke","text":"ok","category":"ops-alert"}'
```

`{"ok":true}` = end-to-end send_email live.
