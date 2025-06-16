# Line Endings Repair Script
# Fixes line ending issues that cause parsing errors in development environments
# Particularly important for Docker, Supabase, and cross-platform development
#
# Features:
#   • Cross-platform line ending normalization
#   • Bulk file processing by type
#   • Backup creation before changes
#   • Detailed reporting and verification
#   • Support for multiple file formats
#
# Usage Examples:
#   .\scripts\19-fix-line-endings.ps1                # Fix all critical files
#   .\scripts\19-fix-line-endings.ps1 -All          # Fix all supported file types
#   .\scripts\19-fix-line-endings.ps1 -Backup       # Create backup first
#   .\scripts\19-fix-line-endings.ps1 -ConfigOnly   # Config files only

param(
    [switch]$All,
    [switch]$Backup,
    [switch]$ConfigOnly,
    [switch]$Verbose
)

# Configuration
$BackupDir = "backups\line-endings-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$ProcessedFiles = @()
$SkippedFiles = @()
$ErrorFiles = @()

# File categories
$CriticalFiles = @(
    "docker\docker-compose.yml",
    "docker\.env",
    "nuxt.config.ts",
    "package.json",
    ".gitignore",
    "README.md"
)

$ConfigFiles = @(
    "docker\*.yml",
    "docker\*.yaml", 
    "docker\.env*",
    "*.config.ts",
    "*.config.js",
    "tsconfig.json",
    "package.json",
    ".eslintrc*",
    ".prettierrc*"
)

$AllSupportedFiles = @(
    "*.js",
    "*.ts",
    "*.vue",
    "*.json",
    "*.yml",
    "*.yaml",
    "*.md",
    "*.txt",
    "*.sql",
    "*.toml",
    "*.env*",
    "*.config.*"
)

