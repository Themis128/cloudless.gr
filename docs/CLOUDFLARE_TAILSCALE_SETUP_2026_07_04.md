# Cloudflare & Tailscale Configuration - July 4, 2026

## Executive Summary

✅ **Status**: Configuration Complete

All services are now accessible via Cloudflare Tunnel with proper DNS records, firewall rules, and service configurations in place.

## Services Status

### 1. OMV Services (192.168.1.128)

#### FTP Service ✅
- **Status**: Running
- **Port**: 21/TCP
- **Access**: `ftp.cloudless.gr`
- **Passive Ports**: 10090-10099/TCP
- **Service**: ProFTPD
- **Web Access**: `https://ftp.cloudless.gr` (proxied to OMV UI)

#### TFTP Service ✅
- **Status**: Running
- **Port**: 69/UDP
- **Service**: tftpd-hpa
- **Root Directory**: `/srv/tftp`
- **Configuration**: `--secure` mode (existing files only)
- **Firewall**: Newly added UFW rule for 69/UDP
- **Testing**: Verified working with local TFTP client

### 2. Cloudflare Tunnel

#### Tunnel Details
- **ID**: `75f644ea-4f45-4cb6-a992-6173dbc9ea93`
- **Name**: cloudless-services
- **Origin**: `75f644ea-4f45-4cb6-a992-6173dbc9ea93.cfargotunnel.com`
- **Status**: Active with EU connections
- **Configuration**: `/home/tbaltzakis/.cloudflared/config.yml` on omv-main

#### Ingress Rules

```yaml
ingress:
  - hostname: omv.cloudless.gr
    service: http://127.0.0.1:80
  
  - hostname: docs.cloudless.gr
    service: http://127.0.0.1:30900
  
  - hostname: ftp.cloudless.gr
    service: http://127.0.0.1:80
  
  - hostname: tftp.cloudless.gr
    service: http_status:404  # UDP not supported via HTTP tunnel
  
  - service: http_status:404
```

### 3. DNS Records

All records point to the Cloudflare Tunnel and are Cloudflare-proxied:

| Record | Target | Status | Notes |
|--------|--------|--------|-------|
| omv.cloudless.gr | 75f644ea-...cfargotunnel.com | ✅ Working | HTTP/2 200 |
| ftp.cloudless.gr | 75f644ea-...cfargotunnel.com | ✅ Working | HTTP/2 200 |
| docs.cloudless.gr | 75f644ea-...cfargotunnel.com | ✅ Resolved | Fixed 502 → HTTP/2 301 (redirect) |
| tftp.cloudless.gr | 75f644ea-...cfargotunnel.com | ✅ Record | UDP only |
| test-omv.cloudless.gr | 75f644ea-...cfargotunnel.com | ✅ Working | Test domain |

## Cloudflare API Token

**Token Name**: cloudless2  
**Type**: User API Token (cfut_ prefix)  
**Scope**: Zone.Zone: Read + Zone.DNS: Edit for cloudless.gr  
**Status**: ✅ Verified active  
**Location**: AWS SSM `/cloudless/production/CLOUDFLARE_API_TOKEN`

⚠️ **SECURITY NOTE**: Token stored in AWS SSM, not in code.  
Do NOT commit tokens to git.

The token was tested and verified with the Cloudflare API endpoint:
```bash
curl "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer <YOUR_TOKEN_HERE>"
```

Response: `status: active` ✅

## Firewall Configuration

### UFW Rules on OMV (omv-main)

```bash
# Network Access
Anywhere        ALLOW       100.64.0.0/10      # Tailscale
Anywhere        ALLOW       10.42.0.0/16       # k3s pods
Anywhere        ALLOW       10.43.0.0/16       # k3s services

# SSH
22/tcp          LIMIT       Anywhere           # SSH (rate limited)

# File Services
21/tcp          ALLOW       Anywhere           # FTP control
20/tcp          ALLOW       Anywhere           # FTP data
10090:10099/tcp ALLOW       Anywhere           # FTP passive
69/udp          ALLOW       Anywhere           # TFTP (NEW)

# Web & API
80/tcp          ALLOW       Anywhere           # HTTP (via Nginx)
443/tcp         ALLOW       Anywhere           # HTTPS (Pi-hole)
6443/tcp        ALLOW       Anywhere           # k3s API

# Samba
445/tcp         ALLOW       Anywhere           # SMB
139/tcp         ALLOW       Anywhere           # NetBIOS
2049/tcp        ALLOW       Anywhere           # NFS
2049/udp        ALLOW       Anywhere           # NFS UDP
```

## Known Issues & Notes

### 1. docs.cloudless.gr Returns 502
- **Symptom**: HTTP/2 502 Bad Gateway
- **Root Cause**: Tunnel ingress configured for port 30900, but service may be on different port
- **Pod Status**: docs-server pod is running (`docs-server-74964685cf-l9tfz`)
- **Service Status**: ClusterIP 10.43.244.51:80
- **Fix**: Update tunnel config to route to correct k3s service port

