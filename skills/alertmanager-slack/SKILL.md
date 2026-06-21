---
name: alertmanager-slack
description: |
  How alerts reach Slack on the cloudless.gr k3s cluster (NOT via
  Alertmanager directly). Triggered by phrases like "alert-manager Slack
  receiver", "no_active_hooks error", "fix Slack alerts", "why isn't my
  alert showing in Slack", "add Slack to Prometheus alerts", "AlertmanagerConfig
  CRD", "kube-prometheus-stack Slack", or any incident where the operator
  expects Slack notifications and isn't seeing them.
---

# Alertmanager → Slack on cloudless.gr

**TL;DR:** Alertmanager has **no Slack receiver**. By design. All Slack
notifications come from in-cluster CronJobs that call Slack's
`chat.postMessage` directly with a bot token via the `SlackClient`
pattern. This is the result of the 2026-06-21 cleanup that removed the
`AlertmanagerConfig/slack-routing` CRD after its embedded webhook URL
went dead and Alertmanager kept logging `no_active_hooks`.

## Current Alertmanager receivers

After the 2026-06-21 cleanup, Alertmanager has exactly three receivers:

| Receiver | Type | Destination |
| --- | --- | --- |
| `null` | drop | Watchdog + info-severity alerts that we explicitly silence |
| `oncall` | webhook | Internal oncall service (whatever's connected) |
| `alert-api` | webhook | `http://alert-api.alert-manager.svc.cluster.local:8080/api/alertmanager/webhook` — the in-cluster alert-api pod which has its own Slack delivery + dedup DB |

That's it. **No `slack_configs` block anywhere.** Adding one back would
violate [[feedback-slack-use-slackclient]] (raw webhooks bypass the
retry/backoff/fallback in `SlackClient`).

## Why we don't use Alertmanager's `slack_configs`

Per [Prometheus Alertmanager docs](https://prometheus.io/docs/alerting/latest/configuration/#slack_config),
`slack_configs.api_url` MUST be a Slack Incoming Webhook URL. Incoming
webhooks:

- Cannot be minted or rotated programmatically from a bot token (they
  require an admin OAuth scope on a separately-installed Slack app).
- Are scoped to ONE channel each (changing channel = re-mint).
- Don't return useful errors — a wrong URL silently 404s, and a removed
  webhook returns `no_active_hooks` with no actionable info.

The cloudless.gr stack standardised on `chat.postMessage` with a bot
token instead because:
- The bot token rotates from one place (Slack workspace UI → app).
- We can post to any channel the bot is in without redeploying.
- Errors are typed (`channel_not_found`, `not_in_channel`, etc.) so the
  Slack monitoring [[feedback-slack-use-slackclient]] knows when to retry
  vs surface.

## Where alerts → Slack actually happens

Three in-cluster paths, all using the bot token from
`cluster-alerts-secret/SLACK_BOT_TOKEN`:

1. **`alert-api` Deployment** (`alert-manager` namespace) — accepts
   Alertmanager webhook POSTs, dedups via SQLite, posts to Slack with
   its own `SLACK_WEBHOOK_URL` env. Already works; both routes from
   Alertmanager (`oncall` + `alert-api`) cover all warning/critical
   severities.
2. **CronJob watchdogs** in the `monitoring` namespace:
   - `omv-disk-watchdog` (every 15min) — `df` thresholds
   - `omv-backup-verify` (daily) — last-backup-age
   - `postiz-slack-notify` (every 5min)
   - `cloudflared-drift-check` (every 6h) — see PR #1053
   Each one curls `https://slack.com/api/chat.postMessage` directly
   with `Authorization: Bearer $SLACK_BOT_TOKEN` and channel ID
   `C09AF5W3X16` (proven working; `#errors`/`#notifications` return
   `channel_not_found`).
3. **App-level webhooks** for EspoCRM (6 Webhook entities) +
   integration receivers — routed through
   `src/app/api/webhooks/espocrm/route.ts` which uses `SlackClient`.

## "I see no_active_hooks errors"

That error means SOMETHING is still trying to deliver to a removed
webhook. Source order to check:

1. **Stray AlertmanagerConfig CRDs** —
   `kubectl get alertmanagerconfig -A`. If you see a `slack-routing` or
   similar, it was added after the 2026-06-21 cleanup; either delete it
   or replace its `slackConfigs` with a `webhookConfigs` pointing at an
   in-cluster proxy.
2. **alert-api's own `SLACK_WEBHOOK_URL`** — `kubectl describe deploy
   alert-api -n alert-manager`. If the webhook is dead, mint a fresh one
   in Slack workspace UI (Settings → Manage apps → cloudless-alerts →
   Incoming Webhooks → Add New), update
   `alert-api-secrets/SLACK_WEBHOOK_URL`, restart the pod.
3. **Other consumers** — `grep -rE 'hooks.slack.com/services' /etc/`
   on omv via the privileged-pod pattern. Any hard-coded webhook URL is
   suspect.

## Adding a new alert → Slack path

DO NOT add it to Alertmanager. Instead, write a CronJob in `monitoring`
namespace following the canonical template
[`monitoring/cloudflared-drift.yaml`](../../infrastructure/monitoring/cloudflared-drift.yaml):

```yaml
env:
  - name: SLACK_BOT_TOKEN
    valueFrom: { secretKeyRef: { name: cluster-alerts-secret, key: SLACK_BOT_TOKEN } }
  - name: SLACK_CHANNEL_ID
    value: "C09AF5W3X16"   # proven working
command:
  - sh
  - -c
  - |
    # ... your check ...
    if [ "$ALERT_CONDITION" ]; then
      curl -fsS -X POST https://slack.com/api/chat.postMessage \
        -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
        -H "Content-Type: application/json; charset=utf-8" \
        --data "$(jq -nc --arg ch "$SLACK_CHANNEL_ID" --arg msg "..." '{channel: $ch, text: $msg}')"
    fi
```

For application code (Next.js routes, Lambdas), always go through
`SlackClient` — never raw `chat.postMessage` — so retry/backoff/webhook-
fallback are preserved (see [[feedback-slack-use-slackclient]]).

## If you absolutely must add a Slack receiver to Alertmanager

For the very narrow case where you want Alertmanager's grouping/inhibit
logic to drive Slack directly (rare; alert-api already does this with
better dedup), deploy a small chat.postMessage proxy in the cluster and
have Alertmanager `webhook_configs.url` point at it:

```yaml
apiVersion: monitoring.coreos.com/v1alpha1
kind: AlertmanagerConfig
metadata:
  name: slack-proxy
  namespace: monitoring
spec:
  receivers:
    - name: slack-proxy
      webhookConfigs:
        - url: http://slack-proxy.monitoring.svc.cluster.local:8080/webhook
          sendResolved: true
  route:
    receiver: slack-proxy
    matchers: [{ name: severity, matchType: =~, value: "warning|critical" }]
```

The proxy reads `SLACK_BOT_TOKEN` from `cluster-alerts-secret`, accepts
Alertmanager's JSON payload, and POSTs to chat.postMessage. ~30 LoC.

But first ask: does alert-api not already cover this? In most cases the
answer is yes and the new path is redundant.

## See also

- `skills/cluster-bash/SKILL.md`
- `skills/cloudflare-tunnel-ops/SKILL.md`
- `infrastructure/monitoring/cloudflared-drift.yaml` — CronJob+Slack template
- `infrastructure/monitoring/omv-watchdogs.yaml` — three more CronJob examples
- Memory: `feedback_slack_use_slackclient`, `feedback_slack_lambda_env_frozen`
