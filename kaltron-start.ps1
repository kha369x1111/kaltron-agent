$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$server = Join-Path $root 'server'
$hermesHome = if ($env:HERMES_HOME) { $env:HERMES_HOME } else { Join-Path $env:LOCALAPPDATA 'hermes' }
$pythonw = Join-Path $server '.venv\Scripts\pythonw.exe'
$runner = Join-Path $server 'run_logged.py'
$pidFile = Join-Path $server 'logs\kaltron.pid'

function Test-LocalPort([int]$Port) {
    $client = [Net.Sockets.TcpClient]::new()
    try {
        $pending = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $pending.AsyncWaitHandle.WaitOne(700)) { return $false }
        $client.EndConnect($pending)
        return $true
    } catch { return $false } finally { $client.Dispose() }
}

if (-not (Test-Path -LiteralPath $pythonw)) {
    throw 'KALTRON virtual environment is missing. Run installer\kaltron-installer.ps1 first.'
}
$env:HERMES_HOME = $hermesHome
$env:HF_HOME = Join-Path $server '.hf-cache'

if (-not (Test-LocalPort 8642)) {
    $gatewayVbs = Join-Path $hermesHome 'gateway-service\Hermes_Gateway.vbs'
    if (Test-Path -LiteralPath $gatewayVbs) {
        Start-Process -FilePath (Join-Path $env:WINDIR 'System32\wscript.exe') -ArgumentList ('"' + $gatewayVbs + '"') -WindowStyle Hidden
        Write-Output 'Hermes gateway start requested.'
    } else {
        Write-Warning 'Hermes gateway launcher was not found. KALTRON will start and report Hermes offline.'
    }
}

if (Test-LocalPort 8766) {
    Write-Output 'KALTRON is already listening on https://localhost:8766/hud/.'
    exit 0
}
New-Item -ItemType Directory -Path (Split-Path $pidFile) -Force | Out-Null
$proc = Start-Process -FilePath $pythonw -ArgumentList ('"' + $runner + '"') -WorkingDirectory $server -WindowStyle Hidden -PassThru
[IO.File]::WriteAllText($pidFile, [string]$proc.Id)
for ($i = 0; $i -lt 60 -and -not (Test-LocalPort 8766); $i++) {
    if ($proc.HasExited) { throw 'KALTRON stopped during startup. Check server\logs\kaltron-stderr.log.' }
    Start-Sleep -Milliseconds 500
}
if (-not (Test-LocalPort 8766)) { throw 'KALTRON did not become ready within 30 seconds.' }
Write-Output 'KALTRON is ready at https://localhost:8766/hud/.'
