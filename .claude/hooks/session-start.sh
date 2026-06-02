#!/bin/bash
# Session-start hook for Claude Code on the web.
#
# Required session secrets (set in Claude Code web UI → session settings → Secrets):
#   GITHUB_PAT           — GitHub Personal Access Token for git push/PR operations
#   AWS_ACCESS_KEY_ID    — AWS credentials for SSM secret fetch (optional if role-based)
#   AWS_SECRET_ACCESS_KEY
#   TAILSCALE_AUTH_KEY   — ephemeral Tailscale auth key (tailscale.com/admin/settings/keys)
#   OMV_SSH_KEY_CONTENTS — base64-encoded SSH private key (base64 -w0 ~/.ssh/id_ed25519)

set -euo pipefail

# Only run in remote (cloud) sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

SETTINGS_FILE="${HOME}/.claude/settings.json"

# ── Helper: write a key=value into the settings.json env block ─────────────────
inject_env() {
  local key="$1" value="$2"
  python3 - "$key" "$value" "$SETTINGS_FILE" << 'PY'
import json, sys
key, value, path = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path) as f:
  d = json.load(f)
d.setdefault("env", {})[key] = value
with open(path, "w") as f:
  json.dump(d, f, indent=4)
PY
}

# ── GitHub PAT ─────────────────────────────────────────────────────────────────

if [ -n "${GITHUB_PAT:-}" ]; then
  echo "[session-start] Configuring git auth with GITHUB_PAT..."
  cat > /tmp/gh-cred-helper.sh << CRED_EOF
#!/bin/bash
echo "username=x-access-token"
echo "password=${GITHUB_PAT}"
CRED_EOF
  chmod +x /tmp/gh-cred-helper.sh
  git config --global credential.helper "/tmp/gh-cred-helper.sh"
  echo "[session-start] Git auth ready."
else
  echo "[session-start] GITHUB_PAT not set — git push will require manual auth." >&2
fi

# ── Secrets: SSM (primary) or GitHub Variables (fallback) ─────────────────────
# Writes every secret into ~/.claude/settings.json env block so MCP servers
# (Notion, HubSpot, etc.) and tools get them without per-session manual config.
#
# Priority:
#   1. AWS SSM /cloudless/production/* — when AWS credentials are present
#   2. GitHub Variables — when only GITHUB_PAT is available (synced by
#      .github/workflows/sync-ssm-to-vars.yml on every push to main)

SETTINGS_FILE="${HOME}/.claude/settings.json"
SSM_PREFIX="/cloudless/production"
GH_REPO="Themis128/cloudless.gr"

inject_settings_env() {
  # $1 = JSON array of {Name, Value} objects (SSM) or {name, value} (GH vars)
  python3 - "$SETTINGS_FILE" << PY
import json, sys
path = sys.argv[1]
raw = sys.stdin.read()
params = json.loads(raw)
with open(path) as f:
  settings = json.load(f)
env = settings.setdefault("env", {})
for p in params:
  key = p.get("Name", p.get("name", ""))
  key = key.split("/")[-1]   # strip SSM prefix if present
  value = p.get("Value", p.get("value", ""))
  if key and value:
    env[key] = value
with open(path, "w") as f:
  json.dump(settings, f, indent=4)
print(f"Injected {len(params)} secrets into settings.json")
PY
}

if aws sts get-caller-identity --region us-east-1 &>/dev/null; then
  echo "[session-start] AWS credentials found — fetching SSM params from ${SSM_PREFIX}..."
  PARAMS=$(aws ssm get-parameters-by-path \
    --path "$SSM_PREFIX" \
    --with-decryption \
    --recursive \
    --query "Parameters[*].{Name:Name,Value:Value}" \
    --output json \
    --region us-east-1 2>/dev/null) || PARAMS="[]"

  COUNT=$(echo "$PARAMS" | python3 -c "import sys,json; params=json.load(sys.stdin); [print(p['Name'].split('/')[-1]+'='+p['Value']) for p in params]" 2>/dev/null | wc -l)

  echo "$PARAMS" | python3 - "$SETTINGS_FILE" "$SSM_PREFIX" << 'PY'
