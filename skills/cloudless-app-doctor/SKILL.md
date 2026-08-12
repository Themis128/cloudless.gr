---
name: cloudless-app-doctor
description: |
  Diagnose cloudless-app (Next.js) issues on the k3s cluster — DNS resolution
  failures (EAI_AGAIN api.cloudflare.com), D1 database connection issues,
  readiness probe timeouts, Slack signature verification failures, and
  missing environment variables (NEWSLETTER_SLACK_SIGNING_SECRET). Use when
  the cloudless-app pod has high restarts, readiness probe failures, D1
  connection errors, or when /api/health returns non-ok status.
---

# Cloudless-App Doctor

The cloudless-app is the main Next.js application running on the k3s cluster
(namespace: `cloudless`, deployment: `cloudless-app`, NodePort: 30300). It
connects to Cloudflare D1 for authentication and configuration, and integrates
with Slack, SES, Stripe, Notion, and other services.

## When to invoke this skill

- `https://cloudless.gr/api/health` returns non-`ok` status or times out
- `kubectl logs -n cloudless deploy/cloudless-app` shows DNS errors
- Readiness probe failures for cloudless-app pod
- D1 database connection errors (`fetch failed`, `D1 lookup failed`)
- Slack signature verification failures in logs
- `NEWSLETTER_SLACK_SIGNING_SECRET not set` warning in logs
- Pod restarts or OOMKilled

## Diagnosis

### 1. Check API health

```bash
# External (via Cloudflare Tunnel)
curl -sS https://cloudless.gr/api/health | jq .
# Expected: {"status":"ok","dbConnected":true,"authProvider":"d1"}

# Internal (via NodePort)
curl -sS http://192.168.1.128:30300/api/health | jq .

# If health endpoint times out:
kubectl logs -n cloudless deploy/cloudless-app --tail=100
```

### 2. Check for DNS resolution failures

The most common issue is `EAI_AGAIN api.cloudflare.com` — a transient DNS
failure when the pod tries to resolve `api.cloudflare.com` for D1 API calls.

```bash
# Check for DNS errors in logs
kubectl logs -n cloudless deploy/cloudless-app --tail=500 | grep -i "EAI_AGAIN\|getaddrinfo\|ENOTFOUND"

# Check DNS resolution from within the pod
kubectl exec -n cloudless deploy/cloudless-app -- nslookup api.cloudflare.com
# or:
kubectl exec -n cloudless deploy/cloudless-app -- node -e "require('dns').resolve('api.cloudflare.com', (err,addr) => console.log(err||addr))"

# Check the pod's DNS config
kubectl exec -n cloudless deploy/cloudless-app -- cat /etc/resolv.conf

# Check CoreDNS
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system deploy/coredns --tail=20
```

**Root cause**: The pod's DNS resolver can't reach the upstream DNS server
or CoreDNS is not forwarding properly. This is usually transient and
self-resolves. If persistent:

```bash
# Restart CoreDNS
kubectl rollout restart -n kube-system deploy/coredns

# Check CoreDNS config
kubectl get configmap -n kube-system coredns -o yaml | grep -A10 "Corefile"
```

### 3. Check for D1 connection issues

```bash
# Check for D1 errors in logs
kubectl logs -n cloudless deploy/cloudless-app --tail=500 | grep -i "D1.*failed\|D1.*error\|fetch failed"

# Check the /api/config endpoint for D1 config
curl -sS https://cloudless.gr/api/config | jq '.config | {AUTH_PROVIDER, dbConnected}'
```

If D1 is not connected:

- Check if `AUTH_DB` binding exists in `wrangler.jsonc`
- Check if `SESSION_SECRET` is set (32+ bytes)
- The D1 binding is `user-auth-db` (see `wrangler.jsonc`)

### 4. Check for readiness probe timeouts

```bash
# Check pod events for readiness probe failures
kubectl describe pod -n cloudless -l app=cloudless-app | grep -A5 "Readiness probe"

# Check the readiness probe config
kubectl get deploy -n cloudless cloudless-app -o json | jq '.spec.template.spec.containers[0].readinessProbe'
```

