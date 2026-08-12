# Pi connectivity (SSH + Tailscale)

## Remedy when connectivity breaks

**Automatic (already on both Pis):** `pi-connectivity-heal.timer` every 2 minutes

+ on boot — restarts `tailscaled`/`sshd`, forces `tailscale set --ssh=false`,
heals ghost-busy GHA runners.

**Manual — from your laptop (LAN or partial Tailscale still works):**

```bash
bash scripts/restore-pi-connectivity.sh
```

**Manual — from anywhere (GitHub Actions, no Pi runners needed):**

```bash
gh workflow run restore-pi-connectivity.yml
# optional: -f target=omv|omv-ha|both  -f restart_tailscaled=true
```

That workflow joins the tailnet with OAuth, SSHes with `OMV_SSH_KEY`, tries
Tailscale IP then LAN for each Pi, jumps `omv-ha → omv` if needed, and comments
on issue #382.

---

Classic **OpenSSH** over the Tailscale mesh — **not** Tailscale SSH.

## Why Tailscale SSH was disabled

With `tailscale set --ssh=true`, port 22 on the 100.x address speaks the
Tailscale SSH protocol and often requires an interactive browser “check”.
That breaks `BatchMode`, GitHub Actions deploy proxy SSH, and operator
automation. Both Pis run:

```bash
sudo tailscale set --ssh=false
```

`sshd` still listens on `0.0.0.0:22` (LAN + Tailscale interface).

## Hosts

| Name | LAN | Tailscale | Role |
|------|-----|-----------|------|
| omv / github-omv | 192.168.1.128 | 100.74.191.58 | k3s + build runners |
| omv-ha | 192.168.1.130 | 100.95.117.84 | mail + deploy-pi rollout runner |

## Firewall + Tailscale ACL

### Host firewall

| Host | Tool | SSH policy |
|------|------|------------|
| omv | ufw | `ALLOW` from `100.64.0.0/10` + `192.168.1.0/24` on :22 **before** public `LIMIT` |
| omv-ha | nftables `inet cloudless_fw` | accept :22 from LAN + Tailscale CGNAT; accept `tailscale0` |

Install/refresh:

```bash
sudo bash infrastructure/omv/configure-pi-firewall.sh
```

### Tailscale ACL (`infrastructure/tailscale/acl-policy.example.json`)

+ **`tag:pi`** — github-omv + omv-ha
+ **grants:** members → `tag:pi` `tcp:22`; admins → `tag:pi` `*`
+ **`ssh` block:** `action: accept` only (no check-mode)
+ Pis still run `tailscale set --ssh=false`

Apply / retag fleet:

```bash
gh workflow run tailscale-admin-api.yml -f dry_run=false -f acl_only=true
```

## Client SSH config

Copy [`ssh-config.pi.example`](./ssh-config.pi.example) into `~/.ssh/config`
(or `Include` it). Fallback helper:

```bash
scripts/ssh-pi.sh omv hostname
scripts/ssh-pi.sh omv-ha uptime
```

## Connectivity heal (on each Pi)

Installed by `install-pi-connectivity-heal.sh`:

+ Boot oneshot + every **2 minutes**
+ Ensures `tailscaled` Running, forces `--ssh=false`
+ Ensures `ssh`/`sshd` listening on `:22`
+ Optional re-auth via `/etc/cloudless/tailscale-authkey` (operator-managed reusable key)
+ `sshd` systemd Nice=-5 so banner exchange still works during `next build`

```bash
# From a machine with LAN or working SSH:
for host in 192.168.1.128 192.168.1.130; do
  scp infrastructure/omv/pi-connectivity-heal* \
      infrastructure/omv/sshd-*.conf \
      infrastructure/omv/install-pi-connectivity-heal.sh \
      tbaltzakis@$host:/tmp/pi-conn/
  ssh tbaltzakis@$host 'sudo bash /tmp/pi-conn/install-pi-connectivity-heal.sh'
done
```

Manual tick: `sudo /usr/local/sbin/pi-connectivity-heal.sh --check`  
Logs: `journalctl -t pi-connectivity-heal -n 50`

## When SSH times out under load

omv can miss the SSH banner while a full Next standalone build pegs CPU.
Use LAN (`omv-lan`) or wait; heal + sshd Nice drop-in reduce this. Do not
re-enable Tailscale SSH as a workaround.
