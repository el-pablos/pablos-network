#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Start Pablos Network services
.DESCRIPTION
    Starts all or specific Pablos Network services (MongoDB, Redis, Gateway, AI Service, Workers, WebTUI)
.PARAMETER Service
    Specific service to start. If not specified, starts all services.
    Valid values: mongodb, redis, gateway, ai, worker-dast, worker-dns, worker-origin, worker-osint, worker-webdiscovery, webtui, all
.EXAMPLE
    .\start.ps1
    Start all services
.EXAMPLE
    .\start.ps1 -Service gateway
    Start only the gateway service
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('mongodb', 'redis', 'gateway', 'ai', 'worker-dast', 'worker-dns', 'worker-origin', 'worker-osint', 'worker-webdiscovery', 'webtui', 'all')]
    [string]$Service = 'all'
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$PidsDir = Join-Path $RootDir ".pids"
$LogsDir = Join-Path $RootDir "logs"

# Create directories if they don't exist
if (-not (Test-Path $PidsDir)) {
    New-Item -ItemType Directory -Path $PidsDir | Out-Null
}
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir | Out-Null
}

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

# Check if service is already running
function Test-ServiceRunning {
    param([string]$ServiceName)
    
    $PidFile = Join-Path $PidsDir "$ServiceName.pid"
    if (Test-Path $PidFile) {
        $Pid = Get-Content $PidFile
        try {
            $Process = Get-Process -Id $Pid -ErrorAction SilentlyContinue
            if ($Process) {
                return $true
            }
        } catch {
            # Process doesn't exist, remove stale PID file
            Remove-Item $PidFile -Force
        }
    }
    return $false
}

