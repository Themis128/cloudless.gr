# Initialize RBAC System
Write-Host "🚀 Initializing RBAC system..." -ForegroundColor Green

# Run the TypeScript initialization script
try {
    Write-Host "📋 Creating default roles and permissions..." -ForegroundColor Yellow
    npx tsx scripts/initialize-rbac.ts
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ RBAC system initialized successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to initialize RBAC system" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error running RBAC initialization: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 RBAC system is ready!" -ForegroundColor Green
Write-Host "📖 Check docs/RBAC_SYSTEM.md for usage instructions" -ForegroundColor Cyan 