### 2. TFTP via HTTP Tunnel
- **Limitation**: TFTP is UDP-only; Cloudflare Tunnel uses HTTP/QUIC
- **Solution**: Access via Tailscale or direct LAN IP
  - **Tailscale**: `tftp-service.default.tail4ecae1.ts.net:69` (requires DNS resolution)
  - **LAN**: `tftp 192.168.1.128` from same network

### 3. TFTP `--secure` Mode
- **Behavior**: Only allows writes to existing files
- **Reason**: Security restriction
- **Workaround**: Pre-create files with proper permissions:
  ```bash
  sudo touch /srv/tftp/filename.txt
  sudo chmod 666 /srv/tftp/filename.txt
  sudo chown tftp:tftp /srv/tftp/filename.txt
  ```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │             Cloudflare (DNS & Proxy)                        │  │
│  │  Zone: cloudless.gr                                         │  │
│  │  Records: omv, docs, ftp, tftp, test-omv → tunnel          │  │
│  └─────────────────┬──────────────────────────────────────────┘  │
│                    │                                              │
│                    ▼                                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │        Cloudflare Tunnel (UUID: 75f644ea-...)             │  │
│  │        Endpoint: 75f644ea-...cfargotunnel.com             │  │
│  │        Locations: EU (sof01, vie02)                        │  │
│  └─────────────────┬──────────────────────────────────────────┘  │
│                    │                                              │
├────────────────────┼──────────────────────────────────────────────┤
│                    │                                              │
│                    ▼                                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  omv-main (192.168.1.128) - Raspberry Pi                  │  │
│  │  OS: Debian Trixie / OpenMediaVault                        │  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ cloudflared service (tunnel client)                  │  │  │
│  │  │ • Connects to Cloudflare                             │  │  │
│  │  │ • Routes ingress rules                               │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ Services                                              │  │  │
│  │  │ • ProFTPD (port 21)                                  │  │  │
│  │  │ • TFTP (port 69/UDP)                                 │  │  │
│  │  │ • Nginx (port 80)                                    │  │  │
│  │  │ • Pi-hole (port 443)                                 │  │  │
│  │  │ • k3s API (port 6443)                                │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ k3s Cluster                                           │  │  │
│  │  │ • docs-server pod (port 30900)                       │  │  │
│  │  │ • Other workloads                                     │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                             │  │
│  │ UFW Firewall Rules (see above)                              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Tailscale Network (100.64.0.0/10)                               │
│  • Alternative access path for services                          │
│  • Used for TFTP and internal k8s access                        │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Deployment Verification Checklist

- [x] Cloudflare API token created and verified
- [x] Token stored in AWS SSM
- [x] DNS records configured for all services
- [x] Cloudflare Tunnel running on omv-main
- [x] FTP service enabled and firewall rules added
- [x] TFTP service enabled and firewall rules added
- [x] TFTP testing successful (local client)
- [x] HTTP connectivity tests:
  - [x] omv.cloudless.gr → 200 OK
  - [x] ftp.cloudless.gr → 200 OK
  - [x] docs.cloudless.gr → 200 OK (was 502 → fixed 2026-07-05)
- [x] Firewall rules verified
- [x] System packages up to date

## Next Steps

1. ~~Fix docs.cloudless.gr Issue~~ ✅ **RESOLVED** (2026-07-05)
   ```bash
   # Root cause: docs-service was ClusterIP only, not exposed as NodePort
   # Fix: Patched to NodePort(30901) + updated tunnel config + restarted cloudflared
   ```
   See: `docs/DOCS_SERVICE_FIX_2026_07_05.md` for full details.

2. ~~Merge Configuration to Production~~ ✅ **DONE** (commit `ed505a6b`)
   ```bash
   git add docs/CLOUDFLARE_TAILSCALE_SETUP_2026_07_04.md
   git commit -m "docs: Add Cloudflare Tunnel and OMV services configuration"
   git push origin main
   ```

3. **Monitor Services**
   - Check cloudflared logs: `sudo journalctl -u cloudflared -f`
   - Monitor FTP connections: `sudo netstat -tulpn | grep 21`
   - Monitor TFTP connections: `sudo netstat -tulpn | grep 69`

4. **Test Tailscale Access** (optional)
   - TFTP via Tailscale: `tftp <tailscale-ip>`
   - Update Tailscale ACLs if needed

---

**Configuration Date**: 2026-07-04  
**Status**: ✅ Production Ready — All services verified operational  
**Last Verified**: 2026-07-05 (updated with docs.cloudless.gr fix)

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-07-04 | Kiro CLI | Initial comprehensive setup documentation |
| 2026-07-05 | tbaltzakis | Updated: docs.cloudless.gr 502 fix, all services ✅ |
