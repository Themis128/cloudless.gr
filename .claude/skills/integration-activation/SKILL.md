---
name: integration-activation
description: >
  Activate and verify the platform's external integrations (ActiveCampaign,
  TikTok Ads, X Ads, Postiz, Slack delivery, Cloudflare token). Use when the
  user provides integration credentials, asks "activate X", "wire up
  ActiveCampaign", "is TikTok configured", "verify integrations", or when an
  integration shows not-configured in /admin/integrations or docs/USE-CASES.md.
---

# Integration Activation

All production credentials live in AWS SSM under `/cloudless/production/`.
There are **no** `.env` files with real values. The single tool for this job
is `scripts/activate-integration.sh` — run it on `omv-main` (has aws CLI,
curl, python3, and network access to every provider) via
`mcp__cloudless-infra__cluster_run_command`, or locally if the operator has
AWS credentials.

## Commands

```bash
# Which activation keys exist (no values printed)
./scripts/activate-integration.sh status

# Write one key and immediately live-verify the affected integration
./scripts/activate-integration.sh set ACTIVECAMPAIGN_API_TOKEN "<value>"

# Live-verify one or all integrations using the values already in SSM
./scripts/activate-integration.sh verify             # all
./scripts/activate-integration.sh verify tiktok      # one
```

On omv-main from a Cowork/Claude session, fetch the script from main first:

```bash
curl -fsSL https://raw.githubusercontent.com/Themis128/cloudless.gr/main/scripts/activate-integration.sh \
  -o /tmp/activate-integration.sh && chmod +x /tmp/activate-integration.sh && /tmp/activate-integration.sh status
```

## Per-integration notes

| Integration | Keys | Where the user finds them | Unlocks |
|-------------|------|---------------------------|---------|
| ActiveCampaign | `ACTIVECAMPAIGN_API_URL`, `ACTIVECAMPAIGN_API_TOKEN`, `ACTIVECAMPAIGN_LEAD_AUTOMATION_ID` | AC → Settings → Developer (URL + key); automation ID is in the automation's URL | Email campaigns pages + automated lead follow-up |
| TikTok Ads | `TIKTOK_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID` | TikTok for Business → developer portal (app already exists: ID/secret are in SSM) | TikTok campaign insights + ROI channel |
| X Ads | `X_AD_ACCOUNT_ID` — **blocked upstream**: verified 2026-06-12 that the X app returns `UNAUTHORIZED_CLIENT_APPLICATION` (no Ads API access). Apply for Ads API access at developer.x.com first; the account ID alone won't help | ads.x.com URL after login (`/accounts/<id>/...`) | X campaign insights + ROI channel |
| Postiz | `POSTIZ_API_URL`, `POSTIZ_API_KEY` | Postiz UI → Settings → Public API (instance: https://postiz.cloudless.gr) | One-click social publishing from the calendar |
| Slack delivery | ✅ DONE 2026-06-12 — bot invited to `#general` (`C09AF5W3X16`) via browser automation; digest verified `sent:true` | — | Weekly digest + all default-channel notifications |
| Cloudflare | `CLOUDFLARE_API_TOKEN` | CF dashboard → API Tokens (scopes: Zone:Read, Zone Settings:Edit, DNS:Edit, Firewall Services:Edit, LB Monitors/Pools+LBs:Edit for cloudless.gr) | HA load balancing + WAF/rulesets + email-obfuscation workflows |

## Handling secrets in a session

- Never echo a credential back in chat or into command output. The script
  never prints values; keep it that way.
- Prefer `set KEY VALUE` over ad-hoc `aws ssm put-parameter` so verification
  runs automatically.
- The app's SSM config cache is 5 minutes; warm Lambda/pod instances may hold
  module-level caches until the next deploy or pod restart
  (`kubectl -n cloudless rollout restart deploy` via cluster_run_command).

## After activation

- Check `/admin/integrations` for the live status flip.
- For Slack: re-run the digest end-to-end —
  `gh workflow run platform-crons.yml -f target=owner-digest` and confirm
  `"sent":true` in the run log.
- Update the status column in `docs/USE-CASES.md` when an item moves to live.
