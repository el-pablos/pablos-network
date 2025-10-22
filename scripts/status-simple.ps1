#!/usr/bin/env pwsh

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$PidsDir = Join-Path $RootDir ".pids"

# Get service status
function Get-ServiceStatus {
    param([string]$ServiceName, [int]$Port = 0)
    
    $PidFile = Join-Path $PidsDir "$ServiceName.pid"
    
    if (-not (Test-Path $PidFile)) {
        return [PSCustomObject]@{
            Name = $ServiceName
            Status = "Stopped"
            Pid = "-"
            Port = if ($Port -gt 0) { $Port } else { "-" }
            Memory = "-"
            Uptime = "-"
        }
    }
    
    $ProcessId = Get-Content $PidFile

    try {
        $Process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue

        if (-not $Process) {
            # Stale PID file
            return [PSCustomObject]@{
                Name = $ServiceName
                Status = "Stopped (stale PID)"
                Pid = $ProcessId
                Port = if ($Port -gt 0) { $Port } else { "-" }
                Memory = "-"
                Uptime = "-"
            }
        }

        $Memory = "{0:N0} MB" -f ($Process.WorkingSet64 / 1MB)
        $Uptime = (Get-Date) - $Process.StartTime
        $UptimeStr = "{0:hh\:mm\:ss}" -f $Uptime

        return [PSCustomObject]@{
            Name = $ServiceName
            Status = "Running"
            Pid = $ProcessId
            Port = if ($Port -gt 0) { $Port } else { "-" }
            Memory = $Memory
            Uptime = $UptimeStr
        }
    } catch {
        return [PSCustomObject]@{
            Name = $ServiceName
            Status = "Error"
            Pid = $ProcessId
            Port = if ($Port -gt 0) { $Port } else { "-" }
            Memory = "-"
            Uptime = "-"
        }
    }
}

Write-Host ""
Write-Host "=== Pablos Network Service Status ===" -ForegroundColor Cyan
Write-Host ""

# Get ports from environment or use defaults
$GatewayPort = if ($env:GATEWAY_PORT) { [int]$env:GATEWAY_PORT } else { 4000 }
$AIPort = if ($env:AI_SERVICE_PORT) { [int]$env:AI_SERVICE_PORT } else { 4001 }
$WebTUIPort = if ($env:WEBTUI_PORT) { [int]$env:WEBTUI_PORT } else { 3000 }

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
Write-Host ("{0,-25} {1,-20} {2,-10} {3,-10} {4,-15} {5,-15}" -f "Service", "Status", "PID", "Port", "Memory", "Uptime") -ForegroundColor White
Write-Host ("{0,-25} {1,-20} {2,-10} {3,-10} {4,-15} {5,-15}" -f "-------", "------", "---", "----", "------", "------") -ForegroundColor Gray

# Display each service
foreach ($Svc in $Services) {
    $Color = switch ($Svc.Status) {
        "Running" { "Green" }
        "Stopped" { "Yellow" }
        default { "Red" }
    }
    
    Write-Host ("{0,-25} {1,-20} {2,-10} {3,-10} {4,-15} {5,-15}" -f $Svc.Name, $Svc.Status, $Svc.Pid, $Svc.Port, $Svc.Memory, $Svc.Uptime) -ForegroundColor $Color
}

# Summary
$RunningCount = ($Services | Where-Object { $_.Status -eq "Running" }).Count
$TotalCount = $Services.Count

Write-Host ""
Write-Host "Summary: $RunningCount/$TotalCount services running" -ForegroundColor $(if ($RunningCount -eq $TotalCount) { "Green" } else { "Yellow" })
Write-Host ""

