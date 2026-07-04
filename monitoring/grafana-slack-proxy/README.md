# Grafana Slack Proxy

A webhook proxy that collects and categorizes Grafana alerts before posting to Slack.

## Features

- Receives Grafana webhook alerts
- Categorizes by app and severity
- Posts formatted messages to Slack
- Groups multiple alerts of same type
- Shows runbook links

## Setup

The pod.yaml contains everything in one file:

```bash
kubectl create namespace grafana-slack-proxy
kubectl create secret generic grafana-slack-proxy-secrets -n grafana-slack-proxy \
  --from-literal=SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..." \
  --from-literal=SLACK_SIGNING_SECRET="your-signing-secret"
kubectl apply -f pod.yaml
```

### 3. Configure Grafana

In Grafana → Alerting → Contact Points:

1. Click **Add contact point**
2. Type: **Webhook**
3. URL: `https://grafana-slack-proxy.cloudless.gr/alerts`
4. Method: **POST**
5. Save

## Alert Categories

The proxy categorizes alerts by:

| Label | Example Values | Description |
|-------|---------------|-------------|
| `app` | `n8n`, `espocrm`, `meilisearch` | Which app generated the alert |
| `category` | `workflow`, `database`, `search` | Alert type |
| `severity` | `critical`, `high`, `warning` | Alert priority |

## Example Slack Message

```
:red_circle: CRITICAL Alert
────────────────────────────────
App:         n8n
Category:    workflow

n8n workflow error detected
_n8n container has recorded workflow errors in the last 5 minutes_

Started: 2026-07-03 21:45:00
```

## Files

- `main.py` - Python webhook server
- `Dockerfile` - Container image
- `deployment.yaml` - K8s deployment
- `service.yaml` - K8s service
- `ingress.yaml` - K8s ingress
- `secrets.yaml` - Slack credentials

## Testing

The proxy is running on omv node. Test from within the pod:

```bash
kubectl exec -n grafana-slack-proxy pod/grafana-slack-proxy -- python -c "import requests; print(requests.post('http://localhost:5001/alerts', json={'alerts':[{'labels':{'app':'test','severity':'critical','category':'test'},'annotations':{'summary':'Test alert','description':'Test description'},'startsAt':'2026-07-04T01:55:00Z'}]}, timeout=10).text)"
```

**Expected response:** `Processed 1 alerts`

If Slack webhook is configured correctly, you should see a message in `#ads-test-scope`.
