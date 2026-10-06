param([Parameter(Mandatory)][string]$Destination)
$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $PSScriptRoot
$portable = Join-Path $Destination 'KALTRON_PORTABLE'
$app = Join-Path $portable 'kaltron-agent'
New-Item -ItemType Directory -Path $app -Force | Out-Null
$excludeDirs = @('.git','.venv','node_modules','__pycache__','logs','backups','.hf-cache','models','launchd','dist')
$excludeFiles = @('.env','key.pem','cert.pem','jarvis.cer','*.pyc','start_jarvis.*','stop_jarvis.*','jarvis_health.*','README-WINDOWS.md','server.lan.pending.yaml','jarvis-*.sh','make-certs.sh','make-boot-audio.sh')
$args = @($source,$app,'/E','/R:1','/W:1','/NFL','/NDL','/NJH','/NJS','/NP','/XD') + $excludeDirs + @('/XF') + $excludeFiles
& robocopy @args
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with code $LASTEXITCODE" }
Copy-Item -LiteralPath (Join-Path $source 'README_PORTABLE.md') -Destination $portable -Force
Write-Output "Portable KALTRON source exported to $portable"
Write-Output 'No virtual environment, model cache, logs, secrets, or private TLS keys were copied.'
