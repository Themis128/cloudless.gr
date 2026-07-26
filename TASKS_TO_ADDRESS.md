# Items That Need Addressing - Cloudless.gr Infrastructure

## 🔴 CRITICAL ISSUES REQUIRING IMMEDIATE ATTENTION

### 1. Tailscale Operator Not Deployed
**Status**: ❌ NOT DEPLOYED  
**Impact**: No secure mesh networking between omv nodes  
**Required**: Tailscale operator deployment

#### Details:
- Tailscale namespace does not exist in k3s cluster
- Tailscale operator pods not running
- Applications cannot communicate over Tailscale mesh network
- Selfhosted applications fall back to LAN endpoints (192.168.1.128:30800)

#### Required Actions:
```bash
# 1. Configure Tailscale OAuth credentials in GitHub secrets
# Add these secrets to repository:
TS_CLIENT_ID
TS_CLIENT_SECRET

# 2. Deploy Tailscale operator
cd infrastructure/tailscale
./deploy.sh

# 3. Verify deployment
kubectl get pods -n tailscale-operator
```

### 2. omv Node Unreachable (192.168.1.128:30800)
**Status**: ❌ OFFLINE  
**Impact**: ESP32 management and selfhosted applications cannot communicate with omv node  
**Required**: Verify omv node is powered on and k3s is running

#### Details:
- omv node (192.168.1.128) on port 30800 not responding
- ESP32 management API configured to communicate with this node
- Applications return 503 with offline: true when node unreachable (proper error handling exists)
- Cloudflare tunnel routes configured for omv node

#### Required Actions:
```bash
# 1. Power on omv node and verify network connectivity
# 2. SSH to omv node and check k3s services
ssh tbaltzakis@192.168.1.128
systemctl status k3s.service

# 3. Verify omv node is accessible
curl http://192.168.1.128:30800/api/esp32/status
```

## 🟡 HIGH PRIORITY ISSUES

### 3. kubectl Cannot Connect to Cluster
**Status**: ❌ CONNECTION REFUSED  
**Impact**: Cannot deploy Tailscale operator or manage k3s cluster  
**Required**: Fix kubectl configuration

#### Details:
- kubectl cannot connect to k3s API server
- Connection refused on localhost:8080
- Cluster API not accessible from current environment

#### Required Actions:
```bash
# 1. Configure kubectl to use k3s cluster
# Set KUBECONFIG environment variable or configure kubectl context

# 2. Verify cluster connectivity
kubectl cluster-info
kubectl get nodes
```

## ✅ WHAT'S ALREADY CONFIGURED

### Selfhosted Applications
- ✅ ESP32 management API configured (`src/app/api/admin/esp32/route.ts`)
- ✅ Proper error handling for unreachable omv node (returns 503 with offline: true)
- ✅ Private LAN URL validation via `isPrivateLanUrl()` function
- ✅ Timeout configurations (5-8 seconds) for reliable communication
- ✅ Admin authentication required for ESP32 endpoints

### Tailscale Configuration
- ✅ Tailscale operator deployment script exists (`infrastructure/tailscale/deploy.sh`)
- ✅ Tailscale namespace configuration file (`infrastructure/tailscale/namespace.yaml`)
- ✅ Tailscale RBAC configuration (`infrastructure/tailscale/namespace.yaml`)
- ✅ Tailscale subnet router configuration (`infrastructure/tailscale/subnet-router.yaml`)
- ✅ Tailscale ingress class configuration (`infrastructure/tailscale/ingress-class.yaml`)
- ✅ Tailscale ProxyGroup for monitoring (`infrastructure/tailscale/proxygroup-monitoring.yaml`)
- ✅ Tailscale ingress rules (`infrastructure/tailscale/ingresses.yaml`)
- ✅ GitHub Actions workflow for Tailscale deployment (`.github/workflows/tailscale-deploy.yml`)
- ✅ Tailscale OAuth credentials reference in workflows

### Cloudflare Configuration
- ✅ Cloudflare tunnel routes configured for omv node on port 30800
- ✅ ESP32 watchdog monitoring configured for omv reachability
- ✅ All selfhosted services use proper LAN endpoints with fallback error handling

## 📊 DEPLOYMENT STATUS

