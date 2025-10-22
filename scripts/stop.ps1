#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Stop Pablos Network services
.DESCRIPTION
    Stops all or specific Pablos Network services gracefully
.PARAMETER Service
    Specific service to stop. If not specified, stops all services.
    Valid values: gateway, ai, worker-dast, worker-dns, worker-origin, worker-osint, worker-webdiscovery, webtui, all
.EXAMPLE
    .\stop.ps1
    Stop all services
.EXAMPLE
    .\stop.ps1 -Service gateway
    Stop only the gateway service
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('gateway', 'ai', 'worker-dast', 'worker-dns', 'worker-origin', 'worker-osint', 'worker-webdiscovery', 'webtui', 'all')]
    [string]$Service = 'all'
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$PidsDir = Join-Path $RootDir ".pids"

# Color output functions
function Write-SuccessMessage {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-InfoMessage {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Cyan
}

function Write-WarningMessage {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-ErrorMessage {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

# Stop a service
function Stop-PablosService {
    param([string]$ServiceName)
    
    $PidFile = Join-Path $PidsDir "$ServiceName.pid"
    
    if (-not (Test-Path $PidFile)) {
        Write-WarningMessage "$ServiceName is not running (no PID file found)"
        return
    }

    $Pid = Get-Content $PidFile

    try {
        $Process = Get-Process -Id $Pid -ErrorAction SilentlyContinue

        if (-not $Process) {
            Write-WarningMessage "$ServiceName is not running (PID $Pid not found)"
            Remove-Item $PidFile -Force
            return
        }

        Write-InfoMessage "Stopping $ServiceName (PID: $Pid)..."

        # Try graceful shutdown first
        $Process.CloseMainWindow() | Out-Null
        Start-Sleep -Seconds 2

        # Check if still running
        $Process = Get-Process -Id $Pid -ErrorAction SilentlyContinue
        if ($Process) {
            # Force kill if still running
            Write-WarningMessage "Forcing $ServiceName to stop..."
            Stop-Process -Id $Pid -Force
            Start-Sleep -Seconds 1
        }

        # Remove PID file
        Remove-Item $PidFile -Force

        Write-SuccessMessage "$ServiceName stopped"
    } catch {
        Write-ErrorMessage "Failed to stop ${ServiceName}: $($_.Exception.Message)"
        # Clean up PID file anyway
        if (Test-Path $PidFile) {
            Remove-Item $PidFile -Force
        }
    }
}

Write-InfoMessage "=== Pablos Network Service Manager ==="
Write-InfoMessage "Stopping services..."
Write-InfoMessage ""

# Define service list
$Services = @()

if ($Service -eq 'all') {
    $Services = @(
        'webtui',
        'worker-webdiscovery',
        'worker-osint',
        'worker-origin',
        'worker-dns',
        'worker-dast',
        'ai',
        'gateway'
    )
} else {
    $Services = @($Service)
}

# Stop services in reverse order (workers first, then core services)
foreach ($Svc in $Services) {
    Stop-PablosService -ServiceName $Svc
}

Write-InfoMessage ""
Write-SuccessMessage "Service shutdown complete!"
Write-InfoMessage "Run '.\status.ps1' to verify all services are stopped"

