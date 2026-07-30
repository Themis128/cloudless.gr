# cloudless.gr Agent Profile

This file is the canonical app profile for cloudless.gr local Deep Agent / vibe-coding workflows.

## App identity

cloudless.gr is a custom Next.js + SST/Lambda website and e-shop with analytics, admin tooling, and self-hosted operator services.

## Runtime architecture

- AWS Lambda/SST is the primary runtime for the public web app.
- Pi k3s is warm-standby for the web app and primary host for self-hosted apps.
- Pi-hosted apps are not assumed to have AWS replicas.
- Self-hosted apps live only on Pi:
  - AppFlowy
  - EspoCRM
  - Postiz
  - n8n
  - Mosquitto
  - Grafana
  - Uptime Kuma
  - ntfy

## Hard constraints

- Never output secrets.
- Never commit `.env.local`.
- Never commit `.deepagents/`.
- Never commit generated Chroma DBs.
- Never suggest putting real API keys into source files.
- For k3s persistent workloads, use the dedicated 120GB SSD on OMV-MAIN.
- For vibe-coding, default to patch proposal mode.
- Do not claim files were changed unless a tool actually changed them and the user explicitly approved.

## Important project areas

- `src/` — Next.js application code.
- `agents/` — local AI, RAG, Deep Agent, and assistant code.
- `agents/tools/` — read-only project and LangSmith registry tools.
- `tools/langsmith_api/` — LangSmith API client scaffold.
- `scripts/ai.sh` — local AI command dispatcher.
- `scripts/check_deepagent_cloudless.py` — Deep Agent readiness check.
- `scripts/check_deepagent_skills.py` — skills/tools readiness check.
- `tests/langsmith_api/` — LangSmith API tooling tests.
- `skills/` — project-specific Deep Agent skills.
- `docs/local-ai-deep-agent-structure.md` — canonical local AI structure.

## Existing AI commands

Use these commands for validation:

    pnpm run ai:check
    pnpm run ai:skills-check
    pnpm run ai:test:api
    pnpm run ai:langsmith-check
    pnpm run ai:langsmith-call -- langsmith GET /info/health
    pnpm run ai:langsmith-page -- langsmith GET /datasets --allow-error
    pnpm run ai:langsmith-stream -- agent-server GET /health --allow-error
    pnpm run ai:langsmith-endpoint -- --list
    pnpm run ai:deep
    pnpm run ai:vibe

## LangSmith behavior

- Local default is `LANGSMITH_TRACING=false`.
- Tracing should only be enabled when `LANGSMITH_API_KEY` exists.
- Use registered endpoint names before arbitrary API paths.
- Public/safe without key:
  - `langsmith.health`
  - `agent_server.health`
  - `agent_server.assistants.search`
- Requires `LANGSMITH_API_KEY`:
  - `langsmith.workspaces.list`
  - `langsmith.datasets.list`
  - `langsmith.runs.query`
  - `deepagents.agents.list`
  - `deepagents.threads.list`
  - `fleet.connections.list`

## Roadmap priorities

Prefer work aligned with:

- R13 EspoCRM mariadb-backup hourly to S3.
- R14 Sentry environment tagging.
- R18 Pi-side SSM scope assertion.
- R22 Stripe webhook idempotency audit.
- R21 AI baseline:
  - Meilisearch
  - semantic search
  - recommendations
  - GenAI product descriptions

## Vibe-coding response contract

For coding requests, answer with:

1. Goal
2. Relevant existing files
3. Proposed change
4. Unified diff
5. Tests to run
6. Rollback plan
7. Human approval question

Always end patch proposals with:

    Apply this patch? yes/no
