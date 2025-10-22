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

$ErrorActionPreference = "Stop"
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

function Write-Error {
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
        Write-Warning "$ServiceName is already running"
        return
    }
    
    Write-Info "Starting $ServiceName..."
    
    $LogFile = Join-Path $LogsDir "$ServiceName-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
    $PidFile = Join-Path $PidsDir "$ServiceName.pid"
    
    try {
        # Start the process in the background
        $ProcessInfo = New-Object System.Diagnostics.ProcessStartInfo
        $ProcessInfo.FileName = "pwsh"
        $ProcessInfo.Arguments = "-NoProfile -Command `"cd '$WorkingDir'; $Command *>&1 | Tee-Object -FilePath '$LogFile'`""
        $ProcessInfo.UseShellExecute = $false
        $ProcessInfo.CreateNoWindow = $true
        $ProcessInfo.RedirectStandardOutput = $false
        $ProcessInfo.RedirectStandardError = $false
        
        $Process = New-Object System.Diagnostics.Process
        $Process.StartInfo = $ProcessInfo
        $Process.Start() | Out-Null
        
        # Save PID
        $Process.Id | Out-File -FilePath $PidFile -Encoding ASCII
        
        # Wait a moment to check if process started successfully
        Start-Sleep -Seconds 2
        
        if ($Process.HasExited) {
            Write-Error "$ServiceName failed to start (exited immediately)"
            Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
            return
        }
        
        if ($Port -gt 0) {
            Write-Success "$ServiceName started (PID: $($Process.Id), Port: $Port)"
        } else {
            Write-Success "$ServiceName started (PID: $($Process.Id))"
        }
        
        Write-Info "Logs: $LogFile"
    } catch {
        Write-Error "Failed to start $ServiceName: $_"
    }
}

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

Write-Info "=== Pablos Network Service Manager ==="
Write-Info "Starting services..."
Write-Info ""

# Start services based on parameter
if ($Service -eq 'all' -or $Service -eq 'mongodb') {
    # Note: MongoDB should be running as a system service
    # This is just a check
    Write-Info "Checking MongoDB..."
    try {
        $MongoUri = if ($env:MONGODB_URI) { $env:MONGODB_URI } else { "mongodb://localhost:27017" }
        Write-Info "MongoDB should be running at: $MongoUri"
        Write-Warning "Please ensure MongoDB is running as a system service"
    } catch {
        Write-Warning "MongoDB check skipped"
    }
}

if ($Service -eq 'all' -or $Service -eq 'redis') {
    # Note: Redis should be running as a system service or Docker container
    Write-Info "Checking Redis..."
    try {
        $RedisUrl = if ($env:REDIS_URL) { $env:REDIS_URL } else { "redis://localhost:6379" }
        Write-Info "Redis should be running at: $RedisUrl"
        Write-Warning "Please ensure Redis is running as a system service or Docker container"
    } catch {
        Write-Warning "Redis check skipped"
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

Write-Info ""
Write-Success "Service startup complete!"
Write-Info "Run '.\status.ps1' to check service status"
Write-Info "Run '.\logs.ps1' to view service logs"

