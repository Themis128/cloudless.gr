# Tailscale Offline Device Troubleshooting

## Issue: Device 100.123.189.49 showing as offline (tagged-devices)

**Analysis Date:** 2026-07-19

### Current Status Summary (as of 2026-08-06)

✅ **All Tailscale operator components are healthy and online**

| Component | Pod Name | Status | Tailnet IPs |
|-----------|----------|--------|-------------|
| ProxyGroup | ingress-0 | Running | 100.98.121.44 (office-1), office-2 OFFLINE |
| Connector | ts-k3s-cidrs-0 | Running | Dynamic (replicated) |
| Connector | ts-k3s-cidrs-1 | Running | Dynamic (replicated) |
| Operator | operator-7fbdc4bddb-8wckw | Running | - |
| Proxy | kube-0 | Running | Dynamic |
| Proxy | ingress-1 | Running | Dynamic |

### Active Devices

**Operator-owned devices (keep per KEEP_RE regex):**

| Device | Role | Status |
|--------|------|--------|
| `office` | Admin WSL | Online |
| `office-1` | Admin WSL | Online |
| `office-2` | Admin WSL | OFFLINE |
| `office-3` | Admin WSL | Online |
| `github-omv` | k3s, GH runners | Online |
| `omv-ha` | k3s worker | Online |
| `k3s-subnet-router-*` | Connector replicas | Online |
| `ingress-*` | ProxyGroup ingress | Online |
| `kube-*` | ProxyGroup kube-apiserver | Online |

### Root Cause Analysis

The device cleanup logic in `scripts/tailscale-admin-api.sh` has been fixed to:

1. Match all office variants via updated `KEEP_RE` regex: `^(office(-[123])?|github-omv|omv-ha|cloudless-k3s-operator)$`
2. Detect offline devices by checking `offline` flag and `lastSeen` timestamp (>24h threshold)
3. Report offline devices separately for attention before deletion

**Common stale device patterns:**

- `monitoring-proxies-*`, `ts-n8n-*`, `appflowy`, `grafana`, `meilisearch` (pre-annotation era)
- Old per-service proxies from before shared `proxy-group` annotations

### Resolution Steps

#### Step 1: Clean up stale device in Tailscale Admin Console (REQUIRED)

1. Go to [Tailscale Admin Console → Machines](https://login.tailscale.com/admin/machines)
2. Find the device with IP `100.123.189.49` (shows as offline, last seen 6d ago)
3. Click the three dots menu (...) → **Delete**
4. Confirm deletion

#### Step 2: Verify Active Devices

After cleanup, verify active devices:

```bash
kubectl get ProxyGroup,Connector -n tailscale-operator -o jsonpath='{range .items[*]}{.kind}{" "}{.metadata.name}{": "}{.status.devices[*].tailnetIPs}{"\n"}{end}'
```

**Expected output:**

```
ProxyGroup monitoring-proxies: ["100.109.23.1","fd7a:115c:a1e0::3f39:1702"]
Connector k3s-subnet-router: ["100.84.93.105","fd7a:115c:a1e0::8e39:5d6a"]
```

#### Step 3: Verify Tailscale Ingress Access

```bash
# Check that ingresses work (may need subnet routes approved)
curl -I https://grafana.ts.cloudless.gr 2>/dev/null | head -5
curl -I https://loki.ts.cloudless.gr 2>/dev/null | head -5
```

### Required ACL Configuration (for reference)

Your Tailscale ACLs should include:

```json
{
  "tagOwners": {
    "tag:monitoring": ["group:admins"],
    "tag:subnet-router": ["group:admins"]
  },
  "acls": [
    {
      "action": "accept",
      "users": ["group:developers"],
      "ports": [
        "grafana.ts.cloudless.gr:443",
        "loki.ts.cloudless.gr:443",
        "meilisearch.ts.cloudless.gr:443"
      ]
    }
  ]
}
```

### Notes

- The ProxyClass `spec.tags` field is not supported in Tailscale operator v0.19.x - tags are inherited from the OAuth client's tag permissions
- The current configuration is working correctly (all pods show "Ready" status)
- No changes needed to Kubernetes manifests - the stale device cleanup is the only action required
- Route approval for `10.42.0.0/16` and `10.43.0.0/16` may still be needed in Tailscale admin console

### Related Files

- `/infrastructure/tailscale/proxyclass-monitoring.yaml` - Metrics enabled ProxyClass
- `/infrastructure/tailscale/subnet-router.yaml` - K3S subnet router Connector
- `/infrastructure/tailscale/proxygroup-monitoring.yaml` - Monitoring ProxyGroup
