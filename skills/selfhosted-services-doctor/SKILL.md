---
name: selfhosted-services-doctor
description: |
  Comprehensive health audit for ALL self-hosted services on the cloudless.gr k3s
  cluster. Covers every service exposed via Cloudflare Tunnel (cloudless.gr,
  grafana, kuma, n8n, ntfy, espocrm, meilisearch, postiz, appflowy, docs) plus
  internal-only services (alert-api, mosquitto). Checks internal NodePort health,
  external web endpoints, DNS resolution, PVC status, pod restarts, and resource
  pressure. Use when the user says "check all services", "is everything healthy",
  "self-hosted health", "cluster audit", or when any service is misbehaving.
---

# Self-Hosted Services Doctor

A complete, layered health audit for every self-hosted service on the
cloudless.gr k3s cluster. Run the one-shot audit tool first, then drill into
specific services as needed.

## When to invoke this skill

- User asks "are all services healthy?" or "check all self-hosted services"
- Any service returns 5xx, timeout, or DNS failure
- After a node reboot, power cycle, or k3s restart
- After deploying a new service or updating an existing one
- Periodic health check / monitoring

## Quick start — one-shot audit

```bash
# Run the comprehensive audit tool
bash tools/cluster-health-audit.sh

# JSON mode for piping to monitoring/alerting
bash tools/cluster-health-audit.sh --json | jq .
```

This checks all 10 areas:

1. Node conditions (Ready, MemoryPressure, DiskPressure, PIDPressure)
2. Node resource usage (kubectl top nodes)
3. Pod status (non-Running, high-restart)
4. PVC status (all Bound?)
5. Recent warning events
6. Internal service health (NodePort HTTP checks)
7. External web endpoints (Cloudflare Tunnel)
8. Cloudless-app API health (D1 connected?)
9. OOMKilled pod detection
10. Memory pressure risk assessment

## Service inventory

### Exposed via Cloudflare Tunnel (external)

| Service | Hostname | NodePort | Namespace | Health check |
|---------|----------|----------|-----------|--------------|
| cloudless-app | cloudless.gr | 30300 | cloudless | `/api/health` → `{"status":"ok"}` |
| grafana | grafana.cloudless.gr | 30850 | monitoring | `/api/health` |
| kuma | kuma.cloudless.gr | 32501 | uptime-kuma | HTTP 200 on `/` |
| n8n | n8n.cloudless.gr | 30900 | n8n | HTTP 200 on `/` |
| ntfy | ntfy.cloudless.gr | 30080 | ntfy | HTTP 200 on `/` |
| espocrm | espocrm.cloudless.gr | 30700 | espocrm | HTTP 200 on `/` |
| meilisearch | meili.cloudless.gr | 30902 | meilisearch | HTTP 200 on `/health` |
| postiz | postiz.cloudless.gr | 30500 | postiz | HTTP 307 on `/` |
| appflowy | appflowy.cloudless.gr | 30810 | appflowy | HTTP 302 on `/` |
| docs | docs.cloudless.gr | 30901 | default | HTTP 302 on `/` |
| omv-ui | omv.cloudless.gr | localhost:80 | (host) | OMV web UI |
| agent | agent.cloudless.gr | 30924 | (host) | Agent API |
| vibe | vibe.cloudless.gr | 30301 | (host) | Vibe agent |

### Internal-only (no tunnel exposure)

| Service | NodePort | Namespace | Notes |
|---------|----------|-----------|-------|
| alert-api | 30820 | alert-manager | Pi alert API, `/health` returns 200 |
| mosquitto | 31883 | monitoring | MQTT broker, not HTTP |

### Cluster infrastructure (not user-facing)

| Service | Namespace | Notes |
|---------|-----------|-------|
| traefik | kube-system | Ingress controller |
| coredns | kube-system | DNS |
| metrics-server | kube-system | HPA metrics |
| cloudflared | (host-level) | Tunnel daemon on omv |
| tailscale | tailscale | Mesh VPN |

## Per-service deep dive

### cloudless-app (Next.js main site)

