$root = $PSScriptRoot
$server = Join-Path $root 'server'
$python = Join-Path $server '.venv\Scripts\python.exe'
function Test-Port([int]$Port) {
    $client = [Net.Sockets.TcpClient]::new()
    try {
        $pending = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $pending.AsyncWaitHandle.WaitOne(800)) { return $false }
        $client.EndConnect($pending); return $true
    } catch { return $false } finally { $client.Dispose() }
}
$checks = [ordered]@{}
$checks['Hermes API 8642'] = Test-Port 8642
$checks['KALTRON TLS 8766'] = Test-Port 8766
$checks['HUD health endpoint'] = $false
if (Test-Path -LiteralPath $python) {
    $cert = Join-Path $server 'certs\cert.pem'
    & $python -c "import requests,sys; r=requests.get('https://localhost:8766/health',verify=sys.argv[1],timeout=4); raise SystemExit(0 if r.status_code == 200 else 1)" $cert 2>$null
    $checks['HUD health endpoint'] = $LASTEXITCODE -eq 0
}
$checks['STT runtime'] = $false
$checks['Edge TTS runtime'] = $false
if (Test-Path -LiteralPath $python) {
    & $python -c "import faster_whisper" 2>$null
    $checks['STT runtime'] = $LASTEXITCODE -eq 0
    & $python -c "import edge_tts,pydub,imageio_ffmpeg" 2>$null
    $checks['Edge TTS runtime'] = $LASTEXITCODE -eq 0
}
$checks.GetEnumerator() | ForEach-Object { '{0,-24} {1}' -f $_.Key, $(if ($_.Value) {'OK'} else {'FAIL'}) }
if ($checks.Values -contains $false) { exit 1 }
