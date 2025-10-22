#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Check status of Pablos Network services
.DESCRIPTION
    Displays the status of all Pablos Network services (running/stopped, PIDs, ports, memory usage)
.EXAMPLE
    .\status.ps1
    Show status of all services
#>

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$PidsDir = Join-Path $RootDir ".pids"

# Color output functions
function Write-Success {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Warning {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Red
}

# Get service status
function Get-ServiceStatus {
    param(
        [string]$ServiceName,
        [int]$Port = 0
    )
    
    $PidFile = Join-Path $PidsDir "$ServiceName.pid"
    
    if (-not (Test-Path $PidFile)) {
        return @{
            Name = $ServiceName
            Status = "STOPPED"
            Pid = $null
            Port = $Port
            Memory = $null
            Uptime = $null
        }
    }
    
    $Pid = Get-Content $PidFile
    
    try {
        $Process = Get-Process -Id $Pid -ErrorAction SilentlyContinue
        
        if (-not $Process) {
            # Stale PID file
            Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
            return @{
                Name = $ServiceName
                Status = "STOPPED"
                Pid = $null
                Port = $Port
                Memory = $null
                Uptime = $null
            }
        }
        
        $MemoryMB = [math]::Round($Process.WorkingSet64 / 1MB, 2)
        $Uptime = (Get-Date) - $Process.StartTime
        $UptimeStr = "{0:D2}h {1:D2}m {2:D2}s" -f $Uptime.Hours, $Uptime.Minutes, $Uptime.Seconds
        
        return @{
            Name = $ServiceName
            Status = "RUNNING"
            Pid = $Pid
            Port = $Port
            Memory = "$MemoryMB MB"
            Uptime = $UptimeStr
        }
    } catch {
        return @{
            Name = $ServiceName
            Status = "ERROR"
            Pid = $Pid
            Port = $Port
            Memory = $null
            Uptime = $null
        }
    }
}

# Load environment variables from .env if it exists
$EnvFile = Join-Path $RootDir ".env"
if (Test-Path $EnvFile) {
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

Write-Info "=== Pablos Network Service Status ==="
Write-Info ""

# Get status for all services
$Services = @(
    (Get-ServiceStatus -ServiceName "gateway" -Port $GatewayPort),
    (Get-ServiceStatus -ServiceName "ai" -Port $AIPort),
    (Get-ServiceStatus -ServiceName "worker-dast"),
    (Get-ServiceStatus -ServiceName "worker-dns"),
    (Get-ServiceStatus -ServiceName "worker-origin"),
    (Get-ServiceStatus -ServiceName "worker-osint"),
    (Get-ServiceStatus -ServiceName "worker-webdiscovery"),
    (Get-ServiceStatus -ServiceName "webtui" -Port $WebTUIPort)
)

# Display table header
$HeaderFormat = "{0,-25} {1,-10} {2,-10} {3,-10} {4,-15} {5,-15}"
Write-Host ($HeaderFormat -f "SERVICE", "STATUS", "PID", "PORT", "MEMORY", "UPTIME") -ForegroundColor White
Write-Host ("-" * 95) -ForegroundColor Gray

# Display service status
foreach ($Svc in $Services) {
    $StatusColor = switch ($Svc.Status) {
        "RUNNING" { "Green" }
        "STOPPED" { "Yellow" }
        "ERROR" { "Red" }
        default { "White" }
    }
    
    $PortStr = if ($Svc.Port -gt 0) { $Svc.Port } else { "-" }
    $PidStr = if ($Svc.Pid) { $Svc.Pid } else { "-" }
    $MemoryStr = if ($Svc.Memory) { $Svc.Memory } else { "-" }
    $UptimeStr = if ($Svc.Uptime) { $Svc.Uptime } else { "-" }
    
    $Line = $HeaderFormat -f $Svc.Name, $Svc.Status, $PidStr, $PortStr, $MemoryStr, $UptimeStr
    Write-Host $Line -ForegroundColor $StatusColor
}

Write-Info ""

# Summary
$RunningCount = ($Services | Where-Object { $_.Status -eq "RUNNING" }).Count
$TotalCount = $Services.Count

if ($RunningCount -eq $TotalCount) {
    Write-Success "All services are running ($RunningCount/$TotalCount)"
} elseif ($RunningCount -eq 0) {
    Write-Warning "All services are stopped (0/$TotalCount)"
} else {
    Write-Warning "Some services are not running ($RunningCount/$TotalCount)"
}

Write-Info ""
Write-Info "External Dependencies:"
Write-Info "  MongoDB: $($env:MONGODB_URI ?? 'mongodb://localhost:27017')"
Write-Info "  Redis:   $($env:REDIS_URL ?? 'redis://localhost:6379')"
Write-Info ""
Write-Info "Service URLs:"
Write-Info "  Gateway:  http://localhost:$GatewayPort"
Write-Info "  AI:       http://localhost:$AIPort"
Write-Info "  WebTUI:   http://localhost:$WebTUIPort"

