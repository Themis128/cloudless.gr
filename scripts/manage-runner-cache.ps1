# 🧹 Optimized Runner Cache Management
# Manages cache for better performance and disk space

param(
    [ValidateSet("clean", "status", "optimize", "backup", "restore")]
    [string]$Action = "status",
    [int]$DaysToKeep = 7,
    [switch]$Force = $false
)

Write-Host "🧹 Optimized Runner Cache Management" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""

# Configuration
$CacheDir = ".\runner-cache"
$BackupDir = ".\runner-cache-backup"
$CacheTypes = @("npm", "docker", "nuxt", "playwright", "build")

# Function to get cache status
function Get-CacheStatus {
    Write-Host "📊 Cache Status Report" -ForegroundColor Cyan
    Write-Host "=====================" -ForegroundColor Cyan
    
    $totalSize = 0
    $cacheInfo = @{}
    
    foreach ($type in $CacheTypes) {
        $typePath = Join-Path $CacheDir $type
        if (Test-Path $typePath) {
            $size = (Get-ChildItem $typePath -Recurse -File | Measure-Object -Property Length -Sum).Sum
            $sizeMB = [math]::Round($size / 1MB, 2)
            $totalSize += $size
            
            $fileCount = (Get-ChildItem $typePath -Recurse -File).Count
            $dirCount = (Get-ChildItem $typePath -Recurse -Directory).Count
            
            $cacheInfo[$type] = @{
                Size = $sizeMB
                Files = $fileCount
                Directories = $dirCount
                Path = $typePath
            }
            
            Write-Host "  📦 $type" -ForegroundColor White
            Write-Host "    • Size: ${sizeMB}MB" -ForegroundColor Gray
            Write-Host "    • Files: $fileCount" -ForegroundColor Gray
            Write-Host "    • Directories: $dirCount" -ForegroundColor Gray
        } else {
            Write-Host "  📦 $type: Not found" -ForegroundColor Yellow
        }
    }
    
    $totalSizeMB = [math]::Round($totalSize / 1MB, 2)
    Write-Host ""
    Write-Host "📈 Total Cache Size: ${totalSizeMB}MB" -ForegroundColor Cyan
    
    return $cacheInfo
}

# Function to clean old cache files
function Remove-OldCache {
    Write-Host "🧹 Cleaning old cache files..." -ForegroundColor Blue
    
    $cutoffDate = (Get-Date).AddDays(-$DaysToKeep)
    $totalRemoved = 0
    
    foreach ($type in $CacheTypes) {
        $typePath = Join-Path $CacheDir $type
        if (Test-Path $typePath) {
            Write-Host "  Cleaning $type cache..." -ForegroundColor White
            
            # Remove old files
            $oldFiles = Get-ChildItem $typePath -Recurse -File | Where-Object { $_.LastWriteTime -lt $cutoffDate }
            $removedFiles = 0
            $removedSize = 0
            
            foreach ($file in $oldFiles) {
                $removedSize += $file.Length
                Remove-Item $file.FullName -Force
                $removedFiles++
            }
            
            # Remove empty directories
            $emptyDirs = Get-ChildItem $typePath -Recurse -Directory | Where-Object { 
                (Get-ChildItem $_.FullName -Recurse | Measure-Object).Count -eq 0 
            }
            $removedDirs = 0
            
            foreach ($dir in $emptyDirs) {
                Remove-Item $dir.FullName -Force
                $removedDirs++
            }
            
            $removedSizeMB = [math]::Round($removedSize / 1MB, 2)
            $totalRemoved += $removedSize
            
            Write-Host "    ✅ Removed $removedFiles files (${removedSizeMB}MB) and $removedDirs empty directories" -ForegroundColor Green
        }
    }
    
    $totalRemovedMB = [math]::Round($totalRemoved / 1MB, 2)
    Write-Host "🎉 Total space freed: ${totalRemovedMB}MB" -ForegroundColor Green
}

