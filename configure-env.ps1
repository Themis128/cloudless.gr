# Environment Configuration Script for Cloudless.gr
# This script helps you configure missing environment variables

param(
    [switch]$Interactive = $true,
    [switch]$ShowCurrent = $false
)

Write-Host "🔧 Cloudless.gr Environment Configuration" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "Please copy env.template to .env first:" -ForegroundColor Yellow
    Write-Host "  copy env.template .env" -ForegroundColor White
    exit 1
}

# Read current .env file
$envContent = Get-Content ".env" -Raw

# Define required variables and their descriptions
$requiredVars = @{
    "OPENAI_API_KEY" = @{
        Description = "Your OpenAI API key for AI features"
        Current = ($envContent -match "OPENAI_API_KEY=(.+)") ? $matches[1] : "NOT_SET"
        Required = $true
    }
    "ANTHROPIC_API_KEY" = @{
        Description = "Your Anthropic API key for Claude features"
        Current = ($envContent -match "ANTHROPIC_API_KEY=(.+)") ? $matches[1] : "NOT_SET"
        Required = $true
    }
    "SENTRY_DSN" = @{
        Description = "Your Sentry DSN for error tracking (optional)"
        Current = ($envContent -match "SENTRY_DSN=(.+)") ? $matches[1] : "NOT_SET"
        Required = $false
    }
    "DATABASE_URL" = @{
        Description = "Production database URL (optional for local dev)"
        Current = ($envContent -match "DATABASE_URL=(.+)") ? $matches[1] : "NOT_SET"
        Required = $false
    }
    "REDIS_URL" = @{
        Description = "Production Redis URL (optional for local dev)"
        Current = ($envContent -match "REDIS_URL=(.+)") ? $matches[1] : "NOT_SET"
        Required = $false
    }
}

# Show current status
if ($ShowCurrent) {
    Write-Host "📊 Current Environment Variables Status:" -ForegroundColor Cyan
    Write-Host ""
    
    foreach ($var in $requiredVars.Keys) {
        $info = $requiredVars[$var]
        $status = if ($info.Current -eq "NOT_SET" -or $info.Current -like "*your-*" -or $info.Current -like "*here*") {
            "❌ NOT SET"
        } else {
            "✅ SET"
        }
        
        Write-Host "  $status $var" -ForegroundColor $(if ($status -eq "✅ SET") { "Green" } else { "Red" })
        Write-Host "     Description: $($info.Description)" -ForegroundColor White
        if ($info.Current -ne "NOT_SET" -and $info.Current -notlike "*your-*" -and $info.Current -notlike "*here*") {
            Write-Host "     Current: $($info.Current.Substring(0, [Math]::Min(20, $info.Current.Length)))..." -ForegroundColor Gray
        }
        Write-Host ""
    }
}

# Interactive configuration
if ($Interactive) {
    Write-Host "🔧 Interactive Configuration Mode" -ForegroundColor Yellow
    Write-Host "==================================" -ForegroundColor Yellow
    Write-Host ""
    
    $updated = $false
    
    foreach ($var in $requiredVars.Keys) {
        $info = $requiredVars[$var]
        $currentValue = $info.Current
        
        # Skip if already set and not a placeholder
        if ($currentValue -ne "NOT_SET" -and $currentValue -notlike "*your-*" -and $currentValue -notlike "*here*") {
            Write-Host "✅ $var is already configured" -ForegroundColor Green
            continue
        }
        
        Write-Host ""
        Write-Host "🔧 Configuring: $var" -ForegroundColor Cyan
        Write-Host "Description: $($info.Description)" -ForegroundColor White
        
        if ($info.Required) {
            Write-Host "Status: REQUIRED" -ForegroundColor Red
        } else {
            Write-Host "Status: OPTIONAL" -ForegroundColor Yellow
        }
        
        $skip = Read-Host "Skip this variable? (y/N)"
        if ($skip -eq "y" -or $skip -eq "Y") {
            Write-Host "⏭️  Skipping $var" -ForegroundColor Yellow
            continue
        }
        
        $value = Read-Host "Enter value for $var"
        
        if ($value) {
            # Update the .env file
            if ($currentValue -eq "NOT_SET") {
                # Add new variable
                $envContent += "`n$var=$value"
            } else {
                # Replace existing value
                $envContent = $envContent -replace "$var=.*", "$var=$value"
            }
            $updated = $true
            Write-Host "✅ Updated $var" -ForegroundColor Green
        } else {
            Write-Host "⚠️  No value provided, skipping" -ForegroundColor Yellow
        }
    }
    
    # Save updated .env file
    if ($updated) {
        $envContent | Set-Content ".env" -NoNewline
        Write-Host ""
        Write-Host "✅ .env file updated successfully!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "ℹ️  No changes made to .env file" -ForegroundColor Blue
    }
}

Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Restart your Docker containers to apply changes:" -ForegroundColor White
Write-Host "   .\docker.ps1 dev-stop" -ForegroundColor Gray
Write-Host "   .\docker.ps1 dev" -ForegroundColor Gray
Write-Host ""
Write-Host "2. For production, set these as GitHub secrets:" -ForegroundColor White
Write-Host "   - Go to your GitHub repository" -ForegroundColor Gray
Write-Host "   - Settings > Secrets and variables > Actions" -ForegroundColor Gray
Write-Host "   - Add each required variable as a repository secret" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Test your configuration:" -ForegroundColor White
Write-Host "   .\docker.ps1 dev-logs" -ForegroundColor Gray
Write-Host ""

# Show help for getting API keys
Write-Host "🔑 How to get API keys:" -ForegroundColor Yellow
Write-Host "• OpenAI API Key: https://platform.openai.com/api-keys" -ForegroundColor White
Write-Host "• Anthropic API Key: https://console.anthropic.com/" -ForegroundColor White
Write-Host "• Sentry DSN: https://sentry.io/settings/" -ForegroundColor White
Write-Host "" 