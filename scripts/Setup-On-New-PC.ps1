param([switch]$RegisterStartup)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
& (Join-Path $root 'installer\kaltron-installer.ps1') -RegisterStartup:$RegisterStartup
