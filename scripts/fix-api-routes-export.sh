#!/usr/bin/env bash
# Fix API routes for Next.js static export
# Changes "force-dynamic" to "force-static" and adds revalidate
# This is needed because the Worker handles API routes, but Next.js
# static export validation requires all routes to be statically generatable

set -euo pipefail

# Find all API route files with force-dynamic and fix them
for file in $(grep -rl 'export const dynamic = "force-dynamic"' src/app/api --include="*.ts" --include="*.tsx" 2>/dev/null || true); do
  if [ -f "$file" ]; then
    # Replace force-dynamic with force-static and add revalidate
    perl -i -pe 's/export const dynamic = "force-dynamic";/\/\/ Static export compatibility - Worker handles API routes\nexport const dynamic = "force-static";\nexport const revalidate = 3600;/g' "$file"
    echo "Fixed: $file"
  fi
done

echo "Done fixing API routes for static export"
