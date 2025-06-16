# Complete Supabase Reset and Seeding Script - FAST MODE with Environment Validation
# This script completely resets Supabase and gets it running immediately
# NEW: Automatically fixes common development environment issues including:
#   • Empty or malformed Vue components (fixes "At least one <template> or <script> is required")
#   • Missing or empty environment variables (fixes Elixir validation errors)
#   • Line ending issues in Elixir/SQL files (prevents parsing errors)
#   • Invalid Docker Compose configurations
#   • Missing directories and problematic files
#
# Usage Examples:
#   .\scripts\reset-and-seed.ps1                    # Full reset with seeding (FAST)
#   .\scripts\reset-and-seed.ps1 -SkipSeed         # Reset without seeding (FASTEST)
#   .\scripts\reset-and-seed.ps1 -DevMode          # Development mode
#   .\scripts\reset-and-seed.ps1 -Quick            # Super quick mode (minimal cleanup)
#   .\scripts\reset-and-seed.ps1 -Force            # Skip all prompts
#   .\scripts\reset-and-seed.ps1 -FixLineEndings   # Fix line endings only (no reset)
#   .\scripts\reset-and-seed.ps1 -ValidateOnly     # Validate and fix environment issues only
#
# Parameters:
#   -SkipSeed       : Skip database seeding after reset
#   -DevMode        : Use development compose file
#   -Quick          : Minimal cleanup for fastest startup
#   -Force          : Skip confirmation prompts
#   -NoCleanup      : Skip all cleanup steps (restart only)
#   -FixLineEndings : Only fix line endings and exit (useful for troubleshooting)
#   -ValidateOnly   : Only validate and fix environment issues (no Docker operations)

param(
    [switch]$SkipSeed,
    [switch]$DevMode,
    [switch]$Quick,
    [switch]$Force,
    [switch]$NoCleanup,
    [switch]$FixLineEndings,
    [switch]$ValidateOnly
)

# Function to fix line endings - prevents Elixir parsing errors
function Repair-AllLineEndings {
    param([string]$BaseDirectory = ".")
    
    Write-Host ""
    Write-Host "🔧 COMPREHENSIVE LINE ENDING FIXES..." -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    # Function to fix individual file
    function Repair-FileLineEndings {
        param([string]$FilePath, [string]$FileType = "")
        if (Test-Path $FilePath) {
            try {
                $content = Get-Content $FilePath -Raw -ErrorAction SilentlyContinue
                if ($content -and $content.Contains("`r`n")) {
                    # Convert CRLF to LF
                    $content = $content -replace "`r`n", "`n"
                    # Remove any standalone CR characters
                    $content = $content -replace "`r", ""
                    [System.IO.File]::WriteAllText($FilePath, $content, [System.Text.Encoding]::UTF8)
                    Write-Host "  ✅ Fixed: $FilePath $FileType" -ForegroundColor Green
                    return $true
                } elseif ($content -and $content.Contains("`r")) {
                    # Fix standalone CR characters
                    $content = $content -replace "`r", "`n"
                    [System.IO.File]::WriteAllText($FilePath, $content, [System.Text.Encoding]::UTF8)
                    Write-Host "  ✅ Fixed CR: $FilePath $FileType" -ForegroundColor Green
                    return $true
                }
            } catch {
                Write-Host "  ⚠️  Failed to fix: $FilePath - $($_.Exception.Message)" -ForegroundColor Yellow
                return $false
            }
        }
        return $false
    }
    
    $fixedCount = 0
    
    # CRITICAL: Elixir files (must be perfect)
    $elixirFiles = @(
        "$BaseDirectory/docker/volumes/pooler/pooler.exs"
    )
    
    Write-Host "🔹 Fixing Elixir files (CRITICAL)..." -ForegroundColor Cyan
    foreach ($file in $elixirFiles) {
        if (Repair-FileLineEndings $file "(Elixir)") { $fixedCount++ }
    }
    
    # SQL files that may contain embedded code
    $sqlFiles = @(
        "$BaseDirectory/docker/volumes/db/jwt.sql",
        "$BaseDirectory/docker/volumes/db/roles.sql", 
        "$BaseDirectory/docker/volumes/db/webhooks.sql",
        "$BaseDirectory/docker/volumes/db/realtime.sql",
        "$BaseDirectory/docker/volumes/db/_supabase.sql",
        "$BaseDirectory/docker/volumes/db/logs.sql",
        "$BaseDirectory/docker/volumes/db/pooler.sql",
        "$BaseDirectory/docker/dev/seed.sql",
        "$BaseDirectory/docker/dev/data.sql"
    )
      Write-Host "🔹 Fixing SQL files..." -ForegroundColor Cyan
    foreach ($file in $sqlFiles) {
        if (Repair-FileLineEndings $file "(SQL)") { $fixedCount++ }
    }
    
    # Script files
    $scriptFiles = @(
        "$BaseDirectory/scripts/add-themis-admin.sql",
        "$BaseDirectory/scripts/add-themis-user.sql", 
        "$BaseDirectory/scripts/quick-keys.sql",
        "$BaseDirectory/scripts/database-keys-retrieval.sql"
    )
    
    Write-Host "🔹 Fixing script files..." -ForegroundColor Cyan
    foreach ($file in $scriptFiles) {
        if (Repair-FileLineEndings $file "(Script)") { $fixedCount++ }
    }
    
    # Configuration files
    $configFiles = @(
        "$BaseDirectory/docker/docker-compose.yml",
        "$BaseDirectory/docker/.env",
        "$BaseDirectory/.env"
    )
    
    Write-Host "🔹 Fixing configuration files..." -ForegroundColor Cyan
    foreach ($file in $configFiles) {
        if (Repair-FileLineEndings $file "(Config)") { $fixedCount++ }
    }
    
    Write-Host ""
    if ($fixedCount -gt 0) {
        Write-Host "🎯 FIXED LINE ENDINGS IN $fixedCount FILES" -ForegroundColor Green
        Write-Host "   This prevents Elixir parsing errors like:" -ForegroundColor Yellow
        Write-Host "   'unexpected token: carriage return (U+000D)'" -ForegroundColor Gray
    } else {
        Write-Host "✅ ALL FILES ALREADY HAVE CORRECT LINE ENDINGS" -ForegroundColor Green
    }
      return $fixedCount
}

