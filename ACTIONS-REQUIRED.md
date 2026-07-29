# Manual Actions Required - Cloudless.gr

# Generated: 2026-07-19 16:44 UTC

# Last Updated: 2026-07-29 21:40 EEST — R2 + account secrets verified set

---

## ✅ GitHub secrets (verified 2026-07-29)

| Secret | Status | Purpose |
|--------|--------|---------|
| `CLOUDFLARE_API_TOKEN` | ✅ | Deploy, SST, CF APIs |
| `CF_ACCOUNT_ID` | ✅ | Deploy, ETL (`fb7dc7b69b662480cd5961a4d1913c78`) |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ | Same account id (alias) |
| `CLOUDFLARE_ZONE_ID` | ✅ | Custom domains |
| `CF_R2_ACCESS_KEY_ID` | ✅ | R2 S3 API (ETL + backups) |
| `CF_R2_SECRET_ACCESS_KEY` | ✅ | R2 S3 API |

Cluster: `pvc-backup-r2` (appflowy/espocrm/postiz/n8n) + `appflowy-walg-r2` live.
Smoke: AppFlowy PVC dump + continuous WAL + daily `pg_dump` CronJob → `datalake-bucket`.

---

## ⏳ Still needs operator (Wrangler / optional)

### Wrangler secrets (Workers runtime)

```bash
npx wrangler secret put SESSION_SECRET --config wrangler.jsonc
npx wrangler secret put AGENT_AUTH_TOKEN --config wrangler.jsonc
# optional Gemini fallback:
npx wrangler secret put GEMINI_API_KEY --config wrangler.jsonc
```

| Secret | Priority | Notes |
|--------|----------|-------|
| `SESSION_SECRET` | 🔴 | 32+ bytes; session signing |
| `AGENT_AUTH_TOKEN` | 🔴 | Agent endpoints |
| `GEMINI_API_KEY` | 🟡 | Workers AI works without it |

### Optional product features

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` | LinkedIn ads |
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta ads |
| `SENTRY_AUTH_TOKEN` / `NEXT_PUBLIC_SENTRY_DSN` | Error tracking |
| `KUMA_PUSH_ETL_ESPOCRM` | ETL monitoring |

---

## 🔧 Verification

1. `gh workflow run etl-espocrm-to-r2.yml` — should no longer fail on missing R2 keys
2. `gh workflow run cloudflare-deploy.yml`
3. Continuous WAL: `archived_count` advances, `failed_count=0` on AppFlowy postgres
4. Daily CronJob `appflowy-walg-basebackup` at `30 2 * * *`

---

## 📝 Google Calendar (optional)

Not required for core chat. To enable booking, set Wrangler secrets
`GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID`, or non-secret
keys via D1 `app_config` / admin Settings. Keep `GOOGLE_PRIVATE_KEY` in Wrangler.

---

## 🔗 Links

- [GitHub Secrets](https://github.com/Themis128/cloudless.gr/settings/secrets/actions)
- [R2 credentials workflow](https://github.com/Themis128/cloudless.gr/actions/workflows/create-r2-credentials.yml)
- [ETL workflow](https://github.com/Themis128/cloudless.gr/actions/workflows/etl-espocrm-to-r2.yml)
- Checklist: `docs/current-source-of-truth-checklist.md`

---

## Notes

1. Prefer D1 `app_config` + Wrangler/k8s secrets over AWS SSM (legacy Lambda path only).
2. Never `kubectl apply` empty Secret stubs for `appflowy-walg-r2` / `pvc-backup-r2`.
3. `WALG_LOG_LEVEL` must be `NORMAL|DEVEL|ERROR` (not `INFO`).
4. Cloudflare token rotation remains an operator SKIPPED item if MCP CF tools 401.
