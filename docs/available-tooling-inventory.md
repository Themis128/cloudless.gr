# Available tooling inventory — what I can use to build cloudless.gr

A complete catalogue of the connectors, plugins, MCP servers, and skills I
have access to in this Cowork session, filtered for relevance to the
cloudless.gr stack. Annotated with **🟢 active** (working now without setup) /
**🟡 needs operator auth** (one-time browser OAuth) / **🔴 needs install or
config** before I can use it.

## Built-in tools (always on)

| Tool | What it does | Used in cloudless.gr for |
|---|---|---|
| **Read / Write / Edit** | Local filesystem ops on your repo | Every file change this session |
| **Bash / Workspace bash** | Run shell in sandboxed Linux container | npm ci, AWS CLI, kubectl-via-API, ssh |
| **Grep / Glob** | ripgrep + file globbing in repo | Finding call sites, audit sweeps |
| **WebSearch** | Live web search (US, 2026-aware) | Best-practices audit research |
| **WebFetch** | Fetch one URL, return text | Reading vendor docs |
| **Agent** | Spawn subagent for parallel research | Best-practices audit (returned in 4 min) |
| **TaskCreate / TaskUpdate** | Cowork task list widget | Tracking R-series progress |
| **Scheduled tasks** | Cron-style automated runs | (Not yet used — could schedule daily PRs) |
| **Cowork artifacts** | Persisted live HTML pages | (Not yet used — could host `/admin/cost` mock) |
| **Visualize show_widget** | Inline SVG / HTML / mermaid renders | (Used in chat for diagrams) |

## MCP servers — connected + auth status

### 🟢 Active (working now)

| Server | Tools | Cloudless.gr value |
|---|---|---|
| **Kubernetes_MCP_Server** | `kubectl_apply`, `exec_in_pod`, `kubectl_get`, `kubectl_logs`, `kubectl_rollout`, `port_forward`, helm | Every cluster-side change today: SSM bootstrap, Grafana plugin install, cloudflared edits, MQTT test. The single most-used tool of this session. |
| **Windows-MCP** | `PowerShell`, `Click`, `Type`, `Screenshot`, `FileSystem`, `Process`, `Registry` | PowerShell→WSL bridge runs every `aws/gh/git/curl/node` command |
| **workspace web_fetch / bash** | sandboxed bash + URL fetch | Backup channel for shell ops |
| **AWS_API_MCP_Server** | `call_aws`, `suggest_aws_commands` | (Not used this session — could replace inline `aws` CLI) |
| **Google Drive** (just authed) | `create_file`, `search_files`, `list_recent_files`, `copy_file`, `download_file_content` | The 3rd canonical surface per `feedback_save_all_artifacts_to_google_drive` |
| **Notion** | `notion-create-pages`, `notion-fetch`, `notion-search`, `notion-update-page`, `notion-create-database` | Operator content surface — read blog/docs/tasks DBs |
| **Cowork directory access** | `request_cowork_directory` | Already mounted: `\\wsl...\cloudless.gr` |
| **plugin_engineering_github** | (would expose: list PRs, read issues, etc.) | Currently using `gh` CLI directly via PowerShell; the MCP would speed up reads |

### 🟡 Needs OAuth one-time auth (then becomes 🟢)

