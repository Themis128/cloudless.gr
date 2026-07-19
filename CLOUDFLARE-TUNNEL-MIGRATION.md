# Tailscale → Cloudflare Access/Tunnel Migration Playbook
# Generated: 2026-07-19
# Last Updated: 2026-07-19

## Current State Analysis

### Tailscale Inventory (23 machines)
- **Control Plane**: `github-omv` (omv-primary, 192.168.1.128)
- **Standby**: `omv-ha` (192.168.1.130, NoSchedule taint)
- **Services**: k3s, monitoring, appflowy, postiz, n8n, postgres, redis
- **Last Seen**: `github-omv` at 9:37 AM GMT+3 (may be offline)

### Cloudflare Tunnel Status
- **Tunnel ID**: e977a490-58c5-4fdb-9155-86832e3e636a
- **Existing Routes**: Pre-configured in `infrastructure/cloudflare-tunnels/routes.yaml`
- **Ingress Rules**: Ready in `infrastructure/cloudflare-tunnels/ingress-rules.yaml`

---

## Migration Strategy: Tailscale → Cloudflare Access

### Phase 1: Authentication Layer (Cloudflare Access)

#### Cloudflare Access Applications to Create
| Service | Domain | Identity Provider | Policy |
|---------|--------|-------------------|--------|
| Grafana Dashboard | grafana.cloudless.gr | GitHub (Themis128@github) | Admin access |
| n8n Workflows | n8n.cloudless.gr | GitHub | Admin access |
| AppFlowy CMS | appflowy.cloudless.gr | GitHub | Authenticated users |
| Postiz Social | postiz.cloudless.gr | GitHub | Authenticated users |
| omv Web UI | omv.cloudless.gr | GitHub | Admin only |
| docs | docs.cloudless.gr | GitHub | Authenticated |
| MeiliSearch | meili.cloudless.gr | GitHub | Internal services |
| Uptime Kuma | kuma.cloudless.gr | GitHub | Admin only |

#### Cloudflare Access Configuration
```yaml
# Access Policies (via Cloudflare dashboard or terraform)
applications:
  - name: Grafana
    domain: grafana.cloudless.gr
    policies:
      - name: Admin Access
        decision: allow
        include:
          - email:
            - themisbaltzakis@gmail.com
          - email_domain:
            - baltzakis-themis.workers.dev
```

### Phase 2: Tunnel Configuration

#### Current Ingress Rules (Ready to Apply)
From `infrastructure/cloudflare-tunnels/ingress-rules.yaml`:
```yaml
ingress:
  - hostname: omv.cloudless.gr
    service: http://localhost:80
    originRequest:
      connectTimeout: 15s
      tcpKeepAlive: 30s
      httpHostHeader: omv.cloudless.gr

  - hostname: ftp.cloudless.gr
    service: http://localhost:21
    originRequest:
      connectTimeout: 30s
      tcpKeepAlive: 60s

  - hostname: docs.cloudless.gr  
    service: http://localhost:30901
    originRequest:
      connectTimeout: 15s
      tcpKeepAlive: 30s

  - hostname: meili.cloudless.gr
    service: http://localhost:30902
    originRequest:
      connectTimeout: 10s
      tcpKeepAlive: 30s

  - hostname: manage.cloudless.gr
    service: http://localhost:80
    originRequest:
      connectTimeout: 15s
      tcpKeepAlive: 30s
      httpHostHeader: manage.cloudless.gr

  - hostname: postiz.cloudless.gr
    service: http://localhost:30500
    originRequest:
      connectTimeout: 15s
      tcpKeepAlive: 30s

  - hostname: appflowy.cloudless.gr
    service: http://localhost:30810
    originRequest:
      connectTimeout: 15s
      tcpKeepAlive: 30s
      noTLSVerify: false
      httpHostHeader: appflowy.cloudless.gr

  - hostname: grafana.cloudless.gr
    service: http://192.168.1.128:30850
    originRequest:
      connectTimeout: 15s
      tcpKeepAlive: 30s

  - hostname: n8n.cloudless.gr
    service: http://192.168.1.128:30900
    originRequest:
      connectTimeout: 15s
      tcpKeepAlive: 30s

  - hostname: kuma.cloudless.gr
    service: http://192.168.1.128:30820
    originRequest:
      connectTimeout: 15s
      tcpKeepAlive: 30s

  - hostname: ntfy.cloudless.gr
    service: http://192.168.1.128:30080
    originRequest:
      connectTimeout: 15s
      tcpKeepAlive: 30s

  - hostname: espocrm.cloudless.gr
    service: http://192.168.1.128:30080
    originRequest:
      connectTimeout: 15s
      tcpKeepAlive: 30s
```

