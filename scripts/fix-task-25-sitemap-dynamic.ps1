# Task #25 fix: make src/app/sitemap.ts dynamic so notion-docs-sitemap.yml's
# TSV updates don't need a redeploy. Also: heal sitemap.ts if Cowork's sandbox
# corrupted it (the partial-flush issue).
#
# What this does:
#   1. Remove any stale .git/index.lock.
#   2. Restore sitemap.ts from HEAD (heals the truncation Cowork left behind).
#   3. Apply the 5-line patch via git apply, which is the safe path on this
#      Windows mount (Edit-tool corrupts; git apply doesn't).
#   4. Run pnpm typecheck to confirm.
#   5. Show the resulting diff.
#
# Usage: pwsh -File scripts\fix-task-25-sitemap-dynamic.ps1

$ErrorActionPreference = "Stop"
Set-Location -Path "D:\cloudless.gr"

Write-Host "==> 1. Remove stale .git/index.lock if present" -ForegroundColor Cyan
if (Test-Path ".git/index.lock") { Remove-Item ".git/index.lock" -Force; Write-Host "    removed" }

Write-Host ""
Write-Host "==> 2. Restore sitemap.ts from HEAD (heals any Cowork partial-flush)" -ForegroundColor Cyan
git checkout HEAD -- src/app/sitemap.ts
Write-Host "    restored ($((Get-Content src\app\sitemap.ts | Measure-Object -Line).Lines) lines)"

Write-Host ""
Write-Host "==> 3. Apply the dynamic-sitemap patch" -ForegroundColor Cyan
$patch = @'
diff --git a/src/app/sitemap.ts b/src/app/sitemap.ts
--- a/src/app/sitemap.ts
+++ b/src/app/sitemap.ts
@@ -3,6 +3,12 @@ import { readFileSync } from "fs";
 import { join } from "path";
 import { posts } from "@/lib/blog";
 import { defaultProducts } from "@/lib/store-products";

+// Render sitemap.xml on each request rather than baking it at build time so
+// Notion → Sitemap Sync (notion-docs-sitemap.yml) doesn't need a redeploy
+// to take effect. Revalidate at most hourly to keep the CDN warm for crawlers.
+export const dynamic = "force-dynamic";
+export const revalidate = 3600;
+
 // ---------------------------------------------------------------------------
 // Static page last-modified dates
 //
'@

# Write patch to a temp file and apply
$patchFile = Join-Path $env:TEMP "sitemap-dynamic.patch"
$patch | Out-File -FilePath $patchFile -Encoding ASCII -NoNewline
git apply --whitespace=nowarn $patchFile
if ($LASTEXITCODE -ne 0) {
    Write-Host "    git apply failed; trying with --3way" -ForegroundColor Yellow
    git apply --3way $patchFile
    if ($LASTEXITCODE -ne 0) {
        Write-Host "    patch failed. Inspect manually." -ForegroundColor Red
        exit 1
    }
}
Remove-Item $patchFile -Force
Write-Host "    patch applied" -ForegroundColor Green

Write-Host ""
Write-Host "==> 4. pnpm typecheck" -ForegroundColor Cyan
pnpm typecheck
if ($LASTEXITCODE -ne 0) {
    Write-Host "    typecheck FAILED" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==> 5. Resulting diff" -ForegroundColor Cyan
git diff --stat -- src/app/sitemap.ts
Write-Host ""
git diff -- src/app/sitemap.ts

Write-Host ""
Write-Host "==> Done. To commit:" -ForegroundColor Green
Write-Host "    git add src/app/sitemap.ts"
Write-Host "    git commit -m 'fix(sitemap): force-dynamic so Notion TSV updates do not need redeploy (closes SHA drift loop)'"
