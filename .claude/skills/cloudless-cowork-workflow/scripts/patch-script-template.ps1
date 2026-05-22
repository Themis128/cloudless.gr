# Template for a Cowork-emitted patch script.
#
# Copy this file to scripts/fix-task-<NN>-<short-name>.ps1 and replace the
# placeholders. The shape is intentional — every step here exists because a
# 2026-05-22 session ran into the exact failure mode it prevents.
#
# Run with: pwsh -File scripts\fix-task-<NN>-<short-name>.ps1

$ErrorActionPreference = "Stop"
Set-Location -Path "D:\cloudless.gr"

# ── 1. Heal Cowork's mount state ────────────────────────────────────────────
Write-Host "==> 1. Remove stale .git/index.lock + scratch tsconfig" -ForegroundColor Cyan
if (Test-Path ".git/index.lock")     { Remove-Item ".git/index.lock" -Force }
if (Test-Path ".tsconfig.check.json") { Remove-Item ".tsconfig.check.json" -Force }

# ── 2. Restore the file(s) you're patching to a known-clean state ──────────
Write-Host ""
Write-Host "==> 2. Restore target file(s) from HEAD" -ForegroundColor Cyan
$targets = @(
    # "path/to/file1.ts",
    # "path/to/file2.tsx"
)
foreach ($t in $targets) {
    git checkout HEAD -- $t
    Write-Host "    restored $t"
}

# ── 3. Apply the patch via git apply (NOT via edit) ────────────────────────
Write-Host ""
Write-Host "==> 3. Apply patch" -ForegroundColor Cyan
$patch = @'
diff --git a/path/to/file.ts b/path/to/file.ts
--- a/path/to/file.ts
+++ b/path/to/file.ts
@@ -X,Y +X,Z @@
 context line
-removed line
+added line
 context line
'@

$patchFile = Join-Path $env:TEMP "fix-task-NN.patch"
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

# ── 4. Typecheck ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "==> 4. pnpm typecheck" -ForegroundColor Cyan
pnpm typecheck
if ($LASTEXITCODE -ne 0) {
    Write-Host "    typecheck FAILED" -ForegroundColor Red
    exit 1
}

# ── 5. Show the diff for review ────────────────────────────────────────────
Write-Host ""
Write-Host "==> 5. Resulting diff" -ForegroundColor Cyan
git diff --stat
Write-Host ""
git diff

# ── 6. Suggested commit ────────────────────────────────────────────────────
Write-Host ""
Write-Host "==> Done. To commit:" -ForegroundColor Green
Write-Host "    git add <files>"
Write-Host "    git commit -m '<scope>: <imperative summary>'"
