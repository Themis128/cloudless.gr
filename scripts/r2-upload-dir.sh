#!/usr/bin/env bash
# Upload all files from ./out to cloudless-assets R2 bucket
set -euo pipefail

BUCKET="cloudless-assets"
OUT_DIR="./out"

if [ ! -d "$OUT_DIR" ]; then
  echo "Error: $OUT_DIR directory not found. Run 'pnpm cf:build' first."
  exit 1
fi

echo "Uploading files from $OUT_DIR to R2 bucket: $BUCKET"

find "$OUT_DIR" -type f | while read -r file; do
  # Get relative path from out directory
  rel_path="${file#$OUT_DIR/}"
  
  # Skip hidden files
  if [[ "$rel_path" == .* ]]; then
    continue
  fi
  
  echo "Uploading: $rel_path"
  npx wrangler r2 object put "$BUCKET" --file "$file" "$rel_path" 2>/dev/null || true
done

echo "Done uploading to $BUCKET"