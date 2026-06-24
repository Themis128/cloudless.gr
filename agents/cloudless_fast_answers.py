from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from tools.langsmith_api.endpoints import list_endpoints


REPO_ROOT = Path(__file__).resolve().parents[1]


def answer_registered_langsmith_endpoints() -> str:
    """Return registered LangSmith endpoint safety without calling the LLM."""
    registry = list_endpoints()

    safe = []
    protected = []

    for name in sorted(registry):
        endpoint = registry[name]
        item = f"- `{name}` — {endpoint['client']} {endpoint['method']} {endpoint['path']}"

        if endpoint.get("auth_required"):
            protected.append(item)
        else:
            safe.append(item)

    return (
        "Registered LangSmith-related endpoints\n\n"
        "Safe without `LANGSMITH_API_KEY` (`auth_required=false`):\n"
        + "\n".join(safe)
        + "\n\nRequires `LANGSMITH_API_KEY` (`auth_required=true`):\n"
        + "\n".join(protected)
        + "\n\nRule: only endpoints with `auth_required=false` are safe without `LANGSMITH_API_KEY`."
    )


def answer_package_scripts() -> str:
    """Return package.json ai:* scripts without calling the LLM."""
    package_path = REPO_ROOT / "package.json"
    data = json.loads(package_path.read_text(encoding="utf-8"))
    scripts = data.get("scripts", {})
    ai_scripts = {k: v for k, v in scripts.items() if k.startswith("ai:")}

    lines = ["AI package scripts from package.json", ""]

    for name in sorted(ai_scripts):
        lines.append(f"- `{name}` → `{ai_scripts[name]}`")

    return "\n".join(lines)


def answer_cloudless_constraints() -> str:
    """Return cloudless.gr operating constraints without calling the LLM."""
    return """
cloudless.gr constraints:
- AWS Lambda/SST is the primary runtime for the public web app.
- Pi k3s is warm-standby for the web app and primary host for self-hosted apps.
- Pi-hosted apps are not assumed to have AWS replicas.
- Self-hosted apps live only on Pi: AppFlowy, EspoCRM, Postiz, n8n, Mosquitto, Grafana, Uptime Kuma, ntfy.
- All k3s persistent workloads must use the dedicated 120GB SSD on the OMV-MAIN node.
- Never commit .env.local, .deepagents/, generated Chroma DBs, package backups, or secrets.
- For vibe-coding, default to patch proposal mode and require explicit human approval before writes.
""".strip()


def try_fast_answer(question: str) -> Optional[str]:
    """Return deterministic app-config answers for known question types."""
    question_lc = question.lower()

    if "registered langsmith endpoint" in question_lc or "langsmith endpoints" in question_lc:
        return answer_registered_langsmith_endpoints()

    if "package.json" in question_lc and "script" in question_lc:
        return answer_package_scripts()

    if "cloudless constraint" in question_lc or "k3s storage" in question_lc:
        return answer_cloudless_constraints()

    return None
