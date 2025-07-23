# PowerShell script to manage and view error reports
# This script helps you view, analyze, and manage error reports from the visual testing system

param(
    [switch]$List = $false,
    [switch]$Latest = $false,
    [switch]$Open = $false,
    [switch]$Summary = $false,
    [switch]$Clean = $false,
    [string]$TestName = "",
    [string]$ErrorType = ""
)

$ErrorFolder = "test-results/errors"

Write-Host "🚨 Error Report Manager" -ForegroundColor Red
Write-Host "📁 Error folder: $ErrorFolder" -ForegroundColor Cyan

# Check if error folder exists
if (!(Test-Path $ErrorFolder)) {
    Write-Host "❌ Error folder not found. No errors have been logged yet." -ForegroundColor Yellow
    exit 0
}

# Function to get error reports
function Get-ErrorReports {
    $reports = @()
    $files = Get-ChildItem "$ErrorFolder/*.md" -ErrorAction SilentlyContinue
    
    foreach ($file in $files) {
        $content = Get-Content $file -Raw
        $jsonFile = $file.FullName -replace '\.md$', '.json'
        
        # Extract basic info from markdown
        $errorId = if ($content -match 'Error ID.*?`([^`]+)`') { $matches[1] } else { "Unknown" }
        $timestamp = if ($content -match 'Timestamp.*?`([^`]+)`') { $matches[1] } else { "Unknown" }
        $testName = if ($content -match 'Test Name.*?`([^`]+)`') { $matches[1] } else { "Unknown" }
        $errorType = if ($content -match 'Error Type.*?`([^`]+)`') { $matches[1] } else { "Unknown" }
        $errorMessage = if ($content -match 'Error Message.*?`([^`]+)`') { $matches[1] } else { "Unknown" }
        
        $reports += [PSCustomObject]@{
            ErrorId = $errorId
            Timestamp = $timestamp
            TestName = $testName
            ErrorType = $errorType
            ErrorMessage = $errorMessage
            MarkdownFile = $file.FullName
            JsonFile = $jsonFile
            FileSize = $file.Length
            LastModified = $file.LastWriteTime
        }
    }
    
    return $reports | Sort-Object LastModified -Descending
}

# Function to show error summary
function Show-ErrorSummary {
    $reports = Get-ErrorReports
    
    if ($reports.Count -eq 0) {
        Write-Host "✅ No error reports found" -ForegroundColor Green
        return
    }
    
    Write-Host "📊 Error Summary:" -ForegroundColor Cyan
    Write-Host "  Total Errors: $($reports.Count)" -ForegroundColor White
    
    # Group by test name
    $testGroups = $reports | Group-Object TestName
    Write-Host "  Tests with Errors:" -ForegroundColor White
    foreach ($group in $testGroups) {
        Write-Host "    - $($group.Name): $($group.Count) errors" -ForegroundColor Yellow
    }
    
    # Group by error type
    $errorGroups = $reports | Group-Object ErrorType
    Write-Host "  Error Types:" -ForegroundColor White
    foreach ($group in $errorGroups) {
        Write-Host "    - $($group.Name): $($group.Count) occurrences" -ForegroundColor Red
    }
    
    # Show latest error
    $latest = $reports[0]
    Write-Host "  Latest Error:" -ForegroundColor White
    Write-Host "    - Test: $($latest.TestName)" -ForegroundColor Yellow
    Write-Host "    - Type: $($latest.ErrorType)" -ForegroundColor Red
    Write-Host "    - Time: $($latest.Timestamp)" -ForegroundColor Gray
    Write-Host "    - Message: $($latest.ErrorMessage)" -ForegroundColor White
}

# Function to list error reports
function Show-ErrorList {
    param([array]$Reports, [string]$Filter = "")
    
    if ($Reports.Count -eq 0) {
        Write-Host "✅ No error reports found" -ForegroundColor Green
        return
    }
    
    Write-Host "📋 Error Reports:" -ForegroundColor Cyan
    
    foreach ($report in $Reports) {
        $color = if ($report.ErrorType -eq "Timeout Error") { "Yellow" } 
                elseif ($report.ErrorType -eq "Element Not Found") { "Red" }
                else { "White" }
        
        Write-Host "  [$($report.ErrorId)]" -ForegroundColor Gray
        Write-Host "    Test: $($report.TestName)" -ForegroundColor Yellow
        Write-Host "    Type: $($report.ErrorType)" -ForegroundColor $color
        Write-Host "    Time: $($report.Timestamp)" -ForegroundColor Gray
        Write-Host "    Message: $($report.ErrorMessage)" -ForegroundColor White
        Write-Host "    File: $($report.MarkdownFile)" -ForegroundColor Cyan
        Write-Host ""
    }
}

