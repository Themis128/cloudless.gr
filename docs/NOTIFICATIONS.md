# Notifications — cloudless.gr

Canonical map of every notification channel and event source. Three layers:
**app-layer** (Next.js routes → Slack/ntfy/email/D1), **ops-layer** (admin alerts
fan-out via `notifyAdmin()`), and **infra-layer** (systemd watchdog,
Alertmanager, pi-alert-api — independent of the app process).

---

## Channels

### Slack — `src/lib/slack-notify.ts`

Primary operator channel. `SlackClient` posts via `chat.postMessage` with
the bot token; falls back to an incoming webhook URL when the bot token is
absent or returns a terminal error (`not_in_channel`, etc.). 3 retries with
exponential backoff. Identical errors are deduplicated for 10 min
(`isDuplicateError`).

**Per-channel routing:**

| `SlackClient` instance | Slack channel                                    | Events                                                            |
| ---------------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| `bookingsClient`       | `#bookings`                                      | `slackBookingNotify`                                              |
| `ordersClient`         | `#orders`                                        | `slackOrderNotify`                                                |
| `errorsClient`         | `#errors`                                        | `slackErrorNotify`                                                |
| `deploymentsClient`    | `#deployments`                                   | `slackDeployNotify`                                               |
| `contactsClient`       | `#notifications`                                 | `slackContactNotify`                                              |
| `subscribersClient`    | `#newsletter` (or `NEWSLETTER_SLACK_CHANNEL_ID`) | `slackSubscriberNotify`                                           |
| `interactionsClient`   | `#notifications`                                 | `slackChatNotify`, `slackTicketNotify`, `slackRegistrationNotify` |

Config: `SLACK_BOT_TOKEN`, `SLACK_WEBHOOK_URL`, `SLACK_DEFAULT_CHANNEL`. See
[`docs/integrations/SLACK.md`](integrations/SLACK.md) for the full setup.

---

### ntfy — `src/lib/ntfy.ts`

Self-hosted push broker at `ntfy.cloudless.gr` (k3s Deployment in namespace
`ntfy` on omv). Used for phone push that bypasses Slack noise filters.

`publishNtfy()` is **opt-in** — requires `ADMIN_PUSH_VIA_NTFY=1` in env or
SSM (SSM wins when both are set). Degrades gracefully: returns
`{ ok: false, skipped: "ntfy_unconfigured" }` and never throws when
`NTFY_BASE_URL` or `NTFY_TOPIC` is missing.

Config: `NTFY_BASE_URL`, `NTFY_TOPIC`, `NTFY_TOKEN`, `ADMIN_PUSH_VIA_NTFY`.
See [`infrastructure/ntfy/k8s.yaml`](../infrastructure/ntfy/k8s.yaml).

---

### Email — `src/lib/email.ts`

Used by `notifyTeam()` for high-severity alerts (→ `tbaltzakis@cloudless.gr`)
and by the SafeDeploy Watchdog independently via Resend REST.

Dispatch order (app path):

1. Workers `EMAIL` binding
2. Cloudflare Email Sending REST (`email-cloudflare.ts`)
3. Resend SDK (`email-resend.ts`)

Watchdog path: direct Resend REST (`POST https://api.resend.com/emails` with
`RESEND_API_KEY`), from address `safedeploy-watchdog@cloudless.gr`.

---

### Admin D1 store — `src/lib/admin-notifications.ts`

Durable audit log in D1 `admin_notification` table (`user-auth-db`). All
notification events that pass through the app are soft-mirrored here via
`recordNotification()` (never throws; returns `null` when `AUTH_DB` is
unbound). Every row is also fire-and-forget synced to R2
(`lake/notifications/year=…/month=…/<id>.json`) for Athena analytics.

Categories: `contact | subscribe | booking | order | error | auth | portal`

Admin UI at `/admin/notifications`. Analytics endpoint at
`/api/admin/notifications`.

---

## Fan-out helper — `src/lib/admin-alerts.ts`

`notifyAdmin(input)` fires Slack, ntfy, and the canonical transactional email
transport in parallel via `Promise.allSettled` — one failing channel never blocks the others.

```ts
await notifyAdmin({
  severity: "high", // info | warning | error | high | critical
  title: "espocrm down",
  message: "5xx from /api/v1/App/user for 3 min",
  click: "https://espocrm.cloudless.gr",
});
```

**Slack:** DMs each user returned by `getSlackOpsUsers()` (SSM-backed list).
**ntfy:** Fires only when `ADMIN_PUSH_VIA_NTFY=1`.

Severity → ntfy priority: `info`→2, `warning`→3, `error`→4,
`high`/`critical`→5 (max).

---

