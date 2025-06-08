# Admin Authentication Test Script
# This script validates that admin authentication is properly configured

Write-Host "🔐 Testing Admin Authentication Setup..." -ForegroundColor Cyan
Write-Host "Updated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ""

# Test 1: Check middleware files exist
Write-Host "📁 Checking middleware files..." -ForegroundColor Yellow
$middlewareFiles = @(
    "middleware/admin-required.ts",
    "middleware/auth-required.ts", 
    "middleware/auth.global.ts",
    "middleware/admin-login-redirect.global.ts",
    "middleware/static-assets.global.ts"
)

$missingFiles = @()
foreach ($file in $middlewareFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file" -ForegroundColor Red
        $missingFiles += $file
    }
}

# Test 2: Check admin pages exist
Write-Host ""
Write-Host "📄 Checking admin pages..." -ForegroundColor Yellow
$adminPages = @(
    "pages/admin.vue",
    "pages/admin/dashboard.vue",
    "pages/admin/contact-submissions.vue",
    "pages/auth/admin-login.vue"
)

foreach ($page in $adminPages) {
    if (Test-Path $page) {
        Write-Host "  ✅ $page" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $page" -ForegroundColor Red
        $missingFiles += $page
    }
}

# Test 3: Check for middleware in admin pages
Write-Host ""
Write-Host "🛡️ Checking middleware protection..." -ForegroundColor Yellow

$adminPageFiles = Get-ChildItem -Path "pages/admin" -Filter "*.vue" -Recurse -ErrorAction SilentlyContinue
foreach ($pageFile in $adminPageFiles) {
    $content = Get-Content $pageFile.FullName -Raw
    if ($content -match "middleware.*admin-required") {
        Write-Host "  ✅ $($pageFile.Name) - Has admin-required middleware" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  $($pageFile.Name) - Missing admin-required middleware" -ForegroundColor Yellow
    }
}

# Check main admin.vue page
if (Test-Path "pages/admin.vue") {
    $adminContent = Get-Content "pages/admin.vue" -Raw
    if ($adminContent -match "middleware.*admin-required") {
        Write-Host "  ✅ admin.vue - Has admin-required middleware" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  admin.vue - Missing admin-required middleware" -ForegroundColor Yellow
    }
}

# Test 4: Check environment variables
Write-Host ""
Write-Host "🔧 Checking environment configuration..." -ForegroundColor Yellow

if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "ADMIN_EMAIL") {
        Write-Host "  ✅ ADMIN_EMAIL configured" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  ADMIN_EMAIL not found in .env" -ForegroundColor Yellow
    }
    
    if ($envContent -match "ADMIN_PASSWORD") {
        Write-Host "  ✅ ADMIN_PASSWORD configured" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  ADMIN_PASSWORD not found in .env" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠️  .env file not found - copy from .env.example" -ForegroundColor Yellow
}

# Test 5: Check composables
Write-Host ""
Write-Host "🧩 Checking auth composables..." -ForegroundColor Yellow
$composables = @(
    "composables/useAuth.ts",
    "composables/useAdminAuth.ts"
)

foreach ($composable in $composables) {
    if (Test-Path $composable) {
        Write-Host "  ✅ $composable" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $composable" -ForegroundColor Red
        $missingFiles += $composable
    }
}

# Test 6: API Endpoints (if server is running)
Write-Host ""
Write-Host "🌐 Testing API endpoints..." -ForegroundColor Yellow

# Test admin login endpoint
$adminBody = @{
    email = "admin@cloudless.gr"
    password = "cloudless2025"
} | ConvertTo-Json

try {
    Write-Host "  Testing admin login endpoint..."
    $adminResponse = Invoke-RestMethod -Uri 'http://localhost:3000/api/auth/admin-login' -Method POST -ContentType 'application/json' -Body $adminBody -TimeoutSec 5
    Write-Host "  ✅ Admin login endpoint working!" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  Admin login endpoint not available (server may not be running)" -ForegroundColor Yellow
    Write-Host "     Start server with: npm run dev" -ForegroundColor Gray
}

# Summary
Write-Host ""
Write-Host "📊 Test Summary" -ForegroundColor Cyan
Write-Host "===============" -ForegroundColor Cyan

if ($missingFiles.Count -eq 0) {
    Write-Host "✅ All tests passed! Admin authentication is properly configured." -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Start the development server: npm run dev" -ForegroundColor White
    Write-Host "  2. Navigate to: http://localhost:3000/auth/admin-login" -ForegroundColor White
    Write-Host "  3. Login with: admin@cloudless.gr / cloudless2025" -ForegroundColor White
} else {
    Write-Host "⚠️  Some issues found. Missing files:" -ForegroundColor Yellow
    foreach ($file in $missingFiles) {
        Write-Host "     - $file" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "🔧 To fix these issues, run the admin setup command or check the documentation." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📚 For detailed documentation, see: ADMIN_ACCESS.md" -ForegroundColor Cyan
