# Self-hosted apps — URLs & admin logins

> **DO NOT COMMIT.** This file is gitignored (contains passwords).
> Cloudflare Access OTP first (`tbaltzakis@cloudless.gr` / Gmail), then app login below.

**Last updated:** 2026-07-29

---

## Unified admin

| Field | Value |
|-------|--------|
| Email | `tbaltzakis@cloudless.gr` |
| Username | `tbaltzakis` |
| Password | `themis` |
| Bootstrap | `ADMIN_PASSWORD='…' python3 scripts/bootstrap-selfhosted-admins.py` |
| Skill | `skills/selfhosted-admin-bootstrap/SKILL.md` |

---

## Public GUIs (Cloudflare Tunnel + Access)

| App | URL | Username | Password |
|-----|-----|----------|----------|
| Grafana | https://grafana.cloudless.gr/ | `tbaltzakis` | `themis` |
| Uptime Kuma | https://kuma.cloudless.gr/ | `tbaltzakis` | `themis` |
| AppFlowy | https://appflowy.cloudless.gr/ | `tbaltzakis@cloudless.gr` | `themis` |
| AppFlowy console | https://appflowy.cloudless.gr/console | `tbaltzakis@cloudless.gr` | `themis` |
| n8n | https://n8n.cloudless.gr/ | `tbaltzakis@cloudless.gr` | `themis` |
| EspoCRM | https://espocrm.cloudless.gr/ | `tbaltzakis` | `themis` |
| Postiz | https://postiz.cloudless.gr/ | `tbaltzakis@cloudless.gr` | `themis` |
| OpenMediaVault | https://omv.cloudless.gr/ | `tbaltzakis` | `themis` |
| Docs | https://docs.cloudless.gr/ | — | Access only |
| Meilisearch | https://meili.cloudless.gr/ | — | master key: `themis` |
| ntfy | https://ntfy.cloudless.gr/ | `tbaltzakis` | `themis` |
| ESP32 Logs | https://logs.cloudless.gr/ | — | Access only |

Access apps: `infrastructure/cloudflare-access/access-apps.tf` (13 GUIs).

---

## Tailscale / LAN

| App | URL | Notes |
|-----|-----|--------|
| Grafana (TS) | https://grafana.ts.cloudless.gr/ | Mesh-only |
| Loki (TS) | https://loki.ts.cloudless.gr/ | Mesh-only |
| OMV LAN | http://192.168.1.128/ | Primary Pi |
| OMV-HA LAN | http://192.168.1.130/ | HA Pi |

---

## Main site

| Surface | URL | Auth |
|---------|-----|------|
| Website | https://cloudless.gr/ | Public |
| Site admin | https://cloudless.gr/en/admin | D1 session + admin role |
| Failover | https://failover.cloudless.gr/ | Worker standby |

---

## Notes

1. Access OTP ≠ app password — clear Cloudflare Access, then use the row above.
2. Rotate: update password here + GH secret `ADMIN_PASSWORD_UNIFIED`, then re-run bootstrap script.
3. Safe template without passwords (committed): `docs/selfhosted-apps.example.md`
