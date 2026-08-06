#!/bin/bash

# Store Cloudflare API token from GitHub secrets to Wrangler
echo "Fetching Cloudflare API token from GitHub secrets..."
TOKEN=$(gh secret list --repo Themis128/cloudless.gr | grep CLOUDFLARE_API_TOKEN | awk '{print $1}')

if [ -z "$TOKEN" ]; then
  echo "Error: Failed to fetch Cloudflare API token from GitHub secrets"
  exit 1
fi

echo "Storing token in Wrangler..."
wrangler secret put CLOUDFLARE_API_TOKEN --config wrangler-cloudless2.json --env=production

if [ $? -eq 0 ]; then
  echo "Successfully stored Cloudflare API token in Wrangler"
else
  echo "Error: Failed to store token in Wrangler"
  exit 1
fi