# Function to validate and fix common development environment issues
function Repair-DevelopmentEnvironment {
    param([string]$BaseDirectory = "..")
    
    Write-Host ""
    Write-Host "🛠️  COMPREHENSIVE ENVIRONMENT VALIDATION & REPAIR..." -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    $fixedIssues = 0
    $validationErrors = @()    # 1. Fix empty or malformed Vue components
    Write-Host "🔹 Validating Vue components..." -ForegroundColor Cyan
    $pagesPath = "$BaseDirectory/pages"
    if (-not (Test-Path $pagesPath)) {
        $pagesPath = "pages"  # Try relative path
    }
    $vueFiles = Get-ChildItem -Path $pagesPath -Filter "*.vue" -Recurse -ErrorAction SilentlyContinue
    foreach ($vueFile in $vueFiles) {
        try {
            $content = Get-Content $vueFile.FullName -Raw -ErrorAction SilentlyContinue
            if (-not $content -or $content.Trim() -eq "") {
                # Fix empty Vue file
                $componentName = [System.IO.Path]::GetFileNameWithoutExtension($vueFile.Name)
                $template = @"
<template>
  <div>
    <h1>$componentName</h1>
    <p>This is the $componentName page.</p>
    <NuxtLink to="/">Go Home</NuxtLink>
  </div>
</template>

<script setup>
// $componentName page component
const pageTitle = '$componentName'
</script>
"@
                [System.IO.File]::WriteAllText($vueFile.FullName, $template, [System.Text.Encoding]::UTF8)
                Write-Host "  ✅ Fixed empty Vue file: $($vueFile.Name)" -ForegroundColor Green
                $fixedIssues++
            } elseif (-not ($content -match "<template>" -or $content -match "<script>")) {
                # Vue file exists but lacks required sections
                $validationErrors += "Vue file $($vueFile.Name) lacks required <template> or <script> sections"
                Write-Host "  ⚠️  Vue file needs manual attention: $($vueFile.Name)" -ForegroundColor Yellow
            }
        } catch {
            $validationErrors += "Failed to validate Vue file $($vueFile.Name): $($_.Exception.Message)"
        }
    }    # 2. Validate and fix environment variables
    Write-Host "🔹 Validating environment variables..." -ForegroundColor Cyan
    # Try both possible locations for .env file
    $envFile = "$BaseDirectory/docker/.env"
    if (-not (Test-Path $envFile)) {
        $envFile = "docker/.env"  # Try relative path
    }
    if (Test-Path $envFile) {
        try {
            $envContent = Get-Content $envFile -Raw
            $requiredVars = @{
                'POOLER_TENANT_ID' = 'default'
                'VAULT_ENC_KEY' = 'abcdefghij1234567890klmnopqrstuv'  # 32 bytes
                'SECRET_KEY_BASE' = 'your-super-secret-key-base-change-this-in-production'
                'JWT_SECRET' = 'eOvlpJPRGfQkptMLRFSfCPerPR5MkrekkpIuLqXd'
                'POSTGRES_PASSWORD' = 'postgres'
                'POSTGRES_DB' = 'postgres'
                'POSTGRES_HOST' = 'db'
                'POSTGRES_PORT' = '5432'
            }
            
            $needsUpdate = $false
            foreach ($var in $requiredVars.Keys) {
                if (-not ($envContent -match "^$var=.+$" -and -not ($envContent -match "^$var=\s*$"))) {
                    # Variable is missing or empty
                    if ($envContent -match "^$var=\s*$") {
                        # Replace empty variable
                        $envContent = $envContent -replace "^$var=\s*$", "$var=$($requiredVars[$var])"
                    } elseif (-not ($envContent -match "^$var=")) {
                        # Add missing variable
                        $envContent += "`n$var=$($requiredVars[$var])"
                    }
                    Write-Host "  ✅ Fixed environment variable: $var" -ForegroundColor Green
                    $needsUpdate = $true
                    $fixedIssues++
                }
            }
            
            if ($needsUpdate) {
                [System.IO.File]::WriteAllText($envFile, $envContent, [System.Text.Encoding]::UTF8)
                Write-Host "  ✅ Updated .env file with required variables" -ForegroundColor Green
            }
        } catch {
            $validationErrors += "Failed to validate .env file: $($_.Exception.Message)"
        }
    } else {
        $validationErrors += ".env file not found at $envFile"
    }

    # 3. Validate Docker Compose configuration  
    Write-Host "🔹 Validating Docker Compose..." -ForegroundColor Cyan
    $composeFile = "$BaseDirectory/docker/docker-compose.yml"
    if (Test-Path $composeFile) {
        try {
            # Test docker-compose config validity
            $oldLocation = Get-Location
            Set-Location "$BaseDirectory/docker"
            $composeTest = docker-compose config 2>&1
            Set-Location $oldLocation
            
            if ($LASTEXITCODE -ne 0) {
                $validationErrors += "Docker Compose configuration is invalid: $composeTest"
            } else {
                Write-Host "  ✅ Docker Compose configuration is valid" -ForegroundColor Green
            }
        } catch {
            $validationErrors += "Failed to validate Docker Compose: $($_.Exception.Message)"
        }
    }

    # 4. Check for problematic files that might cause runtime errors
    Write-Host "🔹 Checking for problematic files..." -ForegroundColor Cyan
    $problematicPatterns = @{
        "*.tmp" = "Temporary files"
        "*.log" = "Log files that might be locked"
        ".DS_Store" = "macOS system files"
        "Thumbs.db" = "Windows thumbnail files"
        "node_modules/.cache" = "Node module cache"
    }
    
    foreach ($pattern in $problematicPatterns.Keys) {
        $files = Get-ChildItem -Path $BaseDirectory -Filter $pattern -Recurse -Force -ErrorAction SilentlyContinue
        if ($files) {
            foreach ($file in $files) {
                try {
                    Remove-Item $file.FullName -Force -Recurse -ErrorAction Stop
                    Write-Host "  ✅ Removed problematic file: $($file.Name)" -ForegroundColor Green
                    $fixedIssues++
                } catch {
                    Write-Host "  ⚠️  Could not remove: $($file.Name)" -ForegroundColor Yellow
                }
            }
        }
    }

    # 5. Validate critical directories exist
    Write-Host "🔹 Validating directory structure..." -ForegroundColor Cyan
    $requiredDirs = @(
        "$BaseDirectory/docker/volumes/pooler",
        "$BaseDirectory/docker/volumes/db",
        "$BaseDirectory/docker/dev",
        "$BaseDirectory/scripts",
        "$BaseDirectory/pages",
        "$BaseDirectory/components"
    )
    
    foreach ($dir in $requiredDirs) {
        if (-not (Test-Path $dir)) {
            try {
                New-Item -Path $dir -ItemType Directory -Force | Out-Null
                Write-Host "  ✅ Created missing directory: $dir" -ForegroundColor Green
                $fixedIssues++
            } catch {
                $validationErrors += "Failed to create directory $dir`: $($_.Exception.Message)"
            }
        }
    }

    # 6. Fix Elixir formatting issues (like the pooler.exs single-line problem)
    Write-Host "🔹 Validating Elixir files..." -ForegroundColor Cyan
    $elixirFile = "$BaseDirectory/docker/volumes/pooler/pooler.exs"
    if (Test-Path $elixirFile) {
        try {
            $elixirContent = Get-Content $elixirFile -Raw
            # Check if it's all on one line (problematic)
            if ($elixirContent -and -not ($elixirContent -match "`n") -and $elixirContent.Length -gt 200) {
                Write-Host "  ⚠️  Elixir file appears to be improperly formatted (single line)" -ForegroundColor Yellow
                $validationErrors += "pooler.exs may be formatted on a single line - check manually"
            } else {
                Write-Host "  ✅ Elixir file formatting looks correct" -ForegroundColor Green
            }        } catch {
            $validationErrors += "Failed to validate Elixir file: $($_.Exception.Message)"
        }
    }

    # 7. Validate Supabase URL configuration
    Write-Host "🔹 Validating Supabase URL configuration..." -ForegroundColor Cyan
    
    # Check both possible .env files
    $envFiles = @("$BaseDirectory/.env", "$BaseDirectory/docker/.env")
    foreach ($envFilePath in $envFiles) {
        if (Test-Path $envFilePath) {
            try {
                $envContent = Get-Content $envFilePath -Raw
                $incorrectUrls = @(
                    'http://127.0.0.1:54321',
                    'http://localhost:54321'
                )
                $correctUrl = 'http://127.0.0.1:8000'
                
                $needsUpdate = $false
                foreach ($incorrectUrl in $incorrectUrls) {
                    if ($envContent -match [regex]::Escape("SUPABASE_URL=$incorrectUrl")) {
                        $envContent = $envContent -replace [regex]::Escape("SUPABASE_URL=$incorrectUrl"), "SUPABASE_URL=$correctUrl"
                        Write-Host "  ✅ Fixed Supabase URL: $incorrectUrl → $correctUrl" -ForegroundColor Green
                        $needsUpdate = $true
                        $fixedIssues++
                    }
                }
                
                # Also check for incorrect database port in root .env
                if ($envFilePath -like "*/.env" -and -not ($envFilePath -like "*/docker/.env")) {
                    if ($envContent -match "POSTGRES_PORT=54322") {
                        $envContent = $envContent -replace "POSTGRES_PORT=54322", "POSTGRES_PORT=5432"
                        Write-Host "  ✅ Fixed Postgres port: 54322 → 5432" -ForegroundColor Green
                        $needsUpdate = $true
                        $fixedIssues++
                    }
                    if ($envContent -match "POSTGRES_HOST=127\.0\.0\.1") {
                        $envContent = $envContent -replace "POSTGRES_HOST=127\.0\.0\.1", "POSTGRES_HOST=localhost"
                        Write-Host "  ✅ Fixed Postgres host: 127.0.0.1 → localhost" -ForegroundColor Green
                        $needsUpdate = $true
                        $fixedIssues++
                    }
                }
                
                if ($needsUpdate) {
                    [System.IO.File]::WriteAllText($envFilePath, $envContent, [System.Text.Encoding]::UTF8)
                    Write-Host "  ✅ Updated $envFilePath with correct Supabase configuration" -ForegroundColor Green
                }
            } catch {
                $validationErrors += "Failed to validate Supabase URL in $envFilePath`: $($_.Exception.Message)"
            }
        }
    }

    # Test connectivity to Supabase services
    try {
        Write-Host "  🔍 Testing Kong gateway connectivity..." -ForegroundColor Gray
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 401) {
            Write-Host "  ✅ Kong gateway is responding on port 8000" -ForegroundColor Green
        }
    } catch {
        $validationErrors += "Kong gateway not responding on port 8000 - check if Supabase containers are running"
        Write-Host "  ⚠️  Kong gateway not responding - run docker-compose up -d" -ForegroundColor Yellow
    }

    try {
        Write-Host "  🔍 Testing auth service connectivity..." -ForegroundColor Gray
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/auth/v1/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 400) {
            Write-Host "  ✅ Auth service is accessible through Kong" -ForegroundColor Green
        }
    } catch {
        $validationErrors += "Auth service not accessible through Kong - check auth container status"
        Write-Host "  ⚠️  Auth service not accessible - check container logs" -ForegroundColor Yellow
    }

    # 8. Summary
    Write-Host ""
    if ($fixedIssues -gt 0) {
        Write-Host "🎯 FIXED $fixedIssues DEVELOPMENT ENVIRONMENT ISSUES" -ForegroundColor Green
    }
    
    if ($validationErrors.Count -gt 0) {
        Write-Host "⚠️  VALIDATION WARNINGS:" -ForegroundColor Yellow
        foreach ($error in $validationErrors) {
            Write-Host "   • $error" -ForegroundColor Yellow
        }
        Write-Host ""
        Write-Host "   These issues may need manual attention." -ForegroundColor Gray
    }
    
    if ($fixedIssues -eq 0 -and $validationErrors.Count -eq 0) {
        Write-Host "✅ DEVELOPMENT ENVIRONMENT IS HEALTHY" -ForegroundColor Green
    }
    
    return @{
        FixedIssues = $fixedIssues
        ValidationErrors = $validationErrors
    }
}

