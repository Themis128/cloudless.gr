# Fix line endings for Supabase pooler.exs file

$filePath = "d:\Nuxt Projects\llm-dev-agent\cloudless.gr\supabase-project\volumes\pooler\pooler.exs"

Write-Host "Fixing BOM and line endings in pooler.exs..." -ForegroundColor Yellow

if (Test-Path $filePath) {
    # Read all bytes
    $bytes = [System.IO.File]::ReadAllBytes($filePath)

    # Remove UTF-8 BOM if present
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        Write-Host "Removing UTF-8 BOM..." -ForegroundColor Yellow
        $bytes = $bytes[3..($bytes.Length - 1)]
    }

    # Convert to string and fix line endings
    $content = [System.Text.Encoding]::UTF8.GetString($bytes)
    $fixedContent = $content -replace "`r`n", "`n" -replace "`r", "`n"

    # Write back without BOM
    [System.IO.File]::WriteAllText($filePath, $fixedContent, [System.Text.Encoding]::UTF8)

    Write-Host "File cleaned successfully!" -ForegroundColor Green
    Write-Host "File: $filePath" -ForegroundColor Cyan
} else {
    Write-Host "File not found: $filePath" -ForegroundColor Red
    exit 1
}

Write-Host "Restarting Supabase pooler container..." -ForegroundColor Yellow
Set-Location "d:\Nuxt Projects\llm-dev-agent\cloudless.gr\supabase-project"

docker-compose restart supavisor

Write-Host "Pooler container restarted!" -ForegroundColor Green
Write-Host "Checking container status..." -ForegroundColor Yellow

Start-Sleep -Seconds 5
docker-compose ps supavisor

Write-Host "To check logs run: docker-compose logs -f supavisor" -ForegroundColor Cyan
