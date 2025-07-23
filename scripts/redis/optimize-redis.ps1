# Redis Optimization Script for Cloudless LLM Dev Agent
# This script helps monitor and optimize Redis performance

param(
    [string]$Action = "status",
    [string]$RedisHost = "localhost",
    [int]$RedisPort = 6379
)

# Colors for output
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"
$Cyan = "Cyan"

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Test-RedisConnection {
    try {
        $result = docker exec cloudlessgr-redis-dev redis-cli ping
        if ($result -eq "PONG") {
            Write-ColorOutput "✅ Redis is running and responding" $Green
            return $true
        } else {
            Write-ColorOutput "❌ Redis is not responding properly" $Red
            return $false
        }
    } catch {
        Write-ColorOutput "❌ Cannot connect to Redis: $($_.Exception.Message)" $Red
        return $false
    }
}

function Get-RedisInfo {
    Write-ColorOutput "`n📊 Redis Information:" $Cyan
    try {
        $info = docker exec cloudlessgr-redis-dev redis-cli info
        $info | ForEach-Object {
            if ($_ -match "^redis_version:") {
                Write-ColorOutput "  Version: $($_.Split(':')[1])" $Green
            }
            if ($_ -match "^used_memory_human:") {
                Write-ColorOutput "  Memory Used: $($_.Split(':')[1])" $Yellow
            }
            if ($_ -match "^connected_clients:") {
                Write-ColorOutput "  Connected Clients: $($_.Split(':')[1])" $Cyan
            }
            if ($_ -match "^total_commands_processed:") {
                Write-ColorOutput "  Total Commands: $($_.Split(':')[1])" $Cyan
            }
            if ($_ -match "^keyspace_hits:") {
                Write-ColorOutput "  Cache Hits: $($_.Split(':')[1])" $Green
            }
            if ($_ -match "^keyspace_misses:") {
                Write-ColorOutput "  Cache Misses: $($_.Split(':')[1])" $Yellow
            }
        }
    } catch {
        Write-ColorOutput "❌ Error getting Redis info: $($_.Exception.Message)" $Red
    }
}

function Get-RedisMemory {
    Write-ColorOutput "`n💾 Memory Analysis:" $Cyan
    try {
        $memory = docker exec cloudlessgr-redis-dev redis-cli info memory
        $usedMemory = 0
        $maxMemory = 0
        
        $memory | ForEach-Object {
            if ($_ -match "^used_memory:") {
                $usedMemory = [long]$_.Split(':')[1]
            }
            if ($_ -match "^maxmemory:") {
                $maxMemory = [long]$_.Split(':')[1]
            }
        }
        
        # Always show memory usage, even if maxMemory is 0
        $usedMemoryStr = "$usedMemory bytes"
        Write-ColorOutput "  Used Memory: $usedMemoryStr" $Yellow
        
        if ($maxMemory -gt 0) {
            $usagePercent = ($usedMemory / $maxMemory) * 100
            $usageStr = "$([math]::Round($usagePercent, 2))% ($usedMemory / $maxMemory bytes)"
            Write-ColorOutput "  Memory Usage: $usageStr" $Yellow
            
            if ($usagePercent -gt 80) {
                Write-ColorOutput "  ⚠️  High memory usage detected!" $Red
                Write-ColorOutput "  Consider increasing maxmemory or optimizing data" $Yellow
            }
        } else {
            Write-ColorOutput "  Max Memory: Not set (unlimited)" $Yellow
        }
    } catch {
        Write-ColorOutput "❌ Error getting memory info: $($_.Exception.Message)" $Red
    }
}

function Get-RedisKeys {
    Write-ColorOutput "`n🔑 Key Analysis:" $Cyan
    try {
        $keys = docker exec cloudlessgr-redis-dev redis-cli dbsize
        Write-ColorOutput "  Total Keys: $keys" $Green
        
        # Get key patterns
        $patterns = @(
            "analytics:*",
            "rate_limit:*", 
            "cache:*",
            "session:*",
            "pipeline:*",
            "model:*"
        )
        
        foreach ($pattern in $patterns) {
            $count = docker exec cloudlessgr-redis-dev redis-cli --raw keys $pattern | Measure-Object | Select-Object -ExpandProperty Count
            if ($count -gt 0) {
                Write-ColorOutput "  $pattern`: $count keys" $Green
            }
        }
    } catch {
        Write-ColorOutput "❌ Error getting key info: $($_.Exception.Message)" $Red
    }
}

function Get-RedisPerformance {
    Write-ColorOutput "`n⚡ Performance Metrics:" $Cyan
    try {
        $stats = docker exec cloudlessgr-redis-dev redis-cli info stats
        $stats | ForEach-Object {
            if ($_ -match "^instantaneous_ops_per_sec:") {
                Write-ColorOutput "  Ops/sec: $($_.Split(':')[1])" $Green
            }
            if ($_ -match "^total_net_input_bytes:") {
                $bytes = [long]$_.Split(':')[1]
                $mb = [math]::Round($bytes / 1MB, 2)
                Write-ColorOutput "  Input: $mb MB" $Cyan
            }
            if ($_ -match "^total_net_output_bytes:") {
                $bytes = [long]$_.Split(':')[1]
                $mb = [math]::Round($bytes / 1MB, 2)
                Write-ColorOutput "  Output: $mb MB" $Cyan
            }
        }
    } catch {
        Write-ColorOutput "❌ Error getting performance info: $($_.Exception.Message)" $Red
    }
}