# Function to open error report
function Open-ErrorReport {
    param([string]$FilePath)
    
    if (Test-Path $FilePath) {
        try {
            Start-Process $FilePath
            Write-Host "✅ Opened error report: $FilePath" -ForegroundColor Green
        } catch {
            Write-Host "❌ Failed to open error report: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Error report not found: $FilePath" -ForegroundColor Red
    }
}

# Function to analyze error patterns
function Analyze-ErrorPatterns {
    $reports = Get-ErrorReports
    
    if ($reports.Count -eq 0) {
        Write-Host "✅ No errors to analyze" -ForegroundColor Green
        return
    }
    
    Write-Host "🔍 Error Pattern Analysis:" -ForegroundColor Cyan
    
    # Most common error types
    $errorTypes = $reports | Group-Object ErrorType | Sort-Object Count -Descending
    Write-Host "  Most Common Error Types:" -ForegroundColor White
    foreach ($type in $errorTypes[0..2]) {
        $percentage = [math]::Round(($type.Count / $reports.Count) * 100, 1)
        Write-Host "    - $($type.Name): $($type.Count) times ($percentage%)" -ForegroundColor Red
    }
    
    # Most problematic tests
    $testErrors = $reports | Group-Object TestName | Sort-Object Count -Descending
    Write-Host "  Most Problematic Tests:" -ForegroundColor White
    foreach ($test in $testErrors[0..2]) {
        Write-Host "    - $($test.Name): $($test.Count) errors" -ForegroundColor Yellow
    }
    
    # Time-based analysis
    $recentErrors = $reports | Where-Object { $_.LastModified -gt (Get-Date).AddDays(-1) }
    Write-Host "  Recent Activity:" -ForegroundColor White
    Write-Host "    - Last 24 hours: $($recentErrors.Count) errors" -ForegroundColor Yellow
}

# Function to clean old error reports
function Clean-OldErrors {
    $reports = Get-ErrorReports
    
    if ($reports.Count -eq 0) {
        Write-Host "✅ No error reports to clean" -ForegroundColor Green
        return
    }
    
    Write-Host "🧹 Cleaning old error reports..." -ForegroundColor Yellow
    
    # Keep only the last 20 reports
    $reportsToDelete = $reports[20..($reports.Count-1)]
    
    if ($reportsToDelete.Count -eq 0) {
        Write-Host "✅ No old reports to delete" -ForegroundColor Green
        return
    }
    
    foreach ($report in $reportsToDelete) {
        try {
            Remove-Item $report.MarkdownFile -Force
            if (Test-Path $report.JsonFile) {
                Remove-Item $report.JsonFile -Force
            }
            Write-Host "  Deleted: $($report.ErrorId)" -ForegroundColor Gray
        } catch {
            Write-Host "  Failed to delete: $($report.ErrorId) - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Write-Host "✅ Cleaned up $($reportsToDelete.Count) old error reports" -ForegroundColor Green
}

# Main execution
try {
    $reports = Get-ErrorReports
    
    if ($Summary) {
        Show-ErrorSummary
        Analyze-ErrorPatterns
    } elseif ($List) {
        $filteredReports = $reports
        if ($TestName) {
            $filteredReports = $reports | Where-Object { $_.TestName -like "*$TestName*" }
        }
        if ($ErrorType) {
            $filteredReports = $filteredReports | Where-Object { $_.ErrorType -like "*$ErrorType*" }
        }
        Show-ErrorList $filteredReports
    } elseif ($Latest) {
        if ($reports.Count -gt 0) {
            Write-Host "📄 Latest Error Report:" -ForegroundColor Cyan
            $latest = $reports[0]
            Write-Host "  Error ID: $($latest.ErrorId)" -ForegroundColor White
            Write-Host "  Test: $($latest.TestName)" -ForegroundColor Yellow
            Write-Host "  Type: $($latest.ErrorType)" -ForegroundColor Red
            Write-Host "  Time: $($latest.Timestamp)" -ForegroundColor Gray
            Write-Host "  Message: $($latest.ErrorMessage)" -ForegroundColor White
            
            if ($Open) {
                Open-ErrorReport $latest.MarkdownFile
            }
        } else {
            Write-Host "✅ No error reports found" -ForegroundColor Green
        }
    } elseif ($Open) {
        if ($reports.Count -gt 0) {
            Open-ErrorReport $reports[0].MarkdownFile
        } else {
            Write-Host "✅ No error reports to open" -ForegroundColor Green
        }
    } elseif ($Clean) {
        Clean-OldErrors
    } else {
        # Default: show summary
        Show-ErrorSummary
        Write-Host ""
        Write-Host "💡 Usage:" -ForegroundColor Cyan
        Write-Host "  -List              : List all error reports" -ForegroundColor White
        Write-Host "  -Latest            : Show latest error report" -ForegroundColor White
        Write-Host "  -Open              : Open latest error report" -ForegroundColor White
        Write-Host "  -Summary           : Show detailed summary and analysis" -ForegroundColor White
        Write-Host "  -Clean             : Clean old error reports" -ForegroundColor White
        Write-Host "  -TestName 'name'   : Filter by test name" -ForegroundColor White
        Write-Host "  -ErrorType 'type'  : Filter by error type" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "🏁 Error report manager completed!" -ForegroundColor Green 