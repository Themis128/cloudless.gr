# Cloudflare Bot Detection Bypass Solution

## Problem Statement

Cloudflare's bot detection blocks GitHub Actions data-center IPs, preventing ETL scripts from accessing the EspoCRM API endpoint at `https://espocrm.cloudless.gr/api/v1/`.

**Current Blocker:** The omv node (Pi 5 at 192.168.1.128) is **OFFLINE**, so Pi runners are unavailable and the EspoCRM endpoint returns HTTP 530.

## Legitimate Solution (Already Implemented)

### Architecture Overview

```
GitHub Actions Runner (blocked) ─X─┐
                                 │
Self-hosted Pi Runner (residential IP) ─O─→ Cloudflare Tunnel ─O─→ EspoCRM
```

### Current Configuration

#### 1. ETL Workflow Runner Routing

**File:** `.github/workflows/etl-espocrm-to-r2.yml`

```yaml
runs-on: ${{ fromJSON(vars.RUNNER_GENERIC || '"self-hosted,omv,build"') }}
```

- **Default:** `self-hosted,omv,build` (Pi runners with residential IPs)
- **Fallback:** Uses `RUNNER_GENERIC` if set (for temporary switching)

#### 2. Cloudflare Tunnel Setup

**File:** `infrastructure/espocrm/cloudflare-tunnel.yaml`

The EspoCRM endpoint is accessible via Cloudflare Tunnel:

- Tunnel ID: `e977a490-58c5-4fdb-9155-86832e3e636a`
- DNS: `espocrm.cloudless.gr` → CNAME tunnel endpoint
- Target: `http://192.168.1.128:30700` (EspoCRM NodePort on omv)

#### 3. Required Repository Secrets

```
ESPOCRM_BASE_URL          - https://espocrm.cloudless.gr
ESPOCRM_API_KEY           - 1e9f15bcd0368bce98b5de76c6929745 (already known)
ESPOCRM_API_PASSWORD      - Optional, for Basic Auth
CLOUDFLARE_ACCOUNT_ID    - R2 account ID
CF_R2_ACCESS_KEY_ID      - R2 access key
CF_R2_SECRET_ACCESS_KEY  - R2 secret key
```

#### 4. Runner Mode Controls

| Workflow | Purpose |
|----------|---------|
| `.github/workflows/runner-mode.yml` | UI toggle: hosted ↔ pi |
| `.github/workflows/bootstrap-gh-runners.yml` | Auto-clears RUNNER_GENERIC on first push |

### How to Switch to Pi Runners (for ETL)

**Method 1: GitHub UI**

1. Go to Actions → "Switch Runner Mode"
2. Select "pi" option

**Method 2: GitHub CLI**

```bash
gh variable delete RUNNER_GENERIC --repo TheMisis/cloudless.gr
```

or to explicitly set Pi runners:

```bash
gh variable set RUNNER_GENERIC --body '["self-hosted","omv","build"]' --repo TheMisis/cloudless.gr
```

### Why This Works

1. **Residential IP Reputation:** Self-hosted Pi runners on home internet connections use residential IPs not flagged by Cloudflare's bot detection

2. **Cloudflare Tunnel Trust:** The tunnel endpoint `*.cfargotunnel.com` is trusted by Cloudflare's own security systems

3. **No Bot Challenge:** Unlike data-center IPs, residential IPs typically bypass JS challenges, CAPTCHAs, and rate limiting

### Alternative Approaches (NOT Recommended)

| Approach | Status | Reason |
|----------|--------|--------|
| Proxy services | ❌ Unreliable | Often blacklisted, violates ToS |
| VPN from runner | ❌ Blocked | Still appears as automated traffic |
| Headless browsers | ❌ Detected | Bot fingerprinting catches these |
| Session replay | ❌ Complex | High maintenance, easily broken |

### Verification Steps

1. **Check runner status:**

   ```bash
   kubectl get nodes -l node-role.kubernetes.io/worker=
   kubectl get pods -n cloudless -o wide
   ```

2. **Test EspoCRM endpoint:**

   ```bash
   curl -s https://espocrm.cloudless.gr/ | head -5
   ```

3. **Run ETL manually:**

   ```bash
   gh workflow run etl-espocrm-to-r2.yml --repo TheMisis/cloudless.gr
   ```

### Immediate Actions Required

**The ETL bypass is already configured but blocked by offline infrastructure:**

1. **Power on omv node (Pi 5 at 192.168.1.128)**
   - Check power LED
   - Check Ethernet connection

2. **Verify Tailscale connectivity**

   ```bash
   tailscale ping 100.74.191.58
   ```

3. **Verify EspoCRM endpoint responds**

   ```bash
   curl -I https://espocrm.cloudless.gr/
   # Should return 200 or 302, NOT 530
   ```

4. **Check runner services**

   ```bash
   ssh 100.74.191.58 "sudo systemctl list-units 'actions.runner.*' --no-pager --all"
   ```

### Notes

- The omv node must be **physically online** for Pi runners to work
- All required secrets are already configured (per ACTIONS-REQUIRED.md)
- The `selfhosted-healthchecks.yml` workflow intentionally uses `ubuntu-latest` (hosted) because it just needs HTTP access for health pings, not the actual ETL data flow

### Related Documentation

- Migration playbook: `.clinerules/aws-to-cloudflare-migration.md`
- Runner bootstrap: `.github/workflows/bootstrap-gh-runners.yml`
- Tunnel config: `infrastructure/espocrm/cloudflare-tunnel.yaml`
