---
name: tunnel-dns-doctor
description: |
  Diagnose Cloudflare Tunnel + DNS configuration issues for the cloudless.gr
  k3s cluster. Validates tunnel ingress rules against actual k3s NodePort
  services, checks DNS resolution for all hostnames, detects domain typos
  (cloudflow.gr vs cloudless.gr), and verifies the cloudflared daemon is
  running. Use when a service is unreachable externally, DNS doesn't resolve,
  or the tunnel config doesn't match the actual services.
---

# Tunnel + DNS Doctor

The Cloudflare Tunnel (`cloudflared`) runs as a host-level service on the
omv node (192.168.1.128). It routes external traffic from
`*.cloudless.gr` to internal k3s NodePort services. This skill diagnoses
mismatches between the tunnel config, actual k3s services, and DNS records.

## When to invoke this skill

- A `*.cloudless.gr` hostname doesn't resolve or returns 5xx
- A service is healthy internally (NodePort responds) but unreachable externally
- After adding a new service or changing a NodePort
- After updating the cloudflared config
- To verify the `cloudflow.gr` → `cloudless.gr` domain typo is fixed
- The tunnel validator tool reports issues

## Quick start — one-shot validation

```bash
# Validate all tunnel endpoints against actual services
bash tools/tunnel-endpoint-validator.sh
```

This checks:

1. Every tunnel ingress rule points to a valid, running NodePort
2. Every NodePort service is healthy internally (HTTP check)
3. Every external hostname resolves in DNS
4. Every external hostname returns HTTP 2xx/3xx
5. No stale `cloudflow.gr` domain references in docs/config

## Diagnosis

### 1. Check if cloudflared is running

The cloudflared daemon runs on the omv host (not as a k8s pod):

```bash
# Check if cloudflared is running on omv (via SSH)
ssh 192.168.1.128 'systemctl status cloudflared'

# Check tunnel info
ssh 192.168.1.128 'cloudflared tunnel info e977a490-58c5-4fdb-9155-86832e3e636a'

# Check recent cloudflared logs
ssh 192.168.1.128 'journalctl -u cloudflared -n 50 --no-pager'
```

If SSH is unavailable, check if the tunnel is working by testing external
endpoints:

```bash
# Quick check — does the tunnel respond?
curl -sI https://cloudless.gr | head -3
curl -sI https://grafana.cloudless.gr | head -3
```

### 2. Check the tunnel config

The tunnel config is at `infrastructure/cloudflare-tunnels/cloudflared-config.yml`:

```bash
# View the config
cat infrastructure/cloudflare-tunnels/cloudflared-config.yml

# Check for specific hostname
grep -A3 "postiz.cloudless.gr" infrastructure/cloudflare-tunnels/cloudflared-config.yml
```

The config maps hostnames to `http://192.168.1.128:<NodePort>`. Verify
each port matches the actual k8s NodePort:

```bash
# Get all NodePorts
kubectl get svc --all-namespaces -o json | jq -r '
  .items[] | select(.spec.type == "NodePort") |
  .metadata.namespace + "/" + .metadata.name + " → " +
  (.spec.ports | map("port=" + (.port|tostring) + " nodePort=" + (.nodePort|tostring) + " targetPort=" + (.targetPort|tostring)) | join(", "))
'
```

### 3. Check DNS resolution

Each `*.cloudless.gr` hostname should have a CNAME pointing to the tunnel:

```bash
# Check DNS for all tunnel hostnames
for host in cloudless.gr grafana.cloudless.gr kuma.cloudless.gr n8n.cloudless.gr \
  ntfy.cloudless.gr espocrm.cloudless.gr meili.cloudless.gr postiz.cloudless.gr \
  docs.cloudless.gr appflowy.cloudless.gr; do
  echo -n "$host: "
  dig +short "$host"
done
```

Expected: Each hostname resolves to a CNAME like
`e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com`

If a hostname doesn't resolve:

- The DNS record is missing in Cloudflare
- The domain is wrong (e.g., `cloudflow.gr` instead of `cloudless.gr`)

### 4. Check for the cloudflow.gr domain typo

The `.clinerules` docs reference `appflowy.cloudflow.gr` but the actual
domain is `appflowy.cloudless.gr`. The `cloudflow.gr` domain doesn't exist.

