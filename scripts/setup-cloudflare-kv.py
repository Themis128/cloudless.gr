#!/usr/bin/env python3
"""Setup KV namespaces for OpenNext.js production caching.
Creates TAG_CACHE + REVALIDATION_QUEUE (prod + preview) and prints
the IDs to drop into wrangler.jsonc."""

import re
import subprocess


def create_ns(name: str, preview: bool) -> str:
    args = ["npx", "wrangler", "kv", "namespace", "create", name, "--config", "wrangler.jsonc"]
    if preview:
        args.append("--preview")
    else:
        args += ["--preview", "false"]
    r = subprocess.run(args, capture_output=True, text=True)
    m = re.search(r"id: ([a-f0-9-]+)", r.stdout + r.stderr)
    return m.group(1) if m else ""


print("=== Cloudflare KV Setup Script ===\n")
print("Creating production KV namespaces...")
print("Creating TAG_CACHE namespace...")
tag = create_ns("TAG_CACHE", preview=False)
print("Creating REVALIDATION_QUEUE namespace...")
reval = create_ns("REVALIDATION_QUEUE", preview=False)

print("\nCreating preview KV namespaces...")
print("Creating TAG_CACHE (preview) namespace...")
tag_prev = create_ns("TAG_CACHE", preview=True)
print("Creating REVALIDATION_QUEUE (preview) namespace...")
reval_prev = create_ns("REVALIDATION_QUEUE", preview=True)

print(f"""
=== KV Namespaces Created ===
Production:
  TAG_CACHE: {tag}
  REVALIDATION_QUEUE: {reval}

Preview:
  TAG_CACHE: {tag_prev}
  REVALIDATION_QUEUE: {reval_prev}

Update wrangler.jsonc with these IDs:
  "kv_namespaces": [
    {{
      "binding": "TAG_CACHE",
      "id": "{tag or "TAG_CACHE_ID_HERE"}"
    }},
    {{
      "binding": "REVALIDATION_QUEUE",
      "id": "{reval or "REVALIDATION_QUEUE_ID_HERE"}"
    }}
  ],
  "env": {{
    "staging": {{
      "kv_namespaces": [
        {{
          "binding": "TAG_CACHE",
          "id": "{tag_prev or "TAG_CACHE_PREVIEW_ID_HERE"}"
        }},
        {{
          "binding": "REVALIDATION_QUEUE",
          "id": "{reval_prev or "REVALIDATION_QUEUE_PREVIEW_ID_HERE"}"
        }}
      ]
    }}
  }}""")
