#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# cloudless_finish_pack.sh
#
# Purpose:
#   Create the local files/scripts needed to finish the current
#   cloudless.gr roadmap and keep the LangChain v1 app experiments
#   organized without touching production app code.
#
# Save at:
#   ~/code/cloudless.gr/scripts/cloudless_finish_pack.sh
#
# Run:
#   cd ~/code/cloudless.gr
#   bash scripts/cloudless_finish_pack.sh
# ============================================================

PROJECT_ROOT="${PROJECT_ROOT:-$HOME/code/cloudless.gr}"
cd "$PROJECT_ROOT"

mkdir -p docs scripts agents/experiments .agent-memory/memories

# ------------------------------------------------------------
# 1. Finish plan doc
# ------------------------------------------------------------
cat > docs/cloudless-finish-plan.md <<'MD'
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
MD

# ------------------------------------------------------------
# 2. LangChain v1 experiment suite runner
# ------------------------------------------------------------
cat > scripts/run_langchain_v1_suite.sh <<'BASH'
#!/usr/bin/env bash
set -euo pipefail

cd ~/code/cloudless.gr
source .venv/bin/activate

run_if_exists() {
  local label="$1"
  local path="$2"
  echo
  echo "=== $label ==="
  if [ -f "$path" ]; then
    PYTHONPATH=. python "$path"
  else
    echo "SKIP: missing $path"
  fi
}

run_if_exists "LangChain v1 release page runner" "agents/run_langchain_v1_research.py"
run_if_exists "LangChain Agents reference runner" "agents/run_langchain_agents_reference.py"
run_if_exists "LangChain v1 create_agent local vLLM experiment" "agents/experiments/langchain_v1_create_agent_local_vllm.py"
run_if_exists "LangChain v1 ModelRequest middleware local vLLM experiment" "agents/experiments/langchain_v1_modelrequest_middleware_local_vllm.py"
run_if_exists "LangChain v1 structured output local vLLM experiment" "agents/experiments/langchain_v1_structured_output_local_vllm.py"
BASH
chmod +x scripts/run_langchain_v1_suite.sh

# Keep existing 1.sh as a convenience alias to the suite.
cat > scripts/1.sh <<'BASH'
#!/usr/bin/env bash
set -euo pipefail

cd ~/code/cloudless.gr
bash scripts/run_langchain_v1_suite.sh
BASH
chmod +x scripts/1.sh

# ------------------------------------------------------------
# 3. LangChain v1 import audit
# ------------------------------------------------------------
cat > scripts/audit_langchain_v1_imports.sh <<'BASH'
#!/usr/bin/env bash
set -euo pipefail

cd ~/code/cloudless.gr
source .venv/bin/activate

echo "=== Legacy LangChain import audit ==="

grep -R \
  --exclude-dir=.venv \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.next \
  --exclude=run_langchain_v1_research.py \
  "create_react_agent\|langchain.chains\|langchain.retrievers\|from langchain import hub\|from langchain import" \
  -n agents src app . 2>/dev/null || true

echo

echo "=== Installed package versions ==="
python - <<'PY'
import importlib.metadata as md

for package in ["langchain", "langchain-core", "langchain-openai", "langgraph", "deepagents"]:
    try:
        print(package, md.version(package))
    except md.PackageNotFoundError:
        print(package, "not installed")
PY
BASH
chmod +x scripts/audit_langchain_v1_imports.sh

# ------------------------------------------------------------
# 4. Roadmap status helper
# ------------------------------------------------------------
cat > scripts/roadmap_status.sh <<'BASH'
#!/usr/bin/env bash
set -euo pipefail

cd ~/code/cloudless.gr

echo "=== cloudless.gr roadmap status ==="
echo
echo "Completed from canonical TODO:"
echo "- R10 PVC daily backup CronJobs to S3"
echo "- R11 TLS cert parity probe"
echo "- R12 /admin/cost Athena panel"
echo
echo "Next app task:"
echo "- R14 Sentry environment tagging: prod on AWS Lambda, pi-standby on Pi build"
echo
echo "Next roadmap rows:"
echo "- R13 EspoCRM MariaDB hourly backup to S3"
echo "- R18 Pi-side SSM scope assertion"
echo "- R22 Stripe webhook idempotency audit + DynamoDB dedup"
echo "- R21 AI baseline: Meilisearch, semantic search, recommendations, GenAI copy"
echo
echo "Useful local checks:"
echo "- bash scripts/audit_langchain_v1_imports.sh"
echo "- bash scripts/run_langchain_v1_suite.sh"
echo "- git status --short"
BASH
chmod +x scripts/roadmap_status.sh