import json, sys
params_json, settings_path, prefix = sys.stdin.read(), sys.argv[1], sys.argv[2]
params = json.loads(params_json)
with open(settings_path) as f:
  settings = json.load(f)
env = settings.setdefault("env", {})
for p in params:
  key = p["Name"].replace(f"{prefix}/", "")
  env[key] = p["Value"]
with open(settings_path, "w") as f:
  json.dump(settings, f, indent=4)
PY

  echo "[session-start] Injected ${COUNT} SSM params into settings.json env block."
elif [ -n "${GITHUB_PAT:-}" ]; then
  # Fallback: read GitHub Variables (synced from SSM/Secrets by sync-*.yml workflows)
  # Paginates through all pages (repo has >100 variables across 3 pages).
  echo "[session-start] No AWS credentials — fetching secrets from GitHub Variables..."

  COUNT=$(python3 - "${GITHUB_PAT}" "${GH_REPO}" "${SETTINGS_FILE}" << 'PY'
import json, sys, urllib.request

pat, repo, settings_path = sys.argv[1], sys.argv[2], sys.argv[3]
all_vars = []
page = 1

while True:
    url = f"https://api.github.com/repos/{repo}/actions/variables?per_page=100&page={page}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {pat}",
        "Accept": "application/vnd.github+json",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            d = json.loads(r.read())
    except Exception:
        break
    batch = d.get("variables", [])
    if not batch:
        break
    all_vars.extend(batch)
    page += 1

with open(settings_path) as f:
    settings = json.load(f)
env = settings.setdefault("env", {})
for v in all_vars:
    key = v.get("name", "")
    value = (v.get("value") or "").strip()
    if key and value:
        env[key] = value
with open(settings_path, "w") as f:
    json.dump(settings, f, indent=4)
print(len(all_vars))
PY
  ) || COUNT=0

  if [ "${COUNT:-0}" -gt 0 ]; then
    echo "[session-start] Injected ${COUNT} GitHub Variables into settings.json env block."
  else
    echo "[session-start] No GitHub Variables found — secrets not yet synced." >&2
  fi
else
  echo "[session-start] No AWS credentials or GITHUB_PAT — skipping secrets fetch." >&2
fi

# ── Tailscale ──────────────────────────────────────────────────────────────────

if [ -z "${TAILSCALE_AUTH_KEY:-}" ]; then
  echo "[session-start] TAILSCALE_AUTH_KEY not set — skipping Tailscale setup." >&2
else
  PI_IP="100.113.41.119"

  if ! command -v tailscale &>/dev/null; then
    echo "[session-start] Installing Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh
  fi

  if ! pgrep -x tailscaled &>/dev/null; then
    echo "[session-start] Starting tailscaled..."
    tailscaled --state=mem: &>/tmp/tailscaled.log &
    sleep 2
  fi

  echo "[session-start] Joining tailnet..."
  tailscale up \
    --authkey="${TAILSCALE_AUTH_KEY}" \
    --hostname="claude-cloud-$(hostname -s)" \
    --accept-routes \
    --timeout=30s

  echo "[session-start] Waiting for Pi at ${PI_IP}..."
  for i in $(seq 1 30); do
    if timeout 2 bash -c "echo >/dev/tcp/${PI_IP}/22" 2>/dev/null; then
      echo "[session-start] Pi reachable after ${i}s."
      break
    fi
    sleep 1
  done

  if ! timeout 2 bash -c "echo >/dev/tcp/${PI_IP}/22" 2>/dev/null; then
    echo "[session-start] Warning: Pi still unreachable — SSH tools may fail." >&2
  fi
fi

# ── SSH key ────────────────────────────────────────────────────────────────────

if [ -n "${OMV_SSH_KEY_CONTENTS:-}" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "[session-start] Exporting OMV_SSH_KEY_CONTENTS for MCP server..."
  printf 'export OMV_SSH_KEY_CONTENTS="%s"\n' "${OMV_SSH_KEY_CONTENTS}" >> "${CLAUDE_ENV_FILE}"
fi

echo "[session-start] Done."