function Optimize-Redis {
    Write-ColorOutput "`n🔧 Running Redis Optimizations:" $Cyan
    
    # Check if Redis needs optimization
    try {
        $memory = docker exec cloudlessgr-redis-dev redis-cli info memory
        $usedMemory = 0
        $maxMemory = 0
        
        $memory | ForEach-Object {
            if ($_ -match "^used_memory:") {
                $usedMemory = [long]$_.Split(':')[1]
            }
            if ($_ -match "^maxmemory:") {
                $maxMemory = [long]$_.Split(':')[1]
            }
        }
        
        # Always show current memory status
        $currentMemoryStr = "$usedMemory bytes"
        Write-ColorOutput "  Current Memory Usage: $currentMemoryStr" $Yellow
        
        if ($maxMemory -gt 0) {
            $usagePercent = ($usedMemory / $maxMemory) * 100
            $usageStr = "$([math]::Round($usagePercent, 2))% ($usedMemory / $maxMemory bytes)"
            Write-ColorOutput "  Memory Usage: $usageStr" $Yellow
            
            if ($usagePercent -gt 80) {
                Write-ColorOutput "  ⚠️  High memory usage detected!" $Red
                Write-ColorOutput "  Consider increasing maxmemory or optimizing data" $Yellow
            }
        } else {
            Write-ColorOutput "  Max Memory: Not set (unlimited)" $Yellow
        }
        
        # Run memory optimization - use BGSAVE instead of memory purge
        Write-ColorOutput "  Running memory optimization..." $Cyan
        try {
            docker exec cloudlessgr-redis-dev redis-cli bgsave
            Write-ColorOutput "  ✅ Background save initiated for memory optimization" $Green
        } catch {
            Write-ColorOutput "  ⚠️  Could not run BGSAVE: $($_.Exception.Message)" $Yellow
        }
        
        # Note: Manual key cleanup may be needed
        Write-ColorOutput "  ℹ️  Consider manually cleaning up expired keys if needed" $Yellow
        
    } catch {
        Write-ColorOutput "❌ Error during optimization: $($_.Exception.Message)" $Red
    }
}

function Clear-RedisCache {
    Write-ColorOutput "`n🧹 Clearing Redis Cache:" $Cyan
    try {
        $confirm = Read-Host "Are you sure you want to clear all Redis data? (y/N)"
        if ($confirm -eq "y" -or $confirm -eq "Y") {
            docker exec cloudlessgr-redis-dev redis-cli flushall
            Write-ColorOutput "  ✅ Redis cache cleared" $Green
        } else {
            Write-ColorOutput "  ❌ Operation cancelled" $Yellow
        }
    } catch {
        Write-ColorOutput "❌ Error clearing cache: $($_.Exception.Message)" $Red
    }
}

function Show-RedisSlowLog {
    Write-ColorOutput "`n🐌 Slow Query Log:" $Cyan
    try {
        $slowLog = docker exec cloudlessgr-redis-dev redis-cli slowlog get 10
        if ($slowLog -and $slowLog.Length -gt 0) {
            $slowLog | ForEach-Object {
                if ($_ -match "^[0-9]+\)") {
                    Write-ColorOutput "  $_" $Yellow
                }
            }
        } else {
            Write-ColorOutput "  No slow queries found" $Green
        }
    } catch {
        Write-ColorOutput "❌ Error getting slow log: $($_.Exception.Message)" $Red
    }
}

function Show-Help {
    Write-ColorOutput "`n📖 Redis Optimization Script Help:" $Cyan
    Write-ColorOutput "Usage: .\optimize-redis.ps1 [Action]" $Yellow
    Write-ColorOutput "`nAvailable Actions:" $Cyan
    Write-ColorOutput "  status     - Show Redis status and basic info" $Green
    Write-ColorOutput "  memory     - Show memory usage and analysis" $Green
    Write-ColorOutput "  keys       - Show key statistics" $Green
    Write-ColorOutput "  performance - Show performance metrics" $Green
    Write-ColorOutput "  optimize   - Run optimization tasks" $Green
    Write-ColorOutput "  clear      - Clear all Redis data" $Red
    Write-ColorOutput "  slowlog    - Show slow query log" $Green
    Write-ColorOutput "  all        - Run all checks and optimizations" $Green
    Write-ColorOutput "  help       - Show this help message" $Green
}

# Main execution
Write-ColorOutput "🚀 Redis Optimization Script for Cloudless LLM Dev Agent" $Cyan
Write-ColorOutput "==================================================" $Cyan

# Check Redis connection first
if (-not (Test-RedisConnection)) {
    Write-ColorOutput "`n❌ Cannot proceed without Redis connection" $Red
    exit 1
}

# Execute based on action
switch ($Action.ToLower()) {
    "status" {
        Get-RedisInfo
        Get-RedisMemory
    }
    "memory" {
        Get-RedisMemory
    }
    "keys" {
        Get-RedisKeys
    }
    "performance" {
        Get-RedisPerformance
    }
    "optimize" {
        Optimize-Redis
    }
    "clear" {
        Clear-RedisCache
    }
    "slowlog" {
        Show-RedisSlowLog
    }
    "all" {
        Get-RedisInfo
        Get-RedisMemory
        Get-RedisKeys
        Get-RedisPerformance
        Optimize-Redis
        Show-RedisSlowLog
    }
    "help" {
        Show-Help
    }
    default {
        Write-ColorOutput "❌ Unknown action: $Action" $Red
        Show-Help
    }
}

Write-ColorOutput "`n✅ Redis optimization script completed" $Green 