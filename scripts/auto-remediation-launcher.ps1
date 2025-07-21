# Auto-Remediation Launcher
# Automatically triggers remediation based on monitoring dashboard logs

param(
    [switch]$DryRun = $false,
    [switch]$Force = $false,
    [switch]$Continuous = $false,
    [int]$Interval = 30,
    [string]$LogFile = "scripts/monitor-runner-web.html"
)

# Colors for output
$Red = "Red"
$Yellow = "Yellow"
$Green = "Green"
$Cyan = "Cyan"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Get-Timestamp {
    return Get-Date -Format "HH:mm:ss"
}

function Parse-LogFile {
    param([string]$LogFilePath)
    
    if (-not (Test-Path $LogFilePath)) {
        Write-ColorOutput "[$(Get-Timestamp)] ⚠️ Log file not found: $LogFilePath" $Yellow
        return @()
    }
    
    try {
        $content = Get-Content $LogFilePath -Raw
        $issues = @()
        
        # Parse ERROR entries
        $errorMatches = [regex]::Matches($content, '\[ERROR\].*?💡 Solutions:.*?(?=\[|$)', [System.Text.RegularExpressions.RegexOptions]::Singleline)
        foreach ($match in $errorMatches) {
            $issues += @{
                Type = "ERROR"
                Content = $match.Value.Trim()
                Timestamp = [regex]::Match($match.Value, '\[(\d{2}:\d{2}:\d{2})\]').Groups[1].Value
            }
        }
        
        # Parse WARNING entries
        $warningMatches = [regex]::Matches($content, '\[WARNING\].*?💡 Solutions:.*?(?=\[|$)', [System.Text.RegularExpressions.RegexOptions]::Singleline)
        foreach ($match in $warningMatches) {
            $issues += @{
                Type = "WARNING"
                Content = $match.Value.Trim()
                Timestamp = [regex]::Match($match.Value, '\[(\d{2}:\d{2}:\d{2})\]').Groups[1].Value
            }
        }
        
        return $issues
    }
    catch {
        Write-ColorOutput "[$(Get-Timestamp)] ❌ Error parsing log file: $($_.Exception.Message)" $Red
        return @()
    }
}

function Should-Remediate {
    param([array]$Issues)
    
    $criticalIssues = @(
        "CPU usage is critically high",
        "Memory usage is critically high", 
        "Disk usage is critically high",
        "Docker service is not running",
        "GitHub Actions runner is not running",
        "Network connectivity issues"
    )
    
    $warningIssues = @(
        "CPU usage is elevated",
        "Memory usage above 70%",
        "Disk usage is elevated",
        "Docker cache needs cleanup",
        "System temperature is high"
    )
    
    foreach ($issue in $Issues) {
        $content = $issue.Content
        
        # Check for critical issues
        foreach ($critical in $criticalIssues) {
            if ($content -match [regex]::Escape($critical)) {
                Write-ColorOutput "[$(Get-Timestamp)] 🚨 Critical issue detected: $critical" $Red
                return $true
            }
        }
        
        # Check for warning issues (only if Force is enabled)
        if ($Force) {
            foreach ($warning in $warningIssues) {
                if ($content -match [regex]::Escape($warning)) {
                    Write-ColorOutput "[$(Get-Timestamp)] ⚠️ Warning issue detected: $warning" $Yellow
                    return $true
                }
            }
        }
    }
    
    return $false
}

function Start-AutoRemediation {
    param([array]$Issues)
    
    Write-ColorOutput "[$(Get-Timestamp)] 🤖 Starting Auto-Remediation..." $Cyan
    
    # Build remediation command
    $remediationScript = Join-Path $PSScriptRoot "auto-remediation.ps1"
    $command = "& '$remediationScript'"
    
    if ($DryRun) {
        $command += " -DryRun"
    }
    
    if ($Force) {
        $command += " -Force"
    }
    
    Write-ColorOutput "[$(Get-Timestamp)] 🔧 Executing: $command" $Cyan
    
    try {
        $result = Invoke-Expression $command
        Write-ColorOutput "[$(Get-Timestamp)] ✅ Auto-remediation completed" $Green
        return $true
    }
    catch {
        Write-ColorOutput "[$(Get-Timestamp)] ❌ Auto-remediation failed: $($_.Exception.Message)" $Red
        return $false
    }
}

function Monitor-And-Remediate {
    Write-ColorOutput "[$(Get-Timestamp)] 🔍 Starting Auto-Remediation Monitor..." $Cyan
    Write-ColorOutput "[$(Get-Timestamp)] 📁 Monitoring log file: $LogFile" $Cyan
    Write-ColorOutput "[$(Get-Timestamp)] 🔄 Continuous mode: $(if ($Continuous) { 'ENABLED' } else { 'DISABLED' })" $(if ($Continuous) { $Yellow } else { $Green })
    
    $lastCheck = Get-Date
    $lastIssues = @()
    
    do {
        # Parse current issues from log file
        $currentIssues = Parse-LogFile -LogFilePath $LogFile
        
        # Check if we have new issues since last check
        $newIssues = @()
        foreach ($issue in $currentIssues) {
            $issueTime = [DateTime]::ParseExact($issue.Timestamp, "HH:mm:ss", $null)
            if ($issueTime -gt $lastCheck) {
                $newIssues += $issue
            }
        }
        
        if ($newIssues.Count -gt 0) {
            Write-ColorOutput "[$(Get-Timestamp)] 📊 Found $($newIssues.Count) new issues" $Yellow
            
            # Check if remediation is needed
            if (Should-Remediate -Issues $newIssues) {
                Write-ColorOutput "[$(Get-Timestamp)] 🚨 Issues require remediation!" $Red
                Start-AutoRemediation -Issues $newIssues
            }
            else {
                Write-ColorOutput "[$(Get-Timestamp)] ✅ Issues don't require immediate remediation" $Green
            }
            
            $lastIssues = $currentIssues
        }
        else {
            Write-ColorOutput "[$(Get-Timestamp)] ✅ No new issues detected" $Green
        }
        
        $lastCheck = Get-Date
        
        if ($Continuous) {
            Write-ColorOutput "[$(Get-Timestamp)] ⏳ Waiting $Interval seconds before next check..." $Cyan
            Start-Sleep -Seconds $Interval
        }
        
    } while ($Continuous)
    
    Write-ColorOutput "[$(Get-Timestamp)] 🎯 Monitoring completed" $Green
}

# Main execution
try {
    if ($Continuous) {
        Monitor-And-Remediate
    }
    else {
        # Single check mode
        $issues = Parse-LogFile -LogFilePath $LogFile
        
        if ($issues.Count -eq 0) {
            Write-ColorOutput "[$(Get-Timestamp)] ✅ No issues found in log file" $Green
            exit 0
        }
        
        Write-ColorOutput "[$(Get-Timestamp)] 📊 Found $($issues.Count) issues in log file" $Yellow
        
        if (Should-Remediate -Issues $issues) {
            Start-AutoRemediation -Issues $issues
        }
        else {
            Write-ColorOutput "[$(Get-Timestamp)] ✅ Issues don't require immediate remediation" $Green
        }
    }
}
catch {
    Write-ColorOutput "[$(Get-Timestamp)] ❌ Auto-remediation launcher failed: $($_.Exception.Message)" $Red
    exit 1
} 