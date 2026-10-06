$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$server = Join-Path $root 'server'
$pidFile = Join-Path $server 'logs\kaltron.pid'
$targets = [Collections.Generic.HashSet[int]]::new()
if (Test-Path -LiteralPath $pidFile) {
    $saved = Get-Content -LiteralPath $pidFile -Raw
    if ($saved -match '^\d+$') { [void]$targets.Add([int]$saved) }
}
Get-NetTCPConnection -State Listen -LocalPort 8765,8766 -ErrorAction SilentlyContinue |
    ForEach-Object { [void]$targets.Add([int]$_.OwningProcess) }
foreach ($id in $targets) {
    $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
    if (-not $proc) { continue }
    $path = $proc.Path
    if (-not $path -or -not $path.StartsWith($server, [StringComparison]::OrdinalIgnoreCase)) {
        Write-Warning "Refused to stop PID $id because it is outside the KALTRON server folder."
        continue
    }
    Stop-Process -Id $id -Force
    Write-Output "Stopped KALTRON process $id."
}
Remove-Item -LiteralPath $pidFile -ErrorAction SilentlyContinue
Write-Output 'Hermes gateway and its Telegram/cron configuration were not changed.'
