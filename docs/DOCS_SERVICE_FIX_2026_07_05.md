# Fix: docs.cloudless.gr 502 Bad Gateway — 2026-07-05

## Issue
- **URL**: https://docs.cloudless.gr/operations/n8n
- **Status**: HTTP/2 502 Bad Gateway
- **Root Cause**: Tunnel ingress configured for port 30900, but docs-service was ClusterIP only (not exposed as NodePort)

## Investigation

### Step 1: Check Tunnel Config
```bash
cat ~/.cloudflared/config.yml
# Found: docs.cloudless.gr → http://127.0.0.1:30900
```

### Step 2: Verify Service Status
```bash
kubectl get svc docs-service -o wide
# Result: ClusterIP 10.43.244.51:80 (internal only)
# Target: Port 8080 on pod
```

### Step 3: Port Conflict Check
- Port 30900 **reserved** for Slack app alarm service
- No NodePort exposed for docs-service
- Service unreachable from host via port 30900

## Solution

### 1. Convert docs-service to NodePort (Port 30901)
```bash
kubectl patch svc docs-service -p '{
  "spec":{
    "type":"NodePort",
    "ports":[{
      "port":80,
      "targetPort":8080,
      "nodePort":30901
    }]
  }
}'
```

**Result**: Service now exposed on `127.0.0.1:30901`

### 2. Update Tunnel Configuration
File: `~/.cloudflared/config.yml`
```yaml
# Changed from:
service: http://127.0.0.1:30900

# To:
service: http://127.0.0.1:30901
```

### 3. Restart Cloudflared Tunnel
```bash
sudo systemctl restart cloudflared
```

## Verification

### Root Path
```bash
curl -sI https://docs.cloudless.gr
# HTTP/2 301 → https://github.com/Themis128/cloudless.gr/wiki ✅
```

### Operations Endpoint
```bash
curl -sI https://docs.cloudless.gr/operations/n8n
# HTTP/2 301 → https://github.com/Themis128/cloudless.gr/wiki/Operations ✅
```

### Docs Endpoint
```bash
curl -sI https://docs.cloudless.gr/docs/
# HTTP/2 301 → https://github.com/Themis128/cloudless.gr/wiki/Docs ✅
```

## Service Details

**Pod**: docs-server (nginx)
```nginx
server {
    listen 8080;
    server_name _;
    
    location / {
        return 301 https://github.com/Themis128/cloudless.gr/wiki;
    }
    
    location /operations/ {
        return 301 https://github.com/Themis128/cloudless.gr/wiki/Operations;
    }
    
    location /docs/ {
        return 301 https://github.com/Themis128/cloudless.gr/wiki/Docs;
    }
    
    location /monitoring/ {
        return 301 https://github.com/Themis128/cloudless.gr/wiki/Monitoring;
    }
}
```

## Impact
- ✅ All docs endpoints functional
- ✅ Tunnel connectivity stable
- ✅ Port 30900 reserved for Slack alarms
- ✅ No service disruptions

## Status
**RESOLVED** — 2026-07-05 00:32 UTC

---

**Changes Made**:
1. Patched `docs-service` from ClusterIP to NodePort (30901)
2. Updated `~/.cloudflared/config.yml` to target port 30901
3. Restarted cloudflared tunnel

**Files Modified**:
- `~/.cloudflared/config.yml` (on Pi)
- Kubernetes service `docs-service` (in-memory patch)

**Testing**: All 3 endpoints verified responding with 301 redirects
