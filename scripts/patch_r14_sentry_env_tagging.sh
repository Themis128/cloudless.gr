#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# patch_r14_sentry_env_tagging.sh
#
# Purpose:
#   Implement R14 Sentry environment tagging:
#     - AWS/Lambda production reports SENTRY_ENVIRONMENT=prod
#     - Pi standby reports SENTRY_ENVIRONMENT=pi-standby
#
# Safe behavior:
#   - Backs up touched files
#   - Applies small targeted text patches
#   - Prints validation grep output
#
# Run:
#   cd ~/code/cloudless.gr
#   bash scripts/patch_r14_sentry_env_tagging.sh
# ============================================================

PROJECT_ROOT="${PROJECT_ROOT:-$HOME/code/cloudless.gr}"
cd "$PROJECT_ROOT"

backup() {
  local file="$1"
  if [ -f "$file" ]; then
    cp "$file" "$file.bak-r14-$(date +%Y%m%d-%H%M%S)"
  fi
}

patch_sst() {
  local file="sst.config.ts"
  if [ ! -f "$file" ]; then
    echo "⚠️  Missing $file; skipping AWS/Lambda env patch."
    return 0
  fi

  backup "$file"

  python - <<'PY'
from pathlib import Path

path = Path("sst.config.ts")
text = path.read_text(encoding="utf-8")
original = text

# R14 target: production should be exactly "prod" per canonical TODO.
text = text.replace(
    'SENTRY_ENVIRONMENT: isProd ? "production" : `staging-${stage}`',
    'SENTRY_ENVIRONMENT: isProd ? "prod" : `staging-${stage}`',
)

if text == original:
    print("⚠️  No exact sst.config.ts SENTRY_ENVIRONMENT pattern replaced.")
else:
    path.write_text(text, encoding="utf-8")
    print("✅ Patched sst.config.ts production SENTRY_ENVIRONMENT to prod.")
PY
}

patch_workflow_pi_env() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "⚠️  Missing $file; skipping."
    return 0
  fi

  if grep -q "SENTRY_ENVIRONMENT" "$file"; then
    echo "✅ $file already contains SENTRY_ENVIRONMENT; skipping."
    return 0
  fi

  backup "$file"

  python - "$file" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
lines = path.read_text(encoding="utf-8").splitlines()
out = []
inserted = False

for line in lines:
    out.append(line)
    if not inserted and "NEXT_PUBLIC_SENTRY_DSN" in line:
        indent = line[: len(line) - len(line.lstrip())]
        stripped = line.strip()
        if ":" in stripped and not stripped.startswith("echo") and not stripped.startswith("NEXT_PUBLIC_SENTRY_DSN="):
            out.append(f"{indent}SENTRY_ENVIRONMENT: pi-standby")
        else:
            out.append(f"{indent}SENTRY_ENVIRONMENT=pi-standby")
        inserted = True

if inserted:
    path.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"✅ Added SENTRY_ENVIRONMENT=pi-standby to {path}")
else:
    print(f"⚠️  Did not find NEXT_PUBLIC_SENTRY_DSN in {path}; no change made.")
PY
}

patch_sst
patch_workflow_pi_env ".github/workflows/deploy-pi.yml"
patch_workflow_pi_env ".github/workflows/build-pi-image.yml"

echo
echo "=== R14 validation grep ==="
grep -R \
  --exclude-dir=.venv \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.next \
  "SENTRY_ENVIRONMENT\|NEXT_PUBLIC_SENTRY_DSN" \
  -n sst.config.ts .github/workflows/deploy-pi.yml .github/workflows/build-pi-image.yml .github/workflows/deploy.yml 2>/dev/null || true

echo
echo "✅ R14 patch script finished. Review with: git diff -- sst.config.ts .github/workflows/deploy-pi.yml .github/workflows/build-pi-image.yml"
