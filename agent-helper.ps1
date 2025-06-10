#!/usr/bin/env powershell
# Agent Setup and Development Helper Script for Cloudless.gr

param(
    [Parameter(Position=0)]
    [string]$Action = "help",

    [Parameter(Position=1)]
    [string]$Target = ""
)

function Show-Header {
    Write-Host "===========================================================" -ForegroundColor Cyan
    Write-Host "🤖 Cloudless.gr Agent Development Helper" -ForegroundColor Green
    Write-Host "   GitHub Copilot + Continue.dev Integration" -ForegroundColor Yellow
    Write-Host "===========================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Show-Help {
    Show-Header
    Write-Host "Available Commands:" -ForegroundColor White
    Write-Host ""
    Write-Host "  dev           Start development server with agent support" -ForegroundColor Green
    Write-Host "  build         Build the application" -ForegroundColor Green
    Write-Host "  test          Run tests with agent debugging" -ForegroundColor Green
    Write-Host "  lint          Run linter (excludes supabase-repo)" -ForegroundColor Green
    Write-Host "  fix           Fix common ESLint issues" -ForegroundColor Green
    Write-Host "  agent         Show agent configuration status" -ForegroundColor Green
    Write-Host "  terminals     Set up specialized terminal profiles" -ForegroundColor Green
    Write-Host "  health        Check project health and dependencies" -ForegroundColor Green
    Write-Host "  clean         Clean cache and temporary files" -ForegroundColor Green
    Write-Host ""
    Write-Host "Usage: .\agent-helper.ps1 <command> [target]" -ForegroundColor Yellow
    Write-Host "Example: .\agent-helper.ps1 dev" -ForegroundColor Gray
}

function Start-Development {
    Show-Header
    Write-Host "🚀 Starting Nuxt development server with agent support..." -ForegroundColor Green
    Write-Host "   - Continue.dev agent mode: ENABLED" -ForegroundColor Yellow
    Write-Host "   - GitHub Copilot: ENABLED" -ForegroundColor Yellow
    Write-Host "   - Terminal integration: ACTIVE" -ForegroundColor Yellow
    Write-Host ""

    # Set environment variables for agent support
    $env:CONTINUE_AGENT_MODE = "true"
    $env:NODE_ENV = "development"

    # Start the development server
    npm run dev
}

function Start-Build {
    Show-Header
    Write-Host "🔨 Building application..." -ForegroundColor Green
    npm run build
}

function Start-Tests {
    Show-Header
    Write-Host "🧪 Running tests with agent debugging..." -ForegroundColor Green
    npm run test
}

function Start-Lint {
    Show-Header
    Write-Host "🔍 Running ESLint (excluding supabase-repo)..." -ForegroundColor Green
    npm run lint
}

function Fix-CommonIssues {
    Show-Header
    Write-Host "🔧 Fixing common ESLint issues..." -ForegroundColor Green

    # Run ESLint with auto-fix
    npm run lint -- --fix

    Write-Host "✅ Auto-fix completed!" -ForegroundColor Green
}

function Show-AgentStatus {
    Show-Header
    Write-Host "🤖 Agent Configuration Status:" -ForegroundColor White
    Write-Host ""

    # Check Continue.dev config
    if (Test-Path ".continue/config.json") {
        Write-Host "✅ Continue.dev configuration found" -ForegroundColor Green
    } else {
        Write-Host "❌ Continue.dev configuration missing" -ForegroundColor Red
    }

    # Check VS Code settings
    if (Test-Path ".vscode/settings.json") {
        Write-Host "✅ VS Code settings configured" -ForegroundColor Green
    } else {
        Write-Host "❌ VS Code settings missing" -ForegroundColor Red
    }

    # Check package.json for agent-friendly scripts
    if (Test-Path "package.json") {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        if ($packageJson.scripts.dev) {
            Write-Host "✅ Development script available" -ForegroundColor Green
        }
        if ($packageJson.scripts.lint) {
            Write-Host "✅ Lint script available" -ForegroundColor Green
        }
    }

    Write-Host ""
    Write-Host "🔧 Terminal Profiles Available:" -ForegroundColor White
    Write-Host "   - AI Agent Terminal (robot icon)" -ForegroundColor Yellow
    Write-Host "   - Nuxt Dev Terminal" -ForegroundColor Yellow
    Write-Host "   - Database Terminal" -ForegroundColor Yellow
    Write-Host "   - Docker Terminal" -ForegroundColor Yellow
    Write-Host "   - Test Terminal" -ForegroundColor Yellow
}

function Setup-Terminals {
    Show-Header
    Write-Host "🖥️ Setting up specialized terminal profiles..." -ForegroundColor Green
    Write-Host ""
    Write-Host "Terminal profiles are configured in .vscode/settings.json:" -ForegroundColor White
    Write-Host "   - AI Agent Terminal: For agent development" -ForegroundColor Yellow
    Write-Host "   - Nuxt Dev: For running development server" -ForegroundColor Yellow
    Write-Host "   - Database Terminal: For Prisma operations" -ForegroundColor Yellow
    Write-Host "   - Docker Terminal: For container operations" -ForegroundColor Yellow
    Write-Host "   - Test Terminal: For running tests" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "✅ Use Ctrl+Shift+` to open terminal and select profile" -ForegroundColor Green
}

function Check-Health {
    Show-Header
    Write-Host "🏥 Checking project health..." -ForegroundColor Green
    Write-Host ""

    # Check Node.js version
    Write-Host "📦 Node.js version:" -ForegroundColor White
    node --version

    # Check npm version
    Write-Host "📦 npm version:" -ForegroundColor White
    npm --version

    # Check Nuxt
    Write-Host "🚀 Nuxt version:" -ForegroundColor White
    npx nuxt --version

    # Check dependencies
    Write-Host ""
    Write-Host "🔍 Checking dependencies..." -ForegroundColor White
    npm audit --audit-level high

    Write-Host ""
    Write-Host "✅ Health check completed!" -ForegroundColor Green
}

function Clean-Project {
    Show-Header
    Write-Host "🧹 Cleaning project..." -ForegroundColor Green

    # Clean Nuxt cache
    if (Test-Path ".nuxt") {
        Remove-Item -Recurse -Force ".nuxt"
        Write-Host "✅ Removed .nuxt cache" -ForegroundColor Green
    }

    # Clean output
    if (Test-Path ".output") {
        Remove-Item -Recurse -Force ".output"
        Write-Host "✅ Removed .output directory" -ForegroundColor Green
    }

    # Clean node_modules cache
    npm cache clean --force
    Write-Host "✅ Cleaned npm cache" -ForegroundColor Green

    Write-Host ""
    Write-Host "🎉 Project cleaned successfully!" -ForegroundColor Green
    Write-Host "💡 You may want to run 'npm install' to reinstall dependencies" -ForegroundColor Yellow
}

# Main script logic
switch ($Action.ToLower()) {
    "dev" { Start-Development }
    "build" { Start-Build }
    "test" { Start-Tests }
    "lint" { Start-Lint }
    "fix" { Fix-CommonIssues }
    "agent" { Show-AgentStatus }
    "terminals" { Setup-Terminals }
    "health" { Check-Health }
    "clean" { Clean-Project }
    "help" { Show-Help }
    default {
        Write-Host "❌ Unknown command: $Action" -ForegroundColor Red
        Show-Help
    }
}