## Webhook entry point — `/api/webhooks/admin-alert`

External callers POST here to trigger `notifyAdmin()`:

```
POST /api/webhooks/admin-alert
x-cloudless-alert-secret: <token>
Content-Type: application/json

{ "severity": "error", "title": "...", "message": "...", "source": "sentry" }
```

Auth: `x-cloudless-alert-secret` header, timing-safe comparison against SSM
`ADMIN_ALERT_SECRET` (fallback: `NOTION_WEBHOOK_SECRET`). Returns 503 when
neither secret is set; 401 on mismatch; always 2xx on delivery attempt so
callers don't retry-loop on a Slack/ntfy outage.

See [`docs/runbooks/admin-alert-secret-setup.md`](runbooks/admin-alert-secret-setup.md)
for provisioning.

---

## Event map — what fires what

| Event                                       | Route                                        | Slack                                                                    | ntfy                              | D1 store           |
| ------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------- | ------------------ |
| Contact form submitted                      | `/api/contact`                               | `slackContactNotify` → `#notifications`                                  | —                                 | `contact`          |
| Newsletter subscribe                        | `/api/subscribe`                             | `slackSubscriberNotify` → `#newsletter`                                  | —                                 | `subscribe`        |
| Calendar booking                            | `/api/calendar/book`, `/api/agent/book`      | `slackBookingNotify` → `#bookings`                                       | —                                 | `booking`          |
| Stripe checkout complete                    | `/api/webhooks/stripe`                       | `slackOrderNotify` → `#orders`                                           | via `notifyAdmin` when high-value | `order`            |
| New user registration                       | `/api/auth/register`                         | `slackRegistrationNotify` → `#notifications`                             | —                                 | `auth`             |
| Chat conversation started                   | `/api/chat`                                  | `slackChatNotify` → `#notifications`                                     | —                                 | —                  |
| EspoCRM Contact / Lead created              | `/api/webhooks/espocrm` → `espocrm-dispatch` | `notifyContactCreated` / `notifyLeadCreated` → `#leads`                  | —                                 | —                  |
| EspoCRM Opportunity created / stage changed | `/api/webhooks/espocrm` → `espocrm-dispatch` | `notifyOpportunityCreated` / `notifyOpportunityStageChanged` → `#orders` | —                                 | —                  |
| EspoCRM Case created / status changed       | `/api/webhooks/espocrm` → `espocrm-dispatch` | `notifyCaseCreated` / `notifyCaseStatusChanged` → `#notifications`       | —                                 | —                  |
| Portal client enrolled                      | `/api/portal/enroll`                         | DM to ops users (inline)                                                 | —                                 | `portal`           |
| Portal deliverable ready                    | `/api/portal/[token]/deliverables`           | —                                                                        | —                                 | `portal`           |
| Sentry alert                                | `/api/webhooks/sentry`                       | DM to ops users via `notifyAdmin`                                        | `notifyAdmin` (opt-in)            | —                  |
| MQTT high-severity event                    | `/api/webhooks/mqtt/publish`                 | DM to ops users via `notifyAdmin`                                        | `notifyAdmin` (opt-in)            | —                  |
| Generic admin alert                         | `/api/webhooks/admin-alert`                  | DM to ops users via `notifyAdmin`                                        | `notifyAdmin` (opt-in)            | —                  |
| Application error                           | `src/lib/slack-notify.ts slackErrorNotify`   | `#errors` (deduped 10 min)                                               | —                                 | `error` (mirrored) |
| Insight refresh failure                     | `/api/admin/insights/refresh`                | `slackErrorNotify` → `#errors`                                           | —                                 | —                  |
| Deploy started/done/failed                  | `src/instrumentation.ts`                     | `slackDeployNotify` → `#deployments`                                     | —                                 | —                  |

Generic admin alerts also email `SES_TO_EMAIL` (default `tbaltzakis@cloudless.gr`) through the canonical Cloudflare Email/Resend dispatch path.

---

## Infra-layer notifications (independent of app process)

### SafeDeploy Watchdog — omv systemd timer

Polls `/api/health` every 2 min from host (outside k3s). Fires ntfy + Slack +
email **directly via curl + Resend REST** — does not go through the app.

| Consecutive failures | ~Minutes | Action                                          |
| -------------------- | -------- | ----------------------------------------------- |
| 1–2                  | 2–4 min  | Silent                                          |
| **3**                | ~6 min   | Alert on all 3 channels (one-shot per incident) |
| 4–7                  | 8–14 min | No further pings                                |
| **8**                | ~16 min  | Auto-rollback + "rolled back" alert             |
| —                    | recovers | "Recovered" alert; state reset                  |

