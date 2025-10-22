#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Restart Pablos Network services
.DESCRIPTION
    Restarts all or specific Pablos Network services
.PARAMETER Service
    Specific service to restart. If not specified, restarts all services.
    Valid values: gateway, ai, worker-dast, worker-dns, worker-origin, worker-osint, worker-webdiscovery, webtui, all
.EXAMPLE
    .\restart.ps1
    Restart all services
.EXAMPLE
    .\restart.ps1 -Service gateway
    Restart only the gateway service
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('gateway', 'ai', 'worker-dast', 'worker-dns', 'worker-origin', 'worker-osint', 'worker-webdiscovery', 'webtui', 'all')]
    [string]$Service = 'all'
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Color output functions
function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Cyan
}

Write-Info "=== Pablos Network Service Manager ==="
Write-Info "Restarting services..."
Write-Info ""

# Stop services
Write-Info "Stopping services..."
& (Join-Path $ScriptDir "stop.ps1") -Service $Service

Write-Info ""
Start-Sleep -Seconds 2

# Start services
Write-Info "Starting services..."
& (Join-Path $ScriptDir "start.ps1") -Service $Service

Write-Info ""
Write-Info "Restart complete!"

