# Claude Code — Project Memory

## Git Workflow

- **Commit and push regularly** — after every logical unit of work (a bug fix, a set of related changes, a completed feature). Do not batch unrelated changes into one large commit.
- Always push to the active feature branch (`claude/...`), never to `main` directly.
- After pushing, check if a PR exists; create a draft PR if none exists.

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

## Deployment to Pi (cloudless.online)

**Workflow:** `.github/workflows/deploy-pi.yml` — triggers on every push to `main`.

- **Job 1 `build-and-push`** (`[self-hosted, omv, pi]`): builds `linux/arm64` Docker image **natively on a Pi runner** (no real QEMU work — the host is already arm64; the `setup-qemu-action` step is left in for portability but is a no-op here). Pushes SHA-only tag to ECR (`278585680617.dkr.ecr.us-east-1.amazonaws.com/cloudless-pi-app:<sha>`). ECR repo has **immutable tags** — never push `:latest` from CI.
- **Job 2 `rollout`** (`[self-hosted, omv, pi]`): runs `kubectl set image` + `kubectl rollout status` against the local k3s API (`192.168.1.128:6443`).
- **Runner labels:** Both jobs require `[self-hosted, omv, pi]` (PR #167, merged 2026-05-17). The `pi` label gates them to the 3 Pi runners (`omv`, `omv-2`, `omv-3`) so an added non-Pi `omv` runner (e.g. `legion` in WSL2) can't accidentally take a cluster-bound job it can't perform. Cross-compile via QEMU on `ubuntu-latest` was tried and abandoned — `pnpm install` alone exceeded 60 min under emulation.
- **Auth:** OIDC via `AWS_DEPLOY_ROLE_ARN` secret — no static AWS keys.
- **`NEXT_PUBLIC_*` vars** are baked into the Next.js client bundle at Docker build time as `--build-arg`. They are NOT available as runtime env vars — changes require a full image rebuild.
- **SSM config** (API keys, Notion DB IDs, etc.) is fetched at runtime by the app via `getIntegrationsAsync()` using the `pi-standby-aws-creds` k8s Secret.

**GitHub Secrets needed:** `AWS_DEPLOY_ROLE_ARN`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`, `NEXT_PUBLIC_HUBSPOT_PORTAL_ID`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_META_PIXEL_ID`

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
import { Link, useRouter, usePathname, redirect } from "@/i18n/navigation"
router.push("/admin")         // → /en/admin  ✓

// ❌ Wrong — produces 404
import Link from "next/link"
router.push("/en/admin")      // → /en/en/admin  ✗
```

**Middleware redirect params must use the bare (locale-stripped) path:**
```ts
// ✅
loginUrl.searchParams.set("redirect", bare)      // "/admin"
// ❌
loginUrl.searchParams.set("redirect", pathname)  // "/en/admin" → double-locale after router.push
```