#!/usr/bin/env python3
"""Generate a markdown secrets-check report from check.log output."""

import sys

log_file = sys.argv[1]
timestamp = sys.argv[2] if len(sys.argv) > 2 else ""

lines = open(log_file).read().splitlines()
ok = []
missing = []
for line in lines:
    if line.startswith("ok:"):
        ok.append(line[3:])
    elif line.startswith("missing:"):
        missing.append(line[8:])

descriptions = {
    "TS_AUTHKEY": "Tailscale auth key — cluster ops over VPN (tailscale.com/admin/settings/keys)",
    "KUBECONFIG_B64": "k3s kubeconfig system:admin — base64-encoded /etc/rancher/k3s/k3s.yaml",
    "OMV_SSH_KEY": "Pi SSH private key — enables k3s-ssh-restart + k3s-watchdog-deploy workflows",
    "NOTION_API_KEY": "Notion integration token — cluster docs, blog, submissions",
    "AWS_DEPLOY_ROLE_ARN": "OIDC deploy role — ECR push + SSM parameter access",
    "SES_SMTP_USER": "SES SMTP username — email verification (AWS Console → SES → SMTP Settings)",
    "SES_SMTP_PASSWORD": "SES SMTP password — email verification",
    "GH_PAT": "GitHub PAT repo scope — cloud session auto-push on stop hook",
}

print(f"# Secrets health check — {timestamp}")
print()
print(f"**{len(ok)} set / {len(missing)} missing**")
print()

for s in ok:
    print(f"- [x] `{s}` — {descriptions.get(s, 'set')}")
for s in missing:
    print(f"- [ ] `{s}` — ⚠️ MISSING — {descriptions.get(s, 'not set')}")

if missing:
    print()
    print("## How to add missing secrets")
    print("GitHub → repo Settings → Secrets and variables → Actions → New repository secret")
    if "OMV_SSH_KEY" in missing:
        print()
        print("### OMV_SSH_KEY")
        print("1. On the Pi: `cat ~/.ssh/id_ed25519` (or generate: `ssh-keygen -t ed25519`)")
        print("2. Ensure `~/.ssh/authorized_keys` contains the public key on the Pi")
        print(
            "3. Paste the **private key** (-----BEGIN OPENSSH PRIVATE KEY----- block) as `OMV_SSH_KEY`"
        )
        print(
            "4. Once set, trigger `k3s-watchdog-deploy.yml` to install the Restart=always drop-in"
        )
    if "SES_SMTP_USER" in missing or "SES_SMTP_PASSWORD" in missing:
        print()
        print("### SES_SMTP_USER + SES_SMTP_PASSWORD")
        print("1. AWS Console → SES → SMTP Settings → Create SMTP credentials")
        print("2. Save the username and password (only shown once)")
        print("3. Add as `SES_SMTP_USER` and `SES_SMTP_PASSWORD` repo secrets")
        print("4. Trigger `provision-ses-smtp.yml` via workflow_dispatch with those values")
