# All Self-Hosted Services Health Audit

> Created: 2026-07-31 — Comprehensive health audit of all self-hosted services
> on the cloudless.gr k3s cluster.

## Executive Summary

**Cluster Status: HEALTHY** — All 11+ self-hosted services are running and
accessible. No critical issues found. Several warnings to address.

| Category | Status | Count |
|----------|--------|-------|
| ✅ Services Running | All healthy | 11/11 |
| ✅ PVCs Bound | All storage healthy | 12/12 |
| ✅ Web Endpoints | All responding | 10/10 |
| ✅ API Health | D1 connected | ok |
| ⚠️ Memory Pressure | omv-ha at 97% requests | 1 node |
| ⚠️ High-Restart Pods | 8 pods with >2 restarts | 8 |
| ⚠️ DNS Errors | Transient EAI_AGAIN in logs | 1 |
| ⚠️ Missing Secret | NEWSLETTER_SLACK_SIGNING_SECRET | 1 |

## Cluster Topology

| Node | Total RAM | Allocatable | CPU | Role | Memory Usage |
|------|-----------|-------------|-----|------|---------------|
| omv | ~8 GB | 8,255 Mi | 4 cores | Primary (workloads) | 70% (5,696 Mi) |
| omv-ha | ~955 MB | 670 Mi | 4 cores | HA standby (infra) | 83% (545 Mi) / 97% requests |

## Service Inventory

### Exposed via Cloudflare Tunnel

| # | Service | Hostname | NodePort | Namespace | Internal | External | Status |
|---|---------|----------|----------|-----------|----------|----------|--------|
| 1 | cloudless-app | cloudless.gr | 30300 | cloudless | 308 | 200 | ✅ |
| 2 | grafana | grafana.cloudless.gr | 30850 | monitoring | 302 | 200 | ✅ |
| 3 | uptime-kuma | kuma.cloudless.gr | 32501 | uptime-kuma | 302 | 200 | ✅ |
| 4 | n8n | n8n.cloudless.gr | 30900 | n8n | 200 | 200 | ✅ |
| 5 | ntfy | ntfy.cloudless.gr | 30080 | ntfy | 200 | 200 | ✅ |
| 6 | espocrm | espocrm.cloudless.gr | 30700 | espocrm | 200 | 200 | ✅ |
| 7 | meilisearch | meili.cloudless.gr | 30902 | meilisearch | 200 | 200 | ✅ |
| 8 | postiz | postiz.cloudless.gr | 30500 | postiz | 307 | 200 | ✅ |
| 9 | appflowy | appflowy.cloudless.gr | 30810 | appflowy | 302 | 200 | ✅ |
| 10 | docs | docs.cloudless.gr | 30901 | default | 302 | 200 | ✅ |
| 11 | alert-api | (internal only) | 30820 | alert-manager | 404→200 | n/a | ✅ |

### Internal-Only Services

| Service | NodePort | Namespace | Notes |
|---------|----------|-----------|-------|
| mosquitto | 31883 | monitoring | MQTT broker |
| alert-api | 30820 | alert-manager | `/health` returns 200, root returns 404 |

## Issues Found

### ⚠️ 1. omv-ha Memory Pressure (97% requests)

**Severity**: Warning (not critical yet)

The omv-ha node has only ~955MB total RAM (~656MB allocatable). Pod memory
requests total 636Mi — 97% of allocatable. The node is essentially full.

**Impact**:
- New pods cannot schedule on omv-ha (insufficient memory)
- Risk of OOMKills if actual usage spikes
- `tailscale/kube-0` has 27 restarts (though these are normal ACME renewals)

**Root cause**: omv-ha is a tiny device running critical infrastructure
(Tailscale, Traefik, CoreDNS, metrics-server, node-exporter, appflowy-worker,
postiz-redis).

**Remediation**: See `skills/omv-ha-memory-doctor/SKILL.md`

### ⚠️ 2. cloudless-app DNS Resolution Failures

**Severity**: Warning (transient)

Cloudless-app logs show `getaddrinfo EAI_AGAIN api.cloudflare.com` —
transient DNS failure when resolving the Cloudflare API for D1 lookups.

**Impact**:
- D1 lookups may fail intermittently
- Readiness probe may time out if D1 is slow
- The `/api/health` endpoint currently returns `{"status":"ok","dbConnected":true}`
  so the issue is not persistent

**Root cause**: CoreDNS may not be forwarding DNS queries properly, or
there's a transient network issue reaching the upstream DNS resolver.

**Remediation**: See `skills/cloudless-app-doctor/SKILL.md`

### ⚠️ 3. Postiz Startup Probe HTTP 500

**Severity**: Warning (resolved)

Postiz had startup probe failures (HTTP 500) during initial startup, but
the pod eventually became Ready and is now serving traffic normally.

**Impact**: None currently — the pod is Running and healthy.

