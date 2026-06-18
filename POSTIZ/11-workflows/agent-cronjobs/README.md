# Agent CronJobs

K8s-native scheduled tasks that drive the Postiz CLI + Anthropic API directly. Use these when you want full GitOps (the YAML lives in this repo, ArgoCD syncs them) without standing up an n8n workflow.

## Prereqs

Both CronJobs reuse the `postiz-api-key` Secret from `06-automation/postiz-agent/`. Brand-voice review additionally needs an Anthropic key + Slack webhook.

```bash
# Anthropic + Slack secret (apply once)
kubectl -n postiz create secret generic agent-creds \
  --from-literal=ANTHROPIC_API_KEY="sk-ant-..." \
  --from-literal=SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
```

## Recipes

### `04-brand-voice-review.yaml`
- **Schedule:** daily 08:00 UTC
- **What it does:** Pulls every post scheduled for the next 24 h via `postiz posts:list`, sends each one's content to Claude with a "does this match our brand voice? flag any drift" prompt, posts the verdict to Slack.
- **Edit:** the brand-voice prompt in the script body — make it specific to your tone.

### `05-pvc-folder-watcher.yaml`
- **Schedule:** every 5 minutes
- **What it does:** Watches `/uploads-watch/inbox` on a PVC; for any new file (compared to a state file in the PVC), uploads to Postiz and creates a draft IG post. You then approve via the Postiz UI.
- **Wire:** create a `ReadWriteMany` PVC named `uploads-watch` and drop files into it from anywhere (NFS share, syncthing, scp, etc.).
- **Why draft, not schedule:** safer for image content where you want a human eyeball before publish.
