# Service Connectivity Testing Script
# Tests all services and endpoints for availability and proper response
#
# Features:
#   • Docker container status checking
#   • Service endpoint testing
#   • Database connectivity verification
#   • Port availability testing
#   • Comprehensive connectivity report
#
# Usage Examples:
#   .\scripts\12-test-connectivity.ps1              # Full connectivity test
#   .\scripts\12-test-connectivity.ps1 -Quick      # Quick essential tests only
#   .\scripts\12-test-connectivity.ps1 -Verbose    # Verbose output with details

param(
    [switch]$Quick,
    [switch]$Verbose
)

# Test endpoint function
function Test-ServiceEndpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$ExpectedStatus = 200,
        [int]$TimeoutSeconds = 10
    )
    
    if ($Verbose) {
        Write-Host "  🔍 Testing $Name at $Url..." -ForegroundColor Cyan
    } else {
        Write-Host "  🔍 Testing $Name..." -ForegroundColor Cyan -NoNewline
    }
    
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSeconds -ErrorAction Stop
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            if ($Verbose) {
                Write-Host "    ✅ SUCCESS: Status $($response.StatusCode)" -ForegroundColor Green
                Write-Host "    📊 Response size: $($response.Content.Length) bytes" -ForegroundColor Gray
            } else {
                Write-Host " ✅ OK ($($response.StatusCode))" -ForegroundColor Green
            }
            return $true
        } else {
            if ($Verbose) {
                Write-Host "    ⚠️  UNEXPECTED: Status $($response.StatusCode) (expected $ExpectedStatus)" -ForegroundColor Yellow
            } else {
                Write-Host " ⚠️  Status: $($response.StatusCode)" -ForegroundColor Yellow
            }
            return $false
        }
    }
    catch {
        if ($Verbose) {
            Write-Host "    ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
        } else {
            Write-Host " ❌ FAILED" -ForegroundColor Red
        }
        return $false
    }
}

# Test port connectivity
function Test-PortConnectivity {
    param(
        [string]$Host,
        [int]$Port,
        [int]$TimeoutSeconds = 3
    )
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $connect = $tcpClient.BeginConnect($Host, $Port, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne($TimeoutSeconds * 1000, $false)
        
        if ($wait) {
            $tcpClient.EndConnect($connect)
            $tcpClient.Close()
            return $true
        } else {
            $tcpClient.Close()
            return $false
        }
    }
    catch {
        return $false    }
}