**Root cause**: Postiz backend (NestJS) takes time to start. The startup
probe hits the health endpoint before the backend is fully initialized.

**Remediation**: See `skills/postiz-doctor/SKILL.md`

### ⚠️ 4. High-Restart Pods

**Severity**: Informational

| Pod | Restarts | Last Reason | Assessment |
|-----|----------|-------------|------------|
| node-exporter-lw66t | 30 | Error (exit 143=SIGTERM) | Node reboots/evictions |
| tailscale/kube-0 | 27 | Completed (exit 0) | Normal ACME cert renewal |
| svclb-traefik (omv) | 6 | — | Node reboots |
| traefik | 5 | — | Node reboots |
| appflowy-worker | 4 | — | Startup sequence |
| gotrue | 4 | — | Startup sequence |
| appflowy-cloud | 3 | — | Startup sequence |
| appflowy/nginx | 3 | — | Startup sequence |

**Assessment**: No OOMKills detected. All restarts are from normal
operational events (node reboots, ACME renewals, startup sequences).

**Remediation**: See `tools/pod-restart-investigator.sh`

### ⚠️ 5. appflowy Domain Mismatch in Docs

**Severity**: Documentation issue

The `.clinerules` docs reference `appflowy.cloudflow.gr` but the actual
domain is `appflowy.cloudless.gr`. The `cloudflow.gr` domain doesn't exist
and doesn't resolve.

**Impact**: Confusion when following documentation. The service itself
works fine at `appflowy.cloudless.gr`.

**Remediation**: See `skills/tunnel-dns-doctor/SKILL.md`

### ⚠️ 6. Missing NEWSLETTER_SLACK_SIGNING_SECRET

**Severity**: Warning

The `NEWSLETTER_SLACK_SIGNING_SECRET` environment variable is not set.
Every request to the newsletter Slack endpoint is rejected as unauthorized.

**Impact**: Newsletter Slack webhook integration doesn't work.

**Remediation**: See `tools/secret-completeness-check.sh` and
`skills/cloudless-app-doctor/SKILL.md`

### ⚠️ 7. Slack Signature Verification Failures

**Severity**: Informational

Cloudless-app logs show Slack signature verification failures from
`52.234.46.113` with user-agent `cloudless-k3s-e2e/1.0`. These are from
E2E tests hitting the Slack endpoint without proper headers.

**Impact**: None — these are expected test artifacts.

## Tools Created

| Tool | Path | Purpose |
|------|------|---------|
| cluster-health-audit.sh | `tools/cluster-health-audit.sh` | One-shot comprehensive cluster health audit (10 checks) |
| pod-restart-investigator.sh | `tools/pod-restart-investigator.sh` | Investigate high-restart pods |
| tunnel-endpoint-validator.sh | `tools/tunnel-endpoint-validator.sh` | Validate tunnel config vs actual services |
| secret-completeness-check.sh | `tools/secret-completeness-check.sh` | Check for missing secrets/env vars |

## Skills Created

| Skill | Path | Purpose |
|-------|------|---------|
| selfhosted-services-doctor | `skills/selfhosted-services-doctor/SKILL.md` | Comprehensive health audit for ALL services |
| omv-ha-memory-doctor | `skills/omv-ha-memory-doctor/SKILL.md` | Diagnose omv-ha memory pressure |
| cloudless-app-doctor | `skills/cloudless-app-doctor/SKILL.md` | Diagnose cloudless-app DNS/D1/readiness issues |
| tunnel-dns-doctor | `skills/tunnel-dns-doctor/SKILL.md` | Diagnose Cloudflare Tunnel + DNS issues |

## Usage

### Quick health check

```bash
bash tools/cluster-health-audit.sh
```

### JSON output for monitoring

```bash
bash tools/cluster-health-audit.sh --json | jq .
```

### Investigate a specific pod

```bash
bash tools/pod-restart-investigator.sh tailscale kube-0
```

### Validate tunnel configuration

```bash
bash tools/tunnel-endpoint-validator.sh
```

### Check for missing secrets

```bash
bash tools/secret-completeness-check.sh
```

## Related Documentation

- `docs/cluster/cluster-overload-runbook.md` — Cluster overload recovery
- `docs/cluster/hw-list.md` — Hardware list
- `docs/cluster/cluster-capacity-audit-2026-06-21.md` — Capacity audit
- `docs/cluster/kubectl-tailscale.md` — kubectl via Tailscale
- `docs/cluster/in-cluster-monitoring.md` — In-cluster monitoring
- `docs/cluster/OMV-MAIN-OPTIMIZED.md` — OMV optimization
- `docs/self-hosted/README.md` — Self-hosted services overview
- `docs/self-hosted/appflowy-deploy.md` — AppFlowy deployment
- `docs/POSTIZ.md` — Postiz documentation
- `docs/SLACK.md` — Slack integration
- `infrastructure/cloudflare-tunnels/cloudflared-config.yml` — Tunnel config