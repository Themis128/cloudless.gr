# n8n + Postiz custom node

## Install
```bash
helm repo add open-8gears https://8gears.container-registry.com/chartrepo/library
helm repo update
helm upgrade --install n8n open-8gears/n8n \
  --namespace n8n --create-namespace \
  -f 06-automation/n8n/values.yaml
kubectl apply -f 06-automation/n8n/ingress.yaml
```

## First-run wiring

1. **Create admin user** at https://n8n.cloudless.gr (owner setup screen).
2. **Install the Postiz community node:**
   Settings → Community Nodes → Install → npm package name `n8n-nodes-postiz` → Install.
3. **Add Postiz credentials:**
   When you drop a Postiz node into a workflow, the credential dialog asks for:
   - `API Key` — the Postiz public API key
   - `Base URL` — `https://postiz.cloudless.gr/api`   **← the `/api` suffix is required for self-hosted Postiz**

## Available Postiz nodes

Per the [postiz-n8n](https://github.com/gitroomhq/postiz-n8n) repo:
- Schedule a post
- Delete post
- Get channels
- Get posts
- Upload file
- Generate video
- Video function

## Example workflow ideas

- **Reddit-to-everywhere:** RSS → AI summarize → Postiz schedule across X / LinkedIn / Mastodon.
- **Folder watcher → IG/TikTok:** Google Drive trigger (new image) → Upload via Postiz → Schedule to Instagram + TikTok.
- **Weekly digest:** Cron → query Plausible/PostHog → AI write thread → Postiz schedule.

## Switching n8n to Postgres (optional)

When SQLite starts hurting, point n8n at the existing CNPG cluster:

```yaml
# values.yaml override
db:
  type: postgresdb
  postgresdb:
    host: postiz-pg-rw.postiz.svc.cluster.local
    port: 5432
    database: n8n
    user: n8n
    password: ""           # use existingSecret instead, see chart docs
```

Then create the `n8n` DB + user on the CNPG cluster:
```bash
kubectl -n postiz exec -it postiz-pg-1 -- psql -U postgres -c \
  "CREATE DATABASE n8n; CREATE USER n8n WITH PASSWORD '...'; GRANT ALL ON DATABASE n8n TO n8n;"
```