# Test for specific Supabase Analytics issues
function Test-SupabaseAnalyticsHealth {
    Write-Host ""
    Write-Host "🔍 CHECKING SUPABASE ANALYTICS HEALTH..."
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    $analyticsHealthy = $true
    
    # Check if analytics container is running
    try {
        $analyticsContainer = docker ps --filter "name=supabase-analytics" --format "{{.Names}}" 2>$null
        if (-not $analyticsContainer) {
            Write-Host "  ❌ Analytics container not running" -ForegroundColor Red
            return $false
        }
        
        Write-Host "  ✅ Analytics container is running" -ForegroundColor Green
        
        # Check container health status
        $healthStatus = docker inspect supabase-analytics --format="{{.State.Health.Status}}" 2>$null
        if ($healthStatus -eq "healthy") {
            Write-Host "  ✅ Analytics container is healthy" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Analytics container health: $healthStatus" -ForegroundColor Yellow
            $analyticsHealthy = $false
        }
        
        # Check for password authentication errors
        $recentLogs = docker logs supabase-analytics --tail 20 2>$null
        if ($recentLogs -match "password authentication failed for user.*supabase_admin") {
            Write-Host "  ❌ CRITICAL: Password authentication errors detected!" -ForegroundColor Red
            Write-Host "     This is a known issue with missing supabase_admin password configuration." -ForegroundColor Yellow
            Write-Host "     🔧 FIX: Run .\scripts\21-fix-supabase-analytics.ps1" -ForegroundColor Cyan
            $analyticsHealthy = $false
        } else {
            Write-Host "  ✅ No password authentication errors found" -ForegroundColor Green
        }
        
        # Check if analytics logs show normal operation
        if ($recentLogs -match "All logs logged!|Logs last second!") {
            Write-Host "  ✅ Analytics service is logging normally" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Analytics service may not be functioning normally" -ForegroundColor Yellow
            if ($Verbose) {
                Write-Host "     Recent logs:" -ForegroundColor Gray
                $recentLogs | Select-Object -Last 5 | ForEach-Object {
                    Write-Host "     $_" -ForegroundColor Gray
                }
            }
        }
        
        # Test database connection for supabase_admin user
        try {
            $connectionTest = docker exec supabase-db psql -U supabase_admin -d _supabase -c "SELECT 1;" 2>$null
            if ($connectionTest -match "1") {
                Write-Host "  ✅ supabase_admin database connection working" -ForegroundColor Green
            } else {
                Write-Host "  ❌ supabase_admin database connection failed" -ForegroundColor Red
                Write-Host "     🔧 FIX: Run .\scripts\21-fix-supabase-analytics.ps1" -ForegroundColor Cyan
                $analyticsHealthy = $false
            }
        }
        catch {
            Write-Host "  ❌ Could not test supabase_admin database connection" -ForegroundColor Red
            $analyticsHealthy = $false
        }
        
    }
    catch {
        Write-Host "  ❌ Error checking analytics container: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    
    return $analyticsHealthy
}

# Check Docker containers
function Test-DockerContainers {
    Write-Host ""
    Write-Host "🐳 CHECKING DOCKER CONTAINERS..."
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    try {
        $containers = docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>$null
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ❌ Docker not available or not running" -ForegroundColor Red
            return $false
        }
        
        if ($containers.Count -le 1) {
            Write-Host "  ⚠️  No containers running" -ForegroundColor Yellow
            return $false
        }
        
        Write-Host "  📊 Running containers:" -ForegroundColor Cyan
        foreach ($line in $containers[1..($containers.Count-1)]) {
            if ($line -match "supabase|postgres|kong") {
                Write-Host "    ✅ $line" -ForegroundColor Green
            } else {
                Write-Host "    ℹ️  $line" -ForegroundColor Gray
            }
        }
        
        return $true
        
    } catch {
        Write-Host "  ❌ Error checking Docker containers: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test port availability
function Test-PortAvailability {
    Write-Host ""
    Write-Host "🔌 TESTING PORT CONNECTIVITY..."
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    $ports = @(
        @{ Name = "Supabase API"; Host = "localhost"; Port = 54321 },
        @{ Name = "PostgreSQL"; Host = "localhost"; Port = 54322 },
        @{ Name = "Supabase Studio"; Host = "localhost"; Port = 54323 }
    )
    
    $allPortsOk = $true
    
    foreach ($portTest in $ports) {
        if ($Verbose) {
            Write-Host "  🔍 Testing $($portTest.Name) port $($portTest.Port)..." -ForegroundColor Cyan
        } else {
            Write-Host "  🔍 $($portTest.Name) ($($portTest.Port))..." -ForegroundColor Cyan -NoNewline
        }
        
        $isOpen = Test-PortConnectivity -Host $portTest.Host -Port $portTest.Port
        
        if ($isOpen) {
            if ($Verbose) {
                Write-Host "    ✅ Port $($portTest.Port) is open and accessible" -ForegroundColor Green
            } else {
                Write-Host " ✅ Open" -ForegroundColor Green
            }
        } else {
            if ($Verbose) {
                Write-Host "    ❌ Port $($portTest.Port) is not accessible" -ForegroundColor Red
            } else {
                Write-Host " ❌ Closed" -ForegroundColor Red
            }
            $allPortsOk = $false
        }
    }
    
    return $allPortsOk
}

# Test Supabase services
function Test-SupabaseServices {
    Write-Host ""
    Write-Host "🚀 TESTING SUPABASE SERVICES..."
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    $tests = @(
        @{ Name = "API Health Check"; Url = "http://localhost:54321/health"; Expected = 200 },
        @{ Name = "REST API"; Url = "http://localhost:54321/rest/v1/"; Expected = 200 },
        @{ Name = "Auth API"; Url = "http://localhost:54321/auth/v1/health"; Expected = 200 },
        @{ Name = "Storage API"; Url = "http://localhost:54321/storage/v1/"; Expected = 200 }
    )
    
    # Add Studio test only if not quick mode
    if (-not $Quick) {
        $tests += @{ Name = "Supabase Studio"; Url = "http://localhost:54323"; Expected = 200 }
    }
    
    $allServicesOk = $true
    
    foreach ($test in $tests) {
        $result = Test-ServiceEndpoint -Name $test.Name -Url $test.Url -ExpectedStatus $test.Expected
        if (-not $result) {
            $allServicesOk = $false
        }
    }
    
    return $allServicesOk
}

# Test database connectivity
function Test-DatabaseConnectivity {
    if ($Quick) {
        return $true
    }
    
    Write-Host ""
    Write-Host "🗄️  TESTING DATABASE CONNECTIVITY..."
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    try {
        if ($Verbose) {
            Write-Host "  🔍 Attempting to connect to PostgreSQL..." -ForegroundColor Cyan
        } else {
            Write-Host "  🔍 Database connection..." -ForegroundColor Cyan -NoNewline
        }
        
        # Test database connection using REST API
        $dbTest = Test-ServiceEndpoint -Name "Database Query" -Url "http://localhost:54321/rest/v1/rpc/version" -ExpectedStatus 401
        
        if ($dbTest) {
            if ($Verbose) {
                Write-Host "    ✅ Database is accessible (401 is expected for unauthenticated request)" -ForegroundColor Green
            } else {
                Write-Host " ✅ Accessible" -ForegroundColor Green
            }
            return $true
        } else {
            if ($Verbose) {
                Write-Host "    ❌ Database connection issues" -ForegroundColor Red
            } else {
                Write-Host " ❌ Issues" -ForegroundColor Red
            }
            return $false
        }
    }
    catch {
        if ($Verbose) {
            Write-Host "    ❌ Database test error: $($_.Exception.Message)" -ForegroundColor Red
        } else {
            Write-Host " ❌ Error" -ForegroundColor Red
        }
        return $false
    }
}

# Generate connectivity report
function Show-ConnectivityReport {
    param(
        $DockerOk,
        $PortsOk,
        $ServicesOk,
        $DatabaseOk
    )
    
    Write-Host ""
    Write-Host "📊 CONNECTIVITY REPORT"
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    $components = @(
        @{ Name = "Docker Containers"; Status = $DockerOk },
        @{ Name = "Port Connectivity"; Status = $PortsOk },
        @{ Name = "Supabase Services"; Status = $ServicesOk },
        @{ Name = "Database Connectivity"; Status = $DatabaseOk }
    )
    
    foreach ($component in $components) {
        $status = if ($component.Status) { "✅ OK" } else { "❌ FAILED" }
        $color = if ($component.Status) { "Green" } else { "Red" }
        Write-Host "  $($component.Name): $status" -ForegroundColor $color
    }
    
    $overallHealth = $DockerOk -and $PortsOk -and $ServicesOk -and $DatabaseOk
    
    Write-Host ""
    Write-Host "🏥 Overall Health: " -NoNewline
    if ($overallHealth) {
        Write-Host "🎉 ALL SYSTEMS OPERATIONAL" -ForegroundColor Green
    } else {
        Write-Host "⚠️  ISSUES DETECTED" -ForegroundColor Yellow
    }
    
    return $overallHealth
}

# Main execution
Write-Host "🌐 SERVICE CONNECTIVITY TESTING" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

$mode = if ($Quick) { "QUICK" } else { "COMPREHENSIVE" }
$verbosity = if ($Verbose) { "VERBOSE" } else { "STANDARD" }
Write-Host "Mode: $mode | Output: $verbosity" -ForegroundColor Cyan

$startTime = Get-Date

try {
    # Run tests
    $dockerOk = Test-DockerContainers
    $portsOk = Test-PortAvailability
    $servicesOk = Test-SupabaseServices
    $databaseOk = Test-DatabaseConnectivity
    
    # Run analytics health check if not in quick mode
    $analyticsOk = $true
    if (-not $Quick) {
        $analyticsOk = Test-SupabaseAnalyticsHealth
    }
    
    # Generate report
    $overallHealth = Show-ConnectivityReport -DockerOk $dockerOk -PortsOk $portsOk -ServicesOk $servicesOk -DatabaseOk $databaseOk
    
    $endTime = Get-Date
    $duration = $endTime - $startTime
    
    Write-Host ""
    Write-Host "⏱️  Test completed in $($duration.Seconds) seconds" -ForegroundColor Cyan
    
    if ($overallHealth) {
        Write-Host ""
        Write-Host "🌐 Access Points:" -ForegroundColor Cyan
        Write-Host "  • Supabase Studio: http://localhost:54323" -ForegroundColor White
        Write-Host "  • API Endpoint: http://localhost:54321" -ForegroundColor White
        Write-Host "  • Database: localhost:54322" -ForegroundColor White
        Write-Host ""
        Write-Host "📋 Next steps:" -ForegroundColor Cyan
        Write-Host "  • Test authentication: node scripts/11-test-authentication.js" -ForegroundColor White
        Write-Host "  • Check database: node scripts/06-check-database.js" -ForegroundColor White
        Write-Host "  • View access points: node scripts/13-show-access-points.js" -ForegroundColor White
        exit 0
    } else {
        Write-Host ""
        Write-Host "🔧 Troubleshooting suggestions:" -ForegroundColor Yellow
        Write-Host "  • Start services: docker-compose up -d" -ForegroundColor White
        Write-Host "  • Check logs: docker-compose logs -f" -ForegroundColor White
        Write-Host "  • Reset environment: .\\scripts\\02-reset-and-seed.ps1" -ForegroundColor White
        Write-Host "  • Check environment: .\\scripts\\01-setup-environment.ps1" -ForegroundColor White
        exit 1
    }
}
catch {
    Write-Host ""
    Write-Host "❌ CONNECTIVITY TEST FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 This usually means:" -ForegroundColor Yellow
    Write-Host "  • Docker is not running" -ForegroundColor White
    Write-Host "  • Supabase containers are not started" -ForegroundColor White
    Write-Host "  • Network connectivity issues" -ForegroundColor White
    exit 1
}
