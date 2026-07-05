#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_ACCOUNT_ID:?Set CLOUDFLARE_ACCOUNT_ID}"
: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN}"

MODEL="${MODEL:-@cf/meta/llama-3.1-8b-instruct-fast}"

curl -sS \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/ai/v1/chat/completions" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"messages\": [
      {
        \"role\": \"system\",
        \"content\": \"You are a concise Cloudflare Workers AI test assistant.\"
      },
      {
        \"role\": \"user\",
        \"content\": \"Say hello from Cloudflare OpenAI-compatible endpoint.\"
      }
    ]
  }" | python3 -m json.tool