The readiness probe hits `/api/health` with a timeout. If D1 is slow to
respond (due to DNS issues), the probe may time out. Fix the DNS issue
(step 2) and the readiness probe will recover.

### 5. Check for Slack signature verification failures

```bash
# Check for Slack verification failures
kubectl logs -n cloudless deploy/cloudless-app --tail=500 | grep "Signature verification failed"

# Check for missing NEWSLETTER_SLACK_SIGNING_SECRET
kubectl logs -n cloudless deploy/cloudless-app --tail=500 | grep "NEWSLETTER_SLACK_SIGNING_SECRET"
```

**Root cause**:

- E2E tests or health checks hit the Slack endpoint without proper headers
- `NEWSLETTER_SLACK_SIGNING_SECRET` is not set in the environment

**Fix**: Set the secret via Wrangler or D1 app_config:

```bash
# Via Wrangler secret
npx wrangler secret put NEWSLETTER_SLACK_SIGNING_SECRET --config wrangler.jsonc

# Or via D1 app_config
npx wrangler d1 execute user-auth-db --command \
  "INSERT OR REPLACE INTO app_config (key, value, description) VALUES ('NEWSLETTER_SLACK_SIGNING_SECRET', '<value>', 'Slack signing secret for newsletter endpoint')"
```

### 6. Check pod resource usage

```bash
# Pod memory/CPU
kubectl top pod -n cloudless cloudless-app-<pod-id>

# Pod resource requests/limits
kubectl get deploy -n cloudless cloudless-app -o json | jq '.spec.template.spec.containers[0].resources'
```

The cloudless-app typically uses ~182Mi RAM. If it's using significantly
more, check for memory leaks or heavy operations.

### 7. Check the service and NodePort

```bash
# Service definition
kubectl get svc -n cloudless cloudless-app -o wide
# Expected: NodePort, port 80 → targetPort 3000, NodePort 30300

# Endpoints (should have the pod IP)
kubectl get endpoints -n cloudless cloudless-app
# If empty, the pod isn't Ready — check readiness probe
```

## Common issues and fixes

| Issue | Symptom | Fix |
|-------|---------|-----|
| DNS failure | `EAI_AGAIN api.cloudflare.com` in logs | Transient — restart CoreDNS if persistent |
| D1 not connected | `dbConnected: false` in health | Check AUTH_DB binding in wrangler.jsonc |
| Readiness timeout | Pod not Ready | Fix DNS/D1 issue, increase probe timeout |
| Slack verification fail | `Signature verification failed` | Set NEWSLETTER_SLACK_SIGNING_SECRET |
| OOMKilled | Pod restarts, exit 137 | Increase memory limit in deployment |
| Port mismatch | Service not reachable | NodePort is 30300, not 3000 (targetPort) |

## Verification

```bash
# Full health check
curl -sS https://cloudless.gr/api/health | jq .
# Expected: {"status":"ok","dbConnected":true,"authProvider":"d1"}

# Config check
curl -sS https://cloudless.gr/api/config | jq .config.AUTH_PROVIDER
# Expected: "d1"

# No DNS errors in recent logs
kubectl logs -n cloudless deploy/cloudless-app --tail=100 | grep -c "EAI_AGAIN"
# Expected: 0

# No Slack verification failures
kubectl logs -n cloudless deploy/cloudless-app --tail=100 | grep -c "Signature verification failed"
# Expected: 0 (or only from e2e tests)
```

## Related

- `skills/selfhosted-services-doctor` — Comprehensive service audit
- `skills/tunnel-dns-doctor` — Tunnel + DNS configuration doctor
- `tools/secret-completeness-check.sh` — Check for missing secrets
- `tools/cluster-health-audit.sh` — One-shot cluster audit
- `docs/cluster/cluster-overload-runbook.md` — Cluster overload recovery
- `.clinerules/api-endpoint-fixes.md` — API endpoint fix documentation
- `.clinerules/migration-completion.md` — Migration completion report
