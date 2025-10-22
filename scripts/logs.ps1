#!/usr/bin/env pwsh
<#
.SYNOPSIS
    View logs from Pablos Network services
.DESCRIPTION
    Displays logs from all or specific Pablos Network services
.PARAMETER Service
    Specific service to view logs for. If not specified, shows all services.
    Valid values: gateway, ai, worker-dast, worker-dns, worker-origin, worker-osint, worker-webdiscovery, webtui, all
.PARAMETER Follow
    Follow log output (like tail -f)
.PARAMETER Lines
    Number of lines to display from the end of the log file (default: 50)
.EXAMPLE
    .\logs.ps1
    Show last 50 lines from all service logs
.EXAMPLE
    .\logs.ps1 -Service gateway -Follow
    Follow gateway service logs in real-time
.EXAMPLE
    .\logs.ps1 -Service ai -Lines 100
    Show last 100 lines from AI service logs
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('gateway', 'ai', 'worker-dast', 'worker-dns', 'worker-origin', 'worker-osint', 'worker-webdiscovery', 'webtui', 'all')]
    [string]$Service = 'all',
    
    [Parameter(Mandatory=$false)]
    [switch]$Follow,
    
    [Parameter(Mandatory=$false)]
    [int]$Lines = 50
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$LogsDir = Join-Path $RootDir "logs"

# Color output functions
function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Cyan
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

# Check if logs directory exists
if (-not (Test-Path $LogsDir)) {
    Write-Warning "Logs directory not found: $LogsDir"
    Write-Info "No services have been started yet."
    exit 0
}

# Get latest log file for a service
function Get-LatestLogFile {
    param([string]$ServiceName)
    
    $LogFiles = Get-ChildItem -Path $LogsDir -Filter "$ServiceName-*.log" -ErrorAction SilentlyContinue | 
                Sort-Object LastWriteTime -Descending
    
    if ($LogFiles.Count -eq 0) {
        return $null
    }
    
    return $LogFiles[0].FullName
}

# Display logs for a service
function Show-ServiceLogs {
    param(
        [string]$ServiceName,
        [bool]$FollowMode = $false,
        [int]$LineCount = 50
    )
    
    $LogFile = Get-LatestLogFile -ServiceName $ServiceName
    
    if (-not $LogFile) {
        Write-Warning "No logs found for $ServiceName"
        return
    }
    
    Write-Info "=== $ServiceName logs ($LogFile) ==="
    Write-Host ""
    
    if ($FollowMode) {
        # Follow mode (like tail -f)
        Get-Content -Path $LogFile -Tail $LineCount -Wait
    } else {
        # Show last N lines
        Get-Content -Path $LogFile -Tail $LineCount
    }
}

# Define service list
$Services = @()

if ($Service -eq 'all') {
    $Services = @(
        'gateway',
        'ai',
        'worker-dast',
        'worker-dns',
        'worker-origin',
        'worker-osint',
        'worker-webdiscovery',
        'webtui'
    )
} else {
    $Services = @($Service)
}

# If following a single service, use tail -f mode
if ($Follow -and $Services.Count -eq 1) {
    Show-ServiceLogs -ServiceName $Services[0] -FollowMode $true -LineCount $Lines
    exit 0
}

# If following multiple services, warn and show static logs
if ($Follow -and $Services.Count -gt 1) {
    Write-Warning "Follow mode (-Follow) only works with a single service"
    Write-Info "Showing static logs instead..."
    Write-Host ""
}

# Show logs for all requested services
foreach ($Svc in $Services) {
    Show-ServiceLogs -ServiceName $Svc -FollowMode $false -LineCount $Lines
    Write-Host ""
    Write-Host ("-" * 80) -ForegroundColor Gray
    Write-Host ""
}

Write-Info "Tip: Use -Follow to tail logs in real-time for a single service"
Write-Info "Example: .\logs.ps1 -Service gateway -Follow"

