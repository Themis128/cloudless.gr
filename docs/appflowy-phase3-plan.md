# AppFlowy Phase 3 — Notion data migration plan

**Status:** Planning. Phase 1 (cluster deploy) + Phase 2 (Cloudflare tunnel) are LIVE.
**Last updated:** 2026-06-21.

## TL;DR

Phase 3 (migrate the 10 admin Notion databases into AppFlowy) is **blocked by an upstream limitation**: AppFlowy Cloud exposes **no public REST API** for the Notion ZIP import flow as of 2026-06. Importing today requires either the AppFlowy desktop client (UI-only) or a direct postgres-level insert.

This document captures the finding and the three viable paths so the operator can pick one in a future session.

## What we ruled out (and why)

| Approach | Verdict | Reason |
|---|---|---|
| `POST /api/import` with a Notion ZIP | ❌ Not available | The endpoint exists internally but is not part of AppFlowy's public REST surface — see [AppFlowy-Cloud#1013](https://github.com/AppFlowy-IO/AppFlowy-Cloud/issues/1013) ("No public REST API"). The current import flow is invoked from the desktop client over the SPA's private WebSocket protocol. |
| `POST /api/workspace/import` via SPA web client | ❌ Tied to desktop client | Web search returned no documentation. Reverse-engineering would couple us to an undocumented private protocol that breaks on every AppFlowy upgrade. |
| Direct AppFlowy desktop import (UI) | ⚠️ Operator action | Operator drops a Notion-exported ZIP into the desktop app, signs in to https://appflowy.cloudless.gr, the worker pod (pinned to omv-ha for the 4 KiB-page jemalloc fix) processes the import. No automation possible. |
| `INSERT INTO af_collab + af_workspace_member` via psql | ✅ Possible | Bypasses the import flow entirely. Each row in a Notion DB becomes one collab document. Risk: AppFlowy's schema is internal and undocumented; an upgrade can re-shape the tables and silently break migrated data. |

## Recommended path (when ready to execute)

**Pivot away from the "import the 10 admin Notion DBs into AppFlowy" framing.** The 10 admin DBs were already decommissioned in PRs B1-B4 (2026-06-20 + earlier this session) and replaced with live Athena queries against the existing data lake. AppFlowy now serves only as a **lightweight workspace for notes/docs**, not as the system of record for analytics/projects/calendar/etc.

What's actually needed:

1. **Operator UI action**: log in to https://appflowy.cloudless.gr, create top-level pages for the few content categories worth migrating (blog drafts, ops runbooks, meeting notes — NOT the 10 admin DBs).
2. **No code changes** in `src/lib/notion-*` — they were already gutted/stubbed and replaced with Athena reads in B1-B4. They do not need to be re-pointed at AppFlowy.
3. **Existing ETL** (`scripts/etl/appflowy-to-lake.mjs`, this session's postgres-direct rewrite) continues to mirror AppFlowy workspace/user state to the data lake regardless of what content the operator puts in.

## Loose ends from this session

- `scripts/etl/appflowy-to-lake.mjs` — postgres-direct path uses `SELECT json_agg(t)::text` + `psql -tAq` (not `COPY ... TO STDOUT`, which escapes embedded newlines as literal `\n` and broke `JSON.parse`). Tested live 2026-06-21 — 2 workspaces returned.
- `infrastructure/monitoring/blackbox-exporter.yaml` — grafana + ntfy probes switched from public `*.cloudless.gr` URLs (404 — not exposed via the tunnel) to in-cluster Service URLs. External public-route monitoring stays in `selfhosted-healthchecks.yml`.
- All 6 Probes carry both `release: kube-prom` AND `cluster-protection.io/health: "true"` labels — Prometheus's `probeSelector` requires both. Single-label probes never get scraped.

## Sources

- [AppFlowy docs — Import from Notion](https://docs.appflowy.io/docs/guides/import-from-notion)
- [AppFlowy-Cloud Issue #1013 — no public REST API](https://github.com/AppFlowy-IO/AppFlowy-Cloud/issues/1013)
- [Blackbox exporter CONFIGURATION.md — valid_status_codes](https://github.com/prometheus/blackbox_exporter/blob/master/CONFIGURATION.md)
- [Prometheus Operator Probe CRD reference](https://prometheus-operator.dev/docs/api-reference/api/#monitoring.coreos.com/v1.Probe)
