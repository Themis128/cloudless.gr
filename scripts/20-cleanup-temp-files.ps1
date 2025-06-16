# Temporary Files Cleanup Script
# Cleans up temporary files, logs, caches, and development artifacts
# Helps maintain a clean development environment and free up disk space
#
# Features:
#   • Node.js cache and temp files cleanup
#   • Docker cleanup (containers, images, volumes)
#   • Log files management
#   • Development artifacts removal
#   • Backup files cleanup
#   • Selective or comprehensive cleanup
#
# Usage Examples:
#   .\scripts\20-cleanup-temp-files.ps1              # Standard cleanup
#   .\scripts\20-cleanup-temp-files.ps1 -Deep       # Deep cleanup including Docker
#   .\scripts\20-cleanup-temp-files.ps1 -LogsOnly   # Logs only
#   .\scripts\20-cleanup-temp-files.ps1 -DryRun     # Show what would be cleaned

param(
    [switch]$Deep,
    [switch]$LogsOnly,
    [switch]$DryRun,
    [switch]$Force
)

# Configuration
$CleanupItems = @()
$TotalSizeFreed = 0
$TotalFilesRemoved = 0

# Standard cleanup patterns
$StandardCleanup = @{
    "Node.js Cache" = @(
        "node_modules/.cache",
        ".nuxt",
        ".next",
        "dist",
        "build"
    )
    "Log Files" = @(
        "logs/*.log",
        "*.log",
        "npm-debug.log*",
        "yarn-debug.log*",
        "yarn-error.log*"
    )
    "Temporary Files" = @(
        "tmp/*",
        "temp/*",
        ".tmp",
        "*.tmp",
        "*.temp"
    )
    "Development Artifacts" = @(
        ".DS_Store",
        "Thumbs.db",
        "*.swp",
        "*~",
        ".vscode/settings.json.bak"
    )
}

# Deep cleanup additional patterns
$DeepCleanup = @{
    "Node.js Deep Clean" = @(
        "node_modules",
        "package-lock.json"
    )
    "Test Output" = @(
        "coverage",
        "test-results",
        "cypress/results",
        "playwright/results"
    )
    "Backup Files" = @(
        "backups/*",
        "*.bak",
        "*.backup"
    )
}

# Function to get directory size
function Get-DirectorySize {
    param([string]$Path)
    
    if (-not (Test-Path $Path)) {
        return 0
    }
    
    try {
        $size = (Get-ChildItem -Path $Path -Recurse -File | Measure-Object -Property Length -Sum).Sum
        return if ($size) { $size } else { 0 }
    } catch {
        return 0
    }
}

# Function to format file size
function Format-FileSize {
    param([long]$Size)
    
    if ($Size -gt 1GB) {
        return "{0:N2} GB" -f ($Size / 1GB)
    } elseif ($Size -gt 1MB) {
        return "{0:N2} MB" -f ($Size / 1MB)
    } elseif ($Size -gt 1KB) {
        return "{0:N2} KB" -f ($Size / 1KB)
    } else {
        return "$Size bytes"
    }
}