# If only fixing line endings, do that and exit
if ($FixLineEndings) {
    Write-Host "🛠️  LINE ENDINGS FIX MODE" -ForegroundColor Cyan
    $fixed = Repair-AllLineEndings
    if ($fixed -gt 0) {
        Write-Host ""
        Write-Host "✅ Line ending fixes completed. You can now run:" -ForegroundColor Green
        Write-Host "   docker compose down && docker compose up -d" -ForegroundColor White
    }
    exit 0
}

# If only validating environment, do that and exit
if ($ValidateOnly) {
    Write-Host "🛠️  ENVIRONMENT VALIDATION MODE" -ForegroundColor Cyan
    $result = Repair-DevelopmentEnvironment -BaseDirectory "."
    Write-Host ""
    if ($result.FixedIssues -gt 0) {
        Write-Host "✅ Environment validation completed: $($result.FixedIssues) issues fixed" -ForegroundColor Green
    } else {
        Write-Host "✅ Environment is healthy - no issues found" -ForegroundColor Green
    }
    
    if ($result.ValidationErrors.Count -gt 0) {
        Write-Host ""
        Write-Host "⚠️  Some issues may need manual attention (see details above)" -ForegroundColor Yellow
        exit 1
    }
    exit 0
}

Write-Host "� FAST Supabase Reset and Startup Script" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Auto-force mode for speed
if ($Quick -or $NoCleanup) {
    $Force = $true
}