| Server | Most relevant tools | Cloudless.gr value |
|---|---|---|
| **Sentry** | `search_issues`, `analyze_issue_with_seer`, `search_events`, `find_organizations` | Could replace the Sentry-to-lake ETL with direct queries + drive `notifyAdmin()` |
| **Slack (by Salesforce)** | `slack_send_message`, `slack_read_channel`, `slack_search`, `slack_create_canvas` | Direct ops-channel messaging without webhook hops; smart canvas for incident docs |
| **Slack admin** | `slack_create_channel`, `slack_invite_to_channel`, `slack_rename_channel`, `slack_archive_channel` | Workspace admin (would help if you scale to a team) |
| **HubSpot** | `get_crm_objects`, `search_owners`, `get_campaign_analytics` | **Decommissioned** — skip (you moved to EspoCRM 2026-06-20) |
| **Stripe** (via small-business) | (auth flow only — not full API) | Probably skip; better to use the Stripe SDK in your Lambda directly |
| **Google Calendar** | `create_event`, `list_events`, `suggest_time`, `respond_to_event` | Booking flow on the site, operator schedule |
| **Gmail** | `create_draft`, `search_threads`, `label_thread` | Operator inbox triage |
| **Microsoft 365** | Full Outlook / Calendar / Contacts | Skip unless you switch from Gmail |
| **Asana / Linear / ClickUp / Monday** | task management | Skip — TaskCreate covers this |
| **Apollo** | enrich-lead, prospect, sequence-load | **Already removed** (PR #1080) — skip |
| **Common Room** | account-research, contact-research, prospect | Could revisit for B2B sales intel; low SMB volume makes ROI marginal |
| **PostHog** (`mcp__57e9eab7-*`) | `query_chart`, `create_experiment`, `create_flags`, `get_session_replays`, `get_feedback_*` | Product analytics + feature flags + session replay — would replace some `/admin/analytics` cards if you adopt PostHog |
| **Adobe Creative Cloud** | image_remove_background, image_crop_and_resize, video_create_quick_cut, design templates, font_recommend | Quick product-photo cleanup, social-asset resize, hero-image touch-up |
| **Figma** | `get_design_context`, `get_screenshot`, `create_new_file`, `use_figma` | Mock new admin pages before coding |
| **Canva** | `generate-design`, `create-design-from-brand-template`, `export-design` | Social-post visuals for Postiz |
| **Miro** | `miro-browse`, `miro-diagram`, `miro-doc`, `miro-table` | Whiteboard arch diagrams (you'd use these for the purchase-flow diagram in a more visual form) |
| **Sanity** (CMS) | `deploy-schema`, `typegen`, `sanity-review` | Skip unless you replace Notion as CMS |
| **Postiz** | `postiz` skill (post scheduling, accounts) | Direct social posting via MCP instead of your existing app integration |
| **Cloudinary** | image transformation URLs, docs lookup | Skip — you don't use Cloudinary; S3 + Lambda image-resize fits same-hardware constraint |
| **Fastly** | falco lint, fastlike, vcl, ngwaf audit | Skip — you don't use Fastly |
| **Vercel** | deploy, build logs, runtime logs | Skip — you're on SST/Lambda, not Vercel |
| **Bright Data** | scraping suite (SERP, scrape, datasets, browser automation) | Competitive intel, brand-mention monitoring, price comparison if you add a B2B angle |
| **SEMrush** | keyword research, organic research, backlinks | SEO funnel — pairs with the existing GSC ETL |
| **Daloopa** | financial models, earnings analysis (public companies) | Skip — not relevant to SMB ops |
| **Bigdata.com** | macro research, sector analysis | Skip — not relevant |
| **Zoom** | meetings, recordings, AI summary | If you offer demo calls / consultations |
| **Intercom** | `intercom-analysis`, `install-messenger`, `customer-360` | Skip — your support flow is SES + EspoCRM Case |
| **Gusto** | payroll | Skip — Greek, not US payroll |
| **QuickBooks** | accounting | Skip unless you also operate a US LLC |
| **PayPal / Square / Shopify** | small-business commerce | Skip — Stripe-only by choice |
| **Zapier** | universal automation | Skip — you have n8n self-hosted |
| **Adspirer (ads)** | campaign performance, keyword research | Light overlap with your LinkedIn ETL |
| **Brand Voice** | `discover-brand`, `enforce-voice`, `guideline-generation` | Could generate a brand voice doc from your existing copy |

### Computer / browser control

| Server | Cloudless.gr value |
|---|---|
| **🟢 Claude in Chrome** | DOM-aware browser automation. Used today to navigate Cloudflare/Notion/AppFlowy UIs when MCP doesn't cover the action. Could automate the 5 operator blockers if you grant access. |
| **🟢 Control Chrome** | Lower-level Chrome ops (open URL, execute JS, get page content) — backup for Claude-in-Chrome |
| **🟢 Desktop Commander** | Full local filesystem + process control on your Windows machine |
| **🟢 computer-use** | Pixel-level desktop control — Maps/Finder/native apps |

## In-repo skills (25 SKILL.md files at `skills/`)

These are YOUR canonical operator playbooks. They embody hard-won lessons.
Per memory `feedback_use_in_repo_skills` I must read them BEFORE solving
from first principles.

Most-load-bearing for cloudless.gr build:

| Skill | What it captures |
|---|---|
| `selfhosted-admin-bootstrap` | Add unified admin to any new self-hosted app |
| `cloudflare-tunnel-ops` | Add ingress + DNS without operator dashboard |
| `cloudflare-token-doctor` | The token rotation flow (Phase 0 item) |
| `appflowy-operator` | 9-pod stack + worker omv-ha pin |
| `espocrm-operator` | API key + webhooks + IMAP + ETL |
| `postiz` + `postiz-doctor` | Posting + OAuth troubleshooting |
| `mqtt-auth-rollout` | Mosquitto auth-only cutover |
| `esphome-ota-flash` | ESP32 firmware over MQTT |
| `cluster-bash` | 2-node SSH/SFTP MCP wrapper |
| `cluster-incident-response` | When MCP/SSH is down, drive via GH Actions |
| `terraform-doctor` | TF CLI / provider drift recovery |
| `gh-actions-pitfalls` | 8 CI gotchas catalogue (read BEFORE every workflow edit) |
| `linkedin-campaigns` | The full campaign wiring stack |
| `linkedin-insight-doctor` | Insight Tag + CAPI debugging |
| `alertmanager-slack` | Prometheus → Slack routing |
| `ad-analytics` | Reusable ad-analytics module spec |
| `cowork-session-secrets` | The 3 session secrets pattern |
| `audit-routine` | Weekly audit workflow |

## Anthropic-installed skills (most relevant subset)

| Skill | Use case |
|---|---|
| **sst-nextjs** | SST + Next.js patterns (your AWS stack) |
| **stripe-nextjs** | Stripe Checkout + webhooks + raw-body gotcha |
| **aws-ssm-config** | SSM caching in Lambda (your runtime config pattern) |
| **aws-ses-nextjs** | SES sendEmail + suppression list |
| **cognito-amplify-nextjs** | Cognito JWT verify on API routes |
| **notion-nextjs** | Notion-as-CMS in Next.js (already in use) |
| **slack-nextjs-integration** | Slack from a Next.js app (webhooks, OAuth, signing) |
| **hubspot-nextjs** | Decommissioned — skip |
| **sentry-nextjs** | Sentry in App Router |
| **gsc-nextjs** | Google Search Console queries (already in use) |
| **google-calendar-nextjs** | Calendar booking flow |
| **vitest-playwright** | Test framework (your existing stack) |
| **github-pr** / **github-actions** / **github-code-review** / **github-issues** / **github-release** / **github-repo** | Full git lifecycle (used implicitly via `gh` CLI today) |
| **mcp-builder** | If you ever want to ship a custom MCP server |
| **docx / xlsx / pptx / pdf** | Document creation for client deliverables |
| **theme-factory** | 10 ready themes for HTML artifacts |
| **brand-guidelines** | Anthropic brand styling (if you want to reuse for inspiration) |
| **canvas-design** + **algorithmic-art** | Visual art generation |
| **web-artifacts-builder** | Multi-component React artifacts |
| **schedule** | Persistent cron-style scheduled tasks |
| **skill-creator** | Build your own skills (you already have 25) |
| **internal-comms** | Status reports + leadership updates |
| **doc-coauthoring** | Structured doc-writing workflow |

## What's most valuable for the R10-R24 roadmap

Per the master TODO list:

- **R10 PVC backup** → Kubernetes MCP + AWS_API_MCP + `cluster-bash` skill
- **R11 TLS probe** → built-in (curl + openssl in bash)
- **R12 /admin/cost** → existing `src/lib/athena.ts` + visualize/show_widget for prototyping
- **R13 mariadb hourly** → Kubernetes MCP + `espocrm-operator` skill
- **R14 Sentry env tag** → trivial config change
- **R15 Cloudflare Access** → `cloudflare-tunnel-ops` skill + `cloudflare-token-doctor` (Phase 0 prereq)
- **R17 Kuma monitors** → operator-only (Kuma UI) — could use Claude-in-Chrome to automate
- **R18 SSM scope assertion** → AWS_API_MCP + scheduled-tasks
- **R19 Failover drill** → AWS_API_MCP (Route 53) + scheduled-tasks
- **R21 AI baseline** → Kubernetes MCP (Meilisearch deploy) + existing Bedrock IAM
- **R22 Stripe idempotency** → `stripe-nextjs` skill
- **R23 Resend pilot** → built-in (curl Resend API)
- **R24 Multi-region** → AWS_API_MCP (Route 53 + DDB Global Tables)

Bottom line: **the existing toolset covers every item in the master TODO
without needing to install a single additional MCP.** The 🟡 ones (Sentry,
Slack-MCP, PostHog, Adobe CC, Figma, Canva, Miro) would each speed up specific
workflows but aren't blockers.

## See also
- `docs/master-todo-list.md` — the work this tooling powers
- `docs/architecture-purchase-flow.md` — what the tools assemble
- `docs/best-practices-audit-2026.md` — 2026 standards this tooling meets
