# cloudless.gr Finish Plan

This plan consolidates the current TODO, optimal architecture assessment, 2026 best-practices audit, and the validated LangChain v1 local experiments.

## Current validated LangChain v1 local stack

Validated locally:

- `create_agent` with local vLLM / OpenAI-compatible endpoint.
- `ModelRequest` middleware via `wrap_model_call` and `request.override(model_settings=...)`.
- `ToolStrategy` structured output with a Pydantic schema.

Keep these as experiments for now. Do not replace the current Deep Agents workflow until a project-specific migration is explicitly planned.

## Current app roadmap priority

### Immediate next

- R14 — Sentry environment tagging:
  - `prod` on AWS Lambda / production.
  - `pi-standby` on Pi build.

### Phase 2

- R13 — EspoCRM MariaDB hourly backup to S3.
- R18 — Pi-side SSM scope assertion.
- R22 — Stripe webhook idempotency audit and DynamoDB dedup table.

### Phase 3 AI baseline

- R21a — Meilisearch self-host on `omv-ha`.
- R21b — `/api/search` with Bedrock Titan embeddings.
- R21c — Product recommendation engine using DynamoDB + Bedrock.
- R21d — GenAI product descriptions.

### Phase 4

- R15 — Cloudflare Access on admin tunnel hosts.
- R17 — Kuma monitors + ntfy/Slack channels.
- R19 — Monthly failover drill workflow.

### Later

- R16 — AppFlowy WAL-G to S3.
- R23 — Resend pilot on order-confirmation.
- R24 — Route 53 health check + secondary-region Lambda + DynamoDB Global Tables.
- R20 — Postgres logical replication via Lambda subscriber if RPO seconds becomes necessary.
- R25 — Self-hosted admin auto-login bridge.

## Operator-only blockers

Before some roadmap rows can complete, operator actions are still needed:

- Rotate Cloudflare API token.
- Add Sentry webhook secret to SSM.
- Restore/configure Kuma status page slug and monitors.
- Restore ESP32 Notion page.
- Provision LinkedIn CAPI conversion details where needed.

## Do not change yet

- Do not install `langchain-classic` unless a future import audit finds legacy LangChain imports.
- Do not migrate away from Cognito until the app crosses the relevant scale threshold.
- Do not migrate away from Athena unless query latency becomes a user-facing issue.
- Do not replace Deep Agents with `create_agent` yet.
- Do not activate dormant multi-CDN work unless there is a specific availability requirement.

## Recommended execution order

1. Commit or stash the validated LangChain v1 experiment files.
2. Run `scripts/run_langchain_v1_suite.sh` whenever changing LangChain/vLLM dependencies.
3. Run `scripts/audit_langchain_v1_imports.sh` before any LangChain migration work.
4. Finish R14.
5. Finish R13, R18, and R22.
6. Start R21 AI baseline.
7. Only after R21 is stable, decide whether any `create_agent` experiment should become production code.