```bash
# Check for stale references
grep -r "cloudflow.gr" .clinerules/ docs/ infrastructure/ 2>/dev/null

# Verify the correct domain works
curl -sI https://appflowy.cloudless.gr | head -3
# Expected: 302 (redirect to Cloudflare Access login)

# Verify the wrong domain doesn't resolve
dig +short appflowy.cloudflow.gr
# Expected: empty (no DNS record)
```

### 5. Check for missing tunnel routes

If a NodePort service exists but isn't in the tunnel config:

```bash
# List all NodePorts not in the tunnel config
bash tools/tunnel-endpoint-validator.sh | grep "not exposed via tunnel"
```

To add a missing route, append to the tunnel config before the catch-all:

```yaml
  # new-service.cloudless.gr
  - hostname: new-service.cloudless.gr
    service: http://192.168.1.128:<NodePort>
    originRequest:
      connectTimeout: 15s
      tcpKeepAlive: 30s
```

Then reload cloudflared:

```bash
ssh 192.168.1.128 'sudo systemctl reload cloudflared'
```

And add the DNS record in Cloudflare:

```bash
# Via Cloudflare API or dashboard
# CNAME: new-service.cloudless.gr → e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com
# Proxied: true
```

### 6. Check for tunnel → NodePort mismatches

The most common issue is the tunnel config pointing to the wrong port.

Known correct mappings (from `cloudflared-config.yml`):

| Hostname | Tunnel Port | k8s NodePort | Match? |
|----------|-------------|--------------|--------|
| cloudless.gr | 30300 | 30300 | ✅ |
| grafana.cloudless.gr | 30850 | 30850 | ✅ |
| kuma.cloudless.gr | 32501 | 32501 | ✅ |
| n8n.cloudless.gr | 30900 | 30900 | ✅ |
| ntfy.cloudless.gr | 30080 | 30080 | ✅ |
| espocrm.cloudless.gr | 30700 | 30700 | ✅ |
| meili.cloudless.gr | 30902 | 30902 | ✅ |
| postiz.cloudless.gr | 30500 | 30500 | ✅ |
| appflowy.cloudless.gr | 30810 | 30810 | ✅ |
| docs.cloudless.gr | 30901 | 30901 | ✅ |
| omv.cloudless.gr | localhost:80 | (host) | ✅ |
| agent.cloudless.gr | 30924 | (host) | ? |
| vibe.cloudless.gr | 30301 | (host) | ? |

**Note**: The `.clinerules` docs incorrectly say `cloudless.gr → port 3000`.
The actual NodePort is **30300** (port 3000 is the container targetPort).

### 7. Check Cloudflare Access

Most services are protected by Cloudflare Access (redirect to login page).
This is expected behavior — a 302 redirect to
`cloudless-gr.cloudflareaccess.com` means the service is healthy and
protected.

```bash
# Verify a service is behind Cloudflare Access
curl -sSL -o /dev/null -w "%{url_effective}" https://postiz.cloudless.gr
# Expected: https://cloudless-gr.cloudflareaccess.com/cdn-cgi/access/login/...
```

If a service returns 200 directly (no Access redirect), it may not be
protected — check the Cloudflare Access application config.

## Common issues and fixes

| Issue | Symptom | Fix |
|-------|---------|-----|
| DNS doesn't resolve | `dig` returns empty | Add CNAME in Cloudflare DNS |
| Wrong domain | `cloudflow.gr` in docs | Update to `cloudless.gr` |
| Port mismatch | Service unreachable | Update tunnel config to match NodePort |
| cloudflared not running | All services 5xx | `ssh 192.168.1.128 'sudo systemctl restart cloudflared'` |
| Tunnel config stale | New service not exposed | Add ingress rule, reload cloudflared |
| Cloudflare Access missing | Service returns 200 directly | Add Access application in Cloudflare dashboard |

## Verification

```bash
# Run the validator
bash tools/tunnel-endpoint-validator.sh

# All hostnames should show ✓ for DNS, internal, and web checks
```

## Related

- `infrastructure/cloudflare-tunnels/cloudflared-config.yml` — Tunnel config
- `infrastructure/cloudflare-tunnels/ingress-rules.yaml` — Ingress rules
- `infrastructure/cloudflare-tunnels/routes.yaml` — DNS routes
- `skills/cloudflare-tunnel-ops` — Tunnel operations
- `skills/selfhosted-services-doctor` — Comprehensive service audit
- `tools/tunnel-endpoint-validator.sh` — One-shot validation tool
- `docs/cluster/kubectl-tailscale.md` — kubectl via Tailscale
- `docs/TAILSCALE-FABRIC.md` — Tailscale fabric documentation