# ------------------------------------------------------------
# 5. R14 Sentry environment tagging planning helper
# ------------------------------------------------------------
cat > scripts/plan_r14_sentry_env_tagging.sh <<'BASH'
#!/usr/bin/env bash
set -euo pipefail

cd ~/code/cloudless.gr

echo "=== R14 Sentry environment tagging plan ==="
echo
echo "Goal:"
echo "- AWS Lambda / production build reports SENTRY_ENVIRONMENT=prod"
echo "- Pi standby build reports SENTRY_ENVIRONMENT=pi-standby"
echo
echo "Search current Sentry/environment usage:"
grep -R \
  --exclude-dir=.venv \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.next \
  "SENTRY_ENVIRONMENT\|SENTRY_DSN\|sentry\|environment" \
  -n src app infrastructure stacks sst.config.* next.config.* package.json .github 2>/dev/null || true

echo
echo "Implementation reminder:"
echo "- Prefer explicit env injection per deploy target."
echo "- Do not hard-code secrets."
echo "- Keep SENTRY_DSN separate from SENTRY_ENVIRONMENT."
echo "- Verify both surfaces produce distinct environments in Sentry."
BASH
chmod +x scripts/plan_r14_sentry_env_tagging.sh

# ------------------------------------------------------------
# 6. Completion checklist doc
# ------------------------------------------------------------
cat > docs/langchain-v1-local-experiment-status.md <<'MD'
# LangChain v1 local experiment status

## Validated

- `create_agent` with local vLLM.
- Normal tools with local vLLM.
- `ModelRequest` middleware with `wrap_model_call`.
- `request.override(model_settings=...)`.
- `ToolStrategy` structured output with a Pydantic schema.

## Keep experimental

These files are experiments and should not replace the main Deep Agents workflow yet:

- `agents/experiments/langchain_v1_create_agent_local_vllm.py`
- `agents/experiments/langchain_v1_modelrequest_middleware_local_vllm.py`
- `agents/experiments/langchain_v1_structured_output_local_vllm.py`

## Promotion criteria before production use

Before promoting any experiment into the main app:

1. Add deterministic Python-side validation.
2. Avoid relying on model self-assessment.
3. Keep local vLLM compatibility with `use_responses_api=False`.
4. Prove behavior with a small tool set.
5. Confirm no recursion-limit loops.
6. Add tests or smoke scripts.
7. Keep Deep Agents fallback until replacement is proven.
MD

# ------------------------------------------------------------
# 7. Memory note
# ------------------------------------------------------------
MEMORY_FILE=".agent-memory/memories/AGENTS.md"
NOTE="For cloudless.gr finishing work, follow docs/cloudless-finish-plan.md; keep LangChain v1 create_agent/middleware/structured-output work as isolated experiments until promoted deliberately."
if [ ! -f "$MEMORY_FILE" ]; then
  cat > "$MEMORY_FILE" <<EOF
# cloudless.gr Agent Memory

## Finish workflow
- $NOTE
EOF
elif ! grep -Fq "$NOTE" "$MEMORY_FILE"; then
  cat >> "$MEMORY_FILE" <<EOF

## Finish workflow
- $NOTE
EOF
fi

# ------------------------------------------------------------
# 8. Final validation
# ------------------------------------------------------------
bash -n scripts/run_langchain_v1_suite.sh
bash -n scripts/1.sh
bash -n scripts/audit_langchain_v1_imports.sh
bash -n scripts/roadmap_status.sh
bash -n scripts/plan_r14_sentry_env_tagging.sh

echo "✅ cloudless finish pack installed."
echo
echo "Next commands:"
echo "  bash scripts/roadmap_status.sh"
echo "  bash scripts/audit_langchain_v1_imports.sh"
echo "  bash scripts/run_langchain_v1_suite.sh"
echo "  bash scripts/plan_r14_sentry_env_tagging.sh"
