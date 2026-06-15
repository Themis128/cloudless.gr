<#
.SYNOPSIS
    Fix Outlook (classic) Autodiscover so it resolves WorkMail's
    `autodiscover-service.mail.<region>.awsapps.com` endpoint instead of
    hijacking to Microsoft 365.

.DESCRIPTION
    Classic Outlook walks several Autodiscover sources in order: SCP (AD),
    HTTPS root domain, SRV record, then the email-suffix subdomain. On
    networks that have ever been M365-joined, the SCP or SRV step routes
    everything to outlook.office365.com -- which has no idea about your
    `@cloudless.gr` WorkMail mailbox and bounces back a sign-in prompt.

    This script writes the documented registry overrides under
    HKCU\Software\Microsoft\Office\<ver>\Outlook\AutoDiscover so Outlook
    skips the hijack-prone sources and goes straight to the WorkMail
    Autodiscover XML. Per-user (HKCU), no admin elevation required.

    Source: AWS re:Post -- "Preventing Outlook (Classic) Autodiscover Hijack
    to Microsoft 365 (AWS WorkMail)".

.PARAMETER Region
    AWS region of the WorkMail org. WorkMail is available in
    us-east-1 / us-west-2 / eu-west-1 only.

.PARAMETER OfficeVersion
    Outlook registry version (16.0 = Office 2016/2019/2021/365, 15.0 = 2013).
    Default 16.0.

.PARAMETER DryRun
    Print every action without writing to the registry.

.PARAMETER Revert
    Remove the keys this script added.

.EXAMPLE
    .\workmail-outlook-autodiscover-fix.ps1 -Region us-east-1

.EXAMPLE
    .\workmail-outlook-autodiscover-fix.ps1 -Region eu-west-1 -DryRun

.EXAMPLE
    .\workmail-outlook-autodiscover-fix.ps1 -Region us-east-1 -Revert
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('us-east-1', 'us-west-2', 'eu-west-1')]
    [string]$Region,

    [ValidateSet('16.0', '15.0')]
    [string]$OfficeVersion = '16.0',

    [switch]$DryRun,

    [switch]$Revert
)

$ErrorActionPreference = 'Stop'

# This script writes per-user (HKCU) registry values, so it can only run on
# Windows. Bail early when running under pwsh on Linux/macOS.
if (-not $IsWindows -and $null -ne $IsWindows) {
    Write-Host "ERROR: workmail-outlook-autodiscover-fix.ps1 must run on Windows." -ForegroundColor Red
    Write-Host "  This script writes registry values under HKCU\Software\Microsoft\Office\..." -ForegroundColor Red
    Write-Host "  Detected platform: $($PSVersionTable.OS)" -ForegroundColor Red
    Write-Host ""
    Write-Host "From WSL on the same machine, invoke the Windows-side PowerShell instead:" -ForegroundColor Yellow
    Write-Host "  /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe \\" -ForegroundColor Yellow
    Write-Host "    -ExecutionPolicy Bypass \\" -ForegroundColor Yellow
    Write-Host '    -File "$(wslpath -w "$PWD/scripts/workmail-outlook-autodiscover-fix.ps1")" \\' -ForegroundColor Yellow
    Write-Host "    -Region $Region" -ForegroundColor Yellow
    exit 4
}

$AutoDiscoverKey = "HKCU:\Software\Microsoft\Office\$OfficeVersion\Outlook\AutoDiscover"
$RedirectKey     = "HKCU:\Software\Microsoft\Office\$OfficeVersion\Outlook\AutoDiscover\RedirectServers"
$WorkMailHost    = "autodiscover-service.mail.$Region.awsapps.com"

# DWORDs that disable the hijack-prone Autodiscover sources.
# 1 = skip that lookup. ExcludeHttpsAutoDiscoverDomain stays 0 so Outlook
# can still hit autodiscover.<vanity-domain> if a CNAME exists.
$Values = @{
    'ExcludeScpLookup'               = 1
    'ExcludeHttpsRootDomain'         = 1
    'ExcludeSrvRecord'               = 1
    'ExcludeHttpsAutoDiscoverDomain' = 0
    'ExcludeLastKnownGoodURL'        = 1
    'ExcludeExplicitO365Endpoint'    = 1
}

