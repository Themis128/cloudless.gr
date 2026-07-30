# Cluster capacity audit — 2026-06-21

Snapshot taken with `kubectl top` at the close of the 2026-06-21 deploy
sweep (AppFlowy Phase 1, EspoCRM, n8n bump, mosquitto auth rollout,
Uptime Kuma + admin probe shipped). This document is **read-only** —
no actions taken from it; it's the input for the next capacity decision.

## Node-level summary

| Node    | Hardware       | CPU usage      | Memory usage         | Headroom    |
| ------- | -------------- | -------------- | -------------------- | ----------- |
| omv     | Pi 5, 8 GB     | 621m / 4 cores (15%) | **6124Mi / ~6.8Gi (89%)** | ~720 Mi RAM, plenty of CPU |
| omv-ha  | Pi 4, 1 GB     | 367m / 4 cores (9%)  | **557Mi / ~650Mi (85%)**  | ~95 Mi RAM — effectively full |

**Read:** omv is the workhorse, omv-ha is at saturation. Any new service
that needs >100 Mi resident **must** land on omv. The AppFlowy worker
stays pinned to omv-ha for the 16K/4K-page jemalloc fix
(per `project_appflowy_phase1_deployed`) and that pin is non-negotiable.

## Top-10 memory consumers (production)

| Rank | Pod                                        | Memory  | Note                                                  |
| ---- | ------------------------------------------ | ------- | ----------------------------------------------------- |
| 1    | postiz/postiz-7c496f74f9                   | **1317 Mi** | Heaviest single process; LiteLLM bundle removed but base Postiz remains JVM-style heavy |
| 2    | monitoring/prometheus-monitoring-prometheus-0 | 459 Mi | Tuned per CLAUDE.md (`storage.tsdb.min-block-duration=2h`, 3d retention) |
| 3    | monitoring/kube-prom-grafana               | 328 Mi  | Sidecar dashboard reloader + main app                  |
| 4    | n8n/n8n-7c98656d6b                         | 301 Mi  | After v1.84 bump (was crashlooping at 384Mi limit)     |
| 5    | monitoring/loki-0                          | 269 Mi  | StatefulSet — only one Loki pod is doing real work     |
| 6    | espocrm/espocrm-mariadb                    | 145 Mi  |                                                        |
| 7    | cloudless/cloudless                        | 122 Mi  | Next.js app — small for its responsibility surface     |
| 8    | espocrm/espocrm                            | 92 Mi   |                                                        |
| 9    | appflowy/postgres                          | 80 Mi   |                                                        |
| 10   | monitoring/grafana (legacy)                | 70 Mi   | Pre-kube-prom-stack standalone Grafana — see § Orphan candidates |

## PVCs (22 total, all Bound)

Largest allocations:

- `appflowy/appflowy-postgres` 20 Gi
- `monitoring/prometheus-monitoring-prometheus-db-...` 20 Gi
- `analytics/duckdb-data` 10 Gi
- `appflowy/appflowy-minio` 10 Gi
- `monitoring/storage-loki-0` 10 Gi
- `oncall/data-oncall-mariadb-0` 8 Gi (orphan — see § Orphan candidates)
- `oncall/redis-data-oncall-redis-master-0` 8 Gi (orphan)
- `home-assistant/ha-config-pvc` 5 Gi (evicted — see CLAUDE.md)
- `home-assistant/home-assistant-config` 5 Gi (evicted)
- `monitoring/loki-data` 5 Gi
- `espocrm/{app,mariadb}-data` 4 Gi each
- `monitoring/{grafana-data,kube-prom-grafana}` 5 Gi combined

**~28 Gi of PVC capacity** is reserved for services that have no
running pod (oncall stack + evicted home-assistant). Recovering that is
in scope of `docs/orphan-k8s-resources-2026-06-21.md` (separate doc).

## Implications for "what fits next"

- Uptime Kuma deployed in PR #1066 fits — ~96 Mi requested, 256 Mi
  limit, leaves ~600 Mi headroom on omv.
- Anything else >300 Mi resident needs a hard look first. Candidates
  worth evaluating before adding:
  - **Self-hosted healthchecks.io** — needs PostgreSQL + Redis + Django
    worker, ~400 Mi. Skipped in favour of Uptime Kuma for exactly this
    reason.
  - **Open-source bug tracker (Gitea Actions / Jira-alt)** — Forgejo
    runners alone are 150 Mi each, the server is 250 Mi. Possible but
    pushes omv into the red.
  - **Self-hosted Sentry** — multi-pod, 2+ Gi. NOT VIABLE on this cluster.
    Keep using SaaS Sentry per `skills/sentry-nextjs/SKILL.md`.

## Driver pods worth investigating later (not action items today)

- Postiz at 1.3 Gi is the biggest single freeable lever. The upstream
  image (`gitroomhq/postiz-app:latest`) bundles BullMQ + the LiteLLM
  proxy + a Vite dev-mode SSR. Pinning to a slim production image OR
  splitting workers from the web frontend could free ~600 Mi.
- The duplicate Loki deploy (`loki` Deployment 269 Mi + `loki-0`
  StatefulSet 49 Mi) — only one is actually doing log ingest. Worth
  confirming which to keep.
- Two separate Grafana pods (kube-prom-grafana 328 Mi + standalone
  grafana 70 Mi). The standalone one is pre-kube-prom-stack and may
  be deletable.

## Sources

- `kubectl top nodes` + `kubectl top pods -A --sort-by=memory` at
  2026-06-21T11:00Z.
- Counter-checks against CLAUDE.md § "omv-main Storage Layout" and
  Memory entries `project_appflowy_phase1_deployed` and
  `project_unified_admin_creds`.
