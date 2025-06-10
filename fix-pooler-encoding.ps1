# Enhanced script to completely fix pooler.exs encoding issues
$filePath = "d:\Nuxt Projects\llm-dev-agent\cloudless.gr\supabase-project\volumes\pooler\pooler.exs"

Write-Host "Completely rewriting pooler.exs to remove all encoding issues..." -ForegroundColor Yellow

# Read the file content as raw text
$rawContent = Get-Content -Path $filePath -Raw

# Remove any BOM and invisible characters at the start
$cleanContent = $rawContent -replace "^\uFEFF", "" -replace "^\xFF\xFE", "" -replace "^\xFE\xFF", "" -replace "^\xEF\xBB\xBF", ""

# Ensure Unix line endings
$unixContent = $cleanContent -replace "`r`n", "`n" -replace "`r", "`n"

# Write back as ASCII/UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($filePath, $unixContent, $utf8NoBom)

Write-Host "File rewritten successfully!" -ForegroundColor Green

# Restart the container
Write-Host "Restarting Supabase pooler container..." -ForegroundColor Yellow
Set-Location "d:\Nuxt Projects\llm-dev-agent\cloudless.gr\supabase-project"
docker-compose restart supavisor

Write-Host "Waiting for container to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "Checking logs..." -ForegroundColor Yellow
docker-compose logs --tail=5 supavisor
