---
name: mcp-tools
description: |
  Catalog of every MCP server configured for this workspace (`.mcp.json` +
  `mcp.json`) and the tools each one exposes. Use whenever the user asks
  "what tools can I use?", "which MCP server does X?", "how do I call the
  Cloudflare/GitHub/n8n/Postiz tool?", "is there a tool for …", or when
  deciding which server to reach for a given operation. This is the index
  of the tool surface — pair with the per-service operator skills
  (n8n-operator, postiz, cloudflare-tunnel-ops, cluster-bash, …).
---

# MCP tools catalog — cloudless.gr workspace

Two config files define the MCP surface:

| File | Scope | Servers |
|---|---|---|
| `.mcp.json` | Workspace-level (Cline/Claude) | 15 servers |
| `mcp.json`   | Project-level (this repo)   | 9 servers |

Auto-start servers connect on launch; the rest can be started on demand.

---

## `.mcp.json` — workspace servers

### 1. fast-markdown
- **Command:** `npx tsx fast-markdown-mcp/src/index.ts`
- **AutoStart:** ✅
- **Purpose:** read/search the local DevDocs markdown store.
- **Tools:** `list_files`, `read_file`, `search_files`, `get_toc`
- **Env:** `DEVDOCS_STORAGE_PATH` (default `/home/tbaltzakis/DevDocs/storage/markdown`)
- **Related skill:** none (generic docs lookup).

### 2. cloudflare-pages
- **Command:** `npx tsx cloudflare-pages-mcp/src/index.ts`
- **AutoStart:** ❌
- **Purpose:** Cloudflare Pages project + deployment management.
- **Tools:** `pages_list_projects`, `pages_get_project`, `pages_list_deployments`, `pages_get_deployment_logs`
- **Env:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- **Use for:** checking Pages build status, reading deploy logs.

### 3. cloudflare-bindings
- **Command:** `npx mcp-remote https://bindings.mcp.cloudflare.com/mcp`
- **AutoStart:** ✅
- **Purpose:** Cloudflare resource bindings (KV, Workers, R2).
- **Tools:** `kv_namespaces_list`, `kv_namespace_create`, `kv_namespace_delete`, `workers_list`, `r2_buckets_list`
- **Env:** `CLOUDFLARE_API_TOKEN`
- **Related skill:** `cloudflare-token-doctor` (token troubleshooting).

### 4. cloudflare (full platform)
- **Command:** `npx -y @cloudflare/mcp-server-cloudflare`
- **AutoStart:** ✅
- **Purpose:** Full Cloudflare platform — zones, DNS, Workers, R2, D1, KV, AI, WAF, Cache.
- **Tools:** broad — dynamic list. Replace most manual `wrangler` calls.
- **Related skills:** `cloudflare-tunnel-ops`, `cloudflare-token-doctor`, `sst-cloudflare`, `wrangler-ai-search`.

### 5. cloudflare-graphql
- **Command:** `npx mcp-remote https://graphql.mcp.cloudflare.com/mcp`
- **AutoStart:** ❌
- **Purpose:** Cloudflare GraphQL Analytics API — zone analytics, HTTP requests, Workers invocations, security events.
- **Env:** `CLOUDFLARE_API_TOKEN`
- **Use for:** pulling historical metrics (requests, threats, bandwidth, cache performance).

### 6. cloudflare-docs
- **Command:** `npx mcp-remote https://docs.mcp.cloudflare.com/mcp`
- **AutoStart:** ❌
- **Purpose:** searchable Cloudflare documentation.
- **Use for:** retrieving current docs instead of relying on training data.

### 7. cloudflare-builds
- **Command:** `npx mcp-remote https://builds.mcp.cloudflare.com/mcp`
- **AutoStart:** ❌
- **Purpose:** Cloudflare Builds management (build config, triggers, logs).
- **Env:** `CLOUDFLARE_API_TOKEN`

