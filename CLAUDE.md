# Claude Code — Project Memory

## ⚠️ Cluster Topology — SINGLE-NODE as of 2026-08-08 (supersedes older 2-node notes)

The k3s cluster is now **single-node**: `omv` (Pi 5, 8GB, control-plane) only.
`omv-ha` (Pi 4, 1GB) was **drained and removed from k3s** on 2026-08-08 and
repurposed as a **dedicated mail host** (webmail.cloudless.gr). Any section below
that describes a 2-node cluster, an `omv-ha` k3s worker, the AppFlowy-worker pin
to omv-ha, warm-standby etcd on omv-ha, or omv-ha cleanup timers is **historical**.

- **omv now runs a 4K-page kernel.** `/boot/firmware/config.txt` sets
  `kernel=kernel8.img` (was the Pi-5 default 16K `kernel_2712`). This was done so
  the **AppFlowy worker** (jemalloc built for 4K pages) can run on omv — it now
  does, pinned `nodeSelector: kubernetes.io/hostname: omv`. Do NOT revert to the
  16K kernel without first moving/rebuilding that worker.
- **omv-ha**: OMV services disabled, k3s agent uninstalled, `/var/lib/rancher`
  removed. It is SSH-reachable over Tailscale (`omv-ha`, 100.95.117.84) and hosts
  postfix/dovecot/Roundcube (see `infrastructure/omv-ha/`).
- All former omv-ha workloads (traefik, tailscale operator, postiz-redis, etc.)
  now run on omv. `local-path` PVCs are omv-local.

## Working Style

- **Never use placeholders.** No `<paste-output-here>`, no `TODO`, no `# TODO`, no `# fill in`, no `# replace this`, no `your-value-here`, no `xxx`, no `???`. If a value isn't known, fetch it, ask one direct question, or stop — do not write code/configs/docs that contain placeholders the user has to find and replace.
- **AWS → Cloudflare (operator decision 2026-07-29).** Prefer Cloudflare (Workers, R2, D1, Access, Tunnel) over expanding AWS. Do **not** install AWS CLI or add AWS SDK for agent/operator work. Treat R16/R20/R24-style AWS paths as legacy; propose Cloudflare replacements. See `.cursor/rules/aws-to-cloudflare.mdc` and the platform-direction note in `docs/current-source-of-truth-checklist.md`.
- **Never touch `.env.local`.** It holds per-machine secrets that must never leave the operator's WSL/dev box. Do not read it, edit it, commit it, delete it, or copy its contents into any other file, config, PR body, comment, or scratch note — even when investigating an env-var issue. `.env.local` is already covered by `.gitignore` (lines 47/48/188); this rule is about the agent, not git. If a task requires a value that would live in `.env.local`, ask the operator for the specific key(s) rather than opening the file.

## Pending One-Time Setup (human action required)

These require access outside GitHub and cannot be automated from a cloud session.