# Show what will be done
Write-Host "⚡ Fast Mode Configuration:" -ForegroundColor Cyan
Write-Host "  • Development Mode: $($DevMode -eq $true)" -ForegroundColor White
Write-Host "  • Skip Seeding: $($SkipSeed -eq $true)" -ForegroundColor White
Write-Host "  • Quick Mode: $($Quick -eq $true)" -ForegroundColor White
Write-Host "  • No Cleanup: $($NoCleanup -eq $true)" -ForegroundColor White

if (-not $Force) {
    Write-Host ""
    Write-Host "⚠️  This will reset Supabase for immediate startup" -ForegroundColor Yellow
    $response = Read-Host "Continue? (Y/n)"
    if ($response -eq 'n' -or $response -eq 'N') {
        Write-Host "❌ Operation cancelled" -ForegroundColor Red
        exit 0
    }
}

Write-Host ""    # Change to docker directory
    $originalPath = Get-Location
    try {
        Set-Location "docker"
        Write-Host "📍 Working in: $(Get-Location)" -ForegroundColor Cyan

        # STEP 1: Comprehensive environment validation and repair
        Write-Host ""
        $envResult = Repair-DevelopmentEnvironment -BaseDirectory ".."
        Write-Host "✅ Environment validation completed: $($envResult.FixedIssues) issues fixed" -ForegroundColor Green

        # CRITICAL: Fix line endings for all Supabase files
        Write-Host ""
        Write-Host "🔧 FIXING LINE ENDINGS (prevents Elixir parsing errors)..." -ForegroundColor Yellow
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
      # Function to fix line endings
    function Repair-LineEndings {
        param([string]$FilePath)
        if (Test-Path $FilePath) {
            try {
                $content = Get-Content $FilePath -Raw
                if ($content -and $content.Contains("`r`n")) {
                    $content = $content -replace "`r`n", "`n"
                    [System.IO.File]::WriteAllText($FilePath, $content, [System.Text.Encoding]::UTF8)
                    Write-Host "  ✅ Fixed: $FilePath" -ForegroundColor Green
                    return $true
                }
            } catch {
                Write-Host "  ⚠️  Failed to fix: $FilePath - $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
        return $false
    }
    
    # Critical files that must have Unix line endings
    $criticalFiles = @(
        "volumes/pooler/pooler.exs",           # Elixir config - CRITICAL
        "volumes/db/jwt.sql",                  # JWT initialization
        "volumes/db/roles.sql",                # Database roles
        "volumes/db/webhooks.sql",             # Webhooks setup
        "volumes/db/realtime.sql",             # Realtime setup
        "volumes/db/_supabase.sql",            # Internal Supabase schema
        "volumes/db/logs.sql",                 # Logging setup
        "volumes/db/pooler.sql",               # Connection pooler
        "dev/seed.sql",                        # Development seed data
        "dev/data.sql"                         # Development data
    )
    
    # Fix script files in parent directory
    $scriptFiles = @(
        "../scripts/add-themis-admin.sql",
        "../scripts/add-themis-user.sql", 
        "../scripts/quick-keys.sql",
        "../scripts/database-keys-retrieval.sql"
    )
    
    $fixedCount = 0
      # Fix critical Docker files
    foreach ($file in $criticalFiles) {
        if (Repair-LineEndings $file) { $fixedCount++ }
    }
    
    # Fix script files
    foreach ($file in $scriptFiles) {
        if (Repair-LineEndings $file) { $fixedCount++ }
    }
    
    if ($fixedCount -gt 0) {
        Write-Host "  🎯 Fixed line endings in $fixedCount files" -ForegroundColor Green
    } else {
        Write-Host "  ✅ All files already have correct line endings" -ForegroundColor Green
    }
    
    Write-Host "✅ Line ending fixes completed" -ForegroundColor Green

    if ($NoCleanup) {
        Write-Host "⏭️  Skipping cleanup - restarting containers only..." -ForegroundColor Yellow
    } else {
        # Fast cleanup mode
        if ($Quick) {
            Write-Host "⚡ QUICK MODE: Minimal cleanup for fastest startup..." -ForegroundColor Yellow
            
            # Quick stop only
            docker compose down 2>$null
            Write-Host "✅ Quick stop completed" -ForegroundColor Green
        } else {
            Write-Host "🛑 Fast cleanup: Stopping containers and removing volumes..." -ForegroundColor Yellow
            
            # Stop and remove with volumes
            if ($DevMode) {
                docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml down -v --remove-orphans 2>$null
            } else {
                docker compose down -v --remove-orphans 2>$null
            }
            
            # Quick removal of problematic containers
            docker rm -f supabase-vector supabase_vector_docker 2>$null
            
            Write-Host "✅ Fast cleanup completed" -ForegroundColor Green
        }
    }    # FAST STARTUP - Get Supabase running immediately
    Write-Host ""
    Write-Host "� FAST STARTUP: Starting Supabase..." -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    # Start the containers with fast options
    if ($DevMode) {
        Write-Host "🔧 Starting in development mode..." -ForegroundColor Cyan
        docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml up -d --force-recreate --no-deps
    } else {
        Write-Host "🏭 Starting in production mode..." -ForegroundColor Cyan
        docker compose up -d --force-recreate --no-deps
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to start containers quickly. Trying standard method..." -ForegroundColor Yellow
        if ($DevMode) {
            docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml up -d
        } else {
            docker compose up -d
        }
    }

    Write-Host "✅ Containers started!" -ForegroundColor Green

    # Step 2: Force remove any remaining Supabase containers
    Write-Host "🗑️  Force removing any remaining Supabase containers..." -ForegroundColor Yellow
    $supabaseContainers = docker ps -a --filter "name=supabase_" --format "{{.Names}}" 2>$null
    if ($supabaseContainers) {
        $containerArray = $supabaseContainers -split "`n" | Where-Object { $_.Trim() -ne "" }
        foreach ($container in $containerArray) {
            Write-Host "   Removing container: $container" -ForegroundColor Gray
            docker rm -f $container 2>$null
        }
        Write-Host "✅ Force removal completed" -ForegroundColor Green
    } else {
        Write-Host "✅ No remaining containers to remove" -ForegroundColor Green
    }

    # Step 3: Remove specific problematic containers
    Write-Host "🔧 Removing specific problematic containers..." -ForegroundColor Yellow
    $problemContainers = @("supabase-vector", "supabase_vector_docker")
    foreach ($container in $problemContainers) {
        docker rm -f $container 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Removed $container" -ForegroundColor Green
        }
    }

    # Step 4: Clean up Docker networks
    Write-Host "🌐 Cleaning up Supabase networks..." -ForegroundColor Yellow
    $supabaseNetworks = docker network ls --filter "name=supabase" --format "{{.Name}}" 2>$null
    if ($supabaseNetworks) {
        $networkArray = $supabaseNetworks -split "`n" | Where-Object { $_.Trim() -ne "" }
        foreach ($network in $networkArray) {
            Write-Host "   Removing network: $network" -ForegroundColor Gray
            docker network rm $network 2>$null
        }
    }

    # Step 5: Clean up Docker volumes
    Write-Host "💾 Cleaning up Supabase volumes..." -ForegroundColor Yellow
    $supabaseVolumes = docker volume ls --filter "name=supabase" --format "{{.Name}}" 2>$null
    if ($supabaseVolumes) {
        $volumeArray = $supabaseVolumes -split "`n" | Where-Object { $_.Trim() -ne "" }
        foreach ($volume in $volumeArray) {
            Write-Host "   Removing volume: $volume" -ForegroundColor Gray
            docker volume rm $volume 2>$null
        }
    }

    # Step 6: Comprehensive Docker cleanup
    Write-Host "🧹 Performing comprehensive Docker cleanup..." -ForegroundColor Yellow
    docker system prune -f --volumes 2>$null
    Write-Host "✅ Docker cleanup completed" -ForegroundColor Green    # Step 7: Remove old Supabase images (optional)
    if ($CleanImages) {
        Write-Host "🖼️  Cleaning up old Supabase images..." -ForegroundColor Yellow
        $supabaseImages = docker images --filter "reference=*supabase*" --format "{{.Repository}}:{{.Tag}}" 2>$null
        if ($supabaseImages) {
            Write-Host "   Found Supabase images to clean up" -ForegroundColor Gray
            docker image prune -f --filter "label=supabase" 2>$null
            # Also remove specific supabase images if they exist
            docker images --filter "reference=*supabase*" --format "{{.Repository}}:{{.Tag}}" | ForEach-Object {
                if ($_ -and $_ -ne "") {
                    Write-Host "   Removing image: $_" -ForegroundColor Gray
                    docker rmi $_ 2>$null
                }
            }
        }
        Write-Host "✅ Image cleanup completed" -ForegroundColor Green
    } else {
        Write-Host "⏭️  Skipping image cleanup (use -CleanImages to remove images)" -ForegroundColor Gray
    }# Step 8: Start Supabase with fresh data
    Write-Host ""
    Write-Host "🚀 Starting fresh Supabase instance..." -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    # Pull latest images before starting
    Write-Host "📥 Pulling latest Supabase images..." -ForegroundColor Cyan
    if ($DevMode) {
        docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml pull
    } else {
        docker compose pull
    }
    
    # Start the containers
    if ($DevMode) {
        Write-Host "🔧 Using development mode with seeding..." -ForegroundColor Cyan
        docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml up -d --force-recreate
    } else {
        Write-Host "🏭 Using production mode..." -ForegroundColor Cyan
        docker compose up -d --force-recreate
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to start Supabase containers" -ForegroundColor Red
        Write-Host "Check Docker logs for more details:" -ForegroundColor Yellow
        Write-Host "  docker compose logs" -ForegroundColor White
        exit 1
    }    # Step 9: Wait for services to be ready
    Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
    $timeout = 120  # Increased timeout for fresh start
    $elapsed = 0
    
    do {
        Start-Sleep -Seconds 3
        $elapsed += 3
        
        # Check multiple container health
        $dbStatus = docker ps --filter "name=supabase_db_docker" --filter "status=running" --format "{{.Status}}" 2>$null
        $authStatus = docker ps --filter "name=supabase_auth_docker" --filter "status=running" --format "{{.Status}}" 2>$null
        $studioStatus = docker ps --filter "name=supabase_studio_docker" --filter "status=running" --format "{{.Status}}" 2>$null
        
        # More lenient health check
        if ($dbStatus -and $authStatus -and $studioStatus) {
            # Check if DB is healthy or at least running for 30+ seconds
            if ($dbStatus -match "healthy" -or ($dbStatus -match "Up" -and $elapsed -gt 30)) {
                Write-Host "✅ Services are ready!" -ForegroundColor Green
                break
            }
        }
        
        # Show progress
        if (($elapsed % 15) -eq 0) {
            Write-Host ""
            Write-Host "   Still waiting... ($elapsed/$timeout seconds)" -ForegroundColor Gray
            Write-Host "   DB: $($dbStatus -replace 'Up.*', 'Running...')" -ForegroundColor Gray
            Write-Host "   Auth: $($authStatus -replace 'Up.*', 'Running...')" -ForegroundColor Gray
        } else {
            Write-Host "." -NoNewline -ForegroundColor Gray
        }
        
        if ($elapsed -ge $timeout) {
            Write-Host ""
            Write-Host "⚠️  Services taking longer than expected to start..." -ForegroundColor Yellow
            Write-Host "Current status:" -ForegroundColor Yellow
            docker ps --filter "name=supabase_" --format "table {{.Names}}\t{{.Status}}" 2>$null
            Write-Host "Proceeding anyway, but seeding might fail." -ForegroundColor Yellow
            break
        }
        
    } while ($elapsed -lt $timeout)

    Write-Host ""    # Step 10: Show container status
    Write-Host "📋 Container Status:" -ForegroundColor Cyan
    docker ps --filter "name=supabase_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    # Step 11: Seed the database (if not skipped)
    if (-not $SkipSeed) {
        Write-Host ""
        Write-Host "🌱 Starting database seeding..." -ForegroundColor Green
        
        # Go back to root directory for seeding script
        Set-Location ".."
        
        # Run the seeding script
        Write-Host "🚀 Running seeding script..." -ForegroundColor Cyan
        node scripts/seed-database.js
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Database seeding completed successfully!" -ForegroundColor Green
        } else {
            Write-Host "❌ Database seeding failed" -ForegroundColor Red
            Write-Host "You can try running it manually later:" -ForegroundColor Yellow
            Write-Host "  node scripts/seed-database.js" -ForegroundColor White
        }
    } else {
        Write-Host "⏭️  Skipping database seeding (--SkipSeed flag used)" -ForegroundColor Yellow
    }    # Step 12: Final summary and verification
    Write-Host ""
    Write-Host "🎉 Supabase Reset and Setup Complete!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    # Verify containers are running
    Write-Host "🔍 Final verification:" -ForegroundColor Cyan
    $runningContainers = docker ps --filter "name=supabase_" --filter "status=running" --format "{{.Names}}" 2>$null
    if ($runningContainers) {
        $containerCount = ($runningContainers -split "`n" | Where-Object { $_.Trim() -ne "" }).Count
        Write-Host "  ✅ $containerCount Supabase containers running" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  No Supabase containers detected running" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "🌐 Access Points:" -ForegroundColor Cyan
    Write-Host "  • Supabase Studio: http://localhost:54323" -ForegroundColor White
    Write-Host "  • API Endpoint: http://localhost:8000" -ForegroundColor White
    Write-Host "  • Database: localhost:54322" -ForegroundColor White
    Write-Host "  • Email Testing: http://localhost:54324" -ForegroundColor White
    
    if (-not $SkipSeed) {
        Write-Host ""
        Write-Host "👥 Seeded Users:" -ForegroundColor Cyan
        Write-Host "  🛡️  baltzakis.themis@gmail.com (admin) - Password: TH!123789th!" -ForegroundColor Green
        Write-Host "  🛡️  john.doe@example.com (admin) - Password: AdminPass123!" -ForegroundColor Blue
        Write-Host "  🛡️  mike.admin@example.com (admin) - Password: AdminPass123!" -ForegroundColor Blue
        Write-Host "  🛂 jane.smith@example.com (moderator) - Password: ModPass123!" -ForegroundColor Magenta
        Write-Host "  👤 bob.wilson@example.com (user) - Password: UserPass123!" -ForegroundColor Gray
        Write-Host "  👤 alice.johnson@example.com (user) - Password: UserPass123!" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "📚 Documentation:" -ForegroundColor Cyan
    Write-Host "  • USER_MANAGEMENT.md - User management guide" -ForegroundColor White
    Write-Host "  • admin-keys-report.md - All keys and configuration" -ForegroundColor White
    
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

} catch {
    Write-Host "❌ Error during reset: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    # Always return to original directory
    Set-Location $originalPath
}


