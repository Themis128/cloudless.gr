---
name: omv-ssh-key-setup
description: Set up the OMV_SSH_KEY GitHub repo secret to enable SSH-based k3s recovery and watchdog deployment. Use when k3s-ssh-restart.yml or k3s-watchdog-deploy.yml fail with "OMV_SSH_KEY not set", when the user says "add the SSH key", "enable watchdog", "install k3s watchdog", or "set up SSH recovery". Covers generating the key, adding it to authorized_keys, storing it as a GitHub repo secret, and triggering the watchdog deploy.
argument-hint: "e.g. 'add OMV_SSH_KEY', 'install watchdog', 'k3s SSH recovery not working'"
---

# OMV_SSH_KEY Setup & k3s Watchdog Deploy

This skill covers adding the `OMV_SSH_KEY` GitHub repo secret that enables the
two SSH-based cluster recovery workflows:

| Workflow | What it does |
|---|---|
| `k3s-ssh-restart.yml` | SSH to Pi → restart k3s → wait for port 6443 → post to #382 |
| `k3s-watchdog-deploy.yml` | SSH to Pi → install `Restart=always` systemd drop-in → k3s auto-recovers on crash |

---

## Prerequisite: SSH key on the Pi

The Pi's SSH user is `omv` at Tailscale IP `100.74.191.58`.

**If a key already exists:**

```bash
# On the Pi — check for existing keys
ls ~/.ssh/id_ed25519  # or id_rsa
cat ~/.ssh/id_ed25519  # ← this is what you'll paste into GitHub
```

**If no key exists, generate one:**

```bash
# On the Pi
ssh-keygen -t ed25519 -C "omv-pi-ssh-key" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

---

## Add OMV_SSH_KEY to GitHub

1. On the Pi: `cat ~/.ssh/id_ed25519` — copy the full output, including the header and footer:

   ```
   -----BEGIN OPENSSH PRIVATE KEY-----
   b3BlbnNzaC1rZXktdjEAAAAA...
   -----END OPENSSH PRIVATE KEY-----
   ```

2. GitHub → repo `Themis128/cloudless.gr` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
3. Name: `OMV_SSH_KEY`
4. Value: paste the private key content
5. Click **Add secret**

---

## Verify connectivity (optional but recommended)

From a machine with Tailscale active:

```bash
ssh -i ~/.ssh/id_ed25519 tbaltzakis@100.74.191.58 "echo connected"
```

Should print `connected`. If it fails:

- Check `sshd` is running: `systemctl status ssh`
- Check `~/.ssh/authorized_keys` contains the public key
- Check firewall: `ufw status` — port 22 must be open

---

## Deploy the k3s Watchdog (one-time, after OMV_SSH_KEY is set)

The watchdog installs a systemd drop-in that restarts k3s automatically
whenever it crashes — eliminating future manual `k3s-ssh-restart` runs.

**Trigger:**

1. Edit `.github/workflows/k3s-watchdog-deploy.yml` (touch a comment)
2. Create PR → squash-merge
3. Watch issue #382 for the result

**What it installs** (`/etc/systemd/system/k3s.service.d/restart-always.conf`):

```ini
[Service]
Restart=always
RestartSec=30s
StartLimitBurst=0
StartLimitIntervalSec=0
```

After install, k3s will restart within 30 seconds of any crash — no manual intervention needed.

---

## Use k3s-ssh-restart manually (when k3s is stopped)

Symptom: cluster doctor shows `connection refused on port 6443`.

**Trigger:**

1. Edit `.github/workflows/k3s-ssh-restart.yml` (touch a comment or whitespace)
2. Create PR → squash-merge
3. Watch issue #382 for result (~90s)

**What it does:**

1. Connects to tailnet via `TS_AUTHKEY`
2. SSH to `tbaltzakis@100.74.191.58` using `OMV_SSH_KEY`
3. Runs `sudo systemctl restart k3s`
4. Waits up to 90s for port 6443 to respond
5. Reports to #382

---

## Troubleshooting

### "Permission denied, please try again" / "Too many authentication failures"

- The key in `OMV_SSH_KEY` doesn't match any entry in `~/.ssh/authorized_keys` on the Pi
- Re-check the public key: `cat ~/.ssh/id_ed25519.pub` should appear in `~/.ssh/authorized_keys`
- If sshd banned the runner IP (fail2ban): wait 10 min or `sudo fail2ban-client unban <IP>`

### "OMV_SSH_KEY not set — skipping SSH steps"

- The secret isn't set in GitHub. Follow the "Add OMV_SSH_KEY to GitHub" steps above.

### Workflow queues forever (>2 min) without starting

- The Pi is completely down (power loss, kernel panic)
- The `ubuntu-latest` runner doesn't need the Pi to start — only the SSH step does
- If the job queues: this is a runner quota issue, not a Pi issue
- Check runner quota at: GitHub → repo → Settings → Actions → Runners

### Watchdog installed but k3s still doesn't restart

- Verify the drop-in: `systemctl cat k3s | grep Restart`
- `systemctl daemon-reload && systemctl enable k3s` must have run (watchdog-deploy does this)
- Check: `journalctl -u k3s -n 20` for startup errors

---

## One-liner status check (from Pi SSH session)

```bash
# Is k3s running?
systemctl is-active k3s

# Is watchdog installed?
systemctl cat k3s | grep -A3 "restart-always"

# Last restart time
systemctl show k3s --property=ActiveEnterTimestamp
```

---

## Reference

- Pi SSH: `tbaltzakis@100.74.191.58` (Tailscale)
- k3s service: `k3s.service`
- Watchdog drop-in: `/etc/systemd/system/k3s.service.d/restart-always.conf`
- Workflows: `k3s-ssh-restart.yml`, `k3s-watchdog-deploy.yml`
- Required secrets: `OMV_SSH_KEY` (this guide), `TS_AUTHKEY` (Tailscale key)
