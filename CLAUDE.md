# Claude Code — Project Memory

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

## Cloud Session SSH Setup (one-time)

The `cloudless-infra` MCP server connects to `omv-main` via SSH. In **local** sessions it reads `~/.ssh/id_ed25519` automatically. In **cloud** sessions (code.claude.com) the key file isn't present — supply it as a base64 secret instead:

1. On your local machine: `base64 -w0 ~/.ssh/id_ed25519 | pbcopy`  (Linux: omit `| pbcopy`, copy manually)
2. In the Claude Code web UI → session settings → **Environment → Secrets** → add:
   - Name: `OMV_SSH_KEY_CONTENTS`
   - Value: the base64 string from step 1

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
  `pnpm prometheus:tune` (kill heavy apiserver SLO rules → `prometheus-tune.yml`).
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
