#!/usr/bin/env python3
"""Smoke-test the Cloudflare Workers AI OpenAI-compatible chat endpoint.

Requires env: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN
Optional: MODEL (default @cf/meta/llama-3.1-8b-instruct-fast)"""

import json
import os
import sys
import urllib.request

account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
token = os.environ.get("CLOUDFLARE_API_TOKEN")
if not account_id or not token:
    sys.exit("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN")

model = os.environ.get("MODEL", "@cf/meta/llama-3.1-8b-instruct-fast")

req = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions",
    data=json.dumps(
        {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a concise Cloudflare Workers AI test assistant.",
                },
                {
                    "role": "user",
                    "content": "Say hello from Cloudflare OpenAI-compatible endpoint.",
                },
            ],
        }
    ).encode(),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    method="POST",
)

print(json.dumps(json.loads(urllib.request.urlopen(req).read()), indent=2, ensure_ascii=False))
