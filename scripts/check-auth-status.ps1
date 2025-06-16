#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Auth System Status Check
.DESCRIPTION
    Quick status check for the authentication system
#>

Write-Host "🔐 Auth System Status Check" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan

# Check middleware files
Write-Host "`n📂 Middleware Files:" -ForegroundColor Yellow
$middlewareFiles = @(
    "middleware/auth.global.ts",
    "middleware/admin.ts", 
    "middleware/auth.ts"
)

foreach ($file in $middlewareFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file (missing)" -ForegroundColor Red
    }
}

# Check composables
Write-Host "`n🧩 Composables:" -ForegroundColor Yellow
$composableFiles = @(
    "composables/useSupabaseAuth.ts",
    "composables/useSupabase.ts",
    "composables/useAuthGuard.ts"
)

foreach ($file in $composableFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file (missing)" -ForegroundColor Red
    }
}

# Check auth components
Write-Host "`n🎨 Auth Components:" -ForegroundColor Yellow
$componentFiles = @(
    "components/auth/LoginForm.vue",
    "components/auth/AdminLogin.vue"
)

foreach ($file in $componentFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file (missing)" -ForegroundColor Red
    }
}

# Check auth pages
Write-Host "`n📄 Auth Pages:" -ForegroundColor Yellow
$pageFiles = @(
    "pages/auth/index.vue",
    "pages/auth/admin-login.vue"
)

foreach ($file in $pageFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file (missing)" -ForegroundColor Red
    }
}

# Check stores
Write-Host "`n🗄️  Stores:" -ForegroundColor Yellow
$storeFiles = @(
    "stores/userStore.ts"
)

foreach ($file in $storeFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file (missing)" -ForegroundColor Red
    }
}

# Check type definitions
Write-Host "`n📝 Type Definitions:" -ForegroundColor Yellow
$typeFiles = @(
    "types/auth.d.ts"
)

foreach ($file in $typeFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file (missing)" -ForegroundColor Red
    }
}

# Check recovery scripts
Write-Host "`n🔧 Recovery Scripts:" -ForegroundColor Yellow
$scriptFiles = @(
    "scripts/fix-auth-system.js",
    "scripts/fix-auth-system.ps1"
)

foreach ($file in $scriptFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file (missing)" -ForegroundColor Red
    }
}

# Check documentation
Write-Host "`n📚 Documentation:" -ForegroundColor Yellow
$docFiles = @(
    "AUTH_SYSTEM_RECOVERY.md"
)

foreach ($file in $docFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file (missing)" -ForegroundColor Red
    }
}

Write-Host "`n✅ Auth System Status Check Complete!" -ForegroundColor Green
Write-Host "`n💡 Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Run: node scripts/fix-auth-system.js --check-only" -ForegroundColor White
Write-Host "  2. Test user login at /auth" -ForegroundColor White
Write-Host "  3. Test admin login at /auth/admin-login" -ForegroundColor White
Write-Host "  4. Verify role-based access control" -ForegroundColor White
