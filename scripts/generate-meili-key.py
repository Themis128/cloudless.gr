#!/usr/bin/env python3
"""Generate MEILI_MASTER_KEY for Meilisearch — a secure
64-character hex key (32 bytes)."""

import secrets

key = secrets.token_hex(32)
print(f"Generated MEILI_MASTER_KEY: {key}\n")
print("To apply this secret to k3s:")
print(
    f"  kubectl create secret generic meilisearch-secret "
    f"-n meilisearch --from-literal=MEILI_MASTER_KEY={key} "
    "--dry-run=client -o yaml | kubectl apply -f -\n"
)
print("Or to store in GitHub Actions secrets:")
print(f"  gh secret set MEILI_MASTER_KEY --body '{key}' --repo Themis128/cloudless.gr")