# Function to create backup
function New-LineEndingBackup {
    if (-not $Backup) {
        return $true
    }
    
    Write-Host ""
    Write-Host "💾 CREATING BACKUP..." -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    try {
        if (-not (Test-Path "backups")) {
            New-Item -ItemType Directory -Path "backups" -Force | Out-Null
        }
        
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
        
        # Backup files that will be processed
        $filesToBackup = if ($All) { $AllSupportedFiles } elseif ($ConfigOnly) { $ConfigFiles } else { $CriticalFiles }
        
        $backupCount = 0
        foreach ($pattern in $filesToBackup) {
            $files = Get-ChildItem -Path . -Recurse -Include $pattern -File 2>$null
            foreach ($file in $files) {
                try {
                    $relativePath = $file.FullName.Substring((Get-Location).Path.Length + 1)
                    $backupPath = Join-Path $BackupDir $relativePath
                    $backupParent = Split-Path $backupPath -Parent
                    
                    if (-not (Test-Path $backupParent)) {
                        New-Item -ItemType Directory -Path $backupParent -Force | Out-Null
                    }
                    
                    Copy-Item $file.FullName $backupPath
                    $backupCount++
                    
                    if ($Verbose) {
                        Write-Host "  📁 Backed up: $relativePath" -ForegroundColor Green
                    }
                } catch {
                    Write-Host "  ⚠️  Could not backup: $($file.Name)" -ForegroundColor Yellow
                }
            }
        }
        
        Write-Host "  ✅ Created backup with $backupCount files in: $BackupDir" -ForegroundColor Green
        return $true
        
    } catch {
        Write-Host "  ❌ Backup creation failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to fix line endings in a file
function Repair-FileLineEndings {
    param(
        [string]$FilePath,
        [string]$FileType = ""
    )
    
    if (-not (Test-Path $FilePath)) {
        $SkippedFiles += @{ Path = $FilePath; Reason = "File not found" }
        if ($Verbose) {
            Write-Host "    ⏭️  Skipped (not found): $FilePath" -ForegroundColor Gray
        }
        return $false
    }
    
    try {
        # Read file content
        $content = Get-Content $FilePath -Raw -ErrorAction SilentlyContinue
        
        if (-not $content -or $content.Length -eq 0) {
            $SkippedFiles += @{ Path = $FilePath; Reason = "Empty file" }
            if ($Verbose) {
                Write-Host "    ⏭️  Skipped (empty): $FilePath" -ForegroundColor Gray
            }
            return $false
        }
        
        # Detect current line endings
        $hasCRLF = $content -match "`r`n"
        $hasLF = $content -match "(?<!`r)`n"
        $hasCR = $content -match "`r(?!`n)"
        
        $originalLength = $content.Length
        
        # Normalize line endings
        # First, convert everything to LF only
        $normalizedContent = $content -replace "`r`n", "`n" -replace "`r", "`n"
        
        # Then convert to the appropriate format for the platform
        if ($IsWindows) {
            $normalizedContent = $normalizedContent -replace "`n", "`r`n"
            $targetFormat = "CRLF (Windows)"
        } else {
            # Keep as LF for Unix-like systems
            $targetFormat = "LF (Unix)"
        }
        
        # Write back to file
        [System.IO.File]::WriteAllText($FilePath, $normalizedContent, [System.Text.Encoding]::UTF8)
        
        $newLength = $normalizedContent.Length
        $sizeChange = $newLength - $originalLength
        
        $ProcessedFiles += @{
            Path = $FilePath
            FileType = $FileType
            OriginalSize = $originalLength
            NewSize = $newLength
            TargetFormat = $targetFormat
            SizeChange = $sizeChange
        }
        
        if ($Verbose) {
            $changeText = if ($sizeChange -eq 0) { "no change" } 
                         elseif ($sizeChange -gt 0) { "+$sizeChange bytes" }
                         else { "$sizeChange bytes" }
            Write-Host "    ✅ Fixed: $FilePath ($changeText)" -ForegroundColor Green
        } else {
            Write-Host "    ✅ $FilePath" -ForegroundColor Green
        }
        
        return $true
        
    } catch {
        $ErrorFiles += @{ Path = $FilePath; Error = $_.Exception.Message }
        Write-Host "    ❌ Error fixing $FilePath : $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to process files by pattern
function Repair-FilesByPattern {
    param(
        [string[]]$Patterns,
        [string]$Category
    )
    
    Write-Host "  🔍 Processing $Category..." -ForegroundColor Cyan
    
    $totalProcessed = 0
    
    foreach ($pattern in $Patterns) {
        if ($pattern -notmatch '[\*\?]') {
            # Direct file path
            if (Repair-FileLineEndings -FilePath $pattern -FileType $Category) {
                $totalProcessed++
            }
        } else {
            # Pattern matching
            try {
                $files = Get-ChildItem -Path . -Recurse -Include $pattern -File 2>$null | 
                        Where-Object { $_.FullName -notmatch '\\(node_modules|\.git|dist|build)\\' }
                
                foreach ($file in $files) {
                    $relativePath = $file.FullName.Substring((Get-Location).Path.Length + 1)
                    if (Repair-FileLineEndings -FilePath $relativePath -FileType $Category) {
                        $totalProcessed++
                    }
                }
            } catch {
                Write-Host "    ⚠️  Pattern matching error for '$pattern': $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
    }
    
    Write-Host "    📊 Processed $totalProcessed files in $Category" -ForegroundColor White
    return $totalProcessed
}

# Function to generate summary report
function Show-ProcessingSummary {
    Write-Host ""
    Write-Host "📊 LINE ENDING REPAIR SUMMARY" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    Write-Host ""
    Write-Host "✅ Successfully processed: $($ProcessedFiles.Count) files" -ForegroundColor Green
    
    if ($SkippedFiles.Count -gt 0) {
        Write-Host "⏭️  Skipped: $($SkippedFiles.Count) files" -ForegroundColor Yellow
        if ($Verbose) {
            foreach ($skipped in $SkippedFiles) {
                Write-Host "    • $($skipped.Path) - $($skipped.Reason)" -ForegroundColor Gray
            }
        }
    }
    
    if ($ErrorFiles.Count -gt 0) {
        Write-Host "❌ Errors: $($ErrorFiles.Count) files" -ForegroundColor Red
        foreach ($error in $ErrorFiles) {
            Write-Host "    • $($error.Path) - $($error.Error)" -ForegroundColor Red
        }
    }
    
    if ($ProcessedFiles.Count -gt 0) {
        Write-Host ""
        Write-Host "📈 Processing details:" -ForegroundColor Cyan
        
        $totalSizeChange = ($ProcessedFiles | Measure-Object -Property SizeChange -Sum).Sum
        $targetFormat = $ProcessedFiles[0].TargetFormat
        
        Write-Host "  • Target format: $targetFormat" -ForegroundColor White
        Write-Host "  • Total size change: $totalSizeChange bytes" -ForegroundColor White
        
        if ($Backup) {
            Write-Host "  • Backup location: $BackupDir" -ForegroundColor White
        }
    }
    
    $overallSuccess = $ProcessedFiles.Count -gt 0 -and $ErrorFiles.Count -eq 0
    
    Write-Host ""
    if ($overallSuccess) {
        Write-Host "🎉 Line ending repair completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Line ending repair completed with issues" -ForegroundColor Yellow
    }
    
    return $overallSuccess
}

# Main execution
Write-Host "🔧 LINE ENDINGS REPAIR SCRIPT" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

$mode = if ($All) { "ALL FILES" } elseif ($ConfigOnly) { "CONFIG FILES ONLY" } else { "CRITICAL FILES" }
Write-Host "Mode: $mode" -ForegroundColor Cyan
Write-Host "Platform: $($PSVersionTable.Platform -replace 'Win32NT', 'Windows')" -ForegroundColor Cyan

if ($Backup) {
    Write-Host "Backup: Enabled" -ForegroundColor Cyan
}

$startTime = Get-Date

try {
    # Create backup if requested
    if (-not (New-LineEndingBackup)) {
        Write-Host "⚠️  Continuing without backup..." -ForegroundColor Yellow
    }
    
    # Process files based on mode
    Write-Host ""
    Write-Host "🔧 PROCESSING FILES..." -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    $totalProcessed = 0
    
    if ($All) {
        $totalProcessed += Repair-FilesByPattern -Patterns $AllSupportedFiles -Category "All Supported Files"
    } elseif ($ConfigOnly) {
        $totalProcessed += Repair-FilesByPattern -Patterns $ConfigFiles -Category "Configuration Files"
    } else {
        $totalProcessed += Repair-FilesByPattern -Patterns $CriticalFiles -Category "Critical Files"
    }
    
    # Generate summary
    $success = Show-ProcessingSummary
    
    $endTime = Get-Date
    $duration = $endTime - $startTime
    
    Write-Host ""
    Write-Host "⏱️  Repair completed in $($duration.Seconds) seconds" -ForegroundColor Cyan
    
    if ($success) {
        Write-Host ""
        Write-Host "📋 Next steps:" -ForegroundColor Cyan
        Write-Host "  • Test your application: npm run dev" -ForegroundColor White
        Write-Host "  • Check Docker services: docker-compose up -d" -ForegroundColor White
        Write-Host "  • Verify setup: node scripts/05-verify-setup.js" -ForegroundColor White
        exit 0
    } else {
        exit 1
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ LINE ENDING REPAIR FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Manual fix suggestions:" -ForegroundColor Yellow
    Write-Host "  • Check file permissions" -ForegroundColor White
    Write-Host "  • Ensure files are not locked by other processes" -ForegroundColor White
    Write-Host "  • Try running as administrator if needed" -ForegroundColor White
    exit 1
}