# Start a service
function Start-PablosService {
    param(
        [string]$ServiceName,
        [string]$Command,
        [string]$WorkingDir = $RootDir,
        [int]$Port = 0
    )
    
    if (Test-ServiceRunning -ServiceName $ServiceName) {
        Write-Host "⚠ $ServiceName is already running" -ForegroundColor Yellow
        return
    }

    Write-Host "ℹ Starting $ServiceName..." -ForegroundColor Cyan
    
    $LogFile = Join-Path $LogsDir "$ServiceName-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
    $PidFile = Join-Path $PidsDir "$ServiceName.pid"
    
    try {
        # Start the process in the background
        $ProcessInfo = New-Object System.Diagnostics.ProcessStartInfo
        $ProcessInfo.FileName = "cmd.exe"
        $CmdArgs = '/c cd /d "' + $WorkingDir + '" && ' + $Command + ' > "' + $LogFile + '" 2>&1'
        $ProcessInfo.Arguments = $CmdArgs
        $ProcessInfo.UseShellExecute = $false
        $ProcessInfo.CreateNoWindow = $true
        $ProcessInfo.RedirectStandardOutput = $false
        $ProcessInfo.RedirectStandardError = $false
        $ProcessInfo.WorkingDirectory = $WorkingDir

        $Process = New-Object System.Diagnostics.Process
        $Process.StartInfo = $ProcessInfo
        $Process.Start() | Out-Null

        # Save PID
        $Process.Id | Out-File -FilePath $PidFile -Encoding ASCII
        
        # Wait a moment to check if process started successfully
        Start-Sleep -Seconds 2

        if ($Process.HasExited) {
            Write-Host "✗ $ServiceName failed to start (exited immediately)" -ForegroundColor Red
            Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
            return
        }

        if ($Port -gt 0) {
            Write-Host "✓ $ServiceName started (PID: $($Process.Id), Port: $Port)" -ForegroundColor Green
        } else {
            Write-Host "✓ $ServiceName started (PID: $($Process.Id))" -ForegroundColor Green
        }

        Write-Host "ℹ Logs: $LogFile" -ForegroundColor Cyan
    } catch {
        Write-Host "✗ Failed to start ${ServiceName}: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Load environment variables from .env if it exists
$EnvFile = Join-Path $RootDir ".env"
if (Test-Path $EnvFile) {
    Write-Host "ℹ Loading environment variables from .env" -ForegroundColor Cyan
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.+)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

# Get ports from environment or use defaults
$GatewayPort = if ($env:GATEWAY_PORT) { [int]$env:GATEWAY_PORT } else { 4000 }
$AIPort = if ($env:AI_SERVICE_PORT) { [int]$env:AI_SERVICE_PORT } else { 4001 }
$WebTUIPort = if ($env:WEBTUI_PORT) { [int]$env:WEBTUI_PORT } else { 3000 }

Write-Host "ℹ === Pablos Network Service Manager ===" -ForegroundColor Cyan
Write-Host "ℹ Starting services..." -ForegroundColor Cyan
Write-Host ""

# Start services based on parameter
if ($Service -eq 'all' -or $Service -eq 'mongodb') {
    # Note: MongoDB should be running as a system service
    # This is just a check
    Write-Host "ℹ Checking MongoDB..." -ForegroundColor Cyan
    try {
        $MongoUri = if ($env:MONGODB_URI) { $env:MONGODB_URI } else { "mongodb://localhost:27017" }
        Write-Host "ℹ MongoDB configured: $($MongoUri.Substring(0, [Math]::Min(50, $MongoUri.Length)))..." -ForegroundColor Cyan
        Write-Host "⚠ Please ensure MongoDB is accessible" -ForegroundColor Yellow
    } catch {
        Write-Host "⚠ MongoDB check skipped" -ForegroundColor Yellow
    }
}

if ($Service -eq 'all' -or $Service -eq 'redis') {
    # Note: Redis should be running as a system service or Docker container
    Write-Host "ℹ Checking Redis..." -ForegroundColor Cyan
    try {
        $RedisHost = if ($env:REDIS_HOST) { $env:REDIS_HOST } else { "localhost" }
        Write-Host "ℹ Redis configured: $RedisHost" -ForegroundColor Cyan
        Write-Host "⚠ Please ensure Redis is accessible" -ForegroundColor Yellow
    } catch {
        Write-Host "⚠ Redis check skipped" -ForegroundColor Yellow
    }
}

if ($Service -eq 'all' -or $Service -eq 'gateway') {
    Start-PablosService -ServiceName "gateway" -Command "pnpm --filter @pablos/gateway start" -Port $GatewayPort
}

if ($Service -eq 'all' -or $Service -eq 'ai') {
    Start-PablosService -ServiceName "ai" -Command "pnpm --filter @pablos/ai start" -Port $AIPort
}

if ($Service -eq 'all' -or $Service -eq 'worker-dast') {
    Start-PablosService -ServiceName "worker-dast" -Command "pnpm --filter @pablos/worker-dast start"
}

if ($Service -eq 'all' -or $Service -eq 'worker-dns') {
    Start-PablosService -ServiceName "worker-dns" -Command "pnpm --filter @pablos/worker-dns start"
}

if ($Service -eq 'all' -or $Service -eq 'worker-origin') {
    Start-PablosService -ServiceName "worker-origin" -Command "pnpm --filter @pablos/worker-origin start"
}

if ($Service -eq 'all' -or $Service -eq 'worker-osint') {
    Start-PablosService -ServiceName "worker-osint" -Command "pnpm --filter @pablos/worker-osint start"
}

if ($Service -eq 'all' -or $Service -eq 'worker-webdiscovery') {
    Start-PablosService -ServiceName "worker-webdiscovery" -Command "pnpm --filter @pablos/worker-webdiscovery start"
}

if ($Service -eq 'all' -or $Service -eq 'webtui') {
    Start-PablosService -ServiceName "webtui" -Command "pnpm --filter @pablos/webtui start" -Port $WebTUIPort
}

Write-Host ""
Write-Host "✓ Service startup complete!" -ForegroundColor Green
Write-Host "ℹ Run '.\scripts\status.ps1' to check service status" -ForegroundColor Cyan
Write-Host "ℹ Run '.\scripts\logs.ps1 -Service [name]' to view service logs" -ForegroundColor Cyan

