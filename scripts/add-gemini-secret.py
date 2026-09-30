#!/usr/bin/env python3
"""Add GEMINI_API_KEY to Cloudflare Workers secrets.

Usage: python3 scripts/add-gemini-secret.py YOUR_API_KEY"""

import json
import subprocess
import sys
import urllib.request

if len(sys.argv) < 2:
    print(f"Usage: {sys.argv[0]} YOUR_GEMINI_API_KEY\n")
    print("Get your API key from: https://ai.google.dev/gemini-api/docs/api-key")
    sys.exit(1)

print("Adding GEMINI_API_KEY to Wrangler...")
r = subprocess.run(
    ["npx", "wrangler", "secret", "put", "GEMINI_API_KEY", "--config", "wrangler.jsonc"],
    input=sys.argv[1],
    text=True,
)

print("\nTesting the chat endpoint...")
req = urllib.request.Request(
    "https://cloudless.gr/api/chat",
    data=json.dumps({"messages": [{"role": "user", "content": "test"}]}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    print(urllib.request.urlopen(req, timeout=30).read()[:2000].decode(errors="replace"))
except Exception as e:
    print(f"(chat probe failed: {e})")

print("\nDone!")
