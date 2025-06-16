#!/usr/bin/env pwsh
#Requires -Version 7.0

<#
.SYNOPSIS
    Test Application Connectivity
.DESCRIPTION
    Quick test script to verify all services are working correctly
.NOTES
    Author: CloudlessGR Development Team
    Version: 1.0
#>

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$ExpectedStatus = 200,
        [int]$TimeoutSeconds = 10
    )
    
    try {
        Write-Host "Testing $Name..." -ForegroundColor Cyan -NoNewline
        
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSeconds -ErrorAction Stop
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host " ✅ OK ($($response.StatusCode))" -ForegroundColor Green
            return $true
        } else {
            Write-Host " ⚠️  Unexpected status: $($response.StatusCode)" -ForegroundColor Yellow
            return $false
        }
    }
    catch {
        Write-Host " ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Test-Supabase {
    Write-Host ""
    Write-Host "🔍 Testing Supabase Services" -ForegroundColor White
    Write-Host "=============================" -ForegroundColor White
      $tests = @(
        @{ Name = "Kong API Gateway"; Url = "http://localhost:8000"; Expected = 404 },
        @{ Name = "Auth Service Health"; Url = "http://localhost:8000/auth/v1/health"; Expected = 200 },
        @{ Name = "REST API"; Url = "http://localhost:8000/rest/v1/"; Expected = 200 },
        @{ Name = "Database Connection"; Url = "http://localhost:8000/rest/v1/rpc/version"; Expected = 401 }
    )
    
    $allPassed = $true
    foreach ($test in $tests) {
        $result = Test-Endpoint -Name $test.Name -Url $test.Url -ExpectedStatus $test.Expected
        if (-not $result) { $allPassed = $false }
    }
    
    return $allPassed
}

function Test-Frontend {
    Write-Host ""
    Write-Host "🌐 Testing Frontend" -ForegroundColor White
    Write-Host "===================" -ForegroundColor White
    
    # Check if frontend is running
    $frontendPorts = @(3000, 3001, 3002)
    $frontendWorking = $false
    
    foreach ($port in $frontendPorts) {
        $result = Test-Endpoint -Name "Frontend (port $port)" -Url "http://localhost:$port" -ExpectedStatus 200
        if ($result) {
            $frontendWorking = $true
            Write-Host "✅ Frontend is accessible at http://localhost:$port" -ForegroundColor Green
            break
        }
    }
    
    if (-not $frontendWorking) {
        Write-Host "❌ Frontend is not accessible. Start it with: npm run dev" -ForegroundColor Red
    }
    
    return $frontendWorking
}

function Test-Environment {
    Write-Host ""
    Write-Host "⚙️  Testing Environment Configuration" -ForegroundColor White
    Write-Host "=====================================" -ForegroundColor White
    
    # Check .env files
    $envFiles = @(".env", "docker\.env")
    $envOk = $true
    
    foreach ($envFile in $envFiles) {
        if (Test-Path $envFile) {
            $content = Get-Content $envFile -Raw
            if ($content -match "SUPABASE_URL=http://127\.0\.0\.1:8000") {
                Write-Host "✅ $envFile has correct SUPABASE_URL" -ForegroundColor Green
            } elseif ($content -match "SUPABASE_URL=.*54321") {
                Write-Host "❌ $envFile has incorrect SUPABASE_URL (port 54321)" -ForegroundColor Red
                $envOk = $false
            } else {
                Write-Host "⚠️  $envFile missing SUPABASE_URL" -ForegroundColor Yellow
                $envOk = $false
            }
        } else {
            Write-Host "❌ $envFile not found" -ForegroundColor Red
            $envOk = $false
        }
    }
    
    # Check nuxt.config.ts
    if (Test-Path "nuxt.config.ts") {
        $nuxtConfig = Get-Content "nuxt.config.ts" -Raw
        if ($nuxtConfig -match "127\.0\.0\.1:8000") {
            Write-Host "✅ nuxt.config.ts has correct URLs" -ForegroundColor Green
        } elseif ($nuxtConfig -match "54321") {
            Write-Host "❌ nuxt.config.ts has incorrect URLs (port 54321)" -ForegroundColor Red
            $envOk = $false
        } else {
            Write-Host "⚠️  nuxt.config.ts URLs unclear" -ForegroundColor Yellow
        }
    }
    
    return $envOk
}

function Test-Docker {
    Write-Host ""
    Write-Host "🐳 Testing Docker Services" -ForegroundColor White
    Write-Host "==========================" -ForegroundColor White
    
    try {
        $containers = docker ps --format "table {{.Names}}\t{{.Status}}" | Select-Object -Skip 1
        
        if ($containers.Count -eq 0) {
            Write-Host "❌ No Docker containers running" -ForegroundColor Red
            Write-Host "💡 Start with: docker-compose up -d" -ForegroundColor Yellow
            return $false
        }
        
        $allHealthy = $true
        foreach ($container in $containers) {
            $parts = $container -split "\s+"
            $name = $parts[0]
            $status = $parts[1..($parts.Length-1)] -join " "
            
            if ($status -match "Up") {
                Write-Host "✅ $name is running" -ForegroundColor Green
            } else {
                Write-Host "❌ $name is not healthy: $status" -ForegroundColor Red
                $allHealthy = $false
            }
        }
        
        return $allHealthy
    }
    catch {
        Write-Host "❌ Error checking Docker: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Main execution
Write-Host ""
Write-Host "🚀 CloudlessGR Application Test Suite" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

$dockerOk = Test-Docker
$envOk = Test-Environment
$supabaseOk = Test-Supabase
$frontendOk = Test-Frontend

Write-Host ""
Write-Host "📊 Test Summary" -ForegroundColor White
Write-Host "===============" -ForegroundColor White

$results = @(
    @{ Name = "Docker Services"; Status = $dockerOk },
    @{ Name = "Environment Config"; Status = $envOk },
    @{ Name = "Supabase Services"; Status = $supabaseOk },
    @{ Name = "Frontend"; Status = $frontendOk }
)

foreach ($result in $results) {
    $icon = if ($result.Status) { "✅" } else { "❌" }
    $color = if ($result.Status) { "Green" } else { "Red" }
    Write-Host "$icon $($result.Name)" -ForegroundColor $color
}

$allPassed = $dockerOk -and $envOk -and $supabaseOk -and $frontendOk

Write-Host ""
if ($allPassed) {
    Write-Host "🎉 All tests passed! Your application is ready to use." -ForegroundColor Green
    Write-Host ""
    Write-Host "📱 Access your application:" -ForegroundColor Cyan
    Write-Host "  • Frontend: http://localhost:3001 (or check the Nuxt output)" -ForegroundColor White
    Write-Host "  • API: http://localhost:8000" -ForegroundColor White
    Write-Host "  • Studio: http://localhost:3000 (Supabase Studio)" -ForegroundColor White
} else {
    Write-Host "⚠️  Some tests failed. Check the issues above." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🔧 Quick fixes:" -ForegroundColor Cyan
    Write-Host "  • Fix URLs: .\scripts\quick-fix.ps1 -FixUrls" -ForegroundColor White
    Write-Host "  • Restart services: .\scripts\quick-fix.ps1 -RestartServices" -ForegroundColor White
    Write-Host "  • Complete restore: .\scripts\emergency-restore.ps1" -ForegroundColor White
}

Write-Host ""
