# Cloudless.gr Architecture Documentation

## Cluster Overview

| Node | IP | Role | Status |
|------|-----|------|--------|
| omv | 192.168.1.128 | Primary (control-plane) | Active |
| omv-ha | 192.168.1.130 | Standby | NoSchedule taint |

## Namespaces

| Namespace | Running Pods | Pending Pods | Description |
|-----------|-------------|--------------|-------------|
| `cloudless` | 7 | 0 | Main application (cloudless-app ×5, manager, sync-webhook) |
| `kube-system` | 5 | 0 | Kubernetes core (traefik, coredns, metrics-server, local-path, svclb) |
| `cert-manager` | 3 | 0 | SSL certificate management |
| `monitoring` | 4 | 6 | Partial stack (grafana, loki, mosquitto, blackbox running) |

## Services Connection Matrix

### External Data Sources → App

| Source | Endpoint | Auth Method | Data Received | Processing |
|--------|----------|-------------|---------------|------------|
| Stripe Webhooks | `/api/webhooks/stripe` | Webhook signature | checkout.session.completed, subscription.* | SES emails, EspoCRM deals, Slack alerts |
| Contact Form | `/api/contact` | None (public) | Name, email, company, service, message | Creates contact/deal, sends notifications |
| Newsletter Signup | `/api/subscribe` | None (public) | Email address | Welcome email, CRM contact, Slack notification |
| Calendar Booking | `/api/calendar/book` | Service Account | Availability slots, booking events | Google Calendar event, notifications |

## Data Flow Into the Application

```
Visitor → /contact form → [app]
  ├─► Cloudflare Email: Email to tbaltzakis@cloudless.gr
  ├─► EspoCRM: Create Contact + Deal
  ├─► Slack #contacts: Notification with lead score
  ├─► R2: analytics event (contact_form_submit)
  └─► ActiveCampaign: Lead enrollment (if configured)
```

## Migration Completion Status

### Completed (✓)

- [x] R2 buckets created: cloudless-assets, cloudless-analytics, app-media-bucket, datalake-bucket
- [x] D1 database created: user-auth-db
- [x] Wrangler configuration ready: wrangler.jsonc, wrangler-cloudflare-free.json
- [x] Authentication routes implemented: register, login, logout, reset-password
- [x] Worker deployed and health endpoint confirmed
- [x] PostgreSQL secret created in k3s database namespace
- [x] Session endpoint returning 200
- [x] MCP server configuration fixed with run_main() async wrapper
- [x] DevDocs integration complete with migration-completion.md

### Remaining Tasks

- [ ] Restart Cline to load MCP configuration changes
- [ ] Configure 2TB SSD mount for analytics storage (/sdb1)
- [ ] Update MinIO credentials from `minioadmin` defaults (security risk)

## Cloudflare Tunnel Status

**Tunnel**: ✅ **ACTIVE** since 2026-07-20 01:25 EEST  
**Tunnel ID**: e977a490-58c5-4fdb-9155-86832e3e636a

### All Services Operational (11/11)

| Service | Namespace | NodePort | Tunnel Host | Status |
|---------|-----------|----------|-------------|--------|
| grafana | monitoring | 30850 | grafana.cloudless.gr | ✅ Running + tunnel working |
| kuma | uptime-kuma | 32501 | kuma.cloudless.gr | ✅ Running + tunnel working |
| n8n | n8n | 30900 | n8n.cloudless.gr | ✅ Running + tunnel working (was 502) |
| ntfy | ntfy | 30080 | ntfy.cloudless.gr | ✅ Running + tunnel working |
| espocrm | espocrm | 30700 | espocrm.cloudless.gr | ✅ Running + tunnel working |
| meili | meilisearch | 30902 | meili.cloudless.gr | ✅ Running + tunnel working |
| postiz | postiz | 30500 | postiz.cloudless.gr | ✅ Running + tunnel working (307 redirect) |
| appflowy | appflowy | 30810 | appflowy.cloudflow.gr | ✅ Running + tunnel working (302 redirect) |
| docs | default | 30901 | docs.cloudless.gr | ✅ Running + tunnel working |

## MCP Tools Available

The fast-markdown-mcp server provides:

- `sync_file` - Force sync a specific file
- `read_file` - Read content of a markdown file
- `list_files` - List all available markdown files
- `search_files` - Search content across all markdown files
- `smart_section_search` - Advanced search with ranking and confidence scores
- `get_table_of_contents` - Get TOC for a markdown file
- `get_section` - Get a specific section from a file
