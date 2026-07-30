# ADR-001 — Mediated database access (SQLTools, not public TCP)

| Field | Value |
|-------|--------|
| Status | **Accepted** (2026-07-30) |
| Context | PR [#1443](https://github.com/Themis128/cloudless.gr/pull/1443) |
| Supersedes | Ad-hoc kubectl port-forwards / mistaken use of `ms-mssql` |

## Context

cloudless.gr’s durable state spans:

- **Pi k3s** — MariaDB (EspoCRM), Postgres (AppFlowy, Postiz), embedded SQLite (n8n, Kuma), plus Redis / MinIO / Meilisearch
- **Cloudflare** — D1 (`user-auth-db` + preview), R2 backups / datalake

Developers need to inspect and query these stores from Cursor. Two wrong paths appeared in practice:

1. Installing the Microsoft **SQL Server** extension (`ms-mssql`) — this stack has **no** TDS/SQL Server endpoints.
2. Temptation to expose DB ports via Cloudflare Tunnel or NodePort for “convenience.”

## Decision

1. **IDE:** Use **SQLTools** (`mtxr.sqltools` + MySQL / PostgreSQL / SQLite drivers). Keep `mssql.connections` empty; list `ms-mssql.mssql` as an unwanted recommendation.
2. **TCP engines:** Reach ClusterIP services only via `pnpm db:forward` (`kubectl port-forward` → fixed localhost ports). Never publish DB TCP through Cloudflare Tunnel.
3. **File engines (pod SQLite, D1):** Pull **snapshots** into gitignored `.local/db/` (`pnpm db:sqlite:pull`, `pnpm db:d1:pull`). Treat files as stale-by-default copies.
4. **Secrets:** Never commit passwords. SQLTools uses `askForPassword: true`; operators run `pnpm db:passwords` (k8s Secrets) or Wrangler for D1.
5. **Docs:** Canonical home is `docs/databases/` — landscape (architect view), omv-cluster (inventory), this ADR (decision record).

## Consequences

**Positive**

- Trust boundary stays clear: internet → Cloudflare → app HTTP; DB engines remain ClusterIP-only.
- One documented developer contract; reproducible ports in `.vscode/settings.json`.
- Separates edge auth (D1) from heavy SOR engines on the Pi without pretending they share a fabric.

**Negative / accepted costs**

- Port-forwards die when the laptop sleeps — operators re-run `pnpm db:ready`.
- SQLite/D1 SQLTools views can be stale until re-pulled.
- Password paste UX is manual (deliberate; avoids secrets in git).

**Rejected alternatives**

| Alternative | Why rejected |
|-------------|--------------|
| `ms-mssql` profiles for “all SQL” | Wrong protocol; empty Object Explorer is correct |
| Cloudflare Tunnel → DB ports | Expands attack surface; violates P1 |
| Shared HA Postgres on 2-node k3s | Raft needs odd quorum; worse than 1-node + R2 restore |
| Passwords in `settings.json` | Secret leakage into git / backups |

## Follow-ups (not blocking this ADR)

- **R10b** — MinIO → R2 backup
- **R10c** — Uptime Kuma SQLite → R2 backup
- Retire or clearly label empty D1 `cloudless-auth`
- Grafana durability (emptyDir vs PVC) if dashboards become load-bearing

## Related

- [landscape.md](landscape.md) — principles, tiers, trust diagrams
- [omv-cluster.md](omv-cluster.md) — ports, secrets, PVCs
- [README.md](README.md) — operator commands
