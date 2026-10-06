param(
    [switch]$RegisterStartup,
    [switch]$EnableLan
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$server = Join-Path $root 'server'
$venv = Join-Path $server '.venv'
$python = Join-Path $venv 'Scripts\python.exe'

$version = & py -3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
if (-not $version) { throw 'Python 3.11 or newer is required.' }
$parts = $version.Split('.')
if ([int]$parts[0] -lt 3 -or ([int]$parts[0] -eq 3 -and [int]$parts[1] -lt 11)) { throw "Python $version is too old." }
if (-not (Test-Path -LiteralPath $python)) { & py -3 -m venv $venv }
& $python -m pip install --upgrade pip
& $python -m pip install -r (Join-Path $root 'requirements-windows.txt')

if (-not (Test-Path -LiteralPath (Join-Path $server 'config\server.yaml'))) {
    Copy-Item -LiteralPath (Join-Path $server 'config\server.example.yaml') -Destination (Join-Path $server 'config\server.yaml')
}
& (Join-Path $root 'scripts\Initialize-KaltronEnv.ps1')
& (Join-Path $server 'scripts\make-certs.ps1')

$cert = Join-Path $server 'certs\cert.pem'
& certutil.exe -user -addstore Root $cert
if ($LASTEXITCODE -ne 0) { throw 'Current-user certificate trust failed.' }

$shell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcut = $shell.CreateShortcut((Join-Path $desktop 'KALTRON HUD.lnk'))
$shortcut.TargetPath = 'https://localhost:8766/hud/'
$shortcut.Save()

if ($RegisterStartup) {
    if (Get-ScheduledTask -TaskName 'KALTRON' -ErrorAction SilentlyContinue) {
        throw 'A scheduled task named KALTRON already exists; it was not replaced.'
    }
    $action = New-ScheduledTaskAction -Execute (Join-Path $root 'kaltron-start.bat')
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName 'KALTRON' -Action $action -Trigger $trigger -Principal $principal | Out-Null
}
if ($EnableLan) {
    throw 'LAN setup is intentionally separate. Review the broad pythonw.exe rule, then run server\scripts\apply-lan-firewall.ps1 as Administrator.'
}
Write-Output 'KALTRON installation completed in localhost-only mode. Run kaltron-start.bat when ready.'
