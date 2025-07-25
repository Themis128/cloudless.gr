#!/usr/bin/env pwsh

# Package Update Helper Script
# This script helps manage package updates safely

param(
    [string]$Action = "check",
    [string]$Package = "",
    [switch]$Force = $false
)

# Colors for output
$Green = "`e[32m"
$Yellow = "`e[33m"
$Red = "`e[31m"
$Blue = "`e[34m"
$Reset = "`e[0m"

Write-Host "${Blue}📦 Package Update Helper${Reset}" -ForegroundColor Blue
Write-Host ""

switch ($Action.ToLower()) {
    "check" {
        Write-Host "${Blue}🔍 Checking for outdated packages...${Reset}" -ForegroundColor Blue
        Write-Host ""
        
        # Run npm outdated
        $outdated = npm outdated 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "${Green}✅ All packages are up to date!${Reset}" -ForegroundColor Green
        }
        else {
            Write-Host "${Yellow}⚠️ Found outdated packages:${Reset}" -ForegroundColor Yellow
            Write-Host $outdated
            Write-Host ""
            
            Write-Host "${Blue}📋 Update Recommendations:${Reset}" -ForegroundColor Blue
            Write-Host "1. Minor/Patch updates (safe): npm update"
            Write-Host "2. Major updates (review first): npm install package@latest"
            Write-Host "3. Security fixes: npm audit fix"
            Write-Host "4. Force security fixes: npm audit fix --force"
            Write-Host ""
            
            Write-Host "${Yellow}⚠️ Major Version Updates Available:${Reset}" -ForegroundColor Yellow
            Write-Host "- @nuxt/eslint-config: 0.2.0 → 1.6.0 (Major)"
            Write-Host "- eslint: 8.57.1 → 9.31.0 (Major)"
            Write-Host "- eslint-plugin-vue: 9.33.0 → 10.3.0 (Major)"
            Write-Host "- nuxt: 3.17.7 → 4.0.0 (Major)"
            Write-Host ""
            Write-Host "${Blue}💡 Tip: Update major versions incrementally to avoid breaking changes${Reset}" -ForegroundColor Blue
        }
    }
    
    "update-minor" {
        Write-Host "${Blue}🔄 Updating minor and patch versions...${Reset}" -ForegroundColor Blue
        npm update
        if ($LASTEXITCODE -eq 0) {
            Write-Host "${Green}✅ Minor updates completed successfully${Reset}" -ForegroundColor Green
        }
        else {
            Write-Host "${Red}❌ Minor updates failed${Reset}" -ForegroundColor Red
        }
    }
    
    "update-major" {
        if (-not $Package) {
            Write-Host "${Red}❌ Please specify a package name: -Package package-name${Reset}" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "${Blue}🔄 Updating $Package to latest version...${Reset}" -ForegroundColor Blue
        Write-Host "${Yellow}⚠️ This is a major version update - review changelog first${Reset}" -ForegroundColor Yellow
        
        if (-not $Force) {
            Write-Host "${Yellow}💡 Use -Force to skip confirmation${Reset}" -ForegroundColor Yellow
            $confirm = Read-Host "Continue? (y/N)"
            if ($confirm -ne "y" -and $confirm -ne "Y") {
                Write-Host "${Blue}Update cancelled${Reset}" -ForegroundColor Blue
                exit 0
            }
        }
        
        npm install "$Package@latest"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "${Green}✅ $Package updated successfully${Reset}" -ForegroundColor Green
        }
        else {
            Write-Host "${Red}❌ Failed to update $Package${Reset}" -ForegroundColor Red
        }
    }
    
    "audit-fix" {
        Write-Host "${Blue}🔧 Running security audit fix...${Reset}" -ForegroundColor Blue
        npm audit fix
        if ($LASTEXITCODE -eq 0) {
            Write-Host "${Green}✅ Security fixes applied successfully${Reset}" -ForegroundColor Green
        }
        else {
            Write-Host "${Yellow}⚠️ Some security issues require manual review${Reset}" -ForegroundColor Yellow
        }
    }
    
    "audit-fix-force" {
        Write-Host "${Blue}🔧 Running security audit fix (force)...${Reset}" -ForegroundColor Blue
        Write-Host "${Yellow}⚠️ This may include breaking changes${Reset}" -ForegroundColor Yellow
        
        if (-not $Force) {
            $confirm = Read-Host "Continue? (y/N)"
            if ($confirm -ne "y" -and $confirm -ne "Y") {
                Write-Host "${Blue}Update cancelled${Reset}" -ForegroundColor Blue
                exit 0
            }
        }
        
        npm audit fix --force
        if ($LASTEXITCODE -eq 0) {
            Write-Host "${Green}✅ Security fixes applied successfully${Reset}" -ForegroundColor Green
        }
        else {
            Write-Host "${Red}❌ Security fixes failed${Reset}" -ForegroundColor Red
        }
    }
    
    default {
        Write-Host "${Red}❌ Unknown action: $Action${Reset}" -ForegroundColor Red
        Write-Host ""
        Write-Host "${Blue}Available actions:${Reset}" -ForegroundColor Blue
        Write-Host "  check              - Check for outdated packages"
        Write-Host "  update-minor       - Update minor/patch versions"
        Write-Host "  update-major       - Update specific package to latest"
        Write-Host "  audit-fix          - Fix security vulnerabilities"
        Write-Host "  audit-fix-force    - Force fix security vulnerabilities"
        Write-Host ""
        Write-Host "${Blue}Examples:${Reset}" -ForegroundColor Blue
        Write-Host "  .\scripts\update-packages.ps1 check"
        Write-Host "  .\scripts\update-packages.ps1 update-minor"
        Write-Host "  .\scripts\update-packages.ps1 update-major -Package eslint"
        Write-Host "  .\scripts\update-packages.ps1 audit-fix"
    }
}

Write-Host ""
Write-Host "${Blue}📚 For more information, see:${Reset}" -ForegroundColor Blue
Write-Host "- npm outdated documentation"
Write-Host "- Package changelogs before major updates"
Write-Host "- SECURITY_WORKFLOW_STATUS.md for CI/CD status" 