```bash
# External health
curl -sS https://cloudless.gr/api/health | jq .

# Internal health (via NodePort)
curl -sS http://192.168.1.128:30300/api/health | jq .

# Pod logs (check for DNS errors, D1 failures)
kubectl logs -n cloudless deploy/cloudless-app --tail=100

# Check for EAI_AGAIN DNS errors (transient Cloudflare API resolution failures)
kubectl logs -n cloudless deploy/cloudless-app --tail=500 | grep "EAI_AGAIN"

# Check for Slack signature verification failures
kubectl logs -n cloudless deploy/cloudless-app --tail=500 | grep "Signature verification failed"
```

Common issues:

- **`EAI_AGAIN api.cloudflare.com`**: Transient DNS failure when resolving
  Cloudflare API for D1 lookups. Usually self-resolves. If persistent, check
  CoreDNS config and `/etc/resolv.conf` in the pod.
- **`NEWSLETTER_SLACK_SIGNING_SECRET not set`**: Newsletter Slack webhook
  endpoint rejects all requests. Set via Wrangler secret or D1 app_config.
- **Readiness probe timeout**: `/api/health` takes too long → check if D1
  binding is responsive, check for memory pressure on the node.
- **D1 lookup failed**: `fetch failed` when calling Cloudflare API → check
  DNS resolution from within the pod.

See also: `cloudless-app-doctor` skill for deeper diagnosis.

### postiz (social media publishing)

```bash
# External
curl -sI https://postiz.cloudless.gr | head -3

# Internal
curl -sI http://192.168.1.128:30500 | head -3

# Pod status
kubectl -n postiz get pods -o wide
kubectl -n postiz logs deploy/postiz --tail=50

# Startup probe failures (HTTP 500)
kubectl -n postiz describe pod -l app=postiz | grep -A5 "Startup probe"

# Postgres + Redis
kubectl -n postiz exec deploy/postiz-postgres -- pg_isready -U postiz
kubectl -n postiz exec deploy/postiz-redis -- redis-cli ping
```

Common issues:

- **Startup probe HTTP 500**: Postiz backend takes time to start. The startup
  probe may fail initially but the pod eventually becomes Ready. If it
  persists, check Postgres connectivity and JWT_SECRET.
- **OOMKilled**: Postiz uses ~1.3GB RAM. If node is under pressure, it may
  get OOMKilled. Check `kubectl describe pod` for OOMKilled reason.
- **Image pull**: `ghcr.io/gitroomhq/postiz-app:v2.11.2` is large. Pin to
  this version — newer versions need Temporal.

See also: `postiz-doctor` skill for the full staged troubleshooter.

### appflowy (CMS + collaboration)

```bash
# External
curl -sI https://appflowy.cloudless.gr | head -3

# Internal (via nginx NodePort)
curl -sI http://192.168.1.128:30810 | head -3

# All appflowy pods
kubectl -n appflowy get pods -o wide

# Check gotrue (auth service)
kubectl -n appflowy logs deploy/gotrue --tail=20

# Check minio (S3-compatible storage)
kubectl -n appflowy exec deploy/minio -- mc admin info local
```

Common issues:

- **Domain mismatch**: Docs reference `appflowy.cloudflow.gr` but the actual
  domain is `appflowy.cloudless.gr`. The `cloudflow.gr` domain doesn't exist.
- **gotrue restarts**: Gotrue may restart if Postgres isn't ready. Check
  `kubectl logs` for `ECONNREFUSED`.
- **MinIO credentials**: Were changed from defaults to secure random hex.
  If pods can't connect, check the secret.

### grafana (monitoring dashboards)

```bash
# External (behind Cloudflare Access)
curl -sI https://grafana.cloudless.gr | head -3

# Internal
curl -sS http://192.168.1.128:30850/api/health | jq .

# Pod status
kubectl -n monitoring get pods -l app.kubernetes.io/name=grafana
```

### n8n (workflow automation)

```bash
# External
curl -sI https://n8n.cloudless.gr | head -3

# Internal
curl -sI http://192.168.1.128:30900 | head -3

# Pod status
kubectl -n n8n get pods -o wide
kubectl -n n8n logs deploy/n8n --tail=30
```

