# Test Supabase Credentials Script
Write-Host "🔍 Testing Supabase Credentials..." -ForegroundColor Cyan

# Set your real credentials
$env:NUXT_PUBLIC_SUPABASE_URL = "https://oflctqligzouzshimuqh.supabase.co"
$env:NUXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbGN0cWxpZ3pvdXpzaGltdXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MTQ3NDUsImV4cCI6MjA2NDM5MDc0NX0.Z1VgH0O77UM2Zb-J4a3fWNTTSFsfHZFmhsAUKJCJInc"

Write-Host "✅ Credentials set:" -ForegroundColor Green
Write-Host "  URL: $env:NUXT_PUBLIC_SUPABASE_URL" -ForegroundColor Yellow
Write-Host "  Key: $($env:NUXT_PUBLIC_SUPABASE_ANON_KEY.Substring(0, 20))..." -ForegroundColor Yellow

# Test if server file exists
if (Test-Path ".output/server/index.mjs") {
    Write-Host "✅ Server file found" -ForegroundColor Green
    
    # Try to start the server
    Write-Host "🧪 Testing server startup..." -ForegroundColor Blue
    try {
        $process = Start-Process -FilePath "node" -ArgumentList "--trace-uncaught", "--trace-warnings", ".output/server/index.mjs" -PassThru -WindowStyle Hidden
        
        # Wait a moment
        Start-Sleep -Seconds 3
        
        if (-not $process.HasExited) {
            Write-Host "✅ Server started successfully!" -ForegroundColor Green
            Write-Host "🎉 Your credentials are working!" -ForegroundColor Green
            
            # Stop the server
            Stop-Process -Id $process.Id -Force
        }
        else {
            Write-Host "❌ Server crashed immediately" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "❌ Error starting server: $($_.Exception.Message)" -ForegroundColor Red
    }
}
else {
    Write-Host "❌ Server file not found. Run 'npm run build' first." -ForegroundColor Red
}

Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "1. Go to https://github.com/Themis128/cloudless.gr/settings/secrets/actions" -ForegroundColor Yellow
Write-Host "2. Add SUPABASE_URL: $env:NUXT_PUBLIC_SUPABASE_URL" -ForegroundColor Yellow
Write-Host "3. Add SUPABASE_ANON_KEY: $env:NUXT_PUBLIC_SUPABASE_ANON_KEY" -ForegroundColor Yellow
Write-Host "4. Push a new commit to trigger CI" -ForegroundColor Yellow 