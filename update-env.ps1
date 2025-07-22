# Simple script to update .env file
Write-Host "Updating .env file..." -ForegroundColor Green

# Read current content
$content = Get-Content .env -Raw

# Replace OpenAI API key with disabled
$content = $content -replace "OPENAI_API_KEY=your-openai-key-here", "OPENAI_API_KEY=disabled"

# Replace Sentry DSN with disabled
$content = $content -replace "SENTRY_DSN=your-sentry-dsn-here", "SENTRY_DSN=disabled"

# Write back to file
$content | Set-Content .env -NoNewline

Write-Host "✅ .env file updated!" -ForegroundColor Green
Write-Host "• OPENAI_API_KEY set to 'disabled'" -ForegroundColor Yellow
Write-Host "• SENTRY_DSN set to 'disabled'" -ForegroundColor Yellow
Write-Host ""
Write-Host "Your environment is now configured for development!" -ForegroundColor Green 