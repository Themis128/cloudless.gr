#!/bin/bash
# Resume R2 upload from local cache (S3 download already complete)
set -e

TEMP_DIR="/tmp/tmp.d3kiKTyfZa"
echo "🚀 Resuming R2 upload from local cache..."
echo "   Files available: $(find "${TEMP_DIR}/assets" -type f | wc -l)"
echo ""

# Get list of already-uploaded objects from R2
echo "=== Checking what's already in R2 ==="
# Use a marker file to persist across runs
R2_LIST="/tmp/r2-existing-files.txt"
if [ ! -f "$R2_LIST" ]; then
    for key in $(find "${TEMP_DIR}/assets" -type f | sed "s|${TEMP_DIR}/assets/||" | head -100); do
        echo "$key"
    done > /tmp/keys-sample.txt 2>/dev/null || true
    # We'll skip this and just overwrite; R2 PUT is idempotent
    echo "   (Will overwrite existing files - R2 PUT is idempotent)"
fi
echo ""

# Upload with xargs for parallel processing
echo "=== Uploading to R2 (parallel) ==="
cd "${TEMP_DIR}/assets"

upload_file() {
    local file="$1"
    # Determine content type
    ext="${file##*.}"
    case "$ext" in
        css) ct="text/css" ;;
        js) ct="application/javascript" ;;
        json) ct="application/json" ;;
        html) ct="text/html" ;;
        svg) ct="image/svg+xml" ;;
        png) ct="image/png" ;;
        jpg|jpeg) ct="image/jpeg" ;;
        gif) ct="image/gif" ;;
        webp) ct="image/webp" ;;
        woff2) ct="font/woff2" ;;
        woff) ct="font/woff" ;;
        *) ct="application/octet-stream" ;;
    esac
    
    # Upload - suppress all output except errors
    npx wrangler r2 object put "cloudless-assets/${file}" \
        --file "$file" \
        --content-type "$ct" \
        --cache-control "public, max-age=31536000, immutable" \
        --remote 2>/dev/null && echo "OK:$file" || echo "FAIL:$file"
}
export -f upload_file

# Upload in parallel batches using xargs
TIMESTAMP=$(date +%s)
BATCH_DIR="/tmp/r2-upload-${TIMESTAMP}"
mkdir -p "$BATCH_DIR"

find . -type f -print0 | \
    xargs -0 -P 5 -I {} bash -c 'upload_file "$@"' _ {} 2>&1 | \
    tee "${BATCH_DIR}/results.txt"

# Count results
OK_COUNT=$(grep -c "^OK:" "${BATCH_DIR}/results.txt" 2>/dev/null || echo 0)
FAIL_COUNT=$(grep -c "^FAIL:" "${BATCH_DIR}/results.txt" 2>/dev/null || echo 0)

echo ""
echo "=== Results ==="
echo "   Uploaded: ${OK_COUNT} files"
echo "   Failed: ${FAIL_COUNT} files"
echo ""
echo "🎉 Upload complete!"
echo "   Verify: curl -I https://cloudless.gr/_next/static/"