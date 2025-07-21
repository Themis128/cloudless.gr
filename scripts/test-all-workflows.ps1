#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Test all refactored GitHub Actions workflows

.DESCRIPTION
    This script provides an interactive menu to test all the refactored workflows:
    - Quick Test (test.yml)
    - Main CI/CD Pipeline (ci-cd.yml)
    - Release Management (release.yml)

.PARAMETER AutoRun
    Automatically run all workflows without prompting

.EXAMPLE
    .\scripts\test-all-workflows.ps1
    .\scripts\test-all-workflows.ps1 -AutoRun
#>

param(
    [Parameter(Mandatory = $false)]
    [switch]$AutoRun
)

Write-Host "🚀 GitHub Actions Workflow Test Suite" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

# Function to display menu
function Show-Menu {
    Write-Host "Available Workflows:" -ForegroundColor Yellow
    Write-Host "1. 🧪 Quick Test (test.yml)" -ForegroundColor White
    Write-Host "2. 🔍 Main CI/CD Pipeline (ci-cd.yml)" -ForegroundColor White
    Write-Host "3. 🚀 Release Management (release.yml)" -ForegroundColor White
    Write-Host "4. 📊 View All Running Workflows" -ForegroundColor White
    Write-Host "5. 🧹 Cancel All Running Workflows" -ForegroundColor White
    Write-Host "6. ❌ Exit" -ForegroundColor White
    Write-Host ""
}

