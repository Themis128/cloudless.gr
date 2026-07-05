#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/tbaltzakis/cloudless.gr"
cd "$PROJECT_DIR"

echo "==> Hardening CodingAgent patch proposal mode"

cp src/agents/coding.ts "src/agents/coding.ts.bak-strict-patch-$(date +%Y%m%d-%H%M%S)"
cp scripts/coding-agent-review-repo.sh "scripts/coding-agent-review-repo.sh.bak-strict-patch-$(date +%Y%m%d-%H%M%S)"

python3 - <<'PY'
from pathlib import Path

p = Path("src/agents/coding.ts")
text = p.read_text()

old = '''      "- Do not invent file paths.",
      "- Do not include secrets.",'''

new = '''      "- Do not invent file paths.",
      "- Do not create new files unless the user explicitly requested new files.",
      "- Allowed file paths are only those present in the repository context under lines that start with ## FILE:.",
      "- Every path in the unified diff must match an existing ## FILE path from the repository context.",
      "- If no safe patch can be made using only those files, output NO_SAFE_PATCH and explain why.",
      "- Do not include secrets.",
      "- Do not invent environment variable names, import paths, framework assumptions, or public files not shown in context.",'''

if old not in text:
    raise SystemExit("Could not find patch rules block in src/agents/coding.ts")

text = text.replace(old, new)
p.write_text(text)
PY

python3 - <<'PY'
from pathlib import Path

p = Path("scripts/coding-agent-review-repo.sh")
text = p.read_text()

old = '''Patch focus:
1. Improve correctness or clarity.
2. Keep the existing architecture.
3. Do not remove auth.
4. Do not expose secrets.
5. Prefer small, reviewable changes.
'''

new = '''Patch focus:
1. Improve correctness or clarity.
2. Keep the existing architecture.
3. Do not remove auth.
4. Do not expose secrets.
5. Prefer small, reviewable changes.

Allowed patch files:
- src/index.ts
- src/agents/coding.ts
- src/agents/counter.ts
- src/agents/echo.ts
- wrangler.jsonc
- tsconfig.worker.json
- package.json

Hard patch rules:
- Do not propose public/counter.ts.
- Do not propose files that are not listed above.
- Do not invent VITE_API_KEY, VITE_API_BASE_URL, or frontend environment variables unless shown in context.
- Do not create new files unless explicitly requested.
- If no safe patch is possible using only the allowed files, respond with NO_SAFE_PATCH.
'''

if old not in text:
    raise SystemExit("Could not find patch focus block in scripts/coding-agent-review-repo.sh")

text = text.replace(old, new)
p.write_text(text)
PY

pnpm run cf:types
pnpm run cf:typecheck

echo
echo "✅ CodingAgent patch mode hardened."
echo
echo "Next:"
echo "  lsof -ti :8787 | xargs -r kill -9"
echo "  pnpm run cf:dev"
echo
echo "Then:"
echo "  scripts/coding-agent-propose-patch.sh http://localhost:8787"
