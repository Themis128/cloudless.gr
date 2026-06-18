# n8n workflow recipes

Each JSON is a complete, importable workflow. Open n8n → Workflows → ⋯ → Import from File.

## Credentials you'll need

| Service | How to create in n8n | Where it's used |
|---|---|---|
| **Postiz** | Add custom credential → API Key: `<your Postiz key>` → Base URL: `https://postiz.cloudless.gr/api` | All workflows |
| **Anthropic** | Built-in `Anthropic API` credential type → paste key | 01, 03 |
| **Google Drive OAuth2** | Built-in → click "Sign in with Google" | 02 |
| **Slack Webhook** | Built-in → paste incoming-webhook URL | 03 |
| **RSS Read** | No auth — just the feed URL | 01 |

## Per-workflow notes

### 01 — RSS → AI summary → multi-platform post
- Polls an RSS feed every 30 minutes.
- For each new item, calls Claude with a "write a short engaging hook in the brand voice of {{ topic }}" prompt.
- Posts the hook to X + LinkedIn + Mastodon with a link back to the article.
- Edit nodes: `RSS Feed Trigger.url`, `Postiz - Schedule.integrations[]`.

### 02 — Google Drive watcher → IG + TikTok
- Trigger on new file in a specific Drive folder.
- Downloads the file → uploads via Postiz → schedules to IG + TikTok with a caption built from the filename.
- Edit nodes: `Google Drive Trigger.folderId`, `Postiz - Schedule.integrations[]`, `Caption.value` (template).

### 03 — Weekly analytics digest → Slack
- Runs every Monday at 09:00.
- Loops over your integration IDs, pulls `analytics:platform <id> -d 7` for each, plus `analytics:post` for the top posts.
- Asks Claude to write a 6-bullet digest with the headline metric + insight + one action.
- Posts to a Slack channel via incoming webhook.

## Importing JSONs

The JSON files in this folder are minimal skeletons — they import cleanly into n8n 1.x but you must still:
1. Re-bind credentials (n8n won't import credential references)
2. Replace integration IDs (`REPLACE_*` placeholders)
3. Test once manually before activating
