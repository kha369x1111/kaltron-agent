$ErrorActionPreference = 'Stop'
$server = Split-Path -Parent $PSScriptRoot
$python = Join-Path $server '.venv\Scripts\python.exe'
$outDir = Join-Path $server 'hud\audio'
$outFile = Join-Path $outDir 'boot.mp3'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
if (Test-Path -LiteralPath $outFile) { throw "Refusing to overwrite $outFile" }
& $python -m edge_tts --voice ar-JO-TaimNeural --text 'Systems online. I am KALTRON.' --write-media $outFile
if ($LASTEXITCODE -ne 0 -or (Get-Item -LiteralPath $outFile).Length -lt 100) { throw 'Boot audio generation failed' }
Write-Output "Created $outFile"