function Write-Action {
    param([string]$Message, [string]$Color = 'Cyan')
    Write-Host "[workmail-fix] $Message" -ForegroundColor $Color
}

function Ensure-Key {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        if ($DryRun) {
            Write-Action "DRYRUN would create key: $Path"
        }
        else {
            New-Item -Path $Path -Force | Out-Null
            Write-Action "Created key: $Path"
        }
    }
}

function Set-DwordValue {
    param([string]$Path, [string]$Name, [int]$Value)
    $existing = $null
    try { $existing = (Get-ItemProperty -Path $Path -Name $Name -ErrorAction Stop).$Name } catch {}

    if ($null -ne $existing -and $existing -eq $Value) {
        Write-Action "Unchanged: $Path\$Name = $Value"
        return
    }

    if ($DryRun) {
        Write-Action "DRYRUN would set: $Path\$Name = $Value (was: $existing)"
    }
    else {
        New-ItemProperty -Path $Path -Name $Name -Value $Value -PropertyType DWord -Force | Out-Null
        Write-Action "Set: $Path\$Name = $Value (was: $existing)"
    }
}

function Remove-NameIfPresent {
    param([string]$Path, [string]$Name)
    try {
        Get-ItemProperty -Path $Path -Name $Name -ErrorAction Stop | Out-Null
        if ($DryRun) {
            Write-Action "DRYRUN would remove: $Path\$Name"
        }
        else {
            Remove-ItemProperty -Path $Path -Name $Name -Force
            Write-Action "Removed: $Path\$Name"
        }
    }
    catch { }
}

if ($Revert) {
    Write-Action "Reverting WorkMail Autodiscover overrides for Office $OfficeVersion" 'Yellow'

    if (Test-Path $AutoDiscoverKey) {
        foreach ($name in $Values.Keys) {
            Remove-NameIfPresent -Path $AutoDiscoverKey -Name $name
        }
    }
    else {
        Write-Action "Key not present, nothing to revert: $AutoDiscoverKey" 'Yellow'
    }

    if (Test-Path $RedirectKey) {
        if ($DryRun) {
            Write-Action "DRYRUN would remove: $RedirectKey"
        }
        else {
            Remove-Item -Path $RedirectKey -Recurse -Force
            Write-Action "Removed: $RedirectKey"
        }
    }

    Write-Action "Done. Restart Outlook for changes to take effect." 'Green'
    exit 0
}

Write-Action "Applying WorkMail Autodiscover fix" 'Green'
Write-Action "  Region:         $Region"
Write-Action "  Autodiscover:   $WorkMailHost"
Write-Action "  Office version: $OfficeVersion"
Write-Action "  Registry key:   $AutoDiscoverKey"
if ($DryRun) { Write-Action "  Mode:           DRY RUN -- no changes written" 'Yellow' }

Ensure-Key -Path $AutoDiscoverKey

foreach ($entry in $Values.GetEnumerator()) {
    Set-DwordValue -Path $AutoDiscoverKey -Name $entry.Key -Value $entry.Value
}

# Trust the redirect to autodiscover-service.mail.<region>.awsapps.com so
# Outlook stops prompting on every restart.
Ensure-Key -Path $RedirectKey
Set-DwordValue -Path $RedirectKey -Name $WorkMailHost -Value 1

Write-Action ""
Write-Action "Done." 'Green'
Write-Action ""
Write-Action "Next steps:"
Write-Action "  1. Close Outlook completely (check the system tray)."
Write-Action "  2. Reopen Outlook, File > Add Account, enter your email."
Write-Action "  3. When prompted with 'Allow this website to configure...',"
Write-Action "     tick 'Don't ask again' and click Allow."