### 8. cloudflare-observability
- **Command:** `npx mcp-remote https://observability.mcp.cloudflare.com/mcp`
- **AutoStart:** ❌
- **Purpose:** Workers Observability / Logpush / real-time logs.
- **Env:** `CLOUDFLARE_API_TOKEN`
- **Use for:** Workers runtime errors, tail logs, exception traces.

### 9. opennextjs-mcp
- **Command:** `node /home/tbaltzakis/opennextjs-cli/packages/opennextjs-mcp/dist/index.js`
- **AutoStart:** ❌
- **Purpose:** OpenNext.js ↔ Cloudflare build/deploy lifecycle for this repo.
- **Tools:** `get_project_status`, `validate_configuration`, `deploy_to_cloudflare`, `start_preview_server`, `update_configuration`, `check_health`, `list_environments`
- **Env:** `PROJECT_ROOT=/home/tbaltzakis/cloudless.gr`
- **Related skill:** `sst-cloudflare` / `opennext-build-deploy` (.clinerules).

### 10. sequentialthinking
- **Command:** `node /home/tbaltzakis/Cline/MCP/sequentialthinking/.../index.js`
- **AutoStart:** ✅
- **Tools:** `sequentialthinking`
- **Use for:** complex multi-step reasoning (not a data-fetch tool).

### 11. github
- **Command:** `/home/tbaltzakis/.local/share/github-mcp-server/github-mcp-server`
- **AutoStart:** ✅
- **Purpose:** GitHub repo/branch/PR/issue/actions management.
- **Tools (alwaysAllow):** `search_repos`, `search_code`, `search_issues`, `search_users`, `get_file_contents`, `get_issue`, `list_issues`, `create_issue`, `update_issue`, `get_pull_request`, `list_pull_requests`, `create_pull_request`, `get_repo`, `list_repos`, `create_repo`, `fork_repo`, `get_branch`, `list_branches`, `create_branch`, `delete_branch`, `get_commit`, `list_commits`, `get_workflow_run`, `list_workflow_runs`, `get_workflow_run_logs`, `get_workflow_run_usage`, `get_actions_secrets`, `create_actions_secret`, `delete_actions_secret`, `get_actions_variables`, `create_actions_variable`, `delete_actions_variable`
- **Env:** `GITHUB_PERSONAL_ACCESS_TOKEN`
- **Related skills:** `gh-actions-pitfalls`, `github-*` (anthropic bundles).

### 12. github.com/…/filesystem
- **Command:** `npx -y @modelcontextprotocol/server-filesystem /home/tbaltzakis/cloudless.gr`
- **AutoStart:** ✅
- **Tools:** `read_text_file`, `read_media_file`, `read_multiple_files`, `write_file`, `edit_file`, `create_directory`, `list_directory`, `list_directory_with_sizes`, `move_file`, `search_files`, `directory_tree`, `get_file_info`, `list_allowed_directories`
- **Note:** restricted to `/home/tbaltzakis/cloudless.gr`.

### 13. postiz-mcp
- **Command:** `npx -y @antoniolg/postiz-mcp`
- **AutoStart:** ❌
- **Purpose:** Postiz Public API tooling (integrations, posts, schedule).
- **Env:** `POSTIZ_API_URL` (points to cluster.local)
- **Related skill:** `postiz`, `postiz-automation`, `postiz-agent-cli`.

### 15. n8n
- **Command:** `npx mcp-remote https://n8n.cloudless.gr/mcp-server/http`
- **AutoStart:** ✅
- **Purpose:** remote n8n MCP bridge — list/invoke n8n workflows as tools.
- **Tools:** `list_resources`, `read_resource`, `list_tools`, `call_tool`, `list_prompts`, `get_prompt`
- **Related skill:** `n8n-operator`.

---

## `mcp.json` — project servers

