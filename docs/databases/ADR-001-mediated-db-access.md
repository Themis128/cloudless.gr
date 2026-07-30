# ADR-001 — Mediated database access (SQLTools, not public TCP)

| Field | Value |
|-------|--------|
| Status | **Accepted** (2026-07-30) |
| Context | PR [#1443](https://github.com/Themis128/cloudless.gr/pull/1443), gap closure R10b/R10c |
| Supersedes | Ad-hoc kubectl port-forwards / mistaken use of `ms-mssql` |

## Context

cloudless.gr’s durable state spans Pi k3s SOR engines and Cloudflare D1/R2. Developers need Cursor access without expanding the attack surface.

## Decision

1. **IDE:** SQLTools + MySQL/PG/SQLite drivers. Keep `mssql.connections` empty; `ms-mssql` is unwanted.
2. **TCP engines:** `pnpm db:forward` only — never Cloudflare Tunnel / NodePort for DB TCP.
3. **SQLite / D1:** Snapshot to `.local/db/` via `pnpm db:refresh-snapshots` (stale-by-default copies).
4. **Secrets:** `askForPassword` + `pnpm db:passwords` — never commit passwords.
5. **DR on 2-node k3s:** Accept warm restore from R2; do not invent shared HA Postgres until a third node enables odd Raft quorum.
6. **Backups:** Daily R2 covers AppFlowy PG, EspoCRM, Postiz, n8n, AppFlowy MinIO (R10b), Uptime Kuma (R10c). Grafana persists on PVC + in-repo dashboards.
7. **D1:** Only `user-auth-db` + `auth-db-preview`. Orphan `cloudless-auth` deleted 2026-07-30 (`pnpm d1:retire:cloudless-auth` is an idempotent guard).

## Consequences

Port-forwards die on sleep (`pnpm db:ready`). Snapshots require refresh. Password paste is manual by design.

## Related

- [landscape.md](landscape.md) · [omv-cluster.md](omv-cluster.md) · [README.md](../cloudflare/README.md)
- [infrastructure/backup/README.md](../../infrastructure/backup/README.md)
