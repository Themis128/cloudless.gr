#!/usr/bin/env bash
# Disable CloudFront distribution for cloudless.gr
# Usage: AWS_SHARED_CREDENTIALS_FILE=/path/to/rootkey.csv bash disable-cloudfront.sh

set -euo pipefail

CF_DISTRIBUTION_ID="${CF_DISTRIBUTION_ID:-ELGQBR8109MTM}"

echo "=== Disabling CloudFront Distribution for cloudless.gr ==="
echo "Distribution ID: $CF_DISTRIBUTION_ID"

# Get ETag and config
echo "Fetching distribution config..."
RESPONSE=$(aws cloudfront get-distribution-config --id "$CF_DISTRIBUTION_ID" --output json)
ETAG=$(echo "$RESPONSE" | jq -r '.ETag')

echo "ETag: $ETAG"

# Check current state
ENABLED=$(echo "$RESPONSE" | jq -r '.DistributionConfig.Enabled')
echo "Currently enabled: $ENABLED"

if [ "$ENABLED" = "false" ]; then
    echo "Already disabled. Exiting."
    exit 0
fi

# Disable the distribution
echo "Disabling distribution..."
DISABLED_RESPONSE=$(aws cloudfront update-distribution \
    --id "$CF_DISTRIBUTION_ID" \
    --if-match "$ETAG" \
    --distribution-config "$(echo "$RESPONSE" | jq '.DistributionConfig.Enabled = false')" \
    --output json)

NEW_STATUS=$(echo "$DISABLED_RESPONSE" | jq -r '.Distribution.Status')
echo "Distribution status: $NEW_STATUS (deletion takes effect after status = Deployed)"

echo "=== CloudFront distribution disable initiated ==="
echo "NOTE: After status reaches 'Deployed', you can delete the distribution with:"
echo "aws cloudfront delete-distribution --id $CF_DISTRIBUTION_ID --if-match <final-etag>"