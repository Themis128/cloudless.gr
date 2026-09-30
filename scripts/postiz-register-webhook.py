#!/usr/bin/env python3
"""postiz-register-webhook.py — print the exact Postiz UI webhook URL
and optionally patch API_LIMIT on the live Deployment.

Secrets are never printed. Fetch POSTIZ_WEBHOOK_SECRET yourself from
SSM (or paste into the UI) — this script only reminds the URL shape.

--apply-api-limit  patches API_LIMIT=100 on deploy/postiz."""

import os
import subprocess
import sys

NS = os.environ.get("POSTIZ_NAMESPACE", "postiz")

print("""==> Register Postiz → cloudless webhook (UI)

1. Open https://postiz.cloudless.gr → Settings → Webhooks (or Integrations).
2. Create webhook:
   Name:  cloudless-app
   URL:   https://cloudless.gr/api/webhooks/postiz?secret=<POSTIZ_WEBHOOK_SECRET>
   Events: post published + post errored (select all connected channels).
3. Secret source (do not commit):
     aws ssm get-parameter --name /cloudless/production/POSTIZ_WEBHOOK_SECRET \\
       --with-decryption --query Parameter.Value --output text
4. Smoke: publish a Bluesky/LinkedIn draft → expect Slack/calendar path via
   POST /api/webhooks/postiz (see src/app/api/webhooks/postiz/route.ts).

==> n8n import (operator UI)

1. Open in-cluster n8n (see infrastructure/n8n/README.md).
2. Import:
     infrastructure/n8n/workflows/postiz-rss-multichannel.json
     infrastructure/n8n/workflows/postiz-utm-guard.json
3. Credential / header auth for Postiz Public API:
     Base URL: http://postiz.postiz.svc.cluster.local:5000/api
     Header:   Authorization = <POSTIZ_API_KEY>
4. Activate both workflows. Keep AUTO_POST_BLOG_TO_SOCIAL unset on
   cloudless-app unless you want AppFlowy Published → social fan-out.
""")

if "--apply-api-limit" in sys.argv:
    print("==> Patching API_LIMIT=100 on deploy/postiz")
    subprocess.run(
        ["kubectl", "-n", NS, "set", "env", "deployment/postiz", "API_LIMIT=100"], check=True
    )
    subprocess.run(
        ["kubectl", "-n", NS, "rollout", "status", "deployment/postiz", "--timeout=300s"],
        check=True,
    )
    print("Done.")
