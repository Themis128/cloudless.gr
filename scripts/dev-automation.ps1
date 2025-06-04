# PowerShell script to automate Nuxt app setup and checks

Write-Host "[1/6] Installing dependencies..." -ForegroundColor Cyan
npm install

Write-Host "[2/6] Checking .env file..." -ForegroundColor Cyan
if (!(Test-Path .env)) {
    if (Test-Path .env.example) {
        Copy-Item .env.example .env
        Write-Host ".env file created from .env.example. Please review its contents." -ForegroundColor Yellow
    } else {
        Write-Host ".env file is missing and no .env.example found!" -ForegroundColor Red
    }
} else {
    Write-Host ".env file found." -ForegroundColor Green
}

Write-Host "[3/6] Running type and lint checks..." -ForegroundColor Cyan
npm run type-check
npm run lint

Write-Host "[4/6] Starting dev server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'npm run dev'

Write-Host "[5/6] Checking for client and server-side auth checks..." -ForegroundColor Cyan
# Check for client-side admin middleware
if (Test-Path .\middleware\admin-required.ts) {
    Write-Host "Client-side admin middleware found: middleware/admin-required.ts" -ForegroundColor Green
} else {
    Write-Host "WARNING: Client-side admin middleware not found!" -ForegroundColor Yellow
}
# Check for server-side auth in API
$serverApiFiles = Get-ChildItem -Path .\server\api -Recurse -Include *.ts -ErrorAction SilentlyContinue
$serverAuthFound = $false
foreach ($file in $serverApiFiles) {
    if (Select-String -Path $file.FullName -Pattern 'admin|auth' -Quiet) {
        $serverAuthFound = $true
        break
    }
}
if ($serverAuthFound) {
    Write-Host "Server-side auth logic detected in server/api." -ForegroundColor Green
} else {
    Write-Host "WARNING: No server-side auth logic detected in server/api!" -ForegroundColor Yellow
}

Write-Host "[6/6] Pulling latest changes from remote..." -ForegroundColor Cyan
git pull

Write-Host "\nAutomation complete. Review output above for any warnings or errors." -ForegroundColor Cyan
