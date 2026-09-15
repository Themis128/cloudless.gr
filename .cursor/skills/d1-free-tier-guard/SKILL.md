---
name: d1-free-tier-guard
description: >
  Keep Cloudflare D1 on Workers Free (100k rows_written/day) — never upgrade to
  Paid. Use when Cloudflare emails “D1 operations nearing the daily cap”,
  rows_written alerts, or Free-tier D1 errors. Covers kill switch workflow,
  discretionary write budget, and gated write paths.
---

# D1 Free-tier guard (never Paid)

## Policy

**Do not upgrade to Workers Paid** for D1. Cap resets daily **00:00 UTC**.

## Immediate relief (live cluster)

```bash
gh workflow run "D1 Free-tier kill switch" --ref main -f mode=kill
# restore after reset (optional):
gh workflow run "D1 Free-tier kill switch" --ref main -f mode=restore
gh workflow run "D1 Free-tier kill switch" --ref main -f mode=status
```

`kill` sets `D1_DISCRETIONARY_WRITES=0` on ConfigMap `cloudless-app-config` and
rolls `cloudless-app`. Auth/session D1 writes continue; analytics/cache/funnel/
admin-notification D1 writes stop.

Pushing `.github/workflows/d1-free-tier-killswitch.yml` to `main` also auto-runs **kill**.

## Code defaults

| Env | Default | Role |
|-----|---------|------|
| `D1_DISCRETIONARY_WRITES` | on (unless `0`) | Kill switch |
| `D1_DISCRETIONARY_DAILY_BUDGET` | `10000` | Soft cap per pod |
| `D1_FUNNEL_SAMPLE` | `0.05` | Funnel sampling |
| `D1_ANALYTICS_SAMPLE` | `0.05` | analytics_events sampling |
| `D1_FUNNEL_IMPRESSIONS` | off | `rec_impression` |

Gated modules: `search-funnel`, `analytics`, `gsc-cache`, `espocrm-cache` (+invalidations),
`bookmarks`, `anomaly-log`, `admin-notifications`, `analytics-cache`.

Ungated (keep): auth/session, Stripe, email suppression.

## Related

- `src/lib/d1-write-budget.ts`
- `k8s/cloudless-app-hostpath.yaml` ConfigMap
- `.github/workflows/d1-free-tier-killswitch.yml`
