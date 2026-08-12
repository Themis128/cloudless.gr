# SafeDeploy Watchdog — continuous prod monitor + auto-rollback

Companion to [SafeDeploy](SAFEDEPLOY.md). Where SafeDeploy's built-in
auto-rollback only fires during the ~1-minute deploy-verify window, the
**Watchdog** covers everything after — subtle regressions that only manifest
in production, external dep hiccups, tunnel blips, etc.

## Design (Notify-first, aggressive-later)

Runs on **omv** (host, outside the k3s cluster) via a systemd timer every
2 minutes. Polls `/api/health` (local NodePort first, LAN, then public URL).

| Consecutive failures | ~ Minutes unhealthy | Action |
|---|---|---|
| 1–2 | 2–4 min | Silent (transient hiccup) |
| **3** | ~6 min | **Alert** on ntfy + Slack + email (one-shot per incident) |
| 4–7 | 8–14 min | No further pings (won't spam) |
| **8** | ~16 min | **Auto-rollback** `previous release` + "rolled back" alert |
| — | recovers | "Recovered" alert; state reset |

### Safeguards

- **60-minute cooldown** between auto-rollbacks (prevents ping-pong loops)
- **Skip rollback if current release is <15 min old** (deploy-time verify
  already handled that window; a new deploy that immediately turns bad in
  the wild is a code problem, not a rollback problem)
- **One alert per incident** — no re-notification every 2 min

## Alert channels (all fire in parallel; failures don't block each other)

- **ntfy** — push to phone (topic: `NTFY_TOPIC`, LAN endpoint used so it
  works even if the Cloudflare tunnel is what's down)
- **Slack** — `#general` via `SLACK_BOT_TOKEN` (`chat.postMessage`)
- **Email** — `tbaltzakis@cloudless.gr` via Resend REST API
  (as `safedeploy-watchdog@cloudless.gr`; DKIM-signed)

All credentials are pulled from the cluster's `cloudless-secrets` Secret at
install time and written to `/etc/safedeploy-watchdog.env` (mode 600, root).
The watchdog script never prints credential values.

## Install / refresh

From a workstation with `.env.local` (or a Cowork session):

```bash
scp -i ~/.ssh/id_rsa infrastructure/omv/{safedeploy-watchdog.sh,safedeploy-watchdog.service,safedeploy-watchdog.timer,install-safedeploy-watchdog.sh} tbaltzakis@omv:/tmp/sdw/
ssh tbaltzakis@omv 'sudo bash /tmp/sdw/install-safedeploy-watchdog.sh'
```

The installer is idempotent — re-run it to refresh creds after any secret
rotation.

## Operate

```bash
# see the timer schedule + last run
systemctl list-timers safedeploy-watchdog.timer

# tail the watchdog log (only prints on unhealthy transitions / rollbacks)
sudo journalctl -t safedeploy-watchdog -f

# force one tick right now
sudo systemctl start safedeploy-watchdog.service

# inspect state (only counters, no secrets)
sudo cat /var/lib/safedeploy-watchdog/{fail_count,last_http_code,notified,incident_start} 2>/dev/null

# manual pause (e.g., during maintenance):
sudo systemctl stop safedeploy-watchdog.timer

# resume
sudo systemctl start safedeploy-watchdog.timer
```

## What the alerts look like

- **"⚠️ cloudless.gr unhealthy"** — 3rd consecutive failure. Includes the
  last HTTP code and the exact command to roll back manually if you don't
  want to wait for auto-rollback: `scripts/rollback.sh previous`.
- **"🔁 cloudless.gr auto-rolled-back"** — 8th consecutive failure; the
  watchdog flipped the symlink from `<old-sha>` to `<previous-sha>` and
  restarted the deployment.
- **"🚨 cloudless.gr rollback FAILED"** — 8th failure but no previous
  release available (fresh install, only 1 release on disk). Manual
  intervention needed.
- **"✅ cloudless.gr recovered"** — health returned after any incident that
  fired an alert. Includes duration and whether an auto-rollback happened.

## Testing

Live-verified at install (2026-08-09):

- Script syntax + logic checks pass
- All 3 alert channels sent test messages successfully (ntfy 200, Slack ok,
  Resend id returned)
- State files created correctly; healthy tick is silent (no log noise);
  timer fires every 2 min per `systemctl list-timers`

To exercise the actual alert threshold without a real outage:

```bash
# Set fake failure count just below the notify threshold, then poll a bad URL
sudo bash -c 'echo 2 > /var/lib/safedeploy-watchdog/fail_count'
# Then edit HEALTH_URL_LOCAL to a broken port temporarily and run:
sudo systemctl start safedeploy-watchdog.service
# ...will fire the ⚠️ alert once. Revert the URL after testing.
```

## What it doesn't cover

- **The watchdog itself dying** — if the omv host is fully down, no alerts
  come. Complement with an external monitor (Uptime Kuma from a different
  network, or a cloud service).
- **The cluster + omv down together** — same as above; needs off-network monitoring.
- **Slow/degraded but healthy responses** — /api/health only checks the app
  is running. For SLA-style latency alerts use Grafana + Alertmanager.
- **Non-cloudless.gr apps** — grafana/postiz/espocrm/etc. aren't watched.
  Extend the script or add per-app watchdogs if needed.
