#!/usr/bin/env pwsh
# Jenkins TypeScript Quality Check Script
# Detects and reports common TypeScript issues including duplicates

param(
    [string]$BuildNumber = $env:BUILD_NUMBER ?? "local",
    [string]$ReportPath = "jenkins-reports",
    [switch]$FixDuplicates = $false,
    [switch]$GenerateReport = $true
)

Write-Host "🔍 Jenkins TypeScript Quality Check (Build #$BuildNumber)" -ForegroundColor Green
Write-Host "=" * 60

# Initialize report directory
if ($GenerateReport) {
    New-Item -ItemType Directory -Force -Path $ReportPath | Out-Null
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $reportFile = "$ReportPath/typescript-quality-$timestamp.json"
}

$qualityReport = @{
    buildNumber = $BuildNumber
    timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
    duplicateImports = @()
    typeErrors = @()
    warnings = @()
    summary = @{}
}

# Step 1: Check for duplicate imports
Write-Host "📊 Checking for duplicate imports..." -ForegroundColor Yellow

$typecheckOutput = & npm run typecheck 2>&1 | Out-String
$duplicateWarnings = $typecheckOutput | Select-String "WARN.*Duplicated imports"

if ($duplicateWarnings) {
    Write-Host "❌ Found duplicate imports:" -ForegroundColor Red
    foreach ($warning in $duplicateWarnings) {
        $warningText = $warning.ToString()
        Write-Host "  $warningText" -ForegroundColor Yellow

        # Parse the duplicate import details
        if ($warningText -match 'Duplicated imports "([^"]+)".*from "([^"]+)".*and "([^"]+)"') {
            $qualityReport.duplicateImports += @{
                function = $matches[1]
                ignoredFile = $matches[2]
                usedFile = $matches[3]
                severity = "warning"
            }
        }
    }

    if ($FixDuplicates) {
        Write-Host "🔧 Auto-fixing duplicate imports..." -ForegroundColor Cyan
        & .\scripts\fix-duplicate-imports.ps1
    }
} else {
    Write-Host "✅ No duplicate imports found!" -ForegroundColor Green
}

# Step 2: Parse TypeScript errors
Write-Host "`n🔍 Analyzing TypeScript errors..." -ForegroundColor Yellow

$errorPattern = '([^(]+)\((\d+),(\d+)\): error (TS\d+): (.+)'
$errorMatches = $typecheckOutput | Select-String $errorPattern

foreach ($errorMatch in $errorMatches) {
    $matches = $errorMatch.Matches[0].Groups
    $qualityReport.typeErrors += @{
        file = $matches[1].Value
        line = [int]$matches[2].Value
        column = [int]$matches[3].Value
        code = $matches[4].Value
        message = $matches[5].Value
        severity = "error"
    }
}

# Step 3: Categorize errors by type
$errorCategories = @{}
foreach ($error in $qualityReport.typeErrors) {
    $category = switch -Regex ($error.message) {
        "never" { "never-types" }
        "Property.*does not exist" { "missing-properties" }
        "Type.*is not assignable" { "type-mismatch" }
        "Cannot find name" { "undefined-variables" }
        "expected" { "syntax-errors" }
        default { "other" }
    }

    if (-not $errorCategories[$category]) {
        $errorCategories[$category] = 0
    }
    $errorCategories[$category]++
}

# Step 4: Generate summary
$qualityReport.summary = @{
    totalErrors = $qualityReport.typeErrors.Count
    totalDuplicates = $qualityReport.duplicateImports.Count
    errorCategories = $errorCategories
    qualityScore = if ($qualityReport.typeErrors.Count -eq 0 -and $qualityReport.duplicateImports.Count -eq 0) { 100 }
                   else { [math]::Max(0, 100 - ($qualityReport.typeErrors.Count * 2) - $qualityReport.duplicateImports.Count) }
}

# Step 5: Display summary
Write-Host "`n📈 Quality Summary:" -ForegroundColor Cyan
Write-Host "  Total TypeScript Errors: $($qualityReport.summary.totalErrors)" -ForegroundColor $(if ($qualityReport.summary.totalErrors -eq 0) { "Green" } else { "Red" })
Write-Host "  Total Duplicate Imports: $($qualityReport.summary.totalDuplicates)" -ForegroundColor $(if ($qualityReport.summary.totalDuplicates -eq 0) { "Green" } else { "Yellow" })
Write-Host "  Quality Score: $($qualityReport.summary.qualityScore)/100" -ForegroundColor $(if ($qualityReport.summary.qualityScore -ge 80) { "Green" } elseif ($qualityReport.summary.qualityScore -ge 60) { "Yellow" } else { "Red" })

if ($errorCategories.Count -gt 0) {
    Write-Host "`n🏷️ Error Categories:" -ForegroundColor Cyan
    foreach ($category in $errorCategories.GetEnumerator()) {
        Write-Host "  $($category.Key): $($category.Value)" -ForegroundColor White
    }
}

# Step 6: Save report
if ($GenerateReport) {
    $qualityReport | ConvertTo-Json -Depth 3 | Set-Content $reportFile
    Write-Host "`n📄 Report saved to: $reportFile" -ForegroundColor Green
}

# Step 7: Set Jenkins build status
$exitCode = 0
if ($qualityReport.summary.qualityScore -lt 60) {
    Write-Host "`n❌ Build quality below threshold (60). Consider this a warning." -ForegroundColor Red
    $exitCode = 1
} elseif ($qualityReport.summary.totalErrors -gt 0) {
    Write-Host "`n⚠️ TypeScript errors found but quality acceptable." -ForegroundColor Yellow
} else {
    Write-Host "`n✅ Excellent code quality!" -ForegroundColor Green
}

Write-Host "`n🎯 Recommendations:" -ForegroundColor Cyan
if ($qualityReport.duplicateImports.Count -gt 0) {
    Write-Host "  - Run: .\scripts\fix-duplicate-imports.ps1" -ForegroundColor White
}
if ($qualityReport.typeErrors.Count -gt 0) {
    Write-Host "  - Run: npm run typecheck for detailed error list" -ForegroundColor White
    Write-Host "  - Run: .\\.vscode\\auto-fix-errors.ps1 for automated fixes" -ForegroundColor White
}

exit $exitCode
