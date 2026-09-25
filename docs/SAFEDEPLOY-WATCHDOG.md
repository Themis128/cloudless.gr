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

## Extended coverage (added 2026-09-25)

Beyond the main site, each 2-min tick also runs:

### Satellite HTTP probes

`WATCH_TARGETS` in the script — `name|url|expect|remediation`:

| Target | URL | Expect |
|---|---|---|
| pi-origin | `pi-origin.cloudless.gr/api/health` | 200 |
| social | `social.cloudless.gr/` | ok (2xx/3xx — Access 302 = up) |
| postiz | `postiz.cloudless.gr/` | ok |
| espocrm | `espocrm.cloudless.gr/` | ok |
| grafana | `grafana.cloudless.gr/api/health` | 200 |
| n8n | `n8n.cloudless.gr/healthz` | 200 |
| webmail | `webmail.cloudless.gr/` | ok |
| postiz-ai-proxy | `…workers.dev/v1/models` | 200 |

Same incident semantics as the main check: silent for 1–2 failures, one
alert at 3, recovery alert on heal. `remediation` supports `none`
(alert-only, the shipped default) or `k3s:<ns>:<deploy>` — a
`rollout restart` at the 8-failure threshold, same 60-min cooldown.
Map deploy names with `k3s kubectl get deploy -A` before enabling.

### Worker error watcher

Every 5th tick (~10 min) queries Cloudflare GraphQL
`workersInvocationsAdaptive` for invocation **exceptions** in the last
30 min across all scripts. Any errors → one alert per incident listing
`script=count`; clears when the window goes quiet. Needs `CF_API_TOKEN` +
`CF_ACCOUNT_ID` in the env file (analytics-read scope is enough; pulled
from `cloudless-secrets` `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` at
install — silently skipped if absent). This catches exception drift that
HTTP health checks can't — e.g. the postiz-ai-proxy 54-errors/7d drift
found 2026-09-25.

### Infra checks

- **k3s node NotReady** — `kubectl get nodes`, urgent alert while any node
  is not Ready
- **Disk pressure** — k3s SSD (`/var/lib/rancher/k3s`, sda1) ≥85% and data
  SSD (sdb1) ≥90%, with hysteresis (clears 5 points below threshold)

### Deadman ping

If `HEALTHCHECK_PING_URL` is set in the env file, every tick curls it —
point it at a healthchecks.io check so a dead watchdog or dead omv host
still produces an external alert.

## Install / refresh via CI

`.github/workflows/install-safedeploy-watchdog.yml` (workflow_dispatch)
runs the installer on the omv self-hosted runner — no workstation ssh
needed.

## What it still doesn't cover

- **omv host fully down AND deadman unconfigured** — set
  `HEALTHCHECK_PING_URL` to close this.
- **Slow/degraded but healthy responses** — /api/health only checks the app
  is running. For SLA-style latency alerts use Grafana + Alertmanager.
- **Docker services on non-omv hosts** (e.g. the SocialAuto stack) — probes
  alert but can't restart; remediation stays `none` unless the service is
  k3s-hosted.