### espocrm (CRM)

```bash
# External
curl -sI https://espocrm.cloudless.gr | head -3

# Internal
curl -sI http://192.168.1.128:30700 | head -3

# Pod + DB status
kubectl -n espocrm get pods -o wide
kubectl -n espocrm exec deploy/espocrm-mariadb -- mysqladmin ping
```

### meilisearch (search engine)

```bash
# External
curl -sI https://meili.cloudless.gr | head -3

# Internal health
curl -sS http://192.168.1.128:30902/health | jq .

# Pod status
kubectl -n meilisearch get pods -o wide
```

### ntfy (notifications)

```bash
# External
curl -sI https://ntfy.cloudless.gr | head -3

# Internal
curl -sI http://192.168.1.128:30080 | head -3

# Pod status
kubectl -n ntfy get pods -o wide
```

### uptime-kuma (uptime monitoring)

```bash
# External
curl -sI https://kuma.cloudless.gr | head -3

# Internal
curl -sI http://192.168.1.128:32501 | head -3

# Pod status
kubectl -n uptime-kuma get pods -o wide
```

### docs-server (documentation)

```bash
# External
curl -sI https://docs.cloudless.gr | head -3

# Internal
curl -sI http://192.168.1.128:30901 | head -3

# Pod status
kubectl -n default get pods -l app=docs-server
```

### alert-api (pi alert manager)

```bash
# Internal only (not exposed via tunnel)
curl -sS http://192.168.1.128:30820/health

# Pod status
kubectl -n alert-manager get pods -o wide
kubectl -n alert-manager logs deploy/alert-api --tail=20
```

## Investigating high-restart pods

```bash
# List all pods with >2 restarts
bash tools/pod-restart-investigator.sh

# Deep dive on a specific pod
bash tools/pod-restart-investigator.sh tailscale kube-0
bash tools/pod-restart-investigator.sh monitoring kube-prom-prometheus-node-exporter-lw66t
```

Known high-restart pods (as of 2026-07-31):

- `tailscale/kube-0` (27 restarts): **Normal** — ACME cert renewal jobs
  complete (exit 0) and restart. `TS_DEBUG_ACME_FORCE_RENEWAL=true` forces
  frequent renewals.
- `monitoring/node-exporter-lw66t` (30 restarts): SIGTERM (exit 143) —
  likely from node reboots or pod evictions. Check if the node was
  restarted recently.
- `appflowy/*` (3-4 restarts): Normal startup sequence after node reboot.

## Tunnel + DNS validation

```bash
# Validate all tunnel endpoints against actual services
bash tools/tunnel-endpoint-validator.sh
```

This checks:

- Every tunnel ingress rule points to a valid NodePort
- Every NodePort service is healthy internally
- Every external hostname resolves in DNS
- Every external hostname returns HTTP 2xx/3xx
- No stale `cloudflow.gr` domain references in docs

## Secret completeness

```bash
# Check for missing secrets across all services
bash tools/secret-completeness-check.sh
```

This checks:

- Kubernetes secrets referenced by pods but missing
- Cloudless-app logs for DNS errors, D1 failures, Slack verification failures
- Postiz secrets (POSTGRES_PASSWORD, JWT_SECRET)
- Integration env vars (SLACK_WEBHOOK_URL, HUBSPOT_API_KEY, NOTION_API_KEY, etc.)
- NEWSLETTER_SLACK_SIGNING_SECRET (commonly missing)

## Related skills

- `cluster-health` — Quick health snapshot (lighter version)
- `postiz-doctor` — Staged Postiz troubleshooter
- `omv-ha-memory-doctor` — omv-ha memory pressure diagnosis
- `cloudless-app-doctor` — cloudless-app DNS/D1/readiness diagnosis
- `tunnel-dns-doctor` — Cloudflare Tunnel + DNS configuration doctor
- `cloudflare-tunnel-ops` — Tunnel operations
- `uptime-kuma-operator` — Uptime Kuma management
- `n8n-operator` — n8n management
- `espocrm-operator` — EspoCRM management
- `appflowy-operator` — AppFlowy management
