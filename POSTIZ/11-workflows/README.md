# Workflow recipes

Ready-to-use automations that consume the stack you just built. Two flavours:

| Where it runs | Best for |
|---|---|
| **n8n** (visual) | Anything with branching, retries, human-in-the-loop, or pulls from SaaS (Drive, Gmail, Notion, Reddit) |
| **K8s CronJob** (CLI) | Headless schedules that just need to call Postiz + post somewhere — no UI dependency, GitOps-friendly |

Pick the flavour that matches your taste — most recipes exist in both.

## What's here

| # | Recipe | Flavour | Needs |
|---|---|---|---|
| 1 | **RSS → AI summary → multi-platform post** | n8n | Postiz API key, Anthropic/OpenAI key |
| 2 | **Google Drive watcher → IG / TikTok** | n8n | Postiz, Google OAuth |
| 3 | **Weekly analytics digest → Slack** | n8n | Postiz, Slack webhook |
| 4 | **Daily brand-voice review of scheduled posts** | CronJob | Postiz, Anthropic key, Slack webhook |
| 5 | **PVC folder watcher → IG** (K3s-native alt of #2) | CronJob | Postiz, a `ReadWriteMany` PVC |

## Prereqs (one-time)

```bash
# Postiz API key (already created during automation layer)
kubectl -n postiz get secret postiz-api-key -o jsonpath='{.data.POSTIZ_API_KEY}' | base64 -d

# Get the Postiz integration IDs you'll target — paste these into workflows
kubectl -n postiz exec -it deploy/postiz -- sh -c '
  curl -s -H "Authorization: $POSTIZ_API_KEY" \
    http://localhost:3000/public/v1/integrations | jq ".[] | {id, identifier}"
'
```

Save the integration IDs you care about (X, LinkedIn, IG, etc.) — every workflow references them.

## Layout

```
11-workflows/
├── n8n-workflows/
│   ├── 01-rss-to-multiplatform.json
│   ├── 02-folder-watcher-to-ig.json
│   ├── 03-weekly-analytics-digest.json
│   └── README.md           # how to import + per-workflow credential map
└── agent-cronjobs/
    ├── 04-brand-voice-review.yaml
    ├── 05-pvc-folder-watcher.yaml
    └── README.md
```

## How to import an n8n workflow

1. Open https://n8n.cloudless.gr
2. Workflows → ⋯ → **Import from File** → pick the JSON
3. Click each highlighted node and set its credentials:
   - **Postiz** node → use the credential you set up in `06-automation` (`https://postiz.cloudless.gr/api`)
   - **Anthropic / OpenAI** → paste an API key
   - **Slack / Google Drive** → OAuth flow
4. Replace placeholder integration IDs (`xxxx-twitter-id`, etc.) with the real ones from the prereq step
5. Toggle **Active** in the top-right

## How to apply a CronJob recipe

```bash
# Most need only the existing postiz-api-key secret + Slack webhook env.
# Edit the .yaml to set your channel IDs / Slack webhook URL, then:
kubectl apply -f 11-workflows/agent-cronjobs/04-brand-voice-review.yaml
```
