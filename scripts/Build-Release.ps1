param([string]$OutputDirectory = $(Join-Path (Split-Path -Parent $PSScriptRoot) 'dist'))
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$version = '1.0.0'
$stage = Join-Path $env:TEMP "kaltron-release-$([guid]::NewGuid().ToString('N'))"
$portableStage = Join-Path $stage 'KALTRON_PORTABLE'
$installerStage = Join-Path $stage 'KALTRON_INSTALLER'
New-Item -ItemType Directory -Path $portableStage,$installerStage,$OutputDirectory -Force | Out-Null
& (Join-Path $root 'scripts\Export-To-External.ps1') -Destination $stage
$installerApp = Join-Path $installerStage 'kaltron-agent'
New-Item -ItemType Directory -Path $installerApp -Force | Out-Null
$excludeDirs = @('.git','.venv','node_modules','__pycache__','logs','backups','.hf-cache','models','dist','launchd')
$excludeFiles = @('.env','key.pem','cert.pem','jarvis.cer','*.pyc','start_jarvis.*','stop_jarvis.*','jarvis_health.*','README-WINDOWS.md','server.lan.pending.yaml','jarvis-*.sh','make-certs.sh','make-boot-audio.sh')
$args = @($root,$installerApp,'/E','/R:1','/W:1','/NFL','/NDL','/NJH','/NJS','/NP','/XD') + $excludeDirs + @('/XF') + $excludeFiles
& robocopy @args
if ($LASTEXITCODE -ge 8) { throw "installer staging failed with code $LASTEXITCODE" }
$portableZip = Join-Path $OutputDirectory "kaltron-agent-v$version-portable.zip"
$installerZip = Join-Path $OutputDirectory "kaltron-agent-v$version-installer.zip"
Compress-Archive -LiteralPath (Join-Path $stage 'KALTRON_PORTABLE') -DestinationPath $portableZip -Force
Compress-Archive -LiteralPath $installerStage -DestinationPath $installerZip -Force
Remove-Item -LiteralPath $stage -Recurse -Force
Write-Output $portableZip
Write-Output $installerZip
