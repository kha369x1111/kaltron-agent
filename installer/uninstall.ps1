param([switch]$RemoveGeneratedFiles)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
& (Join-Path $root 'kaltron-stop.ps1')
$task = Get-ScheduledTask -TaskName 'KALTRON' -ErrorAction SilentlyContinue
if ($task) { Unregister-ScheduledTask -TaskName 'KALTRON' -Confirm:$false }
$shortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'KALTRON HUD.lnk'
Remove-Item -LiteralPath $shortcut -ErrorAction SilentlyContinue
if ($RemoveGeneratedFiles) {
    Remove-Item -LiteralPath (Join-Path $root 'server\.venv') -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path $root 'server\logs') -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Output 'KALTRON launch integration was removed. Hermes, Telegram, cron jobs, and Hermes secrets were not changed.'
