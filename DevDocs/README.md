# DevDocs - Developer Documentation

This folder contains technical documentation for development operations, architecture, and migration playbooks.

## Available Documentation

| File | Description |
|------|-------------|
| `AWS-CLOUDFLARE-MIGRATION.md` | Complete AWS to Cloudflare migration guide with status matrix, cleanup tasks, deployment instructions, and rollback procedures |
| `FLY-IO-PROXY.md` | Fly.io HA failover proxy configuration, endpoints, and verification commands |

## Document Structure

All DevDocs follow a consistent structure:
1. **Status Overview** - Current state and progress
2. **Technical Details** - Implementation specifics
3. **Actionable Commands** - Copy-paste scripts and commands
4. **Verification Steps** - How to confirm success

## Related Documentation

Core system documentation is maintained in `.clinerules/`:
- `.clinerules/aws-to-cloudflare-migration.md` - Migration playbook
- `.clinerules/migration-completion.md` - Completion report
- `.clinerules/cloudless-architecture.md` - Architecture overview

Operational status files:
- `ACTIONS-REQUIRED.md` - Action items and verification status
- `pending-actions-runbook.md` - Current runbook
- `CLOUDFLARE-TUNNEL-MIGRATION.md` - Tunnel setup and fixes
- `API-COVERAGE-GAP-REPORT.md` - API endpoint coverage analysis
- `ARCHITECTURE-MAP.md` - Detailed architecture map

See also:
- `docs/` - General project documentation
- `ops/` - Operational playbooks and scripts
- `.github/workflows/` - CI/CD and deployment automation

## Last Updated

2026-07-20 - All services operational, tunnel active, DNS working