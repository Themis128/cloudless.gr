# API Endpoints Test Script for Cloudless.gr
# Tests all critical API endpoints to ensure they're working

param(
    [string]$BaseUrl = "http://192.168.0.23:3000",
    [switch]$Verbose
)

Write-Host "🔍 Testing API Endpoints for Cloudless.gr" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Yellow
Write-Host ""

# Define all API endpoints to test
$endpoints = @(
    @{ Path = "/api/health"; Method = "GET"; Name = "Health Check" },
    @{ Path = "/api/health/simple"; Method = "GET"; Name = "Simple Health" },
    @{ Path = "/api/health/system"; Method = "GET"; Name = "System Health" },
    @{ Path = "/api/health/database"; Method = "GET"; Name = "Database Health" },
    @{ Path = "/api/health/redis"; Method = "GET"; Name = "Redis Health" },
    @{ Path = "/api/stats"; Method = "GET"; Name = "Stats" },
    @{ Path = "/api/activity"; Method = "GET"; Name = "Activity" },
    @{ Path = "/api/dashboard"; Method = "GET"; Name = "Dashboard" },
    @{ Path = "/api/models"; Method = "GET"; Name = "Models" },
    @{ Path = "/api/pipelines"; Method = "GET"; Name = "Pipelines" },
    @{ Path = "/api/bots"; Method = "GET"; Name = "Bots" },
    @{ Path = "/api/projects"; Method = "GET"; Name = "Projects" },
    @{ Path = "/api/analytics"; Method = "GET"; Name = "Analytics" },
    @{ Path = "/api/cache"; Method = "GET"; Name = "Cache" },
    @{ Path = "/api/csrf-token"; Method = "GET"; Name = "CSRF Token" }
)

$results = @()
$successCount = 0
$totalCount = $endpoints.Count

foreach ($endpoint in $endpoints) {
    $url = "$BaseUrl$($endpoint.Path)"
    $name = $endpoint.Name

    try {
        Write-Host "Testing $name..." -NoNewline

        $response = Invoke-WebRequest -Uri $url -Method $endpoint.Method -UseBasicParsing -TimeoutSec 10

        if ($response.StatusCode -eq 200) {
            Write-Host " ✅" -ForegroundColor Green
            $successCount++
            $status = "SUCCESS"
        } else {
            Write-Host " ❌ (Status: $($response.StatusCode))" -ForegroundColor Red
            $status = "FAILED"
        }

        if ($Verbose) {
            Write-Host "  Response: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))..." -ForegroundColor Gray
        }

    } catch {
        Write-Host " ❌ (Error: $($_.Exception.Message))" -ForegroundColor Red
        $status = "ERROR"
    }

    $results += [PSCustomObject]@{
        Name = $name
        Path = $endpoint.Path
        Status = $status
        URL = $url
    }
}

Write-Host ""
Write-Host "📊 API Endpoints Test Results:" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

foreach ($result in $results) {
    $color = switch ($result.Status) {
        "SUCCESS" { "Green" }
        "FAILED" { "Yellow" }
        "ERROR" { "Red" }
    }

    Write-Host "$($result.Status.PadRight(8)) - $($result.Name)" -ForegroundColor $color
}

Write-Host ""
Write-Host "Summary: $successCount/$totalCount endpoints working" -ForegroundColor Cyan

if ($successCount -eq $totalCount) {
    Write-Host "🎉 All API endpoints are working correctly!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "⚠️  Some API endpoints need attention" -ForegroundColor Yellow
    exit 1
}
