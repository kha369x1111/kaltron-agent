param(
    [string]$HermesHome = $(if ($env:HERMES_HOME) { $env:HERMES_HOME } else { Join-Path $env:LOCALAPPDATA 'hermes' })
)
$ErrorActionPreference = 'Stop'
$envFile = Join-Path $HermesHome '.env'
$configFile = Join-Path $HermesHome 'config.yaml'
if (-not (Test-Path -LiteralPath $envFile)) { throw "Hermes .env was not found at $envFile" }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backup = Join-Path $HermesHome "backups\kaltron_$stamp"
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Copy-Item -LiteralPath $envFile -Destination (Join-Path $backup '.env')
if (Test-Path -LiteralPath $configFile) { Copy-Item -LiteralPath $configFile -Destination (Join-Path $backup 'config.yaml') }

function Set-EnvKey([string]$Name, [string]$Value) {
    $lines = [Collections.Generic.List[string]](Get-Content -LiteralPath $envFile)
    $match = '^' + [regex]::Escape($Name) + '='
    $indices = for ($i=0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match $match) { $i } }
    if (@($indices).Count -gt 1) { throw "Duplicate $Name entries found; no change made." }
    $entry = "$Name=$Value"
    if (@($indices).Count -eq 1) { $lines[$indices[0]] = $entry } else { $lines.Add($entry) }
    [IO.File]::WriteAllLines($envFile, $lines, [Text.UTF8Encoding]::new($false))
}

$apiKey = & py -3 -c "import secrets; print(secrets.token_urlsafe(32))"
$hudToken = 'kaltron-' + (& py -3 -c "import secrets; print(secrets.token_hex(3))")
Set-EnvKey 'API_SERVER_ENABLED' 'true'
Set-EnvKey 'API_SERVER_KEY' $apiKey
Set-EnvKey 'KALTRON_HUD_TOKEN' $hudToken
Write-Output "Hermes environment backed up to $backup"
Write-Output 'Updated only API_SERVER_ENABLED, API_SERVER_KEY, and KALTRON_HUD_TOKEN.'
Write-Output 'The HUD access code is stored in the Hermes .env file and is not printed.'
