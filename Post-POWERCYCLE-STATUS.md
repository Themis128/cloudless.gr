# Post-Powercycle Cluster Status Report

# Generated: 2026-07-19 20:22 UTC

## Current Status

### Tailscale Network Status

```
100.121.191.7   cloudless-k3s-operator  ✅ Active (this machine)
100.74.191.58   github-omv              ❌ Offline (last seen 10h ago)
100.123.189.49  tailscale-operator      ❌ Offline (last seen 6d ago)
```

### GitHub Actions Workflow Run

- **k3s-ssh-restart (#29696311213):** Completed but couldn't connect to Pi
- **Reason:** The `github-omv` node was offline when the workflow ran
- **Warning:** TS_AUTHKEY is deprecated (OAuth recommended)

## Recovery Options

### Option 1: Tailscale Reconnect Agent (Recommended)

This workflow will attempt to reconnect Tailscale services once the Pi is online:

```bash
# Trigger via GitHub CLI
gh workflow run .github/workflows/tailscale-reconnect-agent.yml \
  --repo Themis128/cloudless.gr \
  --field target=all
```

Or manually:

1. Go to https://github.com/Themis128/cloudless.gr/actions/workflows/tailscale-reconnect-agent.yml
2. Click "Run workflow"
3. Leave default settings (target=all, restart_tailscale_daemon=true)

### Option 2: Re-run k3s SSH Restart (when Pi is online)

```bash
gh workflow run .github/workflows/k3s-ssh-restart.yml --repo Themis128/cloudless.gr
```

### Option 3: Manual SSH (when on LAN)

If you're on the local network:

```bash
# SSH directly to the Pi
ssh tbaltzakis@192.168.1.128

# Once logged in, restart k3s
sudo systemctl restart k3s

# Check status
sudo systemctl status k3s

# Check pods
sudo kubectl get nodes
sudo kubectl get pods -A
```

## Verification Steps (After Recovery)

Once the Pi is back online, verify:

```bash
# 1. Check Tailscale connectivity
tailscale status

# 2. Check k3s API
nc -zv 100.74.191.58 6443

# 3. Check pods via KUBECONFIG_B64
# Export config: echo "$KUBECONFIG_B64" | base64 -d > ~/.kube/config
kubectl get nodes
kubectl get pods -A

# 4. Check critical services
kubectl get pods -n tailscale-operator -o wide
kubectl get pods -n monitoring -o wide
kubectl get pods -n database -o wide
kubectl get pods -n appflowy -o wide
```

## Services Affected

| Service | Status | Notes |
|---------|--------|-------|
| n8n.cloudless.gr | ⏸️ Offline | Tailscale proxy needs restart |
| postiz.cloudless.gr | ⏸️ Offline | Pending cloudflared tunnel |
| appflowy.cloudless.gr | ⏸️ Offline | Pending cloudflared tunnel |
| grafana.cloudless.gr | ✅ Cloudflare | Should remain accessible via Traefik |
| Metabase | ⏸️ Offline | Tailscale proxy needs restart |
| ETL Scripts | ⏸️ Blocked | Waiting for cluster recovery |

## Next Actions

1. **Wait for Pi boot** (powercycle already performed)
2. **Verify Pi is online** - run `tailscale status` periodically
3. **Run tailscale-reconnect-agent.yml** when node shows as active
4. **Verify pods are running** with kubectl commands above

## Secrets Status (Verified)

✅ All required secrets configured:

- TS_CLIENT_ID, TS_CLIENT_SECRET (OAuth)
- OMV_SSH_KEY (for SSH access)
- KUBECONFIG_B64 (for kubectl access)
