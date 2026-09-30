#!/usr/bin/env python3
"""Extract static assets from Next.js build for Cloudflare Workers —
creates a static export compatible with Workers + R2 hosting, then
uploads ./out to the cloudless-assets bucket."""

import os
import shutil
import subprocess
import sys
from pathlib import Path

OUT = Path("./out")
OUT.mkdir(exist_ok=True)

print("=== Building for Cloudflare Workers deployment ===")

print("Building Next.js static export...")
env = {**os.environ, "NEXT_OUTPUT_STANDALONE": "1"}
r = subprocess.run(["pnpm", "build"], env=env)
if r.returncode != 0:
    sys.exit(r.returncode)

print("Copying static assets...")
static = Path(".next/static")
if static.is_dir():
    shutil.copytree(static, OUT / "static", dirs_exist_ok=True)

print("Copying public assets...")
public = Path("public")
if public.is_dir():
    for f in public.rglob("*"):
        if f.is_file() and f.name != "index.html":
            shutil.copy2(f, OUT / f.name)

chunks = Path(".next/static/chunks")

css = next(chunks.glob("*.css"), None)
css_bundle = str(css.relative_to(".next")) if css else "static/chunks/2p-z36o5ca_9e.css"

main = (
    next(chunks.glob("*-e5fd6e*.js"), None)
    or next(chunks.glob("main-*.js"), None)
    or next(chunks.glob("1ualf*.js"), None)
)
main_bundle = str(main.relative_to(".next")) if main else "static/chunks/1ualfx4277rj2.js"

LOCALE_HTML = """<!DOCTYPE html>
<html lang="{locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="description" content="Clear skies. Zero friction." />
  <title>Cloudless — Cloud Computing, Serverless & AI Marketing</title>
  <meta name="theme-color" content="#0a7785" />
  <link rel="icon" href="/favicon.ico" />
  <link rel="stylesheet" href="/{css}" />
</head>
<body>
  <div id="root">Loading...</div>
  <script src="/{js}" defer></script>
</body>
</html>
"""

for locale in ("en", "el", "fr", "de"):
    d = OUT / locale
    d.mkdir(exist_ok=True)
    (d / "index.html").write_text(LOCALE_HTML.format(locale=locale, css=css_bundle, js=main_bundle))

(OUT / "index.html").write_text(f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="description" content="Clear skies. Zero friction." />
  <title>Cloudless — Cloud Computing, Serverless & AI Marketing</title>
  <meta name="theme-color" content="#000000" />
  <link rel="icon" href="/favicon.ico" />
  <link rel="stylesheet" href="/{css_bundle}" />
  <script>
    // Root redirect to /en for locale routing
    if (typeof window !== 'undefined' && window.location.hostname === 'cloudless.gr') {{
      const path = window.location.pathname === '/' ? '/en' : '/en' + window.location.pathname;
      window.location.pathname = path;
    }}
  </script>
</head>
<body>
  <div id="root">Loading...</div>
  <script src="/{main_bundle}" defer></script>
</body>
</html>
""")

print("✅ Static assets extracted to ./out/")

print("Uploading to R2...")
for f in sorted(OUT.rglob("*")):
    if not f.is_file():
        continue
    rel = str(f.relative_to(OUT))
    if rel.startswith("."):
        continue
    print(f"Uploading: {rel}")
    subprocess.run(
        [
            "npx",
            "wrangler",
            "r2",
            "object",
            "put",
            f"cloudless-assets/{rel}",
            f"--file={f}",
            "--remote",
        ],
        capture_output=True,
    )
print("✅ Assets uploaded to R2")
