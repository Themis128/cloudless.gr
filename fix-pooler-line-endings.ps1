# Fix line endings for Supabase pooler.exs file
# This removes BOM and converts Windows CRLF to Unix LF line endings

$filePath = "d:\Nuxt Projects\llm-dev-agent\cloudless.gr\supabase-project\volumes\pooler\pooler.exs"

Write-Host "🔧 Fixing BOM and line endings in pooler.exs..." -ForegroundColor Yellow

if (Test-Path $filePath) {
    # Read bytes to check for BOM
    $bytes = [System.IO.File]::ReadAllBytes($filePath)

    # Remove UTF-8 BOM if present
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        Write-Host "Removing UTF-8 BOM..." -ForegroundColor Yellow
        $bytes = $bytes[3..($bytes.Length - 1)]
    }

    # Convert to string
    $content = [System.Text.Encoding]::UTF8.GetString($bytes)

    # Normalize line endings (Windows CRLF or Mac CR) → Unix LF
    $fixedContent = $content -replace "`r`n", "`n" -replace "`r", "`n"

    # Write back with UTF-8 (no BOM)
    [System.IO.File]::WriteAllText($filePath, $fixedContent, [System.Text.Encoding]::UTF8)

    Write-Host "✅ File cleaned successfully!" -ForegroundColor Green
    Write-Host "File: $filePath" -ForegroundColor Cyan
} else {
    Write-Host "❌ File not found: $filePath" -ForegroundColor Red
    exit 1
}

Write-Host "`nRestarting Supabase pooler container..." -ForegroundColor Yellow
Set-Location "d:\Nuxt Projects\llm-dev-agent\cloudless.gr\supabase-project"

# Restart the pooler container
docker-compose restart supavisor

Write-Host "✅ Pooler container restarted!" -ForegroundColor Green
Write-Host "`nChecking container status..." -ForegroundColor Yellow

# Wait a moment for container to start
Start-Sleep -Seconds 5

# Show container status
docker-compose ps supavisor

Write-Host ""
Write-Host "📋 To check logs, run: docker logs -f supabase-pooler" -ForegroundColor Cyan