### 1. cloudless-infra (SSH / k3s) — the cluster control plane
- **Command:** `npx tsx tools/ssh-mcp/src/index.ts`
- **Purpose:** SSH ops on omv / omv-ha: k3s, cluster commands, tunnels, terraform.
- **Tools (canonical names):** `cluster_run_command`, `cluster_run_fanout`, `k3s_get_pod_logs`, `k3s_rollout_restart`, `k3s_apply_manifest`, `ssh_*` family, `tf_doctor`, `cloudflare_tunnel_status`.
- **Env:** `OMV_SSH_HOST_TAILSCALE=100.74.191.58`, `OMV_SSH_USER=omv`, `OMV_SSH_KEY=${HOME}/.ssh/id_ed25519`
- **Related skill:** `cluster-bash` — read BEFORE any cluster SSH.

### 2. project (project-mcp)
- **Command:** `npx -y project-mcp` · **AutoStart:** ✅
- **Purpose:** codebase context/search for the repo.

### 3. postiz
- `npx -y @antoniolg/postiz-mcp` · **AutoStart:** ❌
- Same as `postiz-mcp` above.

### 5. prompt-to-asset
- `npx -y prompt-to-asset` · **AutoStart:** ❌
- **Purpose:** generate design assets from prompts.

### 6. postlint
- `npx -y postlint-mcp` · **AutoStart:** ❌
- **Purpose:** social-post linting (hashtags, length, tone, best practices).

### 7. bluesky
- `npx -y @morinokami/mcp-server-bluesky` · **AutoStart:** ❌
- **Env:** `BLUESKY_IDENTIFIER`, `BLUESKY_APP_PASSWORD`
- **Purpose:** post/search/manage the cloudless Bluesky account.

### 8. free-stock-images
- `npx -y free-stock-images-mcp` · **AutoStart:** ❌
- **Env:** `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`
- **Purpose:** search royalty-free stock images (Unsplash / Pexels / Pixabay).

### 9. n8n
- `npx mcp-remote https://n8n.cloudless.gr/mcp-server/http` · **AutoStart:** ✅
- Same as `.mcp.json` → n8n. Includes `alwaysAllow` for the resource/tool/prompt primitives.

---

## Quick lookup: which server does what?

| Task | Server |
|---|---|
| Deploy / inspect a Cloudflare Worker | `cloudflare`, `cloudflare-bindings` |
| Check Pages build status / logs | `cloudflare-pages` |
| Pull zone analytics / request metrics | `cloudflare-graphql` |
| Search Cloudflare docs | `cloudflare-docs` |
| Tail Workers runtime logs / errors | `cloudflare-observability` |
| OpenNext build → Cloudflare deploy | `opennextjs-mcp` |
| GitHub PR / issue / branch / workflows | `github` |
| k3s cluster ops (pods, logs, restart, apply) | `cloudless-infra` (+ `cluster-bash`) |
| n8n workflow automation | `n8n` (+ `n8n-operator`) |
| Postiz scheduling / social publishing | `postiz` / `postiz-mcp` (+ `postiz*` skills) |
| Bluesky posting | `bluesky` |
| Stock images | `free-stock-images` |
| Post copy linting | `postlint` |
| Asset generation | `prompt-to-asset` |
| Local markdown docs | `fast-markdown` |
| Repo filesystem access | `filesystem` (github…/filesystem) |
| Complex reasoning | `sequentialthinking` |

## Tool-call naming convention

Cline/Claude exposes MCP tools with the server name prefixed, e.g.:

- `mcp__cloudless-infra__k3s_get_pod_logs`
- `mcp__github__list_pull_requests`
- `mcp__n8n__call_tool`
- `mcp__postiz-mcp__integrationList`

When you see a bare tool name in logs (e.g. `call_tool`), it belongs to the
server that returned it — check this file for which server that is.

## How to add a new MCP server

1. Edit `.mcp.json` (workspace, for Cline/Claude) **or** `mcp.json` (project).
2. Follow an existing entry's shape:

   ```json
   "name": {
     "command": "npx",
     "args": ["-y", "package-name" or "mcp-remote https://…"],
     "env": { "KEY": "${ENV_VAR}" },
     "autoStart": false,
     "alwaysAllow": ["tool_a", "tool_b"]
   }
   ```

3. Document it in this SKILL.md (both tables + quick-lookup if relevant).
4. If it maps to a service that already has an operator skill, cross-link it.
5. Restart Cline to load the new server.