# Function to run Quick Test workflow
function Test-QuickTest {
    Write-Host "🧪 Running Quick Test workflow..." -ForegroundColor Cyan
    
    $testType = Read-Host "Test type (all/unit/integration/lint/type-check) [default: all]"
    if (-not $testType) { $testType = "all" }
    
    $command = "gh workflow run test.yml -f test_type=$testType"
    Write-Host "Command: $command" -ForegroundColor Gray
    
    try {
        Invoke-Expression $command
        Write-Host "✅ Quick Test workflow triggered successfully!" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to trigger Quick Test workflow: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Function to run CI/CD Pipeline
function Test-CICDPipeline {
    Write-Host "🔍 Running Main CI/CD Pipeline..." -ForegroundColor Cyan
    
    $environment = Read-Host "Environment (staging/production) [default: staging]"
    if (-not $environment) { $environment = "staging" }
    
    $skipTests = Read-Host "Skip tests? (y/N) [default: N]"
    $skipTests = if ($skipTests -eq 'y' -or $skipTests -eq 'Y') { "true" } else { "false" }
    
    $skipDeployment = Read-Host "Skip deployment? (y/N) [default: N]"
    $skipDeployment = if ($skipDeployment -eq 'y' -or $skipDeployment -eq 'Y') { "true" } else { "false" }
    
    $forceRebuild = Read-Host "Force rebuild? (y/N) [default: N]"
    $forceRebuild = if ($forceRebuild -eq 'y' -or $forceRebuild -eq 'Y') { "true" } else { "false" }
    
    $command = "gh workflow run ci-cd.yml -f environment=$environment -f skip_tests=$skipTests -f skip_deployment=$skipDeployment -f force_rebuild=$forceRebuild"
    Write-Host "Command: $command" -ForegroundColor Gray
    
    try {
        Invoke-Expression $command
        Write-Host "✅ CI/CD Pipeline triggered successfully!" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to trigger CI/CD Pipeline: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Function to run Release Management
function Test-ReleaseManagement {
    Write-Host "🚀 Running Release Management workflow..." -ForegroundColor Cyan
    
    $releaseType = Read-Host "Release type (patch/minor/major) [default: patch]"
    if (-not $releaseType) { $releaseType = "patch" }
    
    $prerelease = Read-Host "Create as prerelease? (y/N) [default: N]"
    $prerelease = if ($prerelease -eq 'y' -or $prerelease -eq 'Y') { "true" } else { "false" }
    
    $draft = Read-Host "Create as draft? (y/N) [default: N]"
    $draft = if ($draft -eq 'y' -or $draft -eq 'Y') { "true" } else { "false" }
    
    $notify = Read-Host "Send notifications? (Y/n) [default: Y]"
    $notify = if ($notify -eq 'n' -or $notify -eq 'N') { "false" } else { "true" }
    
    $command = "gh workflow run release.yml -f release_type=$releaseType -f prerelease=$prerelease -f draft=$draft -f notify=$notify"
    Write-Host "Command: $command" -ForegroundColor Gray
    
    try {
        Invoke-Expression $command
        Write-Host "✅ Release Management workflow triggered successfully!" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to trigger Release Management workflow: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Function to view running workflows
function View-RunningWorkflows {
    Write-Host "📊 Current Running Workflows:" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        $runs = gh run list --limit 10 --json databaseId,displayTitle,status,workflowName,createdAt
        $runs | ConvertFrom-Json | ForEach-Object {
            $status = switch ($_.status) {
                "completed" { "✅" }
                "in_progress" { "🔄" }
                "queued" { "⏳" }
                "waiting" { "⏳" }
                "failure" { "❌" }
                "cancelled" { "🚫" }
                default { "❓" }
            }
            Write-Host "$status $($_.displayTitle) ($($_.workflowName)) - $($_.status)" -ForegroundColor White
        }
    } catch {
        Write-Host "❌ Failed to get workflow runs: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Function to cancel all running workflows
function Cancel-AllWorkflows {
    Write-Host "🧹 Cancelling all running workflows..." -ForegroundColor Yellow
    
    try {
        $runs = gh run list --limit 20 --json databaseId,status
        $runningRuns = $runs | ConvertFrom-Json | Where-Object { $_.status -in @("in_progress", "queued", "waiting") }
        
        if ($runningRuns.Count -eq 0) {
            Write-Host "ℹ️ No running workflows found" -ForegroundColor Blue
            return
        }
        
        Write-Host "Found $($runningRuns.Count) running workflows" -ForegroundColor Yellow
        
        foreach ($run in $runningRuns) {
            Write-Host "Cancelling workflow $($run.databaseId)..." -ForegroundColor Gray
            gh run cancel $run.databaseId
        }
        
        Write-Host "✅ All running workflows cancelled!" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to cancel workflows: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Main execution
if ($AutoRun) {
    Write-Host "🔄 Auto-running all workflows..." -ForegroundColor Yellow
    
    # Run Quick Test
    Write-Host "1. Running Quick Test..." -ForegroundColor Cyan
    gh workflow run test.yml -f test_type=all
    
    # Run CI/CD Pipeline (staging, no deployment)
    Write-Host "2. Running CI/CD Pipeline..." -ForegroundColor Cyan
    gh workflow run ci-cd.yml -f environment=staging -f skip_deployment=true
    
    # Run Release Management (patch, prerelease)
    Write-Host "3. Running Release Management..." -ForegroundColor Cyan
    gh workflow run release.yml -f release_type=patch -f prerelease=true
    
    Write-Host "✅ All workflows triggered!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Monitor progress at: https://github.com/Themis128/cloudless.gr/actions" -ForegroundColor Yellow
    exit 0
}

# Interactive mode
do {
    Show-Menu
    $choice = Read-Host "Select an option (1-6)"
    
    switch ($choice) {
        "1" { Test-QuickTest }
        "2" { Test-CICDPipeline }
        "3" { Test-ReleaseManagement }
        "4" { View-RunningWorkflows }
        "5" { Cancel-AllWorkflows }
        "6" { 
            Write-Host "👋 Goodbye!" -ForegroundColor Green
            exit 0 
        }
        default { 
            Write-Host "❌ Invalid option. Please select 1-6." -ForegroundColor Red 
        }
    }
    
    Write-Host ""
    $continue = Read-Host "Press Enter to continue or 'q' to quit"
    if ($continue -eq 'q' -or $continue -eq 'Q') {
        Write-Host "👋 Goodbye!" -ForegroundColor Green
        exit 0
    }
    
    Clear-Host
} while ($true) 