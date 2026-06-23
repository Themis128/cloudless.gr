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
