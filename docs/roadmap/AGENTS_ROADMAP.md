# Agents Roadmap for cloudless.gr

This file plans how AI agents fit into cloudless.gr across four layers: dev workflow, runtime product, scheduled background work, and CI. Phase 1 has shipped — the rest are concrete proposals waiting for a go-ahead.

The shipped phase is dev-time only and free; subsequent phases add real Anthropic API spend, runner time, and code that runs in production.

---

## Phase 1 — Dev-time subagents — SHIPPED

Defined under `.claude/agents/`:

| Agent                  | When it runs                                | What it does                                                                               |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `sonarcloud-cleanup`   | Before merge / when SonarCloud flags issues | Scopes to changed files, fixes S1192/S3776/S3699/global.fetch inline, reruns lint          |
| `api-security-audit`   | Touching `src/app/api/` routes              | Checks auth/rate-limit/timeout/error-leakage drift; mechanical fixes inline                |
| `notion-schema-drift`  | After Notion DB ID changes / on-demand      | Read-only diff across all 12 Notion DBs between lib schema comments and the live workspace |
| `lighthouse-triage`    | Failing Lighthouse CI run                   | Distinguishes variance vs regression, points at the offending PR                           |
| `release-notes`        | Cutting a release / weekly recap            | Groups commits since last tag into Features / Fixes / Performance / Internal               |
| `cms-populate`         | After new CMS DB IDs added to SSM           | Seeds Testimonials / Case Studies / Services / FAQs DBs from static fallback arrays        |
| `slack-routing-verify` | After Slack channel setup or missing alerts | Verifies channels exist, bot invited, SSM params set, notifier wiring correct              |
| `pr-review-debug`      | PR review comment missing or too noisy      | Debugs workflow triggers, OIDC key fetch, diff scope; tunes model/prompt/cap               |

Cost: zero (runs locally inside Claude Code sessions). Reversible: delete the file under `.claude/agents/`.

---

## Phase 2 — Runtime AI agents in the product

Today `/api/chat` is a Workers AI tool-use loop (`workers-ai-chat.ts`) for pre-sales chat — not Anthropic/Bedrock. Real agents would let it (and a few new endpoints) take actions. Do not move LangGraph onto Workers from this inventory.

### Phase 2a — chatbot tool use — SHIPPED

Two read-only tools wired into `/api/chat`:

1. `lookup_product(query: string)` — searches `getProducts()` (5 min cache, Stripe-backed when configured) and returns up to 3 matches with name, price, category, `/store/<id>` URL.
2. `check_calendar_availability(days_ahead?: integer)` — wraps `getAvailableSlots()` and returns up to 5 30-minute Athens-local slots with a `/book` CTA. Days clamped to `[1, 14]`. Returns a graceful contact-page nudge when Google Calendar isn't configured.

Implementation: replaced the single-turn streaming proxy with a non-streaming tool-use loop capped at 4 iterations / 20s upstream timeout. The final assistant text is chunk-encoded back to the browser as SSE so the existing `ChatWidget` event handlers keep working unchanged. Tools live in `src/lib/chat-tools.ts`; the `runTool` dispatcher always resolves to a string — errors are converted to user-facing nudges so a thrown tool can't crash the loop.

Trade-off: lost the typewriter streaming effect on responses that _use_ a tool — text now arrives as one SSE event after the tool round trip completes. Direct text responses with no tool call still chunk in real time.

**Tests** (19 added): see `docs/integrations/ANTHROPIC.md` (banner first — Bedrock diagrams in that file are stale). Covers tool round-trip with `tool_result`, iteration-cap fallback, schema declarations, and per-tool match / no-match / no-config / throw paths.

Detail: `src/lib/workers-ai-chat.ts` + `src/lib/chat-tools.ts`. The ANTHROPIC.md loop diagram still describes the retired Bedrock path.

### Phase 2b — booking agent — SHIPPED

`POST /api/agent/book` takes natural-language intent ("schedule me for next Tuesday afternoon, 30 min") and runs a Bedrock tool-use loop with two tools (`check_calendar_availability`, `propose_slot`) to pick exactly one open slot. Two-phase:

1. **Propose** — `POST { intent }` → `{ status: "proposed", proposed: { start, end, formatted }, reasoning }` (or `no_match`). Model never books on its own.
2. **Confirm** — `POST { confirm: true, start, end, notes? }` → re-checks slot is free, creates the Google Calendar event with a Meet link, posts to Slack, emails confirmation.

Guardrails:

- Auth required (Bearer JWT — authenticated user session). Email is forced to the authenticated user's email — the model cannot override it.
- Rate-limited 5 / 10 min per IP for both propose and confirm.
- Re-checks availability at confirm time (409 if slot no longer free).

Implementation: `src/lib/agent-book.ts` + `src/app/api/agent/book/route.ts`. Tests in `__tests__/agent-book-api.test.ts`.

### Phase 2c — admin assistant — SHIPPED