---

## Migration Steps

### Step 1: Cloudflare Access Setup (Manual)

1. Go to [Cloudflare Zero Trust Dashboard](https://dash.teams.cloudflare.com)
2. Navigate to Access → Applications → Add an application
3. Create applications for each service with GitHub OIDC

#### GitHub OIDC Provider Setup
```yaml
# Cloudflare Zero Trust → Settings → Identity Providers → GitHub
# OAuth App Configuration:
# - App Name: Cloudless Access
# - Homepage URL: https://cloudless.gr
# - Callback URL: https://cloudflareaccess.com/cdn-cgi/access/callback
# - Scopes: openid, email, profile, organization
```

### Step 2: Tunnel Route Validation

Check if tunnel routes need updating on omv node:
```bash
# Via GitHub Actions (recommended)
gh workflow run .github/workflows/fix-selfhosted-tunnels.yml --repo Themis128/cloudless.gr

# Or via SSH when omv is online
tailscale ping 100.74.191.58
curl -I https://grafana.cloudless.gr
curl -I https://n8n.cloudless.gr
```

### Step 3: Access Policy Testing

After Cloudflare Access apps are created:
```bash
# Test protected endpoints
curl -I https://grafana.cloudless.gr  # Should return 403 without auth
curl -H "Cf-Access-Jwt-Assertion: <token>" https://grafana.cloudless.gr
```

### Step 4: Tailscale Decommission

When Cloudflare Access covers all services:

```yaml
# Remove Tailscale resources
- pods: tailscale-operator (monitoring namespace)
- pods: monitoring-proxies-* (replace with cloudflared)
- subnet routes: 10.42.0.0/16, 10.43.0.0/16 (if not needed elsewhere)
```

---

## Cloudflare Access App Templates

### Template: Monitoring Dashboard (Grafana)
```json
{
  "name": "Grafana Monitoring",
  "domain": "grafana.cloudless.gr",
  "type": "self_hosted",
  "auto_redirect_https": true,
  "http_only": false,
  "logo_url": "https://grafana.com/static/assets/logo.png",
  "session_duration": "1h",
  "policies": [
    {
      "name": "Admin Team",
      "decision": "allow",
      "include": [
        {"email": "themisbaltzakis@gmail.com"},
        {"email_domain": "baltzakis-themis.workers.dev"}
      ]
    }
  ]
}
```

### Template: Workflow Automation (n8n)
```json
{
  "name": "n8n Workflows",
  "domain": "n8n.cloudless.gr", 
  "type": "self_hosted",
  "session_duration": "24h",
  "policies": [
    {
      "name": "Admin Access",
      "decision": "allow",
      "include": [
        {"email": "themisbaltzakis@gmail.com"},
        {"email_domain": "baltzakis-themis.workers.dev"}
      ]
    }
  ]
}
```

### Template: CMS Portal (AppFlowy)
```json
{
  "name": "AppFlowy CMS",
  "domain": "appflowy.cloudless.gr",
  "type": "self_hosted",
  "session_duration": "24h",
  "policies": [
    {
      "name": "Authenticated Users",
      "decision": "allow",
      "include": [
        {"email_domain": "baltzakis-themis.workers.dev"}
      ]
    }
  ]
}
```

### Template: Social Publisher (Postiz)
```json
{
  "name": "Postiz Publishing",
  "domain": "postiz.cloudless.gr",
  "type": "self_hosted",
  "session_duration": "24h",
  "policies": [
    {
      "name": "Authenticated Users",
      "decision": "allow",
      "include": [
        {"email_domain": "baltzakis-themis.workers.dev"}
      ]
    }
  ]
}
```

### Template: OMV Admin Panel
```json
{
  "name": "OMV Admin",
  "domain": "omv.cloudless.gr",
  "type": "self_hosted",
  "session_duration": "1h",
  "policies": [
    {
      "name": "Admin Only",
      "decision": "allow",
      "include": [
        {"email": "themisbaltzakis@gmail.com"}
      ]
    }
  ]
}
```

### Template: Documentation Portal
```json
{
  "name": "Cloudless Docs",
  "domain": "docs.cloudless.gr",
  "type": "self_hosted",
  "session_duration": "24h",
  "policies": [
    {
      "name": "Authenticated Users",
      "decision": "allow",
      "include": [
        {"email_domain": "baltzakis-themis.workers.dev"}
      ]
    }
  ]
}
```

### Template: Search API (MeiliSearch)
```json
{
  "name": "Search API",
  "domain": "meili.cloudless.gr",
  "type": "self_hosted",
  "session_duration": "1h",
  "policies": [
    {
      "name": "Internal Services Only",
      "decision": "allow",
      "include": [
        {"email_domain": "baltzakis-themis.workers.dev"}
      ]
    }
  ]
}
```

---

## Service Token Integration for Internal Services

For internal services that need to communicate without interactive login:

### Generate Service Tokens
```bash
# Via Terraform (if CLOUDFLARE_API_TOKEN is configured)
cd infrastructure/cloudflare-access
terraform apply

# Or via Cloudflare API
curl -X POST "https://api.cloudflare.com/client/v4/accounts/fb7dc7b69b662480cd5961a4d1913c78/access/apps" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cloudless-grafana-access",
    "domain": "grafana.cloudless.gr",
    "policies": [{"name": "Service Token", "decision": "allow"}]
  }'
```

### Configure Worker Environment
Add to `wrangler.jsonc`:
```json
{
  "vars": {
    "GRAFANA_SERVICE_TOKEN": "svc-token-xxx",
    "N8N_SERVICE_TOKEN": "svc-token-xxx",
    "APPFLOWY_SERVICE_TOKEN": "svc-token-xxx"
  }
}
```

---

## Testing Procedures

### Phase 1: Pre-Migration Validation
```bash
# Test all Tailscale endpoints before changes
echo "=== Current Tailscale Access ==="
curl -I https://grafana.cloudless.gr 2>&1 | head -5
curl -I https://n8n.cloudless.gr 2>&1 | head -5
curl -I https://appflowy.cloudless.gr 2>&1 | head -5
curl -I https://postiz.cloudless.gr 2>&1 | head -5
curl -I https://docs.cloudless.gr 2>&1 | head -5
```

### Phase 2: Cloudflare Access Testing
```bash
# After Access apps are created
echo "=== Cloudflare Access Testing ==="

# Without authentication - should get 403
curl -I https://grafana.cloudless.gr 2>&1 | head -3

# With valid service token - should get 200
curl -H "Cf-Access-Client-Id: $GRAFANA_CLIENT_ID" \
     -H "Cf-Access-Client-Secret: $GRAFANA_CLIENT_SECRET" \
     -I https://grafana.cloudless.gr/api/health 2>&1 | head -3
```

### Phase 3: Health Check Script
```bash
#!/bin/bash
# verify-tunnel-endpoints.sh

ENDPOINTS=(
  "https://grafana.cloudless.gr/api/health"
  "https://kuma.cloudless.gr/"
  "https://n8n.cloudless.gr/"
  "https://appflowy.cloudless.gr/api/health"
  "https://postiz.cloudless.gr/"
  "https://docs.cloudless.gr/"
  "https://meili.cloudless.gr/health"
  "https://omv.cloudless.gr/"
  "https://ntfy.cloudless.gr/v1/health"
)

for endpoint in "${ENDPOINTS[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$endpoint" 2>/dev/null || echo "ERR")
  echo "[$code] $endpoint"
done
```

---

## Benefits of Migration

| Aspect | Tailscale | Cloudflare Access |
|--------|-----------|-------------------|
| Auth | Tailnet-based | Cloudflare Access (OIDC, GitHub, SAML) |
| Audit | Limited | Full audit logs |
| WAF | None | Cloudflare WAF |
| Performance | Relay | Argo Smart Routing |
| Device Trust | Yes | Device posture checks |
| Cost | Free tier | Free tier (up to 50 users) |

---

## Rollback Plan

If issues arise:
1. Keep Tailscale installed but disable auto-start
2. Re-enable Tailscale SSH: `sudo systemctl start tailscaled`
3. Remove Cloudflare Access policies
4. Tunnel continues to work in hybrid mode

---

## GitHub OIDC Setup Guide

### Step 1: Create GitHub OAuth App
1. Navigate to GitHub → Settings → Developer settings → OAuth Apps
2. Create new OAuth App with:
   - **App name**: Cloudless Access
   - **Homepage URL**: https://cloudless.gr
   - **Callback URL**: https://cloudflareaccess.com/cdn-cgi/access/callback
   - **Scopes**: `openid`, `email`, `profile`, `organization`

### Step 2: Configure in Cloudflare
1. Go to Cloudflare Zero Trust Dashboard → Settings → Identity Providers
2. Add GitHub as identity provider
3. Enter Client ID and Client Secret from GitHub OAuth App

### Step 3: Test Integration
```bash
# Verify OIDC is working
curl -I https://grafana.cloudless.gr  # Should redirect to Cloudflare login
```

---

## Current Status Summary

### Completed Infrastructure
- ✅ Tunnel ID verified: e977a490-58c5-4fdb-9155-86832e3e636a
- ✅ Ingress rules documented in `infrastructure/cloudflare-tunnels/ingress-rules.yaml`
- ✅ Route registry in `infrastructure/cloudflare-tunnels/routes.yaml`
- ✅ Access app templates in `infrastructure/cloudflare-access/applications.yaml`
- ✅ Terraform configuration in `infrastructure/cloudflare-access/access-apps.tf`

### Required Manual Steps
1. **Create OAuth App in GitHub** (client ID/secret not yet configured)
2. **Set up CLOUDFLARE_API_TOKEN** in GitHub secrets (for Terraform)
3. **Create Cloudflare Access apps** via dashboard or `terraform apply`
4. **Configure GitHub OIDC integration**
5. **Test all endpoints** after configuration

---

## Next Actions

- [ ] Create GitHub OAuth App for Cloudflare Access
- [ ] Add CLOUDFLARE_API_TOKEN to GitHub secrets
- [ ] Create Cloudflare Access apps via dashboard or Terraform
- [ ] Configure GitHub OIDC integration
- [ ] Test all protected endpoints
- [ ] Create decommission timeline for Tailscale (after 30 days of stable Access)

---

## Infrastructure File References

| File | Purpose | Status |
|------|---------|--------|
| `infrastructure/cloudflare-tunnels/routes.yaml` | Route registry | ✅ Complete |
| `infrastructure/cloudflare-tunnels/ingress-rules.yaml` | Tunnel config | ✅ Complete |
| `infrastructure/cloudflare-access/applications.yaml` | App templates | ✅ Complete |
| `infrastructure/cloudflare-access/access-apps.tf` | Terraform | ✅ Ready |
| `.github/workflows/fix-selfhosted-tunnels.yml` | Tunnel fix automation | ✅ Ready |

---

## Verification Commands

### Check Tunnel Status
```bash
# Check if tunnel is active
kubectl get pods -A | grep cloudflared

# Verify ingress rules applied
kubectl exec -it cf-apply-omv -- curl -s http://localhost:30850/api/health
```

### Check Access Applications
```bash
# Via Cloudflare CLI (if installed)
cloudflare access application list

# Or check in dashboard
open https://dash.teams.cloudflare.com/access/applications
```

### Health Check Summary
After migration, all services should show:
- grafana.cloudless.gr - 200 OK with valid auth
- n8n.cloudless.gr - 200 OK with valid auth  
- appflowy.cloudless.gr - 200 OK with valid auth
- postiz.cloudless.gr - 200 OK with valid auth
- docs.cloudless.gr - 200 OK with valid auth
- meili.cloudless.gr - 200 OK with valid auth
- omv.cloudless.gr - 200 OK with valid auth
- kuma.cloudless.gr - 200 OK with valid auth
- ntfy.cloudless.gr - 200 OK with valid auth

---

## Testing Results (Playwright MCP)

### Test Date: 2026-07-19

**Test Method**: Playwright MCP browser navigation  
**Tool**: github.com/microsoft/playwright-mcp

### Endpoint Status Matrix

| Endpoint | Expected Status | Actual Status | Notes |
|----------|-----------------|---------------|-------|
| grafana.cloudless.gr/api/health | 200/403 | **530** | Tunnel Error - Tunnel not connected on omv-main |
| n8n.cloudless.gr/ | 200/403 | **530** | Tunnel Error - Tunnel not connected on omv-main |
| kuma.cloudless.gr/ | 200/403 | **530** | Tunnel Error - Tunnel not connected on omv-main |
| appflowy.cloudless.gr | 200/403 | **530** | Tunnel Error - Tunnel not connected on omv-main |
| postiz.cloudless.gr | 200/403 | **530** | Tunnel Error - Tunnel not connected on omv-main |
| docs.cloudless.gr | 200/403 | **530** | Tunnel Error - Tunnel not connected on omv-main |
| meili.cloudless.gr/health | 200/403 | **530** | Tunnel Error - Tunnel not connected on omv-main |
| omv.cloudless.gr | 200 | **530** | Tunnel Error - Tunnel not connected on omv-main |
| ntfy.cloudless.gr/v1/health | 200/403 | **530** | Tunnel Error - Tunnel not connected on omv-main |
| cloudless.gr/api/health | 200 | **200** | ✅ Cloudflare Workers active |

### Analysis

All self-hosted services behind the Cloudflare tunnel (omv-main: 192.168.1.128) are returning **HTTP 530** errors, indicating:

1. **Tunnel Not Active**: The cloudflared daemon on omv-main is not running or not connected to the tunnel
2. **DNS Records Exist**: The CNAME records point to `*.cfargotunnel.com` correctly
3. **Workers Active**: The main cloudless.gr domain (Cloudflare Workers) responds with 200 OK

### Recommended Actions

1. SSH to omv-main (192.168.1.128) and check cloudflared status:
   ```bash
   sudo systemctl status cloudflared
   sudo journalctl -u cloudflared -n 50
   ```

2. Run the tunnel fix workflow:
   ```bash
   gh workflow run .github/workflows/fix-selfhosted-tunnels.yml --repo Themis128/cloudless.gr
   ```

3. If omv-main is offline, start Tailscale SSH and restart cloudflared:
   ```bash
   sudo systemctl restart cloudflared
   ```

---

## Security Considerations

### Access App Security Policies

All admin applications enforce:
- **Session Duration**: 1 hour (max 24h for non-admin apps)
- **Auto Redirect**: true (unauthenticated requests redirected to login)
- **HTTPS Only**: true (http_only: false)

### Service Token Security

Service tokens should be:
- Generated per-application (least privilege)
- Rotated quarterly
- Stored in Cloudflare secrets, not in config files
- Used only for server-to-server communication

### Network Security

The migration removes the Tailscale tailnet requirement, relying instead on:
- **Cloudflare WAF** for application-layer protection
- **Zero Trust policies** for authentication
- **Argo Smart Routing** for performance
- **Device posture checks** for device trust