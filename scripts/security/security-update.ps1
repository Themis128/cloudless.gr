#!/usr/bin/env pwsh

# Security Update Helper Script
# This script helps manage security updates and vulnerability fixes

param(
    [string]$Action = "check",
    [switch]$Force = $false,
    [switch]$Docker = $false
)

# Colors for output
$Green = "`e[32m"
$Yellow = "`e[33m"
$Red = "`e[31m"
$Blue = "`e[34m"
$Reset = "`e[0m"

Write-Host "${Blue}🔒 Security Update Helper${Reset}" -ForegroundColor Blue
Write-Host ""

switch ($Action.ToLower()) {
    "check" {
        Write-Host "${Blue}🔍 Checking for security vulnerabilities...${Reset}" -ForegroundColor Blue
        Write-Host ""
        
        # Check npm vulnerabilities
        Write-Host "📦 Checking npm dependencies..."
        $npmAudit = npm audit --audit-level moderate 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "${Green}✅ No npm vulnerabilities found${Reset}" -ForegroundColor Green
        }
        else {
            Write-Host "${Yellow}⚠️ npm vulnerabilities found:${Reset}" -ForegroundColor Yellow
            Write-Host $npmAudit
        }
        
        # Check outdated packages
        Write-Host ""
        Write-Host "📦 Checking for outdated packages..."
        $outdated = npm outdated 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "${Green}✅ All packages are up to date${Reset}" -ForegroundColor Green
        }
        else {
            Write-Host "${Yellow}⚠️ Outdated packages found:${Reset}" -ForegroundColor Yellow
            Write-Host $outdated
        }
        
        # Check Docker if requested
        if ($Docker) {
            Write-Host ""
            Write-Host "🐳 Checking Docker image security..."
            
            # Check if Docker is running
            $dockerRunning = docker info 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "${Green}✅ Docker is running${Reset}" -ForegroundColor Green
                
                # Check for Trivy
                $trivyInstalled = trivy --version 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "${Green}✅ Trivy is installed${Reset}" -ForegroundColor Green
                    Write-Host "${Blue}💡 Run: trivy image your-image:tag to scan Docker images${Reset}" -ForegroundColor Blue
                }
                else {
                    Write-Host "${Yellow}⚠️ Trivy not found - install for Docker security scanning${Reset}" -ForegroundColor Yellow
                }
            }
            else {
                Write-Host "${Red}❌ Docker is not running${Reset}" -ForegroundColor Red
            }
        }
    }
    
    "fix" {
        Write-Host "${Blue}🔧 Fixing security vulnerabilities...${Reset}" -ForegroundColor Blue
        Write-Host ""
        
        if (-not $Force) {
            Write-Host "${Yellow}⚠️ This will update packages and may include breaking changes${Reset}" -ForegroundColor Yellow
            $confirm = Read-Host "Continue? (y/N)"
            if ($confirm -ne "y" -and $confirm -ne "Y") {
                Write-Host "${Blue}Update cancelled${Reset}" -ForegroundColor Blue
                exit 0
            }
        }
        
        # Run npm audit fix
        Write-Host "🔧 Running npm audit fix..."
        npm audit fix --force
        if ($LASTEXITCODE -eq 0) {
            Write-Host "${Green}✅ Security fixes applied successfully${Reset}" -ForegroundColor Green
        }
        else {
            Write-Host "${Red}❌ Some security issues require manual review${Reset}" -ForegroundColor Red
        }
        
        # Update packages
        Write-Host ""
        Write-Host "📦 Updating packages..."
        npm update
        if ($LASTEXITCODE -eq 0) {
            Write-Host "${Green}✅ Packages updated successfully${Reset}" -ForegroundColor Green
        }
        else {
            Write-Host "${Red}❌ Package update failed${Reset}" -ForegroundColor Red
        }
    }
    
    "docker-build" {
        Write-Host "${Blue}🐳 Building secure Docker image...${Reset}" -ForegroundColor Blue
        Write-Host ""
        
        # Build Docker image
        Write-Host "🔨 Building Docker image..."
        docker build -t cloudlessgr-app:latest .
        if ($LASTEXITCODE -eq 0) {
            Write-Host "${Green}✅ Docker image built successfully${Reset}" -ForegroundColor Green
            
            # Scan with Trivy if available
            $trivyInstalled = trivy --version 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "🔍 Scanning Docker image with Trivy..."
                trivy image cloudlessgr-app:latest --format table
            }
            else {
                Write-Host "${Yellow}⚠️ Trivy not found - install for security scanning${Reset}" -ForegroundColor Yellow
            }
        }
        else {
            Write-Host "${Red}❌ Docker build failed${Reset}" -ForegroundColor Red
        }
    }
    
    "docker-scan" {
        Write-Host "${Blue}🔍 Scanning Docker image for vulnerabilities...${Reset}" -ForegroundColor Blue
        Write-Host ""
        
        # Check if Trivy is installed
        $trivyInstalled = trivy --version 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "${Red}❌ Trivy not found. Please install Trivy first:${Reset}" -ForegroundColor Red
            Write-Host "   https://aquasecurity.github.io/trivy/latest/getting-started/installation/"
            exit 1
        }
        
        # Scan Docker image
        Write-Host "🔍 Scanning cloudlessgr-app:latest..."
        trivy image cloudlessgr-app:latest --format table --severity HIGH, CRITICAL
    }
    
    default {
        Write-Host "${Red}❌ Unknown action: $Action${Reset}" -ForegroundColor Red
        Write-Host ""
        Write-Host "${Blue}Available actions:${Reset}" -ForegroundColor Blue
        Write-Host "  check              - Check for vulnerabilities"
        Write-Host "  fix                - Fix security vulnerabilities"
        Write-Host "  docker-build       - Build secure Docker image"
        Write-Host "  docker-scan        - Scan Docker image for vulnerabilities"
        Write-Host ""
        Write-Host "${Blue}Examples:${Reset}" -ForegroundColor Blue
        Write-Host "  .\scripts\security-update.ps1 check"
        Write-Host "  .\scripts\security-update.ps1 check -Docker"
        Write-Host "  .\scripts\security-update.ps1 fix"
        Write-Host "  .\scripts\security-update.ps1 docker-build"
        Write-Host "  .\scripts\security-update.ps1 docker-scan"
    }
}

Write-Host ""
Write-Host "${Blue}📚 For more information, see:${Reset}" -ForegroundColor Blue
Write-Host "- npm audit documentation"
Write-Host "- Trivy security scanning"
Write-Host "- Docker security best practices"
Write-Host "- SECURITY_WORKFLOW_STATUS.md for CI/CD status" 