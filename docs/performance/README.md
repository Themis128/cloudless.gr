# Performance

## Lab vs CI Lighthouse

| | Lab (operator laptop) | CI (GitHub Actions) |
| --- | --- | --- |
| Config | [`lighthouserc.local.cjs`](../../lighthouserc.local.cjs) | [`.github/lighthouserc.cjs`](../../.github/lighthouserc.cjs) + budget |
| How | `pnpm lighthouse:audit` ([`scripts/lighthouse-local.sh`](../../scripts/lighthouse-local.sh)) | [`lighthouse.yml`](../../.github/workflows/lighthouse.yml) after **Deploy to Pi (R2 + Cloudflare Workflows pull)** |
| Runner | Local Chrome | `ubuntu-latest` by default; optional Legion via `RUNNER_X64` — never omv |

See [`docs/deploy/runners.md`](../deploy/runners.md) for capacity / failover.

| Doc | File |
|-----|------|
| [lighthouse-optimization-plan.md](lighthouse-optimization-plan.md) | `performance/lighthouse-optimization-plan.md` |
| [lighthouse-quick-checklist.md](lighthouse-quick-checklist.md) | `performance/lighthouse-quick-checklist.md` |
| [lighthouse-technical-implementation.md](lighthouse-technical-implementation.md) | `performance/lighthouse-technical-implementation.md` |
