# Hands-On Action Plan: Tailscale OAuth & omv Node Recovery
# Generated: 2026-07-19
# Priority: CRITICAL - Required for cluster operations

## ⚠️ Current Status

| Component | Status | Impact |
|-----------|--------|--------|
| omv (Pi) node | OFFLINE (100.74.191.58) | Cannot SSH or restart k3s |
| TS_CLIENT_ID | ✅ EXISTS AS `TAILSCALE_OAUTH_CLIENT_ID` | Fixed workflow to use correct secret |
| TS_CLIENT_SECRET | ✅ EXISTS AS `TAILSCALE_OAUTH_SECRET` | Fixed workflow to use correct secret |
| TS_AUTHKEY | ✅ EXISTS | GitHub Actions can join Tailnet |
| OMV_SSH_KEY | ✅ EXISTS | SSH to Pi via workflows available |
| KUBECONFIG_B64 | ✅ EXISTS | kubectl access configured |
| Subnet routes (10.42.0.0/16, 10.43.0.0/16) | NOT APPROVED | Services not accessible via Tailscale |

---

## ✅ ACTION 1: Tailscale Secrets ALREADY CONFIGURED

**Good news!** All required GitHub secrets already exist:

| Secret | Status | Value Used |
|--------|--------|------------|
| `TAILSCALE_OAUTH_CLIENT_ID` / `TS_CLIENT_ID` | ✅ EXISTS | Used by workflow |
| `TAILSCALE_OAUTH_SECRET` / `TS_CLIENT_SECRET` | ✅ EXISTS | Used by workflow |
| `TS_AUTHKEY` | ✅ EXISTS | Auth key for Tailscale join |
| `OMV_SSH_KEY` | ✅ EXISTS | SSH to Pi |
| `KUBECONFIG_B64` | ✅ EXISTS | kubectl access |

**Note:** The workflow file was updated to use `TAILSCALE_OAUTH_CLIENT_ID` and `TAILSCALE_OAUTH_SECRET` (the actual secret names) with fallback support for `TS_CLIENT_ID`/`TS_CLIENT_SECRET`.

---

## 🔴 ACTION 2: Power on omv Node (Pi 5) - PRIMARY ACTION REQUIRED

### Step 2.1: Physical Verification

- **LAN IP:** 192.168.1.128
- **Tailscale IP:** 100.74.191.58 (when online)
- **Physical location:** Check your home/office network for the Pi 5

### Step 2.2: Network Check (from another machine)

```bash
# Check if Pi is powered on and on LAN:
ping 192.168.1.128

# If ping works, SSH directly:
ssh tbaltzakis@192.168.1.128

# Check Tailscale status on the Pi:
ssh tbaltzakis@192.168.1.128 "tailscale status"
```

### Step 2.3: If Pi is Online - Restart Services

```bash
# Restart Tailscale if needed:
ssh tbaltzakis@192.168.1.128 "sudo systemctl restart tailscaled"
ssh tbaltzakis@192.168.1.128 "sudo tailscale up --accept-routes --accept-dns"

# Restart k3s if needed:
ssh tbaltzakis@192.168.1.128 "sudo systemctl restart k3s"

# Check status:
ssh tbaltzakis@192.168.1.128 "sudo systemctl status k3s --no-pager"
```

---

## 🟡 ACTION 3: Approve Subnet Routes in Tailscale Admin

After the Tailscale Operator is deployed and the `k3s-subnet-router` pod is running:

### Step 3.1: Deploy Tailscale Operator

```bash
# From repo root (after secrets added):
gh workflow run .github/workflows/tailscale-deploy.yml --repo Themis128/cloudless.gr
```

### Step 3.2: Approve Routes Manually

1. Go to [Tailscale Admin Console → Machines](https://login.tailscale.com/admin/machines)
2. Find machine named `k3s-subnet-router`
3. Click **"Review routes"**
4. Approve both routes:
   - `10.42.0.0/16` (pods)
   - `10.43.0.0/16` (services)

---

## 🟢 ACTION 4: Verify Everything Works

### Step 4.1: Check Tailscale Operator Status

```bash
# Check the workflow completed:
gh run list --workflow tailscale-deploy.yml --repo Themis128/cloudless.gr

# Or check via kubectl (if you have access):
kubectl get pods -n tailscale-operator
kubectl get ProxyGroup -n tailscale-operator
```

### Step 4.2: Verify Subnet Router Routes

```bash
# From any Tailscale-connected machine:
tailscale ping 10.42.0.1  # Should reach k3s API
```

### Step 4.3: Test k3s SSH Restart (Alternative Method)

```bash
# If Pi still offline, run this to attempt recovery:
gh workflow run .github/workflows/k3s-ssh-restart.yml --repo Themis128/cloudless.gr
```

---

## 📝 Quick Reference Commands

### After completing all steps:

```bash
# 1. Verify all secrets exist:
npx wrangler secret list

# 2. Check Tailscale node:
gh api repos/Themis128/cloudless.gr/issues/382 --jq '.body'

# 3. Test subnet access:
tailscale ping 10.43.0.10  # Should reach kube-dns

# 4. Verify ETL secrets (run after secrets configured):
npx tsx scripts/etl/espocrm-to-r2.mjs
```

---

## 🔄 Fallback: If Pi Remains Offline

If the Pi cannot be powered on or remains unreachable:

1. **Use Lambda-only mode:** Cloudflare Workers can handle most operations
2. **ETL jobs:** Will need to run when Pi is back online
3. **Services:** Postiz and AppFlowy will be unavailable until Pi recovery
4. **Monitoring:** Check CloudWatch for any alerts

---

## ⏱️ Estimated Time

| Action | Time Required | Status |
|--------|---------------|--------|
| Configure Tailscale OAuth secrets | 8 minutes | ✅ COMPLETE |
| Power on Pi (physical) | 2-5 minutes | 🔴 REQUIRED |
| Deploy Tailscale Operator | 2 minutes | 🟡 After Pi online |
| Approve routes | 1 minute | 🟡 After deployment |
| Verify deployment | 5 minutes | 🟡 After deployment |
| **Total remaining** | **10-13 minutes** | |

---
 
## ✅ Summary of Changes Made
 
### Workflow Fix (COMPLETED)
 - Fixed `.github/workflows/tailscale-deploy.yml` to use existing secret names
 - The workflow now uses `TAILSCALE_OAUTH_CLIENT_ID` and `TAILSCALE_OAUTH_SECRET`
 - Support for both naming conventions added for backward compatibility
 - **Commit:** `cf4eb21c` - pushed to main branch
 
 ### What Still Needs Your Action
 
 | # | Action | Why Required |
 |---|--------|--------------|
 | 1 | Power on omv (Pi 5) at LAN IP 192.168.1.128 | Node is offline, preventing cluster access |
 | 2 | Approve subnet routes in Tailscale Admin (10.42.0.0/16, 10.43.0.0/16) | Required for Tailscale-to-cluster networking |
 
 ---
 
 ## ❓ Questions?
 
- **No access to Pi physically?** You'll need to wait until someone can power it on
- **Tailscale Admin access issues?** Contact your workspace admin
