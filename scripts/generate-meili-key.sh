#!/usr/bin/env bash
# Generate MEILI_MASTER_KEY for Meilisearch
# Run this on the Pi or any Unix system with openssl

# Generate a secure 64-character hex key (32 bytes)
MEILI_MASTER_KEY=$(openssl rand -hex 32 | tr -d '\n')

echo "Generated MEILI_MASTER_KEY: $MEILI_MASTER_KEY"
echo ""
echo "To apply this secret to k3s:"
echo "  kubectl create secret generic meilisearch-secret -n meilisearch --from-literal=MEILI_MASTER_KEY=$MEILI_MASTER_KEY --dry-run=client -o yaml | kubectl apply -f -"
echo ""
echo "Or to store in GitHub Actions secrets:"
echo "  gh secret set MEILI_MASTER_KEY --body '$MEILI_MASTER_KEY' --repo Themis128/cloudless.gr"