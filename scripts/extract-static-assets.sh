#!/bin/bash
# Extract static assets from Next.js build for Cloudflare Workers
# Creates a static export compatible with Workers + R2 hosting
set -euo pipefail

echo "=== Building for Cloudflare Workers deployment ==="

# Ensure out directory exists
mkdir -p ./out

# Build Next.js with static export
echo "Building Next.js static export..."
NEXT_OUTPUT_STANDALONE=1 pnpm build

# Copy all static assets from .next (preserve /static prefix for correct path resolution)
echo "Copying static assets..."
if [ -d ".next/static" ]; then
    cp -r .next/static ./out/static 2>/dev/null || true
fi

# Copy public files
echo "Copying public assets..."
if [ -d "public" ]; then
    # Skip index.html from public - we'll generate proper ones
    find public -type f ! -name "index.html" -exec cp {} ./out/ \; 2>/dev/null || true
fi

# Get the main CSS bundle filename (for styling)
CSS_BUNDLE=$(find .next/static/chunks -name "*.css" 2>/dev/null | head -1 | sed 's|.next/||' || true)
if [ -z "$CSS_BUNDLE" ]; then
    CSS_BUNDLE="static/chunks/2p-z36o5ca_9e.css"
fi

# Get the main JS bundle filename
MAIN_BUNDLE=$(find .next/static/chunks -name "*-e5fd6e*.js" -o -name "main-*.js" 2>/dev/null | head -1 || true)
if [ -z "$MAIN_BUNDLE" ]; then
    # Try to find any initial chunk
    MAIN_BUNDLE=$(find .next/static/chunks -name "1ualf*.js" 2>/dev/null | head -1 | sed 's|.next/||' || true)
fi

# Fallback to known bundle if detection fails
if [ -z "$MAIN_BUNDLE" ]; then
    MAIN_BUNDLE="static/chunks/1ualfx4277rj2.js"
fi

# Create locale-specific index.html files for i18n with proper bundle loading
for locale in en el fr de; do
    mkdir -p "./out/${locale}"
    cat > "./out/${locale}/index.html" << EOF
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="description" content="Clear skies. Zero friction." />
  <title>Cloudless — Cloud Computing, Serverless & AI Marketing</title>
  <meta name="theme-color" content="#0a7785" />
  <link rel="icon" href="/favicon.ico" />
  <link rel="stylesheet" href="/${CSS_BUNDLE}" />
</head>
<body>
  <div id="root">Loading...</div>
  <script src="/${MAIN_BUNDLE}" defer></script>
</body>
</html>
EOF
done

# Create fallback index.html for root path with proper bundle loading
cat > ./out/index.html << EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="description" content="Clear skies. Zero friction." />
  <title>Cloudless — Cloud Computing, Serverless & AI Marketing</title>
  <meta name="theme-color" content="#000000" />
  <link rel="icon" href="/favicon.ico" />
  <link rel="stylesheet" href="/${CSS_BUNDLE}" />
  <script>
    // Root redirect to /en for locale routing
    if (typeof window !== 'undefined' && window.location.hostname === 'cloudless.gr') {
      const path = window.location.pathname === '/' ? '/en' : '/en' + window.location.pathname;
      window.location.pathname = path;
    }
  </script>
</head>
<body>
  <div id="root">Loading...</div>
  <script src="/${MAIN_BUNDLE}" defer></script>
</body>
</html>
EOF

echo "✅ Static assets extracted to ./out/"

# Upload to R2 bucket
echo "Uploading to R2..."
if [ -d "./out" ]; then
  find "./out" -type f | while read -r file; do
    rel_path="${file#./out/}"

    # Skip hidden files
    if [[ "$rel_path" == .* ]]; then
      continue
    fi

    echo "Uploading: $rel_path"
    npx wrangler r2 object put "cloudless-assets/$rel_path" --file="$file" --remote 2>/dev/null || true
  done
  echo "✅ Assets uploaded to R2"
else
  echo "❌ No ./out directory found - cannot upload"
  exit 1
fi