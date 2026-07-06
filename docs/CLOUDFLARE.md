# Cloudflare Configuration & Architecture

**Last Updated:** July 6, 2026  
**Status:** ✅ Production Ready  
**Maintainer:** DevOps / Infrastructure Team

---

## Table of Contents

1. [Overview](#overview)
2. [Account & Zone Configuration](#account--zone-configuration)
3. [DNS Records](#dns-records)
4. [Cloudflare Tunnel](#cloudflare-tunnel)
5. [Cloudflare Workers & Failover](#cloudflare-workers--failover)
6. [Security & DDoS Protection](#security--ddos-protection)
7. [API Token Management](#api-token-management)
8. [Monitoring & Alerts](#monitoring--alerts)
9. [Troubleshooting](#troubleshooting)
10. [Runbooks](#runbooks)

---

## Overview

Cloudflare provides a multi-layer infrastructure for cloudless.gr:

1. **DNS Management** - Zone records with Cloudflare nameservers
2. **Tunnel (Private Network)** - Secure connection to Raspberry Pi k3s cluster
3. **Workers (Serverless)** - Failover orchestration between Pi and AWS Lambda
4. **DDoS & WAF Protection** - Managed security layer
5. **HA Failover** - Automatic DNS switching between primary and standby

### Service Architecture

```
                      ┌─────────────────────────────┐
                      │   Cloudflare Zone (global)  │
                      │   cloudless.gr              │
                      └──────────────┬──────────────┘
                                     │
                      ┌──────────────┴──────────────┐
                      │                             │
        ┌───────────▼─────────────┐  ┌──────────▼──────────────┐
        │  DNS Records            │  │  Failover Worker       │
        │  • cloudless.gr         │  │  • cloudless-failover  │
        │  • *.cloudless.gr       │  │  • Routes to Pi/AWS    │
        │  • Tunnel endpoints     │  └──────────┬─────────────┘
        └────────────────────────┘             │
                                                 │
               ┌────────────────────────────────┼────────────────────────────────┐
               │                                │                                │
         ┌─────▼──────────────────┐    ┌────────▼─────────────┐    ┌──────────▼──────────┐
         │  Cloudflare Tunnel     │    │  AWS CloudFront      │    │  DNS Failover       │
         │  (Pi k3s origin)       │    │  (Lambda fallback)   │    │  (Watchdog)         │
         │  • piorigin-tunnel     │    │  • d3k7muo3c6lw6s    │    │  • Swaps CNAME      │
         │  • HTTP/QUIC           │    │  • d9c1d2e3f4g5h6i7  │    │  • Per-minute check │
         │  • Egress from Pi      │    │  • Primary: 2xx-3xx  │    │  • DNS-level HA     │
         └────────────────────────┘    └────────────────────┘    └─────────────────────┘
```

---

## Account & Zone Configuration

### Cloudflare Account

| Property | Value |
|----------|-------|
| Account Name | cloudless (via baltzakisthemis@gmail.com) |
| Zone | cloudless.gr |
| Zone ID | `7025298073d6a5c645a6ad9add0cbf0e` |
| Nameservers | `nova.ns.cloudflare.com` / `watson.ns.cloudflare.com` |
| Plan | Free / Pro (escalate as needed) |
| Two-Factor Auth | ✅ Enabled |

### Zone Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| SSL/TLS | Full (strict) | End-to-end encryption |
| HSTS | 12 months | Force HTTPS via browser |
| Minimum TLS | 1.2 | No legacy clients |
| CNAME Flattening | On root | Allow CNAME for apex |
| Always Use HTTPS | ✅ | Redirect HTTP → HTTPS |
| Page Rules | (see below) | Custom behaviors |

#### Page Rules

| Path | Rule | Purpose |
|------|------|---------|
| `api.cloudless.gr/*` | Cache Level: Bypass | API responses not cached |
| `*.cloudless.gr/*` | Security Level: High | Stricter bot checking |
| `docs.cloudless.gr/*` | Browser Cache TTL: 30m | Documentation caching |

---

## DNS Records

### Current Records

All production records point to Cloudflare Tunnel with orange cloud (proxied).

| Type | Name | Value | Status | TTL | Proxied |
|------|------|-------|--------|-----|---------|
| CNAME | @ (root) | d3k7muo3c6lw6s.cloudfront.net | 🔵 Active | Auto | ✅ Yes |
| CNAME | www | d3k7muo3c6lw6s.cloudfront.net | 🔵 Active | Auto | ✅ Yes |
| CNAME | pi-origin | 75f644ea-4f45-4cb6-a992-6173dbc9ea93.cfargotunnel.com | 🔵 Active | Auto | ✅ Yes |
| CNAME | omv | 75f644ea-4f45-4cb6-a992-6173dbc9ea93.cfargotunnel.com | 🔵 Active | Auto | ✅ Yes |
| CNAME | ftp | 75f644ea-4f45-4cb6-a992-6173dbc9ea93.cfargotunnel.com | 🔵 Active | Auto | ✅ Yes |
| CNAME | docs | 75f644ea-4f45-4cb6-a992-6173dbc9ea93.cfargotunnel.com | ✅ Active | Auto | ✅ Yes |
| CNAME | meili | 75f644ea-4f45-4cb6-a992-6173dbc9ea93.cfargotunnel.com | ✅ Active | Auto | ✅ Yes |
| CNAME | tftp | 75f644ea-4f45-4cb6-a992-6173dbc9ea93.cfargotunnel.com | 🔵 Active | Auto | ✅ Yes |
| CNAME | api | 75f644ea-4f45-4cb6-a992-6173dbc9ea93.cfargotunnel.com | 🔵 Active | Auto | ✅ Yes |
| TXT | _acme-challenge | (Letsencrypt cert validation) | 🔵 Active | Auto | ❌ No |
| MX | @ | mail.cloudless.gr (priority 10) | 🔵 Active | 3600 | ❌ No |
| TXT | @ | v=spf1 include:sendgrid.net ~all | 🔵 Active | 3600 | ❌ No |

### DNS Update Process

1. **Add/Modify Records via Dashboard**
   - Log into Cloudflare Dashboard
   - Navigate to cloudless.gr → DNS
   - Click "Add Record"
   - Select type (CNAME, A, MX, TXT, etc.)
   - Fill in name and value
   - Set TTL (Auto recommended)
   - Save

2. **Update via API** (Terraform/CLI)
   ```bash
   # Example: Create CNAME record
   curl -X POST https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "type": "CNAME",
       "name": "subdomain",
       "content": "target.example.com",
       "ttl": 1,
       "proxied": true
     }'
   ```

3. **Terraform Management** (Recommended for Infrastructure)
   - Define records in `terraform/cloudflare/dns.tf`
   - Run `terraform plan` to preview
   - Run `terraform apply` to deploy
   - Git commit changes

---

## Cloudflare Tunnel

### Overview

Cloudflare Tunnel (formerly Argo Tunnel) provides a secure, outbound-only connection from the Pi k3s cluster to Cloudflare's global network. This eliminates the need for inbound firewall rules or public IPs.

### Tunnel Configuration

| Property | Value |
|----------|-------|
| Tunnel ID | `75f644ea-4f45-4cb6-a992-6173dbc9ea93` |
| Tunnel Name | cloudless-services |
| Account | cloudless (Cloudflare account) |
| Status | ✅ Active |
| Origin | 75f644ea-4f45-4cb6-a992-6173dbc9ea93.cfargotunnel.com |
| Egress Location | EU (sof01, vie02) |
| DNS Access | Enabled (Tailscale DNS integration) |

### Tunnel Credentials

The tunnel uses a credentials file stored on the Pi:

**File:** `/root/.cloudflared/75f644ea-4f45-4cb6-a992-6173dbc9ea93.json`

⚠️ **SECURITY**: This file is:
- Private to root user (600 permissions)
- NOT committed to git
- Rotated automatically by Cloudflare
- Contains certificate for Pi → Cloudflare connection

### Tunnel Configuration File

**Location:** `/home/tbaltzakis/.cloudflared/config.yml`

```yaml
tunnel: 75f644ea-4f45-4cb6-a992-6173dbc9ea93
credentials-file: /root/.cloudflared/75f644ea-4f45-4cb6-a992-6173dbc9ea93.json

ingress:
  # OMV UI & Services
  - hostname: omv.cloudless.gr
    service: http://127.0.0.1:80
    originRequest:
      noTLSVerify: true

  # Documentation Server (k3s)
  - hostname: docs.cloudless.gr
    service: http://127.0.0.1:30901
    originRequest:
      noTLSVerify: true

  # FTP Web Interface
  - hostname: ftp.cloudless.gr
    service: http://127.0.0.1:80
    originRequest:
      noTLSVerify: true

  # Meilisearch Search Engine
  - hostname: meili.cloudless.gr
    service: http://127.0.0.1:30902
    originRequest:
      noTLSVerify: true
      connectTimeout: 15s

  # TFTP (UDP) - Returns 404 via HTTP tunnel
  - hostname: tftp.cloudless.gr
    service: http_status:404

  # API Gateway (fallback)
  - hostname: api.cloudless.gr
    service: http://127.0.0.1:80
    originRequest:
      noTLSVerify: true

  # Default fallback
  - service: http_status:404

loglevel: info
logfile: /var/log/cloudflared/tunnel.log
```

### Tunnel Management

#### Check Tunnel Status

```bash
# SSH to Pi
ssh tbaltzakis@192.168.1.128

# View tunnel logs
sudo journalctl -u cloudflared -f

# Verify tunnel is connected
cloudflared tunnel info 75f644ea-4f45-4cb6-a992-6173dbc9ea93

# List active tunnel connections
curl -s http://localhost:7844/metrics | grep tunnel
```

#### Restart Tunnel

```bash
# Graceful restart
sudo systemctl restart cloudflared

# Force kill and restart (if hung)
sudo pkill -9 cloudflared
sudo systemctl start cloudflared

# Verify after restart
sleep 10
curl https://omv.cloudless.gr -I  # Should return 200
```

#### Rotate Tunnel Credentials

The credentials auto-rotate, but to manually re-generate:

```bash
# On local machine with Cloudflare CLI access
cloudflared tunnel token 75f644ea-4f45-4cb6-a992-6173dbc9ea93

# Copy output to Pi credentials file
```

### Ingress Rules

Each ingress rule maps a hostname to an origin service:

| Hostname | Service | Port | Notes |
|----------|---------|------|-------|
| omv.cloudless.gr | OMV Web UI | 80 | ProFTPD + TFTP management |
| docs.cloudless.gr | k3s docs service | 30901 | Returns 301 redirects to GitHub wiki |
| ftp.cloudless.gr | FTP Web UI | 80 | Same as OMV |
| meili.cloudless.gr | Meilisearch search engine | 30902 | Runs on omv-main (120GB SSD) |
| tftp.cloudless.gr | N/A | 404 | UDP not supported via HTTP tunnel |
| api.cloudless.gr | API Gateway | 80 | Fallback service |

---

## Cloudflare Workers & Failover

### Worker: cloudless-failover

The `cloudless-failover` Worker implements intelligent failover between the Pi origin and AWS Lambda.

#### Worker Purpose

1. **Route requests** to Pi origin (Tunnel)
2. **Check response status** - if < 400, serve directly
3. **Fallback to AWS** - if >= 400 or timeout
4. **Add response headers** - `x-served-by: pi-origin` or `aws-fallback`

#### Worker Configuration

| Property | Value |
|----------|-------|
| Worker Name | cloudless-failover |
| Type | HTTP Handler |
| Routes | cloudless.gr/* |
| Environment Variables | `AWS_FALLBACK_HOST` = d3k7muo3c6lw6s.cloudfront.net |
| Timeout | 10 seconds |
| CPU Time | ✅ Unlimited (paid plan) |

#### Failover Logic (Pseudocode)

```javascript
async function handleRequest(request) {
  const piOrigin = 'pi-origin.cloudless.gr';
  const awsFallback = env.AWS_FALLBACK_HOST; // d3k7muo3c6lw6s.cloudfront.net
  const timeout = 10000; // 10 seconds
  
  try {
    // Try Pi first
    const piResponse = await fetchWithTimeout(
      `https://${piOrigin}${request.url.pathname}`,
      timeout
    );
    
    // If Pi returned < 400, serve it
    if (piResponse.status < 400) {
      piResponse.headers.set('x-served-by', 'pi-origin');
      return piResponse;
    }
    
    // Pi returned 4xx/5xx, fall through to AWS
  } catch (error) {
    // Timeout or connection error, fall through to AWS
    console.log('Pi origin failed:', error.message);
  }
  
  // AWS Fallback
  const awsResponse = await fetch(
    `https://${awsFallback}${request.url.pathname}`
  );
  awsResponse.headers.set('x-served-by', 'aws-fallback');
  return awsResponse;
}
```

#### Deployment

```bash
# Publish worker changes (via Wrangler CLI)
npm install -D wrangler
wrangler publish src/worker.ts

# Or via dashboard: Cloudflare → Workers → cloudless-failover → Edit
```

#### Monitoring Worker

```bash
# View worker analytics
cloudflare-cli analytics worker cloudless-failover --period 24h

# Check error rate
# In Cloudflare Dashboard: cloudless.gr → Workers → cloudless-failover → Analytics
```

---

## Security & DDoS Protection

### DDoS Mitigation

Cloudflare automatically mitigates Layer 3/4 (network) and Layer 7 (application) DDoS attacks:

| Protection Level | Setting |
|------------------|---------|
| Advanced DDoS | ✅ Enabled (free plan) |
| Sensitivity | High |
| Challenge | ✅ CAPTCHA for suspicious traffic |
| Rate Limiting | Custom rules (see below) |

### Web Application Firewall (WAF)

**Status:** ✅ Managed Rules Enabled

| Rule Set | Action | Notes |
|----------|--------|-------|
| OWASP ModSecurity Core | Challenge | SQL injection, XSS, etc. |
| Cloudflare Managed Rules | Block | Known malware, botnets |
| Cloudflare Bot Management | Challenge | Suspicious bot traffic |

### Custom WAF Rules

Example rule to block requests from certain countries:

```
(cf.country != "GR" AND cf.country != "DE" AND cf.country != "US") 
AND 
(cf.threat_score > 50)
→ Block
```

### SSL/TLS Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| SSL Mode | Full (Strict) | End-to-end encryption |
| HTTP to HTTPS | Redirect | Force secure connections |
| Minimum TLS | 1.2 | No legacy clients |
| HSTS | 12 months | Prevent downgrade attacks |
| HSTS Subdomains | Included | Protect subdomains too |
| Preload | ✅ | Include in browser preload lists |

---

## API Token Management

### Current Token

| Property | Value |
|----------|-------|
| Token Name | cloudless2 |
| Type | User API Token |
| Prefix | cfut_ (vs cfat_ for API keys) |
| Permissions | Zone.Zone:Read + Zone.DNS:Edit |
| Scopes | cloudless.gr zone only |
| Status | ✅ Active |
| Storage | AWS SSM `/cloudless/production/CLOUDFLARE_API_TOKEN` |
| Rotation Policy | Annual or on compromise |

### Token Verification

```bash
# Test token validity
TOKEN=$(aws ssm get-parameter --name /cloudless/production/CLOUDFLARE_API_TOKEN --query 'Parameter.Value' --output text)

curl "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Expected response:
# {"success":true,"errors":[],"messages":[],"result":{"id":"...","status":"active"}}
```

### Token Permissions

| Permission | Scope | Purpose |
|------------|-------|---------|
| Zone.Zone:Read | cloudless.gr | Read zone settings |
| Zone.DNS:Edit | cloudless.gr | Modify DNS records |
| Zone.SSL:Edit | cloudless.gr | Manage SSL/TLS |

### Creating New Token

1. Log into Cloudflare Dashboard
2. Go to My Profile → API Tokens
3. Click "Create Token"
4. Choose "Custom Token" (not "API Key")
5. Grant permissions: `Zone.Zone:Read`, `Zone.DNS:Edit`
6. Specify zone: cloudless.gr
7. Click "Create Token"
8. Copy token immediately (not shown again)
9. Store in AWS SSM: `/cloudless/production/CLOUDFLARE_API_TOKEN`

### Token Rotation Checklist

When rotating (e.g., quarterly):

- [ ] Create new token in Cloudflare Dashboard
- [ ] Test new token with API call
- [ ] Update `/cloudless/production/CLOUDFLARE_API_TOKEN` in AWS SSM
- [ ] Test terraform/CLI tools still work
- [ ] Wait 24 hours before deleting old token
- [ ] Delete old token in Cloudflare Dashboard
- [ ] Document rotation date in this file

---

## Monitoring & Alerts

### Key Metrics

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| Tunnel Status | Down > 5min | Page on-call engineer |
| 5xx Errors | > 10/min | Page engineer |
| Cache Hit Ratio | < 50% | Investigate cache settings |
| Worker Errors | > 5% | Review worker logs |
| DNS Query Failure | > 1% | Investigate nameserver |

### Setting Up Alerts

**Via Cloudflare Dashboard:**

1. cloudless.gr → Notifications → Create Notification
2. Choose notification type:
   - Tunnel Down/Up
   - DDoS Attack
   - SSL Alert
   - Firewall Event
3. Set threshold and recipient email
4. Save

**Recommended Alerts:**

- ✅ Tunnel connectivity (down → critical)
- ✅ DDoS attack detected
- ✅ SSL certificate expiring (30 days out)
- ✅ 5xx error rate spike

### Monitoring Dashboard

**Cloudflare Analytics:** cloudless.gr → Analytics

Displays:
- Requests over time
- Cache performance
- Bandwidth usage
- Threat activity
- Error rates by type

---

## Troubleshooting

### Issue: Tunnel Status Shows "Disconnected"

**Symptoms:**
- `curl https://omv.cloudless.gr` → Connection timeout or 522 error
- Cloudflare Dashboard shows "No Connectors"

**Diagnosis:**

```bash
# SSH to Pi
ssh tbaltzakis@192.168.1.128

# Check cloudflared service
sudo systemctl status cloudflared

# Check logs for errors
sudo journalctl -u cloudflared -n 50

# Verify credentials file exists
ls -la /root/.cloudflared/75f644ea-*.json
```

**Solutions:**

1. **Restart cloudflared:**
   ```bash
   sudo systemctl restart cloudflared
   sleep 10
   curl https://omv.cloudless.gr -I
   ```

2. **Check network connectivity:**
   ```bash
   ping 1.1.1.1        # Cloudflare DNS
   ping 8.8.8.8        # Google DNS
   ss -tulpn | grep cloudflared  # Check ports
   ```

3. **Regenerate credentials (if corrupted):**
   ```bash
   sudo rm /root/.cloudflared/75f644ea-*.json
   cloudflared tunnel login
   sudo systemctl restart cloudflared
   ```

### Issue: docs.cloudless.gr Returns 502 Bad Gateway

**Symptoms:**
- Other services (omv, ftp) return 200
- Only docs.cloudless.gr returns 502
- Tunnel logs show no connection errors

**Root Causes:**
- K3s service on wrong port
- Pod not running
- Service misconfigured

**Diagnosis:**

```bash
# SSH to Pi
ssh tbaltzakis@192.168.1.128

# Check k3s service
kubectl get svc docs-service -o wide -n cloudless

# Expected output: docs-service NodePort 10.43.xxx.xxx:80/TCP
# Note: Port changed from 30900 to 30901 on 2026-07-05

# Check if pod is running
kubectl get pods -n cloudless | grep docs

# Get pod status details
kubectl describe pod docs-server-* -n cloudless

# Test connectivity directly from Pi
curl http://127.0.0.1:30901 -v
```

**Solutions:**

1. **Update tunnel config to correct port:**
   ```bash
   sudo nano /home/tbaltzakis/.cloudflared/config.yml
   # Change service port from 30900 to 30901
   sudo systemctl restart cloudflared
   ```

2. **Restart the docs pod:**
   ```bash
   kubectl rollout restart deployment/docs-server -n cloudless
   ```

3. **Check pod logs:**
   ```bash
   kubectl logs -f deployment/docs-server -n cloudless
   ```

### Issue: meili.cloudless.gr Returns 302 Redirect

**Symptoms:**
- Returns 302 redirect instead of Meilisearch UI
- Response headers show wrong origin

**Root Cause:**
- Tunnel ingress configured for `127.0.0.1:30902`
- Meilisearch pod may not be running or service port misconfigured

**Diagnosis:**

```bash
# SSH to Pi
ssh tbaltzakis@192.168.1.128

# Check Meilisearch pod
kubectl get pods -n meilisearch
kubectl get svc meilisearch -n meilisearch

# Test local connectivity
curl http://127.0.0.1:30902 -v
```

### Issue: "cert not yet valid" Error

**Symptoms:**
- Tunnel logs show certificate validation error
- Tunnel keeps restarting

**Solution:**

```bash
# SSH to Pi and check system clock
date

# If time is wrong, sync it
sudo timedatectl set-ntp true
sudo timedatectl

# Restart cloudflared
sudo systemctl restart cloudflared
```

---

## Runbooks

### Daily Operations

**Morning Checklist (5 min):**

```bash
# 1. Check tunnel status
curl -s https://omv.cloudless.gr -I | head -1
curl -s https://ftp.cloudless.gr -I | head -1
curl -s https://meili.cloudless.gr -I | head -1

# 2. Check for errors in logs
ssh tbaltzakis@192.168.1.128 "sudo journalctl -u cloudflared --since '10 minutes ago' | tail -20"

# 3. Verify DNS is resolving
dig cloudless.gr +short
dig omv.cloudless.gr +short
```

**Weekly Checklist (15 min):**

```bash
# 1. Check all DNS records
# In Cloudflare Dashboard: cloudless.gr → DNS → Review all records

# 2. Review DDoS stats
# In Cloudflare Dashboard: cloudless.gr → Analytics → Threats

# 3. Check worker error rate
# In Cloudflare Dashboard: cloudless.gr → Workers → Analytics

# 4. Verify SSL certificates
# In Cloudflare Dashboard: cloudless.gr → SSL/TLS → Origin Server
```

**Monthly Checklist (30 min):**

```bash
# 1. Review and rotate API token if needed
# See "Token Rotation Checklist" above

# 2. Audit DNS records for cleanup
# Check for unused or test records

# 3. Review WAF rules and block lists
# In Cloudflare Dashboard: cloudless.gr → Security → WAF

# 4. Test failover manually
# Shut down tunnel, verify AWS fallback works
# Restart tunnel, verify Pi origin works
```

### Emergency Response

**Tunnel Down (Critical)**

1. Receive alert: Tunnel disconnected
2. SSH to Pi: `ssh tbaltzakis@192.168.1.128`
3. Check status: `sudo systemctl status cloudflared`
4. Restart: `sudo systemctl restart cloudflared`
5. Verify: `curl https://omv.cloudless.gr -I` (should return 200)
6. If still down, check DNS to confirm failover to AWS working
7. Escalate if AWS failover not working

**DDoS Attack (High)**

1. Monitor: Watch Cloudflare Analytics
2. No action needed - Cloudflare mitigates automatically
3. If rate limiting needed, update WAF rules:
   - Cloudflare Dashboard → cloudless.gr → Security → Rate Limiting
   - Add rule for `/api/*` : 100 requests per 10 minutes
4. Communicate status to team

**DNS Poison/Hijack (Critical)**

1. Change password immediately: Cloudflare Dashboard
2. Enable 2FA if not already enabled
3. Audit recent DNS changes for unauthorized modifications
4. Contact Cloudflare support if compromised

---

## Reference

### Useful Links

- **Cloudflare Dashboard:** https://dash.cloudflare.com
- **Cloudflare API Docs:** https://developers.cloudflare.com/api
- **Tunnel Docs:** https://developers.cloudflare.com/cloudflare-one/connections/connect-apps
- **Worker Docs:** https://developers.cloudflare.com/workers

### Team Contacts

| Role | Contact | Timezone |
|------|---------|----------|
| DevOps Lead | tbaltzakis | CET/EET |
| On-Call Escalation | (TBD) | (TBD) |
| Cloudflare Support | Premium | 24/7 |

### Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-07-04 | Kiro CLI | Initial comprehensive documentation |
| 2026-07-05 | tbaltzakis | Fixed docs.cloudless.gr port (30900 → 30901), updated DNS status table |
| 2026-07-06 | Cline | Updated meili.cloudless.gr to omv-main (127.0.0.1), removed omv-ha nodeSelector |

---

**Status:** ✅ Production Ready  
**Last Reviewed:** 2026-07-06  
**Next Review:** 2026-08-04 (monthly)