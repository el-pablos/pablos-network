#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Start Pablos Network services in development mode
.DESCRIPTION
    Starts all Pablos Network services in development mode with hot reload
.PARAMETER Service
    Specific service to start in dev mode. If not specified, starts all services.
    Valid values: gateway, ai, worker-dast, worker-dns, worker-origin, worker-osint, worker-webdiscovery, webtui, all
.EXAMPLE
    .\dev.ps1
    Start all services in development mode
.EXAMPLE
    .\dev.ps1 -Service webtui
    Start only the WebTUI in development mode
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('gateway', 'ai', 'worker-dast', 'worker-dns', 'worker-origin', 'worker-osint', 'worker-webdiscovery', 'webtui', 'all')]
    [string]$Service = 'all'
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

# Color output functions
function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Cyan
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

Write-Info "=== Pablos Network Development Mode ==="
Write-Info "Starting services with hot reload..."
Write-Info ""

# Load environment variables from .env if it exists
$EnvFile = Join-Path $RootDir ".env"
if (Test-Path $EnvFile) {
    Write-Info "Loading environment variables from .env"
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.+)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

# Get ports from environment or use defaults
$GatewayPort = if ($env:GATEWAY_PORT) { $env:GATEWAY_PORT } else { 4000 }
$AIPort = if ($env:AI_SERVICE_PORT) { $env:AI_SERVICE_PORT } else { 4001 }
$WebTUIPort = if ($env:WEBTUI_PORT) { $env:WEBTUI_PORT } else { 3000 }

Write-Info "Service URLs:"
Write-Info "  Gateway:  http://localhost:$GatewayPort"
Write-Info "  AI:       http://localhost:$AIPort"
Write-Info "  WebTUI:   http://localhost:$WebTUIPort"
Write-Info ""
Write-Warning "Press Ctrl+C to stop all services"
Write-Info ""

# Change to root directory
Set-Location $RootDir

# Build the pnpm filter command based on service selection
$FilterArgs = @()

if ($Service -eq 'all') {
    # Start all services using Turborepo
    Write-Info "Starting all services in parallel..."
    & pnpm dev
} else {
    # Start specific service
    $PackageName = switch ($Service) {
        'gateway' { '@pablos/gateway' }
        'ai' { '@pablos/ai' }
        'worker-dast' { '@pablos/worker-dast' }
        'worker-dns' { '@pablos/worker-dns' }
        'worker-origin' { '@pablos/worker-origin' }
        'worker-osint' { '@pablos/worker-osint' }
        'worker-webdiscovery' { '@pablos/worker-webdiscovery' }
        'webtui' { '@pablos/webtui' }
    }
    
    Write-Info "Starting $Service ($PackageName) in development mode..."
    & pnpm --filter $PackageName dev
}