# Function to optimize cache
function Optimize-Cache {
    Write-Host "⚡ Optimizing cache..." -ForegroundColor Blue
    
    # Optimize npm cache
    $npmPath = Join-Path $CacheDir "npm"
    if (Test-Path $npmPath) {
        Write-Host "  Optimizing npm cache..." -ForegroundColor White
        try {
            # Run npm cache verify and clean
            npm cache verify --cache $npmPath 2>$null
            Write-Host "    ✅ NPM cache optimized" -ForegroundColor Green
        } catch {
            Write-Host "    ⚠️ Could not optimize NPM cache" -ForegroundColor Yellow
        }
    }
    
    # Optimize Docker cache
    Write-Host "  Optimizing Docker cache..." -ForegroundColor White
    try {
        docker system prune -f
        Write-Host "    ✅ Docker cache optimized" -ForegroundColor Green
    } catch {
        Write-Host "    ⚠️ Could not optimize Docker cache" -ForegroundColor Yellow
    }
    
    # Compress large files
    Write-Host "  Compressing cache files..." -ForegroundColor White
    $largeFiles = Get-ChildItem $CacheDir -Recurse -File | Where-Object { $_.Length -gt 10MB }
    $compressedCount = 0
    
    foreach ($file in $largeFiles) {
        if ($file.Extension -notin @(".gz", ".zip", ".tar")) {
            try {
                # Use PowerShell compression
                $compressedPath = $file.FullName + ".gz"
                if (-not (Test-Path $compressedPath)) {
                    $content = Get-Content $file.FullName -Raw
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
                    $compressed = [System.IO.Compression.GZipStream]::new(
                        [System.IO.File]::Create($compressedPath),
                        [System.IO.Compression.CompressionMode]::Compress
                    )
                    $compressed.Write($bytes, 0, $bytes.Length)
                    $compressed.Close()
                    
                    # Remove original if compression was successful
                    if ((Get-Item $compressedPath).Length -lt $file.Length) {
                        Remove-Item $file.FullName -Force
                        $compressedCount++
                    } else {
                        Remove-Item $compressedPath -Force
                    }
                }
            } catch {
                Write-Host "    ⚠️ Could not compress $($file.Name)" -ForegroundColor Yellow
            }
        }
    }
    
    Write-Host "    ✅ Compressed $compressedCount large files" -ForegroundColor Green
}

# Function to backup cache
function Backup-Cache {
    Write-Host "💾 Creating cache backup..." -ForegroundColor Blue
    
    $backupName = "cache-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    $backupPath = Join-Path $BackupDir $backupName
    
    if (-not (Test-Path $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    }
    
    try {
        # Create backup using tar (if available) or PowerShell
        if (Get-Command tar -ErrorAction SilentlyContinue) {
            tar -czf "$backupPath.tar.gz" -C $CacheDir .
            Write-Host "✅ Cache backed up to: $backupPath.tar.gz" -ForegroundColor Green
        } else {
            # PowerShell fallback
            Compress-Archive -Path "$CacheDir\*" -DestinationPath "$backupPath.zip" -Force
            Write-Host "✅ Cache backed up to: $backupPath.zip" -ForegroundColor Green
        }
        
        # Clean old backups (keep last 5)
        $oldBackups = Get-ChildItem $BackupDir | Sort-Object LastWriteTime -Descending | Select-Object -Skip 5
        foreach ($backup in $oldBackups) {
            Remove-Item $backup.FullName -Force
        }
        
    } catch {
        Write-Host "❌ Backup failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Function to restore cache
function Restore-Cache {
    Write-Host "🔄 Restoring cache from backup..." -ForegroundColor Blue
    
    $backups = Get-ChildItem $BackupDir | Sort-Object LastWriteTime -Descending
    if ($backups.Count -eq 0) {
        Write-Host "❌ No backups found in $BackupDir" -ForegroundColor Red
        return
    }
    
    $latestBackup = $backups[0]
    Write-Host "  Restoring from: $($latestBackup.Name)" -ForegroundColor White
    
    try {
        if ($Force -or (Read-Host "Are you sure you want to restore cache? This will overwrite current cache. (y/N)") -eq "y") {
            # Clear current cache
            if (Test-Path $CacheDir) {
                Remove-Item "$CacheDir\*" -Recurse -Force
            }
            
            # Restore from backup
            if ($latestBackup.Extension -eq ".gz") {
                tar -xzf $latestBackup.FullName -C $CacheDir
            } else {
                Expand-Archive -Path $latestBackup.FullName -DestinationPath $CacheDir -Force
            }
            
            Write-Host "✅ Cache restored successfully" -ForegroundColor Green
        } else {
            Write-Host "❌ Cache restore cancelled" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Restore failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Main execution
try {
    switch ($Action.ToLower()) {
        "status" {
            Get-CacheStatus
        }
        "clean" {
            if ($Force -or (Read-Host "Are you sure you want to clean old cache files? (y/N)") -eq "y") {
                Remove-OldCache
                Get-CacheStatus
            } else {
                Write-Host "❌ Cache cleaning cancelled" -ForegroundColor Yellow
            }
        }
        "optimize" {
            Optimize-Cache
            Get-CacheStatus
        }
        "backup" {
            Backup-Cache
        }
        "restore" {
            Restore-Cache
        }
        default {
            Write-Host "❌ Invalid action: $Action" -ForegroundColor Red
            Write-Host "Valid actions: clean, status, optimize, backup, restore" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "❌ Cache management failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎯 Cache management completed!" -ForegroundColor Green 