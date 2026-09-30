#!/usr/bin/env python3
"""Cloudless finish pack — create the docs/memory pointers that
finish the current roadmap and keep LangChain v1 experiments
organized, without touching production app code.

The helpers it used to emit as .sh are already present as .py:
  run_langchain_v1_suite.py, audit_langchain_v1_imports.py,
  roadmap_status.py, plan_r14_sentry_env_tagging.py"""

import os
import py_compile
import sys
from pathlib import Path

ROOT = Path(os.environ.get("PROJECT_ROOT",
                           Path.home() / "code/cloudless.gr"))
os.chdir(ROOT)

for d in ("docs", "scripts", "agents/experiments",
          ".agent-memory/memories"):
    Path(d).mkdir(parents=True, exist_ok=True)

# 1. checklist pointer
Path("docs/current-source-of-truth-checklist.md")\
    .write_text("""# Current Source of Truth Checklist

Use this file as the active checklist. For full rationale and history, see:

- `docs/master-todo-list.md`

If this script is run, refresh checklist entries from `docs/master-todo-list.md`
instead of creating a separate roadmap document.
""")

# 2-5. verify the Python helpers exist and compile
helpers = [
    "scripts/run_langchain_v1_suite.py",
    "scripts/audit_langchain_v1_imports.py",
    "scripts/roadmap_status.py",
    "scripts/plan_r14_sentry_env_tagging.py",
]
for h in helpers:
    p = Path(h)
    if not p.is_file():
        sys.exit(f"Missing expected Python helper: {h}")
    py_compile.compile(str(p), doraise=True)

# 6. completion checklist doc
Path("docs/langchain-v1-local-experiment-status.md")\
    .write_text("""# LangChain v1 local experiment status

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
""")

# 7. memory note
mem = Path(".agent-memory/memories/AGENTS.md")
note = ("For cloudless.gr finishing work, follow "
        "docs/current-source-of-truth-checklist.md "
        "(details in docs/master-todo-list.md); keep "
        "LangChain v1 create_agent/middleware/"
        "structured-output work as isolated experiments "
        "until promoted deliberately.")
if not mem.is_file():
    mem.write_text("# cloudless.gr Agent Memory\n\n"
                   "## Finish workflow\n"
                   f"- {note}\n")
elif note not in mem.read_text():
    with mem.open("a") as f:
        f.write(f"\n## Finish workflow\n- {note}\n")

print("✅ cloudless finish pack installed.\n")
print("Next commands:")
for h in helpers:
    print(f"  python3 {h}")