`/admin/ai-assistant` page hosts a multi-tool agent. Tool **names** keep legacy ids (`search_notion`, `get_recent_orders`) for prompt compatibility; executors are lake / Vectorize / AppFlowy — not live Notion or live Stripe. Also: `get_datalake_section`, `get_lake_insight`, `draft_email`. Admin-only, lower stakes than the public chat.

Implementation: `src/lib/admin-assistant-tools.ts` + `src/app/api/admin/ai/assistant/route.ts` (Workers AI tool protocol, Gemini fallback, max 4 iterations, `requireAdmin` guard) + UI on `src/app/[locale]/admin/ai-assistant/page.tsx`. Tests in `__tests__/admin-assistant-api.test.ts`.

**Cost model**: bursty — only used by admins. Probably under $5/month even at heavy use.

---

## Phase 3 — Background / scheduled agents

Today there are 4 cron routes (analytics-rollup, calendar-digest, report-cleanup, voice-brief). They're imperative scripts. Converting them to agents would add: retry with reasoning, Slack progress updates, and the ability to skip steps when conditions don't apply.

### Voice-brief agent — SHIPPED

`/api/cron/voice-brief` runs a Bedrock tool-use loop (`src/lib/agent-voice-brief.ts`) with 4 data tools (`get_seo_metrics`, `get_pipeline_stats`, `get_email_metrics`, `get_stripe_revenue`) plus a terminal `emit_brief` tool. The model decides which sources to call, each tool is wrapped with two retries on failure (200 ms / 400 ms backoff), and after the loop the route posts a Slack summary block with a per-source `ok/failed/skipped` breakdown plus the polished narrative.

The original linear `Promise.all(…)` pipeline is preserved verbatim — pass `?legacy=true` on the cron request to fall back to it for at least one full release cycle. Both paths share the same SSM persistence (`/cloudless/VOICE_BRIEF_LATEST`) so the admin assistant page sees the same shape regardless.

**Cost model in practice**: one cron tick a week, ~3–8 LLM calls (model often skips EspoCRM/Stripe if `isConfigured` returns false on the first probe), < $0.05/run on Bedrock Haiku.

**Tests**: 6 specs in `__tests__/cron-voice-brief.test.ts` covering auth, agent happy path, agent failure tolerance (SSM/Slack), legacy default, and legacy fallback when the Anthropic narrate call returns non-200.

**Skip**: `report-cleanup` and `analytics-rollup` — they're trivial and don't benefit from agent reasoning. `calendar-digest` may be worth converting next if we want the agent to skip empty-week digests rather than always posting.

---

## Phase 4 — Agent-driven CI/CD

Three concrete additions, in increasing order of risk:

### 4a — PR review agent — SHIPPED

On every PR open / push that touches `src/**` or root config files, a workflow dispatches a Claude Haiku agent that:

- Reads the diff (capped at 80k chars, src/ + root configs only).
- Applies the same rules as `api-security-audit` and `sonarcloud-cleanup` dev-time agents.
- Posts (or updates) a single PR comment with findings — no auto-fix, no auto-merge.

Implementation: `.github/workflows/pr-review.yml` + `scripts/pr-review.mjs`. Anthropic key fetched from SSM via the existing OIDC role — no new secrets needed. Skipped for `dependabot/*` and `revert/*` branches. Default model: `claude-haiku-4-5` (override with `REVIEW_MODEL` env var). Cost: ~$0.02–0.10 per PR. Use `pr-review-debug` agent to tune.

### 4b — Failing-CI babysitter — SHIPPED

On CI/Deploy failure a `workflow_run` triggers `ci-babysitter.yml` which fetches failed job logs (capped at 40k chars), calls Claude Haiku for root-cause analysis (root cause + fix + confidence), and posts a comment to the triggering PR or to tracking issue #382 if run on main. Implementation: `scripts/ci-babysitter.mjs` + `.github/workflows/ci-babysitter.yml`. Uses the same OIDC → ANTHROPIC_API_KEY SSM pattern as the PR review agent. Cost: ~$0.02–0.08 per failure.

### 4c — Auto-cleanup of stale gates — SHIPPED

Runs weekly (Monday 09:00 UTC) via `.github/workflows/stale-gate-sweeper.yml` + `scripts/stale-gate-sweeper.mjs`. Scans `src/`, `scripts/`, and `sst.config.ts` for `remove once`, `TODO: remove`, `@deprecated`, `backward-compat`, and similar markers using `git grep`. Gets 4 lines of context per match and recent commits (last 30 days), calls Claude Haiku to evaluate which conditions are met, and posts a two-section triage report (Ready to remove / Not yet) to tracking issue #382. Cap: 40 matches, 30k prompt chars. Override model with `REVIEW_MODEL` env var. Cost: ~$0.01–0.04/run.

---

## Order I'd actually pick

1. ~~**2a chatbot tool use**~~ — SHIPPED.
2. **4a PR review agent** — protects the codebase as we move faster, and dogfooding it reveals which dev-time agents need tightening.
3. ~~**3 voice-brief agent**~~ — SHIPPED.
4. **2b booking agent / 2c admin assistant / 4b CI babysitter / 4c stale-gate sweeper** — order by what you're actually feeling pain about.

Tell me which to start and I'll write the first PR.
