#!/usr/bin/env python3
"""cowork-secrets-doctor — surface which Cowork session secrets are
wired, which are missing, and which MCP servers will fail.

Usage:
  python3 scripts/cowork-secrets-doctor.py          # check all
  python3 scripts/cowork-secrets-doctor.py CF       # match names

Exit 0 if every expected secret is present, 1 otherwise."""

import os
import sys

EXPECTED = [
    ("CLOUDFLARE_API_TOKEN",
     "cloudless-infra (Cloudflare tools)",
     "cloudflare_list_tokens / zone_settings / zone_analytics "
     "/ etc. all 401"),
    ("GITHUB_PAT",
     "git push / gh CLI (from the agent's bash)",
     "push to feature branch, PR ops, workflow dispatch all "
     "fail with 401"),
    ("TAILSCALE_AUTH_KEY",
     "cloudless-infra (Pi/k3s tools)",
     "cluster_run_command / k3s_get_pods / gh_runner_health "
     "unreachable"),
    ("OMV_SSH_KEY_CONTENTS",
     "cloudless-infra (SSH to omv-main)",
     "same Pi/k3s tools — they SSH to 100.113.41.119 with "
     "this key"),
]

c_ok, c_err, c_dim, c_off = ("\033[32m", "\033[31m",
                           "\033[2m", "\033[0m")
filt = sys.argv[1] if len(sys.argv) > 1 else ""

print("Cowork session secrets — health check")
print("-------------------------------------")
if filt:
    print(f"Filter: matching '{filt}'")

passed = failed = 0
missing = []
for name, consumer, impact in EXPECTED:
    if filt and filt not in name:
        continue
    val = os.environ.get(name, "")
    if val:
        print(f"  {c_ok}✓{c_off}  {name:<30} "
              f"({val[:4]}…, {len(val)} chars)")
        print(f"       {c_dim}consumer: {consumer}{c_off}")
        passed += 1
    else:
        print(f"  {c_err}✗{c_off}  {name:<30} (not set)")
        print(f"       {c_dim}consumer: {consumer}{c_off}")
        print(f"       {c_dim}breaks  : {impact}{c_off}")
        missing.append(name)
        failed += 1

print("\n-------------------------------------")
print(f"Pass: {passed}  Fail: {failed}")

if failed:
    print("""
Missing secrets need to be added to the Cowork session env.
Steps (from skills/cowork-session-secrets/SKILL.md):

  1. Open the Cowork desktop app's session settings
     (gear icon in the chat title bar, or File → Preferences → Sessions)
  2. Open the Environment / Secrets section
  3. Add each missing name above with its correct value
  4. Save, close the chat, open a new one

If you can't find the settings UI, fall back to:
  - SSM   : aws ssm get-parameter --with-decryption --name /cloudless/production/<KEY>
  - GitHub: gh workflow run verify-cloudflare-token.yml (etc.)
  - Direct API: see scripts/cf-token-smoketest.py for the curl-only pattern
""")
    sys.exit(1)

print("\nTip: keep CLAUDE.md → Cloud Session Secrets table in "
      "sync after rotations.")
