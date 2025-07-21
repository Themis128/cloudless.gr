# Clear Rate Limits Script
# This script clears all rate limit keys from Redis

Write-Host "Clearing rate limit cache..." -ForegroundColor Yellow

# Check if Redis is running in Docker
try {
    $redisTest = docker exec cloudlessgr-redis-dev redis-cli ping
    if ($redisTest -eq "PONG") {
        Write-Host "Redis is running in Docker" -ForegroundColor Green
    }
    else {
        Write-Host "Redis is not responding properly" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "Redis is not running or not accessible" -ForegroundColor Red
    Write-Host "Please start Redis with: docker-compose up -d redis" -ForegroundColor Yellow
    exit 1
}

# Clear all rate limit keys
try {
    $rateLimitKeys = docker exec cloudlessgr-redis-dev redis-cli keys "rate_limit:*"
    $apiRateLimitKeys = docker exec cloudlessgr-redis-dev redis-cli keys "api_rate_limit:*"
    $authRateLimitKeys = docker exec cloudlessgr-redis-dev redis-cli keys "auth_rate_limit:*"
    $uploadRateLimitKeys = docker exec cloudlessgr-redis-dev redis-cli keys "upload_rate_limit:*"
    $devRateLimitKeys = docker exec cloudlessgr-redis-dev redis-cli keys "dev_rate_limit:*"
    
    $allKeys = @($rateLimitKeys, $apiRateLimitKeys, $authRateLimitKeys, $uploadRateLimitKeys, $devRateLimitKeys) | Where-Object { $_ -ne $null }
    
    if ($allKeys.Count -gt 0) {
        Write-Host "Found $($allKeys.Count) rate limit keys to clear" -ForegroundColor Yellow
        
        foreach ($key in $allKeys) {
            docker exec cloudlessgr-redis-dev redis-cli del $key | Out-Null
        }
        
        Write-Host "Rate limit cache cleared successfully!" -ForegroundColor Green
    }
    else {
        Write-Host "No rate limit keys found to clear" -ForegroundColor Blue
    }
}
catch {
    Write-Host "Error clearing rate limit cache: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "Done!" -ForegroundColor Green 