| Component | Status | Notes |
|-----------|--------|-------|
| Tailscale Operator | ❌ Not Deployed | Missing credentials/configuration |
| omv Node (192.168.1.128) | ❌ Offline | Node not responding |
| kubectl Cluster Access | ❌ Connection Refused | API server not accessible |
| ESP32 Management API | ✅ Configured | Proper error handling implemented |
| Tailscale Configuration Files | ✅ Ready | All files prepared |
| GitHub Secrets | ⚠️ Missing | TS_CLIENT_ID and TS_CLIENT_SECRET needed |

## 🎯 PRIORITY ORDER FOR RESOLUTION

### Priority 1 (IMMEDIATE - Must Fix First)
1. **Fix kubectl connectivity** - Resolve cluster API access issues
2. **Power on omv node** - Verify node is powered on and network accessible
3. **Deploy Tailscale operator** - Establish secure mesh networking between nodes

### Priority 2 (HIGH - Next)
4. **Verify omv node k3s services** - Ensure k3s is running on omv node
5. **Test omv node connectivity** - Verify node responds on port 30800
6. **Configure Tailscale OAuth credentials** - Add secrets to GitHub

### Priority 3 (MEDIUM - After Tailscale Deployed)
7. **Test ESP32 communication over Tailscale** - Verify mesh networking works
8. **Document Tailscale configuration** - Update documentation

## 🔧 TECHNICAL DETAILS

### Application Configuration Files
- **ESP32 Route**: `src/app/api/admin/esp32/route.ts`
  - Uses `ALERT_API = process.env.ALERT_API_URL ?? "http://192.168.1.128:30800"`
  - Validates private LAN URLs with `isPrivateLanUrl()` function
  - Returns 503 with offline: true when node unreachable

- **ESP32 Notion Sync**: `src/app/api/admin/esp32/notion-sync/route.ts`
  - Targets same omv node endpoint

- **Operations Monitoring**: `src/app/api/admin/ops/monitor/route.ts`
  - Monitors ALERT_API_URL with private LAN validation

### Tailscale Deployment Script
- Location: `infrastructure/tailscale/deploy.sh`
- Steps:
  1. Add Tailscale Helm repository
  2. Create tailscale-operator namespace
  3. Load credentials from SSM or use existing
  4. Install Tailscale operator with Helm
  5. Deploy subnet router
  6. Deploy ProxyGroup for monitoring
  7. Create Tailscale ingress class
  8. Verify deployment

### omv Node Configuration
- Node: Raspberry Pi 5 (8GB RAM, NVMe boot)
- Services: k3s cluster with ESP32 management on port 30800
- Role: Primary node in HA failover cluster

## 📞 CONTACT & REFERENCE

### Tailscale Configuration Reference
- **Tailscale Operator Helm Chart**: `tailscale/tailscale-operator`
- **Tailscale Namespace**: `tailscale-operator`
- **Required Secrets**: `tailscale-operator-secrets` (TS_CLIENT_ID, TS_CLIENT_SECRET)
- **MagicDNS**: `*.ts.cloudless.gr`

### omv Node Reference
- **Node IP**: 192.168.1.128
- **Node Name**: omv-main
- **Port**: 30800 (ESP32 management API)
- **Role**: Primary in HA cluster

### Cloudflare Reference
- **Tunnel**: Active and configured
- **Routes**: Configured for omv node services
- **DNS**: Configured for secure access

## ⚠️ WARNINGS

### Current State Warnings
- Applications will fail to communicate with omv node until node is online
- Tailscale mesh networking cannot be established until operator is deployed
- kubectl cannot manage cluster until API access is restored
- ESP32 watchdog monitoring will report failures until connectivity restored

### Risk Assessment
- **High Risk**: omv node offline - affects ESP32 management and selfhosted applications
- **Medium Risk**: Tailscale not deployed - prevents secure mesh networking
- **Low Risk**: kubectl access issues - temporary management limitation

## ✅ SUCCESS CRITERIA

### When All Issues Are Resolved
- [ ] Tailscale operator deployed and running
- [ ] omv node (192.168.1.128) powered on and accessible
- [ ] kubectl can connect to k3s cluster
- [ ] Applications can communicate with omv node
- [ ] ESP32 management works over Tailscale mesh network
- [ ] All selfhosted services operational

### Verification Commands
```bash
# Verify Tailscale operator
kubectl get pods -n tailscale-operator

# Verify omv node connectivity
curl http://192.168.1.128:30800/api/esp32/status

# Verify ESP32 communication
curl http://cloudless.gr/api/admin/esp32/status

# Check cluster health
kubectl get nodes
kubectl get pods -n cloudless
```

---
*Generated: 2026-07-26*  
*Last Updated: 2026-07-26*