Credentials: `/etc/safedeploy-watchdog.env` (mode 600).
Logs: `journalctl -t safedeploy-watchdog`.
Files: `infrastructure/omv/safedeploy-watchdog.sh` + `.service` + `.timer`.
Full runbook: [`docs/SAFEDEPLOY-WATCHDOG.md`](SAFEDEPLOY-WATCHDOG.md).

---

### Alertmanager — `monitoring` namespace

Routes Prometheus rule firings to pi-alert-api / Slack / MQTT. High-severity
rules can POST `/api/webhooks/admin-alert` for the full ntfy + Slack DM
fan-out. Config in kube-prometheus-stack Helm values.
Pod doc: [`docs/pods/alertmanager/README.md`](pods/alertmanager/README.md).

---

### pi-alert-api — `alert-manager` namespace

FastAPI service (`infrastructure/pi-alert-api/`). Receives ESP32 / homelab
alerts and MQTT publishes. High-severity events forward to
`/api/webhooks/admin-alert`. Exposed at `logs.cloudless.gr` (NodePort 30820).
Pod doc: [`docs/pods/pi-alert-api/README.md`](pods/pi-alert-api/README.md).

---

### kuma-slack-bridge — `uptime-kuma` namespace

Standby-only in-cluster bridge from Uptime Kuma → Slack. Usually
`replicas: 0`; scale to 1 only when the app's `/api/webhooks/kuma` handler is
unavailable (e.g., during a full app outage). Live path is always the app
webhook.
Pod doc: [`docs/pods/kuma-slack-bridge/README.md`](pods/kuma-slack-bridge/README.md).

---

## Config reference

| Key                           | Where            | Used by                                                       |
| ----------------------------- | ---------------- | ------------------------------------------------------------- |
| `SLACK_BOT_TOKEN`             | SSM / env        | All `SlackClient` posts                                       |
| `SLACK_WEBHOOK_URL`           | SSM / env        | `SlackClient` webhook fallback                                |
| `SLACK_DEFAULT_CHANNEL`       | SSM / env        | Default channel when no instance override                     |
| `NEWSLETTER_SLACK_CHANNEL_ID` | env              | `subscribersClient` channel override                          |
| `NTFY_BASE_URL`               | SSM              | `ntfy.ts publishNtfy` (default: in-cluster ClusterIP)         |
| `NTFY_TOPIC`                  | SSM              | `ntfy.ts publishNtfy`                                         |
| `NTFY_TOKEN`                  | SSM              | `ntfy.ts` Bearer auth (optional)                              |
| `ADMIN_PUSH_VIA_NTFY`         | SSM (wins) / env | Enables ntfy fan-out in `notifyAdmin`                         |
| `ADMIN_ALERT_SECRET`          | SSM              | `/api/webhooks/admin-alert` shared secret                     |
| `RESEND_API_KEY`              | env / SSM        | App email + SafeDeploy Watchdog email                         |
| `ALERT_EMAIL`                 | watchdog env     | Watchdog email recipient (default: `tbaltzakis@cloudless.gr`) |

---

## Ops quick reference

```bash
# Force one watchdog tick immediately
sudo systemctl start safedeploy-watchdog.service

# Tail watchdog alerts (fires only on unhealthy transitions)
sudo journalctl -t safedeploy-watchdog -f

# Check watchdog state (counters only, no secrets)
sudo cat /var/lib/safedeploy-watchdog/{fail_count,last_http_code,notified}

# Pause watchdog (maintenance window)
sudo systemctl stop safedeploy-watchdog.timer
sudo systemctl start safedeploy-watchdog.timer   # resume

# Verify ntfy pod
kubectl -n ntfy get pods

# Trigger a test admin alert
curl -s -X POST https://cloudless.gr/api/webhooks/admin-alert \
  -H "x-cloudless-alert-secret: $ADMIN_ALERT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"severity":"info","title":"test","message":"connectivity check","source":"manual"}'
```

## Related docs

- [`docs/SAFEDEPLOY-WATCHDOG.md`](SAFEDEPLOY-WATCHDOG.md) — watchdog design + ops
- [`docs/integrations/SLACK.md`](integrations/SLACK.md) — Slack app setup
- [`docs/EMAIL-INFRASTRUCTURE.md`](EMAIL-INFRASTRUCTURE.md) — email systems map
- [`docs/runbooks/admin-alert-secret-setup.md`](runbooks/admin-alert-secret-setup.md) — ADMIN_ALERT_SECRET provisioning
- [`docs/pods/ntfy/README.md`](pods/ntfy/README.md) — ntfy pod
- [`docs/pods/pi-alert-api/README.md`](pods/pi-alert-api/README.md) — alert-api pod