# Function to clean up by pattern
function Remove-ItemsByPattern {
    param(
        [string[]]$Patterns,
        [string]$Category
    )
    
    Write-Host "  🧹 Cleaning $Category..." -ForegroundColor Cyan
    
    $categorySize = 0
    $categoryFiles = 0
    
    foreach ($pattern in $Patterns) {
        try {
            # Handle different pattern types
            if ($pattern -match '[\*\?]') {
                # Wildcard pattern
                $items = Get-ChildItem -Path . -Recurse -Include $pattern -Force 2>$null
            } elseif (Test-Path $pattern) {
                # Direct path
                $items = Get-Item $pattern -Force
            } else {
                continue
            }
            
            foreach ($item in $items) {
                try {
                    $itemSize = if ($item.PSIsContainer) {
                        Get-DirectorySize -Path $item.FullName
                    } else {
                        $item.Length
                    }
                    
                    $relativePath = $item.FullName.Substring((Get-Location).Path.Length + 1)
                    
                    if ($DryRun) {
                        Write-Host "    🔍 Would remove: $relativePath ($(Format-FileSize $itemSize))" -ForegroundColor Yellow
                    } else {
                        if ($item.PSIsContainer) {
                            Remove-Item $item.FullName -Recurse -Force
                            Write-Host "    🗂️  Removed directory: $relativePath ($(Format-FileSize $itemSize))" -ForegroundColor Green
                        } else {
                            Remove-Item $item.FullName -Force
                            Write-Host "    📄 Removed file: $relativePath ($(Format-FileSize $itemSize))" -ForegroundColor Green
                        }
                    }
                    
                    $categorySize += $itemSize
                    $categoryFiles++
                    
                } catch {
                    Write-Host "    ⚠️  Could not remove: $($item.Name) - $($_.Exception.Message)" -ForegroundColor Yellow
                }
            }
        } catch {
            Write-Host "    ⚠️  Pattern error '$pattern': $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    
    if ($categoryFiles -gt 0) {
        Write-Host "    📊 $Category: $categoryFiles items, $(Format-FileSize $categorySize) freed" -ForegroundColor White
    } else {
        Write-Host "    ✨ $Category: Already clean" -ForegroundColor Gray
    }
    
    $CleanupItems += @{
        Category = $Category
        FilesRemoved = $categoryFiles
        SizeFreed = $categorySize
    }
    
    return @{ Files = $categoryFiles; Size = $categorySize }
}

# Function to clean Docker resources
function Remove-DockerResources {
    if ($LogsOnly) {
        return @{ Files = 0; Size = 0 }
    }
    
    Write-Host "  🐳 Cleaning Docker resources..." -ForegroundColor Cyan
    
    try {
        # Check if Docker is available
        $dockerVersion = docker --version 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "    ⚠️  Docker not available, skipping..." -ForegroundColor Yellow
            return @{ Files = 0; Size = 0 }
        }
        
        $dockerSizeBefore = 0
        $dockerSizeAfter = 0
        
        if (-not $DryRun) {
            # Get system info before cleanup
            try {
                $systemInfo = docker system df --format "table {{.Type}}\t{{.Size}}" 2>$null
                Write-Host "    📊 Docker disk usage before cleanup:" -ForegroundColor Gray
                $systemInfo | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
            } catch {
                Write-Host "    ℹ️  Could not get Docker disk usage" -ForegroundColor Gray
            }
        }
        
        # Clean containers
        if ($DryRun) {
            $containers = docker ps -aq 2>$null
            if ($containers) {
                Write-Host "    🔍 Would remove $($containers.Count) containers" -ForegroundColor Yellow
            }
        } else {
            Write-Host "    🗑️  Removing containers..." -ForegroundColor Cyan
            docker container prune -f 2>&1 | Out-Host
        }
        
        # Clean networks
        if ($DryRun) {
            Write-Host "    🔍 Would prune unused networks" -ForegroundColor Yellow
        } else {
            Write-Host "    🌐 Pruning networks..." -ForegroundColor Cyan
            docker network prune -f 2>&1 | Out-Host
        }
        
        # Clean volumes (only in deep mode)
        if ($Deep) {
            if ($DryRun) {
                $volumes = docker volume ls -q 2>$null
                if ($volumes) {
                    Write-Host "    🔍 Would remove $($volumes.Count) volumes" -ForegroundColor Yellow
                }
            } else {
                Write-Host "    💾 Pruning volumes..." -ForegroundColor Cyan
                docker volume prune -f 2>&1 | Out-Host
            }
        }
        
        # Clean images (only in deep mode)
        if ($Deep) {
            if ($DryRun) {
                Write-Host "    🔍 Would prune unused images" -ForegroundColor Yellow
            } else {
                Write-Host "    🖼️  Pruning images..." -ForegroundColor Cyan
                docker image prune -f 2>&1 | Out-Host
            }
        }
        
        # System prune for comprehensive cleanup
        if ($Deep -and -not $DryRun) {
            Write-Host "    🔄 Running system prune..." -ForegroundColor Cyan
            docker system prune -f 2>&1 | Out-Host
        }
        
        if (-not $DryRun) {
            # Get system info after cleanup
            try {
                $systemInfoAfter = docker system df --format "table {{.Type}}\t{{.Size}}" 2>$null
                Write-Host "    📊 Docker disk usage after cleanup:" -ForegroundColor Gray
                $systemInfoAfter | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
            } catch {
                Write-Host "    ℹ️  Could not get Docker disk usage" -ForegroundColor Gray
            }
        }
        
        Write-Host "    ✅ Docker cleanup completed" -ForegroundColor Green
        return @{ Files = 1; Size = 0 } # Approximate, Docker doesn't report exact sizes easily
        
    } catch {
        Write-Host "    ❌ Docker cleanup failed: $($_.Exception.Message)" -ForegroundColor Red
        return @{ Files = 0; Size = 0 }
    }
}

# Function to clean npm cache
function Remove-NpmCache {
    if ($LogsOnly) {
        return @{ Files = 0; Size = 0 }
    }
    
    Write-Host "  📦 Cleaning NPM cache..." -ForegroundColor Cyan
    
    try {
        if ($DryRun) {
            Write-Host "    🔍 Would clean NPM cache" -ForegroundColor Yellow
            return @{ Files = 0; Size = 0 }
        }
        
        # Clear npm cache
        npm cache clean --force 2>&1 | Out-Host
        
        # Clear yarn cache if yarn is available
        try {
            yarn cache clean 2>&1 | Out-Host
            Write-Host "    ✅ NPM and Yarn caches cleaned" -ForegroundColor Green
        } catch {
            Write-Host "    ✅ NPM cache cleaned (Yarn not available)" -ForegroundColor Green
        }
        
        return @{ Files = 1; Size = 0 } # Approximate
        
    } catch {
        Write-Host "    ⚠️  NPM cache cleanup failed: $($_.Exception.Message)" -ForegroundColor Yellow
        return @{ Files = 0; Size = 0 }
    }
}

# Function to generate cleanup summary
function Show-CleanupSummary {
    Write-Host ""
    Write-Host "📊 CLEANUP SUMMARY" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    if ($DryRun) {
        Write-Host "Mode: DRY RUN (no files were actually removed)" -ForegroundColor Yellow
        Write-Host ""
    }
    
    $totalFiles = 0
    $totalSize = 0
    
    foreach ($item in $CleanupItems) {
        if ($item.FilesRemoved -gt 0 -or $item.SizeFreed -gt 0) {
            Write-Host "  • $($item.Category): $($item.FilesRemoved) items, $(Format-FileSize $item.SizeFreed)" -ForegroundColor White
            $totalFiles += $item.FilesRemoved
            $totalSize += $item.SizeFreed
        }
    }
    
    Write-Host ""
    Write-Host "📈 Totals:" -ForegroundColor Cyan
    Write-Host "  • Files/directories removed: $totalFiles" -ForegroundColor White
    Write-Host "  • Disk space freed: $(Format-FileSize $totalSize)" -ForegroundColor White
    
    if ($totalSize -gt 100MB) {
        Write-Host "  🎉 Significant space freed!" -ForegroundColor Green
    } elseif ($totalSize -gt 10MB) {
        Write-Host "  ✅ Good cleanup results" -ForegroundColor Green
    } elseif ($totalFiles -gt 0) {
        Write-Host "  ✨ Environment cleaned" -ForegroundColor Green
    } else {
        Write-Host "  ✨ Environment was already clean" -ForegroundColor Gray
    }
    
    return $totalSize -gt 0
}

# Main execution
Write-Host "🧹 TEMPORARY FILES CLEANUP SCRIPT" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

$mode = if ($Deep) { "DEEP CLEANUP" } elseif ($LogsOnly) { "LOGS ONLY" } else { "STANDARD CLEANUP" }
Write-Host "Mode: $mode$(if ($DryRun) { ' (DRY RUN)' })" -ForegroundColor Cyan

if (-not $Force -and -not $DryRun) {
    Write-Host ""
    Write-Host "⚠️  This will remove temporary files and caches." -ForegroundColor Yellow
    if ($Deep) {
        Write-Host "⚠️  Deep mode will also remove node_modules and Docker resources." -ForegroundColor Yellow
    }
    Write-Host ""
    $response = Read-Host "Continue with cleanup? (Y/n)"
    if ($response -eq 'n' -or $response -eq 'N') {
        Write-Host "❌ Cleanup cancelled" -ForegroundColor Red
        exit 0
    }
}

$startTime = Get-Date

try {
    Write-Host ""
    Write-Host "🧹 STARTING CLEANUP..." -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    # Standard cleanup
    foreach ($category in $StandardCleanup.GetEnumerator()) {
        $result = Remove-ItemsByPattern -Patterns $category.Value -Category $category.Key
        $TotalFilesRemoved += $result.Files
        $TotalSizeFreed += $result.Size
    }
    
    # Deep cleanup additional items
    if ($Deep) {
        foreach ($category in $DeepCleanup.GetEnumerator()) {
            $result = Remove-ItemsByPattern -Patterns $category.Value -Category $category.Key
            $TotalFilesRemoved += $result.Files
            $TotalSizeFreed += $result.Size
        }
    }
    
    # NPM cache cleanup
    if (-not $LogsOnly) {
        $npmResult = Remove-NpmCache
        $TotalFilesRemoved += $npmResult.Files
        $TotalSizeFreed += $npmResult.Size
    }
    
    # Docker cleanup (only in deep mode)
    if ($Deep) {
        $dockerResult = Remove-DockerResources
        $TotalFilesRemoved += $dockerResult.Files
        $TotalSizeFreed += $dockerResult.Size
    }
    
    # Generate summary
    $success = Show-CleanupSummary
    
    $endTime = Get-Date
    $duration = $endTime - $startTime
    
    Write-Host ""
    Write-Host "⏱️  Cleanup completed in $($duration.Seconds) seconds" -ForegroundColor Cyan
    
    if ($success -or $DryRun) {
        if (-not $DryRun) {
            Write-Host ""
            Write-Host "📋 Next steps:" -ForegroundColor Cyan
            Write-Host "  • Reinstall dependencies: npm install" -ForegroundColor White
            Write-Host "  • Restart development server: npm run dev" -ForegroundColor White
            Write-Host "  • Check Docker services: docker-compose ps" -ForegroundColor White
        }
        exit 0
    } else {
        exit 1
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ CLEANUP FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
