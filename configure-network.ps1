# Network Configuration Script for Cloudless.gr Docker
# This script helps configure Windows to allow external access to the Docker app

param(
    [string]$IP = "192.168.68.106",
    [int]$Port = 3000
)

Write-Host "Configuring network access for Cloudless.gr Docker app..." -ForegroundColor Green
Write-Host "Target IP: $IP" -ForegroundColor Yellow
Write-Host "Target Port: $Port" -ForegroundColor Yellow
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "WARNING: This script should be run as Administrator for full functionality." -ForegroundColor Red
    Write-Host "Some network configurations may not work without admin privileges." -ForegroundColor Yellow
    Write-Host ""
}

# 1. Check current network interfaces
Write-Host "1. Checking network interfaces..." -ForegroundColor Cyan
try {
    $interfaces = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "$IP*" }
    if ($interfaces) {
        Write-Host "   ✓ Found interface with IP $IP" -ForegroundColor Green
        $interfaces | Format-Table IPAddress, InterfaceAlias, AddressFamily
    } else {
        Write-Host "   ⚠ No interface found with IP $IP" -ForegroundColor Yellow
        Write-Host "   Available IPv4 interfaces:" -ForegroundColor Yellow
        Get-NetIPAddress -AddressFamily IPv4 | Format-Table IPAddress, InterfaceAlias, AddressFamily
    }
} catch {
    Write-Host "   ❌ Error checking network interfaces: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 2. Check if port is listening
Write-Host "2. Checking if port $Port is listening..." -ForegroundColor Cyan
try {
    $listeners = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($listeners) {
        Write-Host "   ✓ Port $Port is listening" -ForegroundColor Green
        $listeners | Format-Table LocalAddress, LocalPort, State, OwningProcess
    } else {
        Write-Host "   ⚠ Port $Port is not currently listening" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Error checking port: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 3. Check Windows Firewall rules
Write-Host "3. Checking Windows Firewall rules..." -ForegroundColor Cyan
try {
    $firewallRules = Get-NetFirewallRule -DisplayName "*$Port*" -ErrorAction SilentlyContinue
    if ($firewallRules) {
        Write-Host "   ✓ Found firewall rules for port $Port" -ForegroundColor Green
        $firewallRules | Format-Table DisplayName, Enabled, Direction, Action
    } else {
        Write-Host "   ⚠ No specific firewall rules found for port $Port" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Error checking firewall rules: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 4. Test connectivity
Write-Host "4. Testing connectivity..." -ForegroundColor Cyan
Write-Host "   Testing localhost:$Port..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:$Port" -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✓ localhost:$Port is accessible" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ localhost:$Port returned status: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ localhost:$Port is not accessible: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "   Testing $IP`:$Port..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://$IP`:$Port" -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✓ $IP`:$Port is accessible" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ $IP`:$Port returned status: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ $IP`:$Port is not accessible: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 5. Provide solutions
Write-Host "5. Solutions to try:" -ForegroundColor Cyan

if (-not $isAdmin) {
    Write-Host "   🔧 Run this script as Administrator to configure firewall rules" -ForegroundColor Yellow
}

Write-Host "   🔧 Check Windows Firewall settings:" -ForegroundColor Yellow
Write-Host "      - Open Windows Defender Firewall" -ForegroundColor White
Write-Host "      - Go to 'Advanced settings'" -ForegroundColor White
Write-Host "      - Add inbound rule for port $Port" -ForegroundColor White

Write-Host "   🔧 Alternative: Use localhost instead of $IP" -ForegroundColor Yellow
Write-Host "      - Access your app at: http://localhost:$Port" -ForegroundColor White

Write-Host "   🔧 Check Docker network settings:" -ForegroundColor Yellow
Write-Host "      - Docker might be binding to localhost only" -ForegroundColor White
Write-Host "      - Try: docker run --network host ..." -ForegroundColor White

Write-Host "   🔧 Check your router/network configuration:" -ForegroundColor Yellow
Write-Host "      - Ensure port forwarding is configured" -ForegroundColor White
Write-Host "      - Check if your ISP blocks the port" -ForegroundColor White

Write-Host ""
Write-Host "Configuration check complete!" -ForegroundColor Green 