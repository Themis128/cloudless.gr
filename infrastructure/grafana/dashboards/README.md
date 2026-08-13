# Grafana dashboards (provisioned via Grafana API)

JSON definitions live here; deployment is a one-shot push via Grafana's
REST API (`POST /api/dashboards/db` with `overwrite: true`).

## Catalogue

| File | UID | Status | Notes |
| ---- | --- | ------ | ----- |
| `aws-cost.json` | `aws-cost` | **Deprecated** | Panels target Athena `cloudless_analytics.*`. Cost Explorer ETL and Athena path are retired. Use admin `/admin/cost` (D1/R2 frozen snapshot) instead. |
| `lakehouse.json` | — | **Deprecated** | Athena datasource panels — do not reinstall `grafana-athena-datasource` for product analytics. |

## Operator note (2026-08)

Analytics cutover is **R2 + D1** (see `docs/data/datalake.md`). Do not provision
new Athena datasources or re-enable Cost Explorer ETLs for these dashboards.
Keep the JSON files only as historical reference until removed in a later cleanup.