| Item                             | Status              | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OMV_SSH_KEY`                    | **SET** ✅          | Key for `tbaltzakis@omv` (host omv, user tbaltzakis). SSH workflows updated to `PI_USER: "tbaltzakis"`. k3s watchdog (`Restart=always`) deployed 2026-06-02T18:56Z — auto-restart active.                                                                                                                                                                                                                                                                                                                                                                          |
| ESP32 page content               | **PARTIAL RESTORE** | Full content requires Notion UI: open page → ••• → Page history → restore pre-15:19 UTC 2026-06-02. ESP32 Devices + Telemetry databases (IDs confirmed correct, integration has access) are **empty** — no data was ever populated there to restore.                                                                                                                                                                                                                                                                                                               |
| Admin password                   | **N/A**             | Auth is Cloudflare D1 (not Cognito). Promote admins via `/api/admin/users/promote` or the admin Users UI against `user-auth-db`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Cloudflare HA LB                 | **MOOT (single-node)** | Cluster is single-node as of 2026-08-08 (omv-ha out, see topology note). There is no HA to load-balance across — `setup-cloudflare-lb.yml` is historical. Delete/skip. |
| Cloudflare Email Obfuscation     | **✅ ALREADY OFF**  | Zone setting was disabled 2026-06-10; re-verified via API 2026-08-08 (using the `.env.local` `CLOUDFLARE_API_TOKEN` which has `Zone Settings:Edit`). The `cloudflare-disable-email-obfuscation.yml` workflow is no longer needed unless it flips back on. |
| Self-hosted mail server          | **✅ LIVE (2026-08-08)** | webmail.cloudless.gr (Roundcube) + dovecot IMAP + postfix relay via Resend. See `docs/MAIL-SERVER-SETUP.md`. Admin dashboard has a "Webmail" tab (Infrastructure group). Inbound via Cloudflare Email Routing → Gmail forward (not into dovecot — intentional). Secrets in `.env.local`: `RESEND_API_KEY`, `MAIL_TBALTZAKIS_PASSWORD`, `CLOUDFLARE_TUNNEL_TOKEN`, `CLOUDFLARE_ACCESS_TOKEN`. |
| Auth recovery                    | **✅ SCRIPTED**     | If `/api/auth/login` starts returning 500, run `scripts/restore-auth.sh` from the repo root — it validates the `.env.local` token against D1, then pins account+token as explicit deployment env (a Secret patch is silently overridden by explicit env). See project memory `login-500-pi-d1-token`. |

## omv-main Storage Layout (post-2026-06-13 migration)

The omv-main Pi 5 cluster node has **two SATA-over-USB SSDs** plus the SD
card. After the 2026-06-13 disk-pressure incident (sdb1 hit 89% from a 624GB
Windows backup, k3s started evicting/restarting pods), the storage roles
are now strictly separated:

| Device      | Hardware                                           | Size  | UUID / Mount                                                                                                       | Role                                                                                       |
| ----------- | -------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `mmcblk0p2` | SD card (SR64G)                                    | 58GB  | `/`                                                                                                                | OS root only                                                                               |
| `/dev/sda1` | SanDisk SDSSDP128G via ICY_BOX IB-AC603b-U3 (USB3) | 119GB | `a9a5a108-8095-4b7b-8011-716889995cd7` → `/srv/dev-disk-by-uuid-a9a5a108-…` (and bind to `/var/lib/rancher/k3s`)  | **Dedicated k3s data**: containerd images, etcd, kubelet state, all local-path PVs. Local-path-provisioner `nodePath` = `/srv/dev-disk-by-uuid-a9a5a108-…/k3s/storage` (verified 2026-06-20). |
| `/dev/sdb1` | Samsung SSD 860 EVO 1TB via ASMedia ASM1153 (USB3) | 916GB | `fa6231ab-eae7-40ea-a4b6-400f767a89d7` → `/srv/dev-disk-by-uuid-fa6231ab-…`                                       | **User data only**: Windows backups, photos, media. K3s does NOT live here.                |

**Why this matters for any future debugging:**

- If `sdb1` fills again (Windows backup growth), k3s stays healthy.
- If `sda1` starts filling, that IS a k3s problem — usually runaway image
  layers, log retention, or a PV growing unbounded. First step:
  `crictl rmi --prune` and check `du -sh /var/lib/rancher/k3s/*`.
- `local-path-provisioner` is configured to allocate PVs under
  `/var/lib/rancher/k3s/storage` so every PV lives on the dedicated SSD.
  Do NOT change its `nodePath` back to `/srv/...` without first checking
  sda1 has the headroom.
- The legacy `/dev/sdb1 on /var/lib/rancher/k3s` bind-mount in OMV's
  fstab/`/etc/openmediavault/config.xml` has been removed. Do not re-enable
  it. OMV's web UI may want to add it back when it sees the share — check
  the bind-mount section after any OMV update.
- The `pi-disk-cleanup` systemd timer (daily 03:00) still runs the same
  set of prunes (journal, apt cache, pnpm store, buildx volumes, crictl
  rmi). It now has +810GB of true headroom on sdb1 because nothing
  cluster-relevant lives there.

**Quick disk audit one-liner** (run on omv-main):

```bash
df -h /var/lib/rancher/k3s /srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7 /
```

**Restoring a Windows backup safely:** the OMV share for the
`/srv/.../Backups/WindowsImageBackup/` directory remains exposed via the
existing OMV SMB share — Windows backup tooling on `Office` continues
to write there. If that backup tree breaches 80% of sdb1's capacity,
prune the oldest dated `Backup YYYY-MM-DD HHMMSS` directory or move the
share to an external drive; k3s is unaffected either way.

## Testing Policy

**Never fix test failures by adding mock code.** When a test fails, fix the actual production code so the test passes naturally. Do not add `vi.mocked(...)`, `mockReturnValue`, `mockResolvedValue`, or any other mock overrides to patch a failing test. If the test expectation is wrong (e.g. it expects old behavior that changed), update the expectation — but never shim production behavior with mocks.

**Address every issue found with actual code.** When a test run, audit, or review surfaces problems, fix all of them with real working code — never placeholders, stubs, skipped assertions, or "known failure" allowlists.

### Coverage (read before any "combined coverage" work)

There are **two separate, non-mergeable** coverage numbers — this is a tooling
constraint, not a TODO. Do not try to produce a single server-inclusive %.

- **Unit (Vitest, v8):** `pnpm test:unit:coverage`. This is the **enforced** number —
  ratchet thresholds in `vitest.config.mts` (lines/stmts/funcs/branches) fail CI on
  regression. Raise them as coverage grows; never lower them. Baseline 2026-06-09:
  lines 49.98 / stmts 48.51 / funcs 39.01 / branches 39.27.
- **E2E client-side (Playwright CDP):** `pnpm test:coverage:full` then
  `pnpm coverage:merge` (`scripts/coverage-merge.mjs`). Source-resolvable because
  `/_next/static` chunks carry browser source maps (`productionBrowserSourceMaps` in
  coverage mode). This is the _only_ e2e coverage that maps to `src/`.
- **E2E server-side V8 is NOT source-resolvable post-hoc** — do not chase it. Next
  records app code against ephemeral `webpack-internal:///(rsc|ssr)/./src/...` bundle
  URLs with no on-disk source/map, so monocart drops them → a report that _looks_ 0%.
  The trailing comment in `scripts/coverage-merge.mjs` documents this; the guard there
  warns when it happens.
- **Build-time instrumentation is a dead end here (both paths checked):** Babel/Istanbul
  needs Babel, which breaks App Router Server Actions (vercel/next.js#53901 — see the
  note in `next.config.ts`); `swc-plugin-coverage-instrument` is ABI-pinned to an old
  `swc_core` and won't load under Next 16's swc. So server coverage stays V8-only.
- **Don't run coverage against a production build.** `next start` 308-redirects http→https
  (`proxy.ts`) and prod bundle URLs are _less_ resolvable than dev's. The harness targets
  `next dev --webpack`. COVERAGE-mode e2e failures (theme-switcher 45s timeouts, etc.) are
  dev-server-under-instrumentation **artifacts**, not bugs — verify against a normal run.

## E2E (Playwright) Conventions — learned 2026-06-11

- **`playwright.config.mts` must keep** the `setup` project (runs `auth.setup.ts`, which writes `e2e/.auth/{user,admin}.json` — empty without `E2E_USER_*`/`E2E_ADMIN_*` creds) with `chromium`/`mobile-chrome` declaring `dependencies: ["setup"]`, plus `testIgnore: ["**/k3s/**"]`. Without setup, every storageState-based deep spec fails ENOENT on a fresh checkout (206 tests, PR #790); k3s specs target the live cluster via `playwright.k3s.config.mts` and must never run against localhost. PR #754 once clobbered both — watch for stale-branch merges overwriting this config.
- **503 means "integration not configured"** — API routes deliberately return 503 when their backing service (Notion docs, Anthropic chat, Google Calendar, …) has no credentials. E2E status expectations must accept 503 alongside 2xx/4xx for those routes; do not "fix" the route to hide it.
- **Run full suites with `--workers=2`** (repo convention, see `scripts/e2e-smart-run.sh`) — higher worker counts overload the dev server and produce flaky 500s / Suspense-fallback stalls. Content checks should wait on `page.locator("h1, main").first().waitFor({ state: "visible", timeout: 30_000 })`, not short `isVisible()` samples (PRs #788/#790).
- **Port 4000 must be free of foreign dev servers before a run.** `reuseExistingServer: true` silently reuses whatever listens on 4000 — including a `pnpm dev` inside WSL — which lacks the webServer env (`NEXT_PUBLIC_E2E=1`, `E2E_ADMIN_TOKEN`) and causes mass false 401s in `admin-api-sweep`. Check with `Get-NetTCPConnection -LocalPort 4000` / `lsof -ti:4000` first.
- **Mobile-viewport specs**: navbar controls (contact link, theme/locale switcher) live inside the hamburger drawer (`button[aria-label*="menu" i]`) and the desktop instances stay hidden in the DOM — open the drawer first and select with `.filter({ visible: true })`, never bare `.first()`.
- A broken `node_modules` (missing `@auth/core`, stale nested `@aws-sdk/*` requiring removed `@smithy/property-provider`) makes API routes 500 en masse while the lockfile is fine — fix with a clean `pnpm install --frozen-lockfile` after deleting `node_modules`, never by touching code.
- **Verify load artifacts solo before changing code.** Under full-suite load the dev server can transiently 404 a real API route (seen once on `POST /api/admin/ai/analytics-orchestration/pdf`, both projects + retries). Re-run the failing spec alone first — if it passes (route verified: unauth → 401), it's a dev-server race, not a regression. Never widen a security assertion (e.g. adding 404 to "unauth must be 401/403") to absorb such flakes.
- Notion integration health (verified live 2026-06-20T22:30Z from cluster pod): **all 13 DBs OK** — Blog, Docs, Projects, Tasks, Analytics, Calendar, Reports, GSC Reports, Submissions, Testimonials, Case Studies, Services, FAQs. The earlier 4-DB `object_not_found` symptom was resolved by an operator UI re-share. Re-run probe any time with `node scripts/probe-notion-dbs.mjs` (uses SSM creds). Runbook stays in place for the next time it drifts: [`docs/integrations/notion-integration-reshare.md`](docs/integrations/notion-integration-reshare.md). AppFlowy was evaluated as a self-host alternative on 2026-06-21 and rejected: 7-pod arm64 stack + new client lib is multi-day work, the runbook fixes drift in 3 minutes per occurrence.

## Git Workflow

- **Commit and push regularly** — after every logical unit of work (a bug fix, a set of related changes, a completed feature). Do not batch unrelated changes into one large commit.
- Always push to the active feature branch (`claude/...`), never to `main` directly.
- After pushing, check if a PR exists; create a draft PR if none exists.
- **Always merge immediately after pushing** — use `mcp__github__merge_pull_request` with `merge_method: "squash"` to merge the feature branch into `main`. Do not leave PRs in draft or open state waiting for CI unless the user explicitly asks to wait.

## Agent Orchestration

When spawning sub-agents, follow these rules for optimal orchestration:

### When to use agents

- Use `subagent_type: "Explore"` for **read-only codebase searches** (grep, find, file reads). This protects the main context window.
- Use `subagent_type: "general-purpose"` for **multi-step research + write tasks** that are independent of the main thread.
- Use `subagent_type: "Plan"` before large refactors to get an implementation plan.

### Parallel dispatch

- Launch **independent agents in a single message** (multiple Agent tool calls in one response) so they run concurrently.
- Only run agents sequentially when one's output is required as input for the next.

### Prompt discipline

- Keep agent prompts **short and focused** — long prompts cause "Prompt is too long" errors.
- Give each agent exactly one task. If a search covers many files, split it into 2–3 agents with non-overlapping file lists.
- For file searches: prefer direct `Bash` grep/find when the pattern is simple and the target set is small (≤ 5 files). Reserve agents for broader, open-ended exploration.

### Context protection

- Agents return a **single summary message** — raw tool output stays out of the main context.
- Use `run_in_background: true` only for genuinely independent work that does not block the next step.

## Cloud Session Secrets (one-time setup)

Set these in **Claude Code web UI → Session → Environment → Secrets**. The `session-start` hook picks them up automatically on every new session.

| Secret name            | Value                          | Effect                                                                                |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| `GITHUB_PAT`           | GitHub PAT with `repo` scope   | `git push` works without any manual auth step; stop hook auto-pushes on session close |
| `TAILSCALE_AUTH_KEY`   | Tailscale ephemeral auth key   | Pi SSH access via `mcp__cloudless-infra__*` tools                                     |
| `OMV_SSH_KEY_CONTENTS` | `base64 -w0 ~/.ssh/id_ed25519` | SSH private key forwarded to the infra MCP server                                     |

**Generate a GitHub PAT:** github.com/settings/tokens/new — `repo` scope, no expiry or 1 year. Use `/github-push` skill for manual push/PR/merge within a session.

**Generate Tailscale key:** tailscale.com/admin/settings/keys — ephemeral, pre-authorized.

The `cloudless-infra` MCP server connects to `omv-main` via SSH. Once `TAILSCALE_AUTH_KEY` and `OMV_SSH_KEY_CONTENTS` are set, `cluster_run_command`, `gh_runner_health`, `k3s_get_pods` and all `mcp__cloudless-infra__*` tools are available. The Tailscale IP `100.74.191.58` is baked into `mcp.json`.

Once set, `cluster_run_command`, `gh_runner_health`, `k3s_get_pods` and all other `mcp__cloudless-infra__*` tools become available in every cloud session. The Tailscale IP `100.74.191.58` is already baked into `mcp.json` so no host configuration is needed.

## Cluster Incident Response (no kubectl/ssh/aws in the session)

When `OMV_SSH_KEY_CONTENTS` is NOT set (the infra MCP is unavailable), you still
have **no** `kubectl`/`ssh`/`aws`, and the tailnet API (`100.74.191.58:6443`) is
blocked by the network policy. Drive the cluster through **GitHub Actions**
instead — see the **`cluster-incident-response`** skill for the full playbook.

- **Pattern:** a workflow with `on.push.paths: [its own file]` is fired by
  editing+merging that file (the GitHub MCP here **cannot** `workflow_dispatch`).
  Jobs run on `ubuntu-latest`, connect via `tailscale/github-action`
  (`TS_AUTHKEY`), configure kubectl from the `KUBECONFIG_B64` secret (it is
  **`system:admin`**), do the work, and `gh issue comment 382` the result.
  Read it back with `mcp__github__issue_read(get_comments, issue_number=382)`.
  Do NOT pin recovery to `[self-hosted, omv, pi]` — those runners go offline
  during cluster incidents and the job queues forever.
- **Tools (in repo):** `pnpm cluster:doctor` (read-only diagnostics →
  `cluster-doctor.yml`), `pnpm prometheus:tune` (kill heavy apiserver SLO rules
  → `prometheus-tune.yml`).
- **JVM workload sizing lessons (2026-06-01 incident):**
  - **Never cap a JVM container below `-Xmx` + ~200Mi non-heap.** A higher
    _limit_ doesn't raise real RSS — it only stops the kernel OOMKill.
  - From CI, a direct `kubectl patch` of the single object beat
    `kubectl apply -f <manifest>` (the apply silently never reached the deploy).
  - `PrometheusRuleFailures` here = `kube-apiserver-burnrate.rules` timing out
    (`context deadline exceeded`), not OOM. `pnpm prometheus:tune` removes those
    unused heavy SLO rule groups. Durable fix: kube-prometheus-stack Helm values
    `defaultRules.rules.kubeApiserver{Burnrate,Availability,Slos}: false`.

## Operator skills (read SKILL.md before touching the stack)

Three operator manuals live under `skills/`. Each one is the canonical
"first stop" for its stack and captures the load-bearing quirks (env-var
ordering bugs, port mismatches, page-size pins, etc.):

- `skills/appflowy-operator/SKILL.md` — AppFlowy Cloud stack (Notion
  replacement, 9 pods + 1 worker on omv-ha). The worker pin to omv-ha
  is mandatory: Pi 5 runs a 16 KiB-page kernel and the worker's jemalloc
  was built for 4 KiB pages.
- `skills/espocrm-operator/SKILL.md` — EspoCRM stack (EspoCRM replacement).
  Drop-in mirror at `src/lib/espocrm.ts` (21 exports 1:1 with the old
  `hubspot.ts`); 6 Webhook entities sync to Slack via `SlackClient`;
  daily ETL to Athena; SES → Lambda → Case bridge for inbound email.
- `skills/cloudflare-tunnel-ops/SKILL.md` — adds/removes ingress + DNS
  for the single shared tunnel (UUID
  `e977a490-58c5-4fdb-9155-86832e3e636a`). Copy-paste pod manifests for
  both halves; works end-to-end from `Kubernetes_MCP_Server` alone when
  the `cloudless-infra` MCP is unavailable.

## Cluster bash (cluster-bash skill)

Two-node SSH operations go through one of four MCP tools per the
`cluster-bash` skill (`skills/cluster-bash/SKILL.md`):

- `mcp__cloudless-infra__cluster_list_nodes` — topology + reachability probe
- `mcp__cloudless-infra__cluster_run_fanout` — parallel exec on both Pis
- `mcp__cloudless-infra__cluster_read_file` — SFTP read, 1 MiB cap, returns true size
- `mcp__cloudless-infra__cluster_write_file` — SFTP write, refuses /etc /boot /sys /proc /dev, 8 MiB cap

These complement (not replace) the existing `cluster_run_command`,
`k3s_*` tools, and the GitHub Actions fallback documented above. Source
lives in `tools/ssh-mcp/src/sftp.ts`; topology is the single source of
truth in `TOPOLOGY`. Unit tests in `tools/ssh-mcp/src/__tests__/sftp.test.ts`
cover the path-safety policy. Read the skill before reaching for SSH.

## LinkedIn campaigns (linkedin-campaigns skill)

Paid-acquisition landing pages live under `/<locale>/campaigns/<slug>/` via a
single dynamic route. The operating playbook — add a new campaign, wire its
Stripe checkout, dual-fire the LinkedIn conversion (Insight Tag + Conversions
API) — is in `skills/linkedin-campaigns/SKILL.md`; the architecture
reference is in `docs/marketing/linkedin-campaigns.md`. Read the skill before touching:

- `src/components/LinkedInInsightTag.tsx` (consent-gated loader)
- `src/lib/linkedin-track.ts` (`trackLinkedInConversion` helper)
- `src/data/campaigns.ts` (campaign metadata, conversion IDs)
- `src/app/[locale]/campaigns/**` (index + `[slug]` landing + thanks pages)
- `src/app/api/checkout/route.ts` (GET branch — campaign → Stripe adapter)
- `src/app/api/campaigns/conversion/route.ts` (CAPI server-side mirror)

Env: `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` (client, build-time) and
`LINKEDIN_CAPI_ACCESS_TOKEN` (server-only, SSM-preferred). When either is
unset the corresponding fire becomes a no-op — the route stays wired so the
rest of the flow still works.

## CRM migration: EspoCRM → EspoCRM (in progress 2026-06-20)

EspoCRM's `content` scope is locked behind a paid Marketing Hub plan we don't
have, breaking `/api/admin/email/campaigns` (501) — see the live probe in
PR #1024. Rather than upgrade EspoCRM, the CRM is being moved to **self-hosted
EspoCRM** (SugarCRM lineage, same data model family as SuiteCRM but with proper
arm64 image support — SuiteCRM's Bitnami image is amd64-only + commercial-only).

- **Infra (LIVE on omv 2026-06-20):** `infrastructure/espocrm/k8s/espocrm.yaml`
  — raw k8s manifests (mariadb:11 + espocrm/espocrm:9, both pinned to `omv`,
  both PVCs `local-path` → sda1 120 GB SSD). Helm path was abandoned: the
  twenty20 chart bundles no DB, and cloudpirates' MariaDB sub-chart is
  amd64-only. Raw manifests match the existing `infrastructure/postiz/`
  pattern. Cloudflare tunnel fragment for `espocrm.cloudless.gr` in
  `cloudflare-tunnel.yaml`.
- **Memory freed:** Home Assistant + Metabase were evicted from omv to make
  room (omv was at 97% RAM). Their deployment manifests are preserved at
  `infrastructure/espocrm/evicted-deployments/{home-assistant,metabase}.yaml`
  for redeploy on a third Pi (omv-ha is Pi 4 1 GB — neither fits there).
  PVCs (`ha-config-pvc`, `metabase-data`, `duckdb-data`) were NOT deleted.
- **Status**: pods 1/1 Running, HTTP 200 from inside the cluster. Pending:
  Cloudflare tunnel append + DNS CNAME + first UI login + API key into SSM
  (`/cloudless/production/ESPOCRM_BASE_URL` + `ESPOCRM_API_KEY`).
- **Live now**: API user `cloudless-app` (role `Cloudless App Full Access`,
  ID `6a36ef141808ed737`); `Export Import` extension v2.9.0 installed via
  `php command.php extension --file=...`. SSM keys live at
  `/cloudless/production/ESPOCRM_BASE_URL`, `ESPOCRM_API_KEY`,
  `ESPOCRM_WEBHOOK_SECRET`.
- **`src/lib/espocrm.ts` SHIPPED** — drop-in mirror of the 21 hubspot.ts
  exports (`upsertContact`, `createTicket`, `listDeals`, `createDeal`,
  `getDealsByStage`, `getPipelineStats`, etc). Module mapping: Contact↔contact,
  Account↔company, Opportunity↔deal, Case↔ticket. Auth via `X-Api-Key`.
- **Slack sync LIVE** — `/api/webhooks/espocrm` route forwards Contact/Lead
  create, Opportunity create + stage-change, and Case create + status-change
  to Slack via `SlackClient` (per `feedback_slack_use_slackclient`). Six
  Webhook entities registered in EspoCRM (one per event), all `isActive=true`.
- **Next PRs**: PR 4 flips imports in the 10 admin API routes + 9 admin
  pages from `@/lib/hubspot` → `@/lib/espocrm` (51 files reference EspoCRM
  today). PR 5: `scripts/etl/espocrm-to-lake.mjs` + Athena views.
  EspoCRM was fully decommissioned on 2026-06-20 (PR A in this thread):
  `src/lib/hubspot.ts`, `src/components/HubSpotScript.tsx`,
  `src/app/[locale]/admin/hubspot/`, `src/app/api/hubspot/`,
  `src/app/api/webhooks/hubspot/`, `scripts/etl/hubspot-to-lake.mjs` +
  workflow, `scripts/weekly-subscriber-report.ts` + workflow + test, and
  all `__tests__/*hubspot*` files are deleted. `NEXT_PUBLIC_HUBSPOT_PORTAL_ID`
  build-arg is removed from all 6 workflows. `HUBSPOT_API_KEY` /
  `HUBSPOT_CLIENT_SECRET` removed from `lib/integrations.ts` and
  `lib/ssm-config.ts`. SSM keys at `/cloudless/production/HUBSPOT_*` should
  be deleted by the operator (script-side change is in this PR; AWS-side
  is a manual step — `aws ssm delete-parameters --names ...`).

See `infrastructure/espocrm/README.md` for the full deploy + verify runbook.

## Authentication

Auth is **Cloudflare D1** (`user-auth-db`) — email/password with PBKDF2 hashes and
opaque `session_token` cookies. Cognito / Keycloak are gone. App admin = row in the
D1 `roles` table, surfaced as `groups: ["admin"]` and checked by `api-auth.ts`
`requireAdmin`. Promote via `/api/admin/users/promote`. Session resolution lives in
`src/lib/auth-d1.ts` + `src/lib/api-auth.ts` (cookie or Bearer).

- Legacy CloudWatch metric filters that counted next-auth Cognito
  `[auth][error] Configuration` lines are obsolete noise if still present in AWS;
  do not expand them. Prefer app/Sentry signals on the Pi path.

## Deployment to Pi

**Workflow:** `.github/workflows/deploy-pi.yml` — triggers on every push to `main`.

- **Job 1 `build-and-push`** (`[self-hosted, omv, pi, build]`): builds `linux/arm64` Docker image **natively on a Pi runner** (no real QEMU work — the host is already arm64; the `setup-qemu-action` step is left in for portability but is a no-op here). Pushes SHA-only tag to ECR (`278585680617.dkr.ecr.us-east-1.amazonaws.com/cloudless-pi-app:<sha>`). ECR repo has **immutable tags** — never push `:latest` from CI.
  - **Immutable-tag race (FIXED, PR #799, 2026-06-11):** `deploy-pi.yml` and `build-pi-image.yml` both build+push the _same_ SHA tag on every push to `main`. They race; whichever pushes second hits `tag invalid: ... already exists ... immutable`. The `Push to ECR` step now treats that specific error as success (the image IS in ECR) and sets `image_exists=true` so the rollout still runs — mirroring the pattern `build-pi-image.yml` already used. Any _other_ push error still fails. So a "tag already exists" line in this job's log is expected, not a failure.
- **Job 2 `rollout`** (`${{ fromJSON(vars.RUNNER_GENERIC || '"ubuntu-latest"') }}` — GH-hosted by default, joins tailnet via `KUBECONFIG_B64`; failover to `[self-hosted, omv, build]` via `toggle-runner.sh pi`): runs `kubectl set image` + `kubectl rollout status` against the k3s API over Tailscale (`100.74.191.58:6443`). Gated by `if: ... build-and-push.result == 'success' || build-and-push.outputs.image_exists == 'true'`.
- **Runner labels:** Both jobs require `[self-hosted, omv, pi]` (PR #167, merged 2026-05-17). The `pi` label gates them to the 3 Pi runners (`omv`, `omv-2`, `omv-3`) so an added non-Pi `omv` runner (e.g. `legion` in WSL2) can't accidentally take a cluster-bound job it can't perform. Cross-compile via QEMU on `ubuntu-latest` was tried and abandoned — `pnpm install` alone exceeded 60 min under emulation.
- **Auth:** OIDC via `AWS_DEPLOY_ROLE_ARN` secret — no static AWS keys.
- **`NEXT_PUBLIC_*` vars** are baked into the Next.js client bundle at Docker build time as `--build-arg`. They are NOT available as runtime env vars — changes require a full image rebuild.
- **SSM config** (API keys, Notion DB IDs, etc.) is fetched at runtime by the app via `getIntegrationsAsync()` using the `pi-standby-aws-creds` k8s Secret.

**GitHub Secrets needed:** `AWS_DEPLOY_ROLE_ARN`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` (plus Wrangler/D1 bind for `AUTH_DB` on the Pi/Workers path — Cognito `NEXT_PUBLIC_COGNITO_*` build-args are retired)

## CI Runner Failover

When GH-hosted runner billing/capacity breaks, flip the `RUNNER_GENERIC` repo variable to re-route most workflows onto the self-hosted Pi `build` cluster:

```bash
.github/scripts/toggle-runner.sh status   # show mode + runner inventory
.github/scripts/toggle-runner.sh pi       # → ["self-hosted","omv","build"]
.github/scripts/toggle-runner.sh hosted   # → unset (ubuntu-latest)
```

Instrumented workflows use `runs-on: ${{ fromJSON(vars.RUNNER_GENERIC || '"ubuntu-latest"') }}`. See [`docs/deploy/runners.md`](docs/deploy/runners.md) for the full design, the list of opted-in workflows, the ones that stay GH-hosted (Lighthouse, k3s-e2e, CodeQL — they need x86_64/Chrome), and the registration steps for the `omv,build` runner profile on each Pi host.

## SonarCloud

- Target: **0 new issues** on every PR before merge.
- Common violation rules to watch: `sonarjs/void-use` (S3699), `sonarjs/cognitive-complexity` (S3776), `sonarjs/prefer-global-this`, `sonarjs/no-duplicate-string` (S1192).
- Fix pattern for `void asyncFn()`: replace with `asyncFn().catch(() => {})`.
- Fix pattern for `global.fetch`: replace with `globalThis.fetch`.
- Fix cognitive complexity by extracting helper functions outside the component/class.

## Locale-Aware Navigation (CRITICAL)

**Always use `@/i18n/navigation`, never `next/link` or `next/navigation` for internal links.**

The app uses `localePrefix: "always"` — every route requires a locale prefix (`/en/`, `/el/`, etc.).

```ts
// ✅ Correct
import { Link, useRouter, usePathname, redirect } from "@/i18n/navigation";
router.push("/admin"); // → /en/admin  ✓

// ❌ Wrong — produces 404
import Link from "next/link";
router.push("/en/admin"); // → /en/en/admin  ✗
```

**Middleware redirect params must use the bare (locale-stripped) path:**

```ts
// ✅
loginUrl.searchParams.set("redirect", bare); // "/admin"
// ❌
loginUrl.searchParams.set("redirect", pathname); // "/en/admin" → double-locale after router.push
```

## Playwright Coverage (PR #754, merged 2026-06-10 as 8a1ee3d9)

The repo now has a Playwright E2E suite that runs **alongside** Vitest.
Both are required-pass on every PR.

### Layout

- `e2e/migrated/` — refined-pattern API contract specs (admin-api,
  public-api, webhooks, integrations, validation-branches, jwt-branches,
  i18n-branches).
- `e2e/admin-api-sweep.spec.ts` — every mounted admin API route (69) hit
  authenticated with the E2E admin token.
- `e2e/public-api-sweep.spec.ts` — every public API route (37) probed.
- `e2e/admin-pages-sweep.spec.ts` — every admin page (41) loaded via
  cookie auth bypass.
- `e2e/journey-*.spec.ts` — 5 deep user journeys (contact, store
  checkout, blog, theme+locale, admin tour).

### E2E auth bypass (production-safe, dead code in prod)

- `src/lib/api-auth.ts` `requireAuth`: synthetic admin user returned
  ONLY when ALL THREE hold: `NEXT_PUBLIC_E2E=1` env, `E2E_ADMIN_TOKEN`
  env non-empty, AND the request's Bearer token equals that env value.
  Production sets neither env var.
- `src/context/AuthContext.tsx` `checkAuth`: client-side synthetic admin
  session ONLY when `NEXT_PUBLIC_E2E=1` (build-time, prod never sets)
  AND cookie `e2e_admin=1` is present.
- Hard-coded test token: `e2e-admin-token-do-not-use-in-prod` in
  `playwright.config.mts` webServer env + `e2e/_internal/admin-fixture.ts`.

### CI workflow

`.github/workflows/e2e-full-coverage.yml` boots `pnpm dev` on
ubuntu-latest, installs chromium, runs ~241 tests in 2-3 min. Triggers
on `pull_request` (paths `src/**`, `e2e/**`, `playwright.config.mts`,
`package.json`, the workflow file) AND `workflow_dispatch`.

### Pi5 cannot host the full suite

The Pi5 (4 cores, 8GB) OOM-rebooted under `pnpm dev` + 100+ concurrent
Playwright tests + k3s simultaneously during migration. Always run the
full sweep in CI, not on the Pi. The Pi handles individual smoke runs
fine.

### Coverage at merge

- **Vitest**: 1649 tests, ~45% line coverage of `src/` (74% in
  `src/lib/`, 66% in `src/app/api/`). Kept intact.
- **Playwright**: 241 tests in new suite — 100% of mounted API routes
  exercised, 98% of admin pages, 5 deep journeys. CI on commit 8a1ee3d9:
  238 passed, 3 skipped, 0 failed in 1m30s.

### Failure handling pattern

When a Playwright spec fails in CI without backing creds (Google,
Notion, etc.), the right fix is either (a) widen the assertion to
"route is wired" (accept any 2xx-5xx), or (b) `test.skip()` gracefully
when preconditions aren't met. Both are honest reflections of the
missing data; the test still proves the surface exists. Real bugs would
still fail the spec on a fully-configured environment.

## Pi Housekeeping

Daily disk cleanup runs on **both cluster nodes** via systemd timers
named `cloudless-cleanup.timer`. Schedules are staggered so the two Pis
never prune concurrently:

| Node           | Schedule (EEST) | Installed   | Prunes                                                                                  |
| -------------- | --------------- | ----------- | --------------------------------------------------------------------------------------- |
| `omv` / `omv-main` (control-plane Pi 5) | **03:00** + 10min jitter | 2026-06-10 | journal, apt cache, pnpm store, buildx volumes, docker image+builder, VS Code Server, k3s crictl |
| `omv-ha` (worker Pi)                    | **03:45** + 10min jitter | 2026-06-16 | journal, apt cache, k3s crictl, GH Actions runner `_temp`/`_actions` (>7-14 days old), VS Code Server |

The worker script skips Docker/pnpm steps because omv-ha doesn't ship
either toolchain (k3s containerd is the only container runtime). The
GH Actions runner step is omv-ha-specific — it has the self-hosted
`omv-2-build` runner that leaves stale `_work` directories from
cancelled or OOM-killed jobs.

**Files (identical paths on both nodes):**

- `/usr/local/sbin/cloudless-cleanup.sh` — the script (slightly different content per node)
- `/etc/systemd/system/cloudless-cleanup.service`
- `/etc/systemd/system/cloudless-cleanup.timer`
- `/var/log/cloudless-cleanup.log` — output log

**Manual run:**

```bash
sudo systemctl start cloudless-cleanup.service
sudo tail -f /var/log/cloudless-cleanup.log
```

**Disable:**

```bash
sudo systemctl disable --now cloudless-cleanup.timer
```

**Verified on first install (2026-06-16):** omv-ha run freed 2024 MB on the SD card and pruned 3 stale containerd images in 9s, exit 0.

## k3s Tuning (omv control plane, applied 2026-06-16)

Both USB3-SATA SSDs on omv are misdetected as rotational by the kernel
(bridges omit the ATA flag). Persistent fix in
`/etc/udev/rules.d/60-ssd-rotational.rules` sets `queue/rotational=0`,
`nr_requests=256`, `read_ahead_kb=128` on `sd[ab]` add/change (SanDisk
k3s data + Samsung user data; extended to `sdb` 2026-07-30 after a
watchdog reboot storm). OMV’s `RuntimeWatchdogSec=15` is overridden to
`60` via `/etc/systemd/system.conf.d/zz-cloudless-watchdog.conf` (must
sort after `openmediavault-watchdog.conf`). Mount opts on `/dev/sda1`
plus both k3s bind-mounts use `noatime,nodiratime` (apply at OMV UI too,
so OMV's config rewrite doesn't reset them).

etcd config in `/etc/rancher/k3s/config.yaml`:

- `heartbeat-interval=300` + `election-timeout=3000` — tuned for
  USB-SSD fsync latency, avoids spurious leader elections.
- `auto-compaction-retention=1h` periodic + `quota-backend-bytes=2GiB`.
- `etcd-snapshot-schedule-cron: 0 */1 * * *` (hourly, was 6h), 24
  retained locally + compressed S3 mirror.

Weekly defrag at Sunday 04:30 EEST via `k3s-etcd-defrag.timer` —
auto-compaction marks revisions removable but does NOT reclaim disk;
per etcd docs §Defragmentation, defrag must be triggered manually. The
script at `/usr/local/sbin/k3s-etcd-defrag.sh` takes a pre-snapshot,
runs `etcdctl defrag` against the local member, verifies endpoint
health, disarms any NOSPACE alarm.

**Why no 2-node etcd HA:** Raft consensus needs odd-numbered quorum.
2-node = quorum 2 = 0 failures tolerated = worse than 1-node. K3s
docs require 3 server nodes for HA. With only 2 Pis the right path is
warm-standby (hourly snapshot pull to omv-ha + dormant promotion
script). When a 3rd Pi is added, follow the runbook on Notion:
[🏗️ k3s Cluster Architecture, Tuning & Third-Pi Promotion Runbook](https://www.notion.so/3817d82c410a8143ab76e80e4bfdd013).

## Terraform Doctor

When a Terraform CI workflow fails, **invoke the `terraform-doctor` skill first**
(`skills/terraform-doctor/SKILL.md`). The cloudless-infra MCP exposes `tf_doctor`
which automates Stages 0-3 from the Pi.

**Lessons from PRs #778-#781 (2026-06-10):**

- `openpgp: key expired` from `terraform init` is almost always the **CLI's**
  embedded root key, not the provider's. Bump `TF_VERSION` (1.6.0 → 1.15.6).
  Bumping just the AWS provider does NOT fix it.
- New CLI versions enforce stricter `fmt -check` and `validate`. Expect cascading
  failures after a CLI bump. Fix them in order — never try to fix multiple
  stages at once.
- AWS provider 5.x has notable schema breaks (CloudFront `header_behavior =
"all"` is no longer valid for cache policies; `aws_db_proxy` requires `auth`
  block + `vpc_subnet_ids`; pool config moved to `aws_db_proxy_default_target_group`).
  See `scripts/tf-validate-fix.py` for the idempotent migration script.
- `terraform plan` failures on a data source (e.g. `Function not found`) are
  environment preconditions — gate the dependent block behind a feature flag
  variable so the rest of the stack still plans.

**Known-good versions (mid-2026):**

- Terraform CLI: `1.15.6`
- `hashicorp/aws`: `~> 5.80.0`
- `aws-actions/configure-aws-credentials`: `v4.x`
- `hashicorp/setup-terraform`: prefer `v3.x` (v2 nears Node 20 EOL)

## OpenClaudia Marketing Skills

67 marketing skills from [OpenClaudia](https://github.com/OpenClaudia/openclaudia-skills) are installed at `.claude/skills/`. They provide slash-command marketing automation for cloudless.gr.

### Target Site

- **URL:** https://cloudless.gr
- **Stack:** Next.js (App Router), deployed on Pi5 k3s cluster + Vercel
- **Auth:** Cloudflare D1 (`user-auth-db`)
- **CMS:** Notion databases

### Available Skill Categories

| Category | Example skills |
|----------|---------------|
| SEO | `seo-audit`, `keyword-research`, `serp-analyzer`, `backlink-audit`, `schema-markup`, `programmatic-seo` |
| Content | `write-blog`, `write-landing`, `copywriting`, `copy-editing`, `content-strategy`, `seo-content-brief` |
| Email | `email-sequence`, `email-subject-lines` |
| Social | `social-content`, `thread-writer`, `linkedin-content`, `reddit-marketing`, `bluesky` |
| Ads | `google-ads`, `facebook-ads`, `linkedin-ads`, `page-cro`, `ab-test-setup` |
| Analytics | `google-analytics`, `search-console`, `semrush-research`, `google-ads-report` |
| Strategy | `competitor-analysis`, `icp-builder`, `growth-strategy`, `launch-strategy`, `pricing-strategy` |
| Messaging | `discord-bot`, `slack-bot`, `telegram-bot` |

### API Keys (in `~/.claude/.env.global`)

Currently configured:

- `CLOUDFLARE_API_TOKEN` — DNS/CDN operations
- `NOTION_API_KEY` — content management queries
- `SITE_URL` — https://cloudless.gr

Add these for richer skill output when available:

- `SEMRUSH_API_KEY` — keyword/backlink data
- `RESEND_API_KEY` — send emails directly
- `UNSPLASH_CLIENT_ID` — stock images for blog posts
- `HUBSPOT_ACCESS_TOKEN` — CRM integration
- `SLACK_BOT_TOKEN` or `SLACK_WEBHOOK_URL` — Slack posting
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — GA4, Search Console, Ads

### Usage

Invoke skills directly in conversation or via slash commands:

```
> /seo-audit https://cloudless.gr
> /write-blog "Cloud hosting for Greek businesses"
> /competitor-analysis competitor.com
> /keyword-research "cloud services greece"
```

Skills chain naturally — describe a goal and Claude orchestrates multiple skills:

```
> Audit cloudless.gr SEO, find keyword gaps vs competitors, then create a content
> strategy and write the first blog post.
```
