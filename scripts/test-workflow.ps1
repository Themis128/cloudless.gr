#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Test and run the new CI/CD workflow

.DESCRIPTION
    This script helps test and run the refactored CI/CD workflow with various options.

.PARAMETER Environment
    The deployment environment (staging or production)

.PARAMETER SkipTests
    Skip testing phases

.PARAMETER SkipDeployment
    Skip deployment phase

.PARAMETER ForceRebuild
    Force rebuild all caches

.PARAMETER DryRun
    Show the command that would be run without executing it

.EXAMPLE
    .\scripts\test-workflow.ps1 -Environment staging
    .\scripts\test-workflow.ps1 -Environment production -SkipTests
    .\scripts\test-workflow.ps1 -DryRun
#>

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet('staging', 'production')]
    [string]$Environment = 'staging',
    
    [Parameter(Mandatory = $false)]
    [switch]$SkipTests,
    
    [Parameter(Mandatory = $false)]
    [switch]$SkipDeployment,
    
    [Parameter(Mandatory = $false)]
    [switch]$ForceRebuild,
    
    [Parameter(Mandatory = $false)]
    [switch]$DryRun
)

Write-Host "🚀 CI/CD Workflow Test Script" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# Build the command
$command = "gh workflow run ci-cd.yml"

# Add parameters
$params = @()

if ($Environment -and $Environment -ne 'staging') {
    $params += "-f environment=$Environment"
}

if ($SkipTests) {
    $params += "-f skip_tests=true"
}

if ($SkipDeployment) {
    $params += "-f skip_deployment=true"
}

if ($ForceRebuild) {
    $params += "-f force_rebuild=true"
}

if ($params.Count -gt 0) {
    $command += " " + ($params -join " ")
}

# Display configuration
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Environment: $Environment" -ForegroundColor White
Write-Host "  Skip Tests: $SkipTests" -ForegroundColor White
Write-Host "  Skip Deployment: $SkipDeployment" -ForegroundColor White
Write-Host "  Force Rebuild: $ForceRebuild" -ForegroundColor White
Write-Host ""

# Show command
Write-Host "Command:" -ForegroundColor Yellow
Write-Host "  $command" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "🔍 Dry run mode - command not executed" -ForegroundColor Blue
    exit 0
}

# Confirm execution
$confirmation = Read-Host "Do you want to run this workflow? (y/N)"
if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
    Write-Host "❌ Workflow execution cancelled" -ForegroundColor Red
    exit 0
}

# Execute the command
Write-Host "🚀 Executing workflow..." -ForegroundColor Green
try {
    Invoke-Expression $command
    Write-Host "✅ Workflow triggered successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can monitor the workflow at:" -ForegroundColor Yellow
    Write-Host "  https://github.com/Themis128/cloudless.gr/actions" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed to trigger workflow: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} 