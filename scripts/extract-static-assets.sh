#!/bin/bash
# Extract static assets from Next.js build for Cloudflare Workers
# Creates a static export compatible with Workers + R2 hosting
set -euo pipefail

echo "=== Building for Cloudflare Workers deployment ==="

# Clean out directory
rm -rf ./out
mkdir -p ./out

# Build Next.js with static export
echo "Building Next.js static export..."
NEXT_OUTPUT_STANDALONE=1 pnpm build

# Copy all static assets from .next
echo "Copying static assets..."
if [ -d ".next/static" ]; then
    cp -r .next/static/* ./out/ 2>/dev/null || true
fi

# Copy public files
echo "Copying public assets..."
if [ -d "public" ]; then
    cp -r public/* ./out/ 2>/dev/null || true
fi

# Create locale-specific index.html files for i18n
for locale in en el fr; do
    mkdir -p "./out/${locale}"
    cat > "./out/${locale}/index.html" << EOF
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="description" content="Clear skies. Zero friction." />
  <title>Cloudless — Cloud Computing, Serverless & AI Marketing</title>
  <meta name="theme-color" content="#000000" />
  <link rel="icon" href="/favicon.ico" />
  <script>
    // Client-side locale redirect for SPA
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/${locale}')) {
      window.location.pathname = '/${locale}' + window.location.pathname;
    }
  </script>
</head>
<body>
  <div id="root">Loading...</div>
  <script src="/static/chunks/main.js" defer></script>
</body>
</html>
EOF
done

# Create fallback index.html for root path
cat > ./out/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="description" content="Clear skies. Zero friction." />
  <title>Cloudless — Cloud Computing, Serverless & AI Marketing</title>
  <meta name="theme-color" content="#000000" />
  <link rel="icon" href="/favicon.ico" />
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
