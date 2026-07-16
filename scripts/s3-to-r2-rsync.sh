#!/bin/bash
# S3 to R2 Migration using rsync-style download + upload
# 1. Download S3 assets to local temp
# 2. Upload to R2 using rclone or parallel uploads with rate limiting

set -e

# Configuration
S3_BUCKET="cloudless-production-cloudlesssiteassetsbucket-sasvvhra"
S3_PREFIX="_assets/_next/static/"
R2_BUCKET="cloudless-assets"
TEMP_DIR=$(mktemp -d)
CONCURRENCY=3  # Low concurrency to avoid rate limiting

# Rate limiting
RATE_LIMIT_MS=200  # 200ms delay between uploads

echo "🚀 Starting S3 to R2 migration (rsync-style)..."
echo ""

# Step 1: Download from S3
echo "=== Step 1: Downloading from S3 ==="
aws s3 sync "s3://${S3_BUCKET}/${S3_PREFIX}" "${TEMP_DIR}/assets" \
    --content-type "application/octet-stream" \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "*" --include "*" || true

FILE_COUNT=$(find "${TEMP_DIR}/assets" -type f | wc -l)
echo "   Downloaded ${FILE_COUNT} files"
echo ""

# Step 2: Upload to R2 with rate limiting
echo "=== Step 2: Uploading to R2 ==="

upload_file() {
    local file="$1"
    local key="${file#${TEMP_DIR}/assets/}"
    
    # Get content type
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
    
    npx wrangler r2 object put "${R2_BUCKET}/${key}" \
        --file "$file" \
        --content-type "$content_type" \
        --cache-control "public, max-age=31536000, immutable" \
        --remote 2>&1 | grep -v "^\s*$" || true
    
    echo "1" >> "${TEMP_DIR}/progress"
}

export -f upload_file
export TEMP_DIR R2_BUCKET

# Upload with rate limiting using a simple loop
find "${TEMP_DIR}/assets" -type f -print0 | while IFS= read -r -d '' file; do
    key="${file#${TEMP_DIR}/assets/}"
    
    # Get content type
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
    
    echo "   Uploading: ${key}"
    npx wrangler r2 object put "${R2_BUCKET}/${key}" \
        --file "$file" \
        --content-type "$content_type" \
        --cache-control "public, max-age=31536000, immutable" \
        --remote 2>&1 | tail -1 || true
    
    sleep 0.5  # Rate limit: 500ms delay to avoid 429 errors
done

MIGRATED_COUNT=$(cat "${TEMP_DIR}/progress" 2>/dev/null | wc -l || echo 0)
echo ""
echo "   Migrated ${MIGRATED_COUNT} files"

# Cleanup
rm -rf "${TEMP_DIR}"

echo ""
echo "🎉 Migration complete!"
echo "   Next steps:"
echo "   1. Verify: curl https://cloudless.gr/_next/static/chunks/*.js"
echo "   2. Deploy: npx wrangler deploy --config wrangler-cloudflare-free.json"