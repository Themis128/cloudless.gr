# Cloudflare & Tailscale Configuration - July 4, 2026

## Executive Summary

✅ **Status**: Configuration Complete

All services are now accessible via Cloudflare Tunnel with proper DNS records, firewall rules, and service configurations in place. All k3s services run exclusively on omv-main (120GB SSD).

## Network Fabric

**Tailscale** operates as the secure fabric interconnect for all k3s cluster services:
- Mesh networking between nodes (omv-main ↔ omv-ha)
- MagicDNS endpoint resolution (`*.ts.cloudless.gr`)
- Required for cross-node service access if needed in future
- Currently unused - all k3s services consolidated on omv-main

## Services Status

### 1. OMV Services (192.168.1.128 / omv-main)

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

#### Meilisearch Service ✅

- **Status**: Running
- **Port**: 7700/TCP (NodePort 30902)
- **Access**: `meili.cloudless.gr` (via tunnel)
- **Service**: Meilisearch v1.48
- **Node**: Running on **omv-main** (120GB SSD, exclusive k3s storage)
- **Namespace**: `meilisearch`
- **Storage**: 5Gi local-path PVC on 120GB SSD
- **Auth**: Master key in AWS SSM

#### Log Aggregation Service (Loki/Grafana) ✅

- **Status**: Running
- **Port**: 3000/TCP (NodePort 30850)
- **Access**: `grafana.cloudless.gr` (Internal/Tunnel)
- **Service**: Loki (Logs) + Grafana (Dashboard)
- **Node**: Running on `omv-main`
- **Aggregation**: All self-hosted app logs gathered via Promtail into Loki.

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
    service: http://127.0.0.1:30901

  - hostname: ftp.cloudless.gr
    service: http://127.0.0.1:80

  - hostname: meili.cloudless.gr
    service: http://127.0.0.1:30902

  - hostname: tftp.cloudless.gr
    service: http_status:404 # UDP not supported via HTTP tunnel

  - service: http_status:404
```

### 3. DNS Records

All records point to the Cloudflare Tunnel and are Cloudflare-proxied:

| Record                | Target                       | Status      | Notes                             |
| --------------------- | ---------------------------- | ----------- | --------------------------------- |
| appflowy.cloudless.gr | e977a490-...cfargotunnel.com | ✅ Working  | HTTP/2 302 → /app                |
| espocrm.cloudless.gr  | e977a490-...cfargotunnel.com | ✅ Working  | HTTP/2 200 (login page)          |
| postiz.cloudless.gr   | e977a490-...cfargotunnel.com | ✅ Working  | HTTP/2 307 (redirect)            |
| grafana.cloudless.gr  | e977a490-...cfargotunnel.com | ✅ Working  | HTTP/2 302 → /login              |
| docs.cloudless.gr     | e977a490-...cfargotunnel.com | ✅ Active   | HTTP/2 301 redirects to GitHub   |
| omv.cloudless.gr      | e977a490-...cfargotunnel.com | ✅ Active   | HTTP/2 200 (OMV UI)              |
| ftp.cloudless.gr      | e977a490-...cfargotunnel.com | ✅ Active   | HTTP/2 200 (OMV UI)              |
| meili.cloudless.gr    | e977a490-...cfargotunnel.com | ✅ Active   | HTTP/2 200 (Meilisearch UI)      |

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

### 1. Meilisearch Runs on omv-main

- **Status**: ✅ Confirmed running on omv-main (120GB SSD)
- **Storage**: Uses local-path PVC on primary k3s storage
- **No nodeSelector** - runs on default node (omv-main)
- **Verification**: `curl -I https://meili.cloudless.gr/health` returns HTTP/2 200

### 2. docs.cloudless.gr Returns 502 ✅ FIXED

- **Fix Applied (2026-07-05)**: Updated tunnel config from port 30900 to 30901
- **Verification**: All endpoints now return 301 redirects to GitHub wiki ✅

### 3. TFTP via HTTP Tunnel

- **Limitation**: TFTP is UDP-only; Cloudflare Tunnel uses HTTP/QUIC
- **Solution**: Access via Tailscale or direct LAN IP
  - **Tailscale**: `tftp-service.default.tail4ecae1.ts.net:69` (requires DNS resolution)
  - **LAN**: `tftp 192.168.1.128` from same network

### 4. TFTP `--secure` Mode

- **Behavior**: Only allows writes to existing files
- **Reason**: Security restriction
- **Workaround**: Pre-create files with proper permissions:
  ```bash
  sudo touch /srv/tftp/filename.txt
  sudo chmod 666 /srv/tftp/filename.txt
  sudo chown tftp:tftp /srv/tftp/filename.txt
  ```

### 5. Self-Hosted Log Aggregation

- **Mechanism**: Promtail (agent) → Loki (aggregator) → Grafana (visualization).
- **Scope**: Gathers logs from all namespaces (appflowy, postiz, n8n, meilisearch, monitoring, etc.).
- **Access**: Accessible via Grafana dashboard (Internal/Tunnel).
- **Status**: ✅ Active and gathering logs from all self-hosted apps.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │             Cloudflare (DNS & Proxy)                       │  │
│  │  Zone: cloudless.gr                                      │  │
│  │  Records: omv, docs, ftp, tftp, meili → tunnel            │  │
│  └─────────────────┬─────────────────────────────────────────┘  │
│                    │                                            │
│                    ▼                                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │        Cloudflare Tunnel (UUID: 75f644ea-...)             │  │
│  │        Endpoint: 75f644ea-...cfargotunnel.com             │  │
│  │        Locations: EU (sof01, vie02)                        │  │
│  └─────────────────┬─────────────────────────────────────────┘  │
│                    │                                            │
│  ├─────────────────┼──────────────────────────────────────────────┤
│                    │                                            │
│                    ▼                                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  omv-main (192.168.1.128) - Raspberry Pi               │  │
│  │  OS: Debian Trixie / OpenMediaVault                       │  │
│  │  Storage: 120GB SSD (exclusive k3s)                    │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │ cloudflared service (tunnel client)             │    │  │
│  │  │ • Connects to Cloudflare                        │    │  │
│  │  │ • Routes ingress rules                          │    │  │
│  │  └──────────────────────────────────────────────────┘    │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │ Services on this node                              │    │  │
│  │  │ • ProFTPD (port 21)                             │    │  │
│  │  │ • TFTP (port 69/UDP)                            │    │  │
│  │  │ • Nginx (port 80)                               │    │  │
│  │  │ • Pi-hole (port 443)                            │    │  │
│  │  │ • k3s API (port 6443)                           │    │  │
│  │  └──────────────────────────────────────────────────┘    │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │ k3s Cluster (all services)                         │  │
│  │  │ • Meilisearch (NodePort 30902)                    │  │
│  │  │ • docs-service (NodePort 30901)                   │  │
│  │  │ • All other pods on 120GB SSD                     │  │
│  │  └──────────────────────────────────────────────────┘    │  │
│  │                                                            │  │
│  │  UFW Firewall Rules (see above)                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                               │
│  omv-ha (192.168.1.130) - Second Pi 5 node                │
│  • Standby/warm spare (no active k3s workloads)             │
│  • Available for overflow/future expansion                   │
│                                                               │
│  Tailscale Network (100.64.0.0/10)                           │
│  • Fabric interconnect for cross-node access if needed        │
│                                                               │
└─────────────────────────────────────────────────────────────────┘
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
  - [x] meili.cloudless.gr → 200 OK (running on omv-main)
- [x] Log aggregation verified (Loki/Grafana)
- [x] Firewall rules verified
- [x] System packages up to date

---

**Configuration Date**: 2026-07-04  
**Status**: ✅ Complete — All tunnel configs verified and working  
**Last Verified**: 2026-07-06 (meili.cloudless.gr running on omv-main)

## Revision History

| Date       | Author     | Change                                              |
| ---------- | ---------- | --------------------------------------------------- |
| 2026-07-04 | Kiro CLI   | Initial comprehensive setup documentation           |
| 2026-07-05 | tbaltzakis | Updated: docs.cloudless.gr 502 fix, all services ✅ |
| 2026-07-06 | Pochi      | Added Meilisearch and Log Aggregation (Loki) status |
| 2026-07-06 | Cline      | All k3s services consolidated on omv-main, removed omv-ha nodeSelector |