#!/usr/bin/env python3
"""Harden CodingAgent patch-proposal mode — adds the allowed-files
whitelist + NO_SAFE_PATCH rules to coding.ts and the review-repo
script, then typechecks."""

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

PROJECT_DIR = Path("/home/tbaltzakis/cloudless.gr")

os.chdir(PROJECT_DIR)

print("==> Hardening CodingAgent patch proposal mode")

ts = time.strftime("%Y%m%d-%H%M%S")
shutil.copy("src/agents/coding.ts", f"src/agents/coding.ts.bak-strict-patch-{ts}")

review_py = Path("scripts/coding-agent-review-repo.py")
review_sh = Path("scripts/coding-agent-review-repo.sh")
review = review_py if review_py.exists() else review_sh
shutil.copy(review, f"{review}.bak-strict-patch-{ts}")

# --- coding.ts rules block ---
p = Path("src/agents/coding.ts")
text = p.read_text()
old = """      "- Do not invent file paths.",
      "- Do not include secrets.","""
new = """      "- Do not invent file paths.",
      "- Do not create new files unless the user explicitly requested new files.",
      "- Allowed file paths are only those present in the repository context under lines that start with ## FILE:.",
      "- Every path in the unified diff must match an existing ## FILE path from the repository context.",
      "- If no safe patch can be made using only those files, output NO_SAFE_PATCH and explain why.",
      "- Do not include secrets.",
      "- Do not invent environment variable names, import paths, framework assumptions, or public files not shown in context.","""
if old not in text:
    sys.exit("Could not find patch rules block in src/agents/coding.ts")
p.write_text(text.replace(old, new))

# --- review-repo patch focus block ---
text = review.read_text()
old = """Patch focus:
1. Improve correctness or clarity.
2. Keep the existing architecture.
3. Do not remove auth.
4. Do not expose secrets.
5. Prefer small, reviewable changes.
"""
new = """Patch focus:
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
"""
if old not in text:
    sys.exit(f"Could not find patch focus block in {review}")
review.write_text(text.replace(old, new))

subprocess.call(["pnpm", "run", "cf:types"])
subprocess.call(["pnpm", "run", "cf:typecheck"])

print("""
✅ CodingAgent patch mode hardened.

Next:
  lsof -ti :8787 | xargs -r kill -9
  pnpm run cf:dev

Then:
  python3 scripts/coding-agent-propose-patch.py http://localhost:8787""")
