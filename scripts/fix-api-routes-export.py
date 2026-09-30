#!/usr/bin/env python3
"""Fix API routes for Next.js static export — swap
`export const dynamic = "force-dynamic"` for force-static +
revalidate. The Worker handles API routes, but static export
validation requires all routes to be statically generatable."""

from pathlib import Path

OLD = 'export const dynamic = "force-dynamic";'
NEW = (
    "// Static export compatibility - Worker handles API "
    'routes\nexport const dynamic = "force-static";\n'
    "export const revalidate = 3600;"
)

for f in Path("src/app/api").rglob("*.ts"):
    text = f.read_text(errors="replace")
    if OLD in text:
        f.write_text(text.replace(OLD, NEW))
        print(f"Fixed: {f}")
for f in Path("src/app/api").rglob("*.tsx"):
    text = f.read_text(errors="replace")
    if OLD in text:
        f.write_text(text.replace(OLD, NEW))
        print(f"Fixed: {f}")

print("Done fixing API routes for static export")
