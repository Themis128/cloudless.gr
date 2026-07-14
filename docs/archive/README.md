# Archived Migration Documentation

These files are preserved for historical reference. The migration strategy has been superseded by the current Cloudflare + Fly.io approach documented in `strategy_cloudflare.md`.

## Files Archived

| File | Status | Notes |
|------|--------|-------|
| `AWS-MIGRATION-PLAN.md` | ✅ Obsolete | Migrated to Cloudflare |
| `FLY-HA-SETUP.md` | ✅ Outdated | Replaced by CLUSTER-MAP.md |
| `FULL-CLOUDFLARE-CUTTOVER-PLAN.md` | ⚠️ Duplicate | Content merged into strategy_cloudflare.md |
| `FULL-LAMBDA-TO-WORKERS-MIGRATION.md` | ⚠️ Duplicate | Content merged into strategy_cloudflare.md |
| `LAMBDA-MIGRATION-ANALYSIS.md` | ✅ Obsolete | Workers migration complete |
| `MIGRATION-EXECUTION-GUIDE.md` | ✅ Archive | Historical reference |
| `MIGRATION-STATUS.md` | ✅ Archive | Historical reference |
| `MIGRATION-SUMMARY.md` | ✅ Archive | Historical reference |
| `MIGRATION-VALIDATION.md` | ✅ Archive | Historical reference |
| `RUN-MIGRATION.md` | ✅ Archive | Historical reference |
| `START-MIGRATION.md` | ✅ Archive | Historical reference |
| `EXECUTE-MIGRATION.sh` | ✅ Obsolete | No longer needed |
| `run-migration-cli.sh` | ✅ Obsolete | No longer needed (was at root) |
| `migration-output.log` | 🔒 Log file | Build output log |

## Current Architecture

See the following files for current configuration:
- `../strategy_cloudflare.md` - Cloudflare + Fly.io deployment strategy
- `../CLUSTER-MAP.md` - Current k3s cluster state
- `../wrangler.jsonc` - Cloudflare Worker configuration
- `../fly-*.toml` - Fly.io app configurations