#!/bin/bash
# Script to add GEMINI_API_KEY to Cloudflare Workers

# Usage: ./add-gemini-secret.sh YOUR_API_KEY

if [ -z "$1" ]; then
    echo "Usage: $0 YOUR_GEMINI_API_KEY"
    echo ""
    echo "Get your API key from: https://ai.google.dev/gemini-api/docs/api-key"
    exit 1
fi

API_KEY="$1"

echo "Adding GEMINI_API_KEY to Wrangler..."
echo "$API_KEY" | npx wrangler secret put GEMINI_API_KEY --config wrangler.jsonc

echo ""
echo "Testing the chat endpoint..."
curl -s -X POST -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"test"}]}' \
    https://cloudless.gr/api/chat | head -100

echo ""
echo "Done!"