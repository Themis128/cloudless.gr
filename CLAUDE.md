# Claude Code — Project Memory

## Pending One-Time Setup (human action required)

These require access outside GitHub and cannot be automated from a cloud session.

| Item | Status | Action |
|------|--------|--------|
| `OMV_SSH_KEY` | **SET** ✅ | Key for `tbaltzakis@omv` (host omv, user tbaltzakis). SSH workflows updated to `PI_USER: "tbaltzakis"`. k3s watchdog (`Restart=always`) deployed 2026-06-02T18:56Z — auto-restart active. |
| SES SMTP | **IAM BLOCKED** | `GitHubActionsOIDC` role lacks `iam:CreateUser`. AWS Console → IAM → role `GitHubActionsOIDC` → add inline policy (exact JSON in issue #382 comment 2026-06-02T18:55Z). Then touch `provision-ses-smtp.yml` to trigger. |
| ESP32 page content | **PARTIAL RESTORE** | Full content requires Notion UI: open page → ••• → Page history → restore pre-15:19 UTC 2026-06-02. ESP32 Devices + Telemetry databases (IDs confirmed correct, integration has access) are **empty** — no data was ever populated there to restore. |
| Admin password | **PENDING VERIFICATION** | `keycloak-finalize-admin.yml` re-ran 2026-06-02T19:09Z with fixed exec pattern. Check issue #382 for new `PERM_LOGIN` credentials. Login at https://auth.cloudless.gr with `tbaltzakis@cloudless.gr` + password from latest finalize-admin comment. |
| Cloudflare HA LB | **TOKEN NEEDED** | `setup-cloudflare-lb.yml` (merged PR #548) needs `CLOUDFLARE_API_TOKEN` — add as repo secret or SSM `/cloudless/production/CLOUDFLARE_API_TOKEN` with scopes: Zone:Read, Load Balancing Monitors/Pools+Load Balancers:Edit, DNS:Edit (zone cloudless.gr). Then `workflow_dispatch` or touch the workflow to apply. |

## Testing Policy

**Never fix test failures by adding mock code.** When a test fails, fix the actual production code so the test passes naturally. Do not add `vi.mocked(...)`, `mockReturnValue`, `mockResolvedValue`, or any other mock overrides to patch a failing test. If the test expectation is wrong (e.g. it expects old behavior that changed), update the expectation — but never shim production behavior with mocks.

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

| Secret name           | Value                                    | Effect                                              |
|-----------------------|------------------------------------------|-----------------------------------------------------|
| `GITHUB_PAT`          | GitHub PAT with `repo` scope             | `git push` works without any manual auth step; stop hook auto-pushes on session close |
| `TAILSCALE_AUTH_KEY`  | Tailscale ephemeral auth key             | Pi SSH access via `mcp__cloudless-infra__*` tools   |
| `OMV_SSH_KEY_CONTENTS`| `base64 -w0 ~/.ssh/id_ed25519`           | SSH private key forwarded to the infra MCP server   |

**Generate a GitHub PAT:** github.com/settings/tokens/new — `repo` scope, no expiry or 1 year. Use `/github-push` skill for manual push/PR/merge within a session.

**Generate Tailscale key:** tailscale.com/admin/settings/keys — ephemeral, pre-authorized.

The `cloudless-infra` MCP server connects to `omv-main` via SSH. Once `TAILSCALE_AUTH_KEY` and `OMV_SSH_KEY_CONTENTS` are set, `cluster_run_command`, `gh_runner_health`, `k3s_get_pods` and all `mcp__cloudless-infra__*` tools are available. The Tailscale IP `100.113.41.119` is baked into `mcp.json`.

Once set, `cluster_run_command`, `gh_runner_health`, `k3s_get_pods` and all other `mcp__cloudless-infra__*` tools become available in every cloud session. The Tailscale IP `100.113.41.119` is already baked into `mcp.json` so no host configuration is needed.

## Cluster Incident Response (no kubectl/ssh/aws in the session)

When `OMV_SSH_KEY_CONTENTS` is NOT set (the infra MCP is unavailable), you still
have **no** `kubectl`/`ssh`/`aws`, and the tailnet API (`100.113.41.119:6443`) is
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
- **Tools (all in repo):** `pnpm cluster:doctor` (read-only diagnostics →
  `cluster-doctor.yml`), `pnpm keycloak:smoke` (login/registration surface),
  `pnpm keycloak:restore` (direct-patch recovery → `restore-keycloak.yml`),
  `pnpm prometheus:tune` (kill heavy apiserver SLO rules → `prometheus-tune.yml`),
  `pnpm keycloak:create-user` / `pnpm keycloak:enable-signup` (user provisioning →
  `keycloak-create-user.yml` / `keycloak-full-verify.yml`; see the
  **`keycloak-user-provisioning`** skill).
- **2026-06-01 incident:** the 2026-05-31 memory-relief PR OOM-capped Keycloak
  (384Mi container vs its real `-Xmx512m` heap) → CrashLoop → `auth.cloudless.gr`
  503, login/registration down ~8h. Fix: size the container to the heap
  (768Mi limit). Lessons baked into the skill:
  - **Never cap a JVM container below `-Xmx` + ~200Mi non-heap.** A higher
    *limit* doesn't raise real RSS (~500Mi) — it only stops the kernel OOMKill.
  - Keycloak's operative heap var is **`JAVA_OPTS_APPEND`**, not
    `JAVA_OPTS_KC_HEAP`. Verify via the doctor's deploy `env` dump.
  - From CI, a direct `kubectl patch` of the single object beat
    `kubectl apply -f <manifest>` (the apply silently never reached the deploy).
  - Test login with the real **POST + CSRF** flow → `302` to Keycloak with
    `code_challenge_method=S256`. `error=Configuration` on a bare **GET** to
    `/api/auth/signin/keycloak` is a test artifact, not a bug.
  - `PrometheusRuleFailures` here = `kube-apiserver-burnrate.rules` timing out
    (`context deadline exceeded`), not OOM. `pnpm prometheus:tune` removes those
    unused heavy SLO rule groups. Durable fix: kube-prometheus-stack Helm values
    `defaultRules.rules.kubeApiserver{Burnrate,Availability,Slos}: false`.

### Keycloak users & the `ServerlessErrors` alarm

- **Self-service registration** was OFF on the `master` realm (users are
  admin-provisioned). 2026-06-01 it was turned **ON**
  (`registrationAllowed=true` + `resetPasswordAllowed` + `loginWithEmailAllowed`)
  so the website "Create Account" / forgot-password flows work. Toggle with
  `pnpm keycloak:enable-signup` (`ENABLE=false` reverts).
- **Provision users** with `pnpm keycloak:create-user` (`EMAIL=…`, `ADMIN=1` for
  the admin group). It runs `kcadm` **inside the keycloak pod** so the admin
  password never leaves the cluster. The keycloak image has **no `curl`** and **no
  `awk`/`jq`**, so verify a login with `kcadm config credentials` (direct grant as
  the user via `admin-cli`) and parse kcadm output with `--format csv --noquotes` +
  grep/cut. App admin = **`admin` group membership**, surfaced via the `groups`
  claim — which requires a **group-membership protocol mapper on the `cloudless-app`
  client** with **`full.path=false`** (a `full.path=true` emits `"/admin"` and
  silently breaks `isAdmin()`).
- **Admin login chain** (must all hold): `admin` group → user membership →
  `groups` mapper on `cloudless-app` (full.path=false, id+access claims) →
  `auth.ts` jwt+session callbacks → `proxy.ts` (server) + `AdminLayoutClient`
  (client, via `/api/auth/session`) + `api-auth.ts requireAdmin`. Configure it:
  - `pnpm keycloak:configure-admin` — ensure group + verify/fix the mapper +
    membership; sets the password from the `ADMIN_BOOTSTRAP_PASSWORD` repo secret
    or a `workflow_dispatch` `password` input, and enforces single-admin once a
    password exists.
  - `pnpm keycloak:bootstrap-admin` — when you **can't** deliver a password to CI
    (no `Secrets:write` token in-session; the mobile Actions UI hides inputs):
    generates a one-time **temporary** password in-cluster, configures the sole
    admin, and posts the temp login to #382; the human logs in once and Keycloak
    forces `UPDATE_PASSWORD`. (A temporary password fails a direct-grant check —
    that's expected; no `LOGIN_VERIFIED`.) **Never commit a password to git.**
- **Self-heal:** `pnpm keycloak:ensure` (`keycloak-ensure.yml`, **cron `*/15`**)
  reconciles auth to the last-working state — OOM-recovers Keycloak (768Mi /
  `-Xmx512m`), fixes realm flags + the `cloudless-app` groups mapper + admin
  group/membership, **and restores the Pi `cloudless` app's auth wiring** (the
  `cloudless-app-auth` secret + `envFrom`) if it stops serving the keycloak
  provider; posts to #382 only when it corrects drift or auth is broken.
- **Pi/k3s app auth (HA standby):** the `cloudless` deployment needs runtime env
  `AUTH_SECRET` + `KEYCLOAK_ISSUER`(**realm `master`**, not the stale SSM value
  `cloudless`) + `KEYCLOAK_CLIENT_ID`/`KEYCLOAK_CLIENT_SECRET` + **`AUTH_TRUST_HOST=true`**
  + `AUTH_URL=https://cloudless.gr` — else next-auth returns `{}` (no AUTH_SECRET)
  or a "server configuration"/`UntrustedHost` error. Wire it with
  `pnpm keycloak:wire-pi` style (`scripts/wire-pi-keycloak.sh` → `wire-pi-keycloak.yml`):
  pulls values from SSM `/cloudless/production/*`, pins realm to `master`, stores
  them in `cloudless-app-auth`, adds `envFrom` (keeping `pi-standby-aws-creds`),
  restarts. `NEXT_PUBLIC_KEYCLOAK_ISSUER` is build-time → the Pi login *page*
  button still needs the `--build-arg` in `deploy-pi.yml`.
- **CloudWatch `SERVERLESS-APP_MAIN-Errors`** (custom metric
  `CloudlessApp/ServerlessErrors`) is a **CloudWatch Logs metric filter** on the
  Lambda log group — NOT Sentry (Sentry had 0). It counts next-auth
  `[auth][error] Configuration` lines, which fire on a bare **GET** to
  `/api/auth/signin/keycloak` (real login POSTs and is fine). The 2026-06-01
  burst was the Keycloak outage (now fixed) + diagnostic GET probes. Threshold
  is 1 error / 5 min (very noisy). The alarm/filter are not in this repo.

## Deployment to Pi

**Workflow:** `.github/workflows/deploy-pi.yml` — triggers on every push to `main`.

- **Job 1 `build-and-push`** (`[self-hosted, omv, pi]`): builds `linux/arm64` Docker image **natively on a Pi runner** (no real QEMU work — the host is already arm64; the `setup-qemu-action` step is left in for portability but is a no-op here). Pushes SHA-only tag to ECR (`278585680617.dkr.ecr.us-east-1.amazonaws.com/cloudless-pi-app:<sha>`). ECR repo has **immutable tags** — never push `:latest` from CI.
- **Job 2 `rollout`** (`[self-hosted, omv, pi]`): runs `kubectl set image` + `kubectl rollout status` against the local k3s API (`192.168.1.128:6443`).
- **Runner labels:** Both jobs require `[self-hosted, omv, pi]` (PR #167, merged 2026-05-17). The `pi` label gates them to the 3 Pi runners (`omv`, `omv-2`, `omv-3`) so an added non-Pi `omv` runner (e.g. `legion` in WSL2) can't accidentally take a cluster-bound job it can't perform. Cross-compile via QEMU on `ubuntu-latest` was tried and abandoned — `pnpm install` alone exceeded 60 min under emulation.
- **Auth:** OIDC via `AWS_DEPLOY_ROLE_ARN` secret — no static AWS keys.
- **`NEXT_PUBLIC_*` vars** are baked into the Next.js client bundle at Docker build time as `--build-arg`. They are NOT available as runtime env vars — changes require a full image rebuild.
- **SSM config** (API keys, Notion DB IDs, etc.) is fetched at runtime by the app via `getIntegrationsAsync()` using the `pi-standby-aws-creds` k8s Secret.

**GitHub Secrets needed:** `AWS_DEPLOY_ROLE_ARN`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`, `NEXT_PUBLIC_HUBSPOT_PORTAL_ID`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_META_PIXEL_ID`

## CI Runner Failover

When GH-hosted runner billing/capacity breaks, flip the `RUNNER_GENERIC` repo variable to re-route most workflows onto the self-hosted Pi `build` cluster:

```bash
.github/scripts/toggle-runner.sh status   # show mode + runner inventory
.github/scripts/toggle-runner.sh pi       # → ["self-hosted","omv","build"]
.github/scripts/toggle-runner.sh hosted   # → unset (ubuntu-latest)
```

Instrumented workflows use `runs-on: ${{ fromJSON(vars.RUNNER_GENERIC || '"ubuntu-latest"') }}`. See [`docs/runners.md`](docs/runners.md) for the full design, the list of opted-in workflows, the ones that stay GH-hosted (Lighthouse, k3s-e2e, CodeQL — they need x86_64/Chrome), and the registration steps for the `omv,build` runner profile on each Pi host.

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
