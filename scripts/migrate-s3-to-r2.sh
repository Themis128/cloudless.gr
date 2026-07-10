#!/bin/bash
# S3 to R2 Migration Script
# Migrates cloudless.gr static assets and analytics data to Cloudflare R2

set -e

# Configuration
S3_ASSETS_BUCKET="cloudless-production-cloudlesssiteassetsbucket-sasvvhra"
S3_ANALYTICS_BUCKET="cloudless-analytics-data"
R2_ASSETS_BUCKET="cloudless-assets"
R2_DATALAKE_BUCKET="datalake-bucket"
R2_MEDIA_BUCKET="app-media-bucket"

# Temp directory for migration
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "🚀 Starting S3 to R2 migration..."

# Function to sync S3 to R2
sync_s3_to_r2() {
    local s3_bucket=$1
    local r2_bucket=$2
    local prefix=$3
    
    echo "📥 Downloading from s3://$s3_bucket/${prefix}..."
    
    # Download all objects from S3
    aws s3 sync "s3://${s3_bucket}/${prefix}" "${TEMP_DIR}/${r2_bucket}" --exclude "*" --include "*" 2>/dev/null || true
    
    # Check if there are files to upload
    if [ -d "${TEMP_DIR}/${r2_bucket}" ] && [ "$(find "${TEMP_DIR}/${r2_bucket}" -type f | wc -l)" -gt 0 ]; then
        echo "📤 Uploading to R2 bucket ${r2_bucket}..."
        
        # Find and upload all files
        find "${TEMP_DIR}/${r2_bucket}" -type f -print0 | while IFS= read -r -d '' file; do
            # Remove the temp dir prefix to get the key
            key="${file#${TEMP_DIR}/${r2_bucket}/}"
            echo "   Uploading: ${key}"
            
            # Get content type based on extension
            ext="${key##*.}"
            case "$ext" in
                css) content_type="text/css" ;;
                js) content_type="application/javascript" ;;
                json) content_type="application/json" ;;
                html) content_type="text/html" ;;
                svg) content_type="image/svg+xml" ;;
                png) content_type="image/png" ;;
                jpg|jpeg) content_type="image/jpeg" ;;
                gif) content_type="image/gif" ;;
                webp) content_type="image/webp" ;;
                woff2) content_type="font/woff2" ;;
                woff) content_type="font/woff" ;;
                *) content_type="application/octet-stream" ;;
            esac
            
            # Set cache control for static assets
            cache_control="public, max-age=31536000, immutable"
            
            npx wrangler r2 object put "${r2_bucket}/${key}" \
                --file "$file" \
                --content-type "$content_type" \
                --cache-control "$cache_control" \
                --remote 2>&1 | head -5
        done
        echo "✅ Synced ${r2_bucket}"
    else
        echo "⚠️ No files found in s3://${s3_bucket}/${prefix}"
    fi
}

# Migrate production assets (under _assets/ prefix)
echo "=== Migrating Production Assets ==="
sync_s3_to_r2 "$S3_ASSETS_BUCKET" "$R2_ASSETS_BUCKET" "_assets/"

# Migrate analytics data (events/ and lake/ prefixes)
echo "=== Migrating Analytics Data ==="
sync_s3_to_r2 "$S3_ANALYTICS_BUCKET" "$R2_DATALAKE_BUCKET" "events/"
sync_s3_to_r2 "$S3_ANALYTICS_BUCKET" "$R2_DATALAKE_BUCKET" "lake/"

# Migrate Athena results (for historical queries)
echo "=== Migrating Athena Results ==="
sync_s3_to_r2 "$S3_ANALYTICS_BUCKET" "$R2_DATALAKE_BUCKET" "athena-results/"

echo "🎉 Migration complete!"
echo ""
echo "Next steps:"
echo "1. Update cloudless.gr DNS to point to the Worker"
echo "2. Run: npx wrangler deploy"
echo "3. Test: curl https://cloudless.gr/_next/static/*"