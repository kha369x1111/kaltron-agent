param([string]$LanIp)
$ErrorActionPreference = 'Stop'
$server = Split-Path -Parent $PSScriptRoot
$certDir = Join-Path $server 'certs'
$opensslCommand = Get-Command openssl.exe -ErrorAction SilentlyContinue
$openssl = if ($opensslCommand) { $opensslCommand.Source } else { 'C:\Program Files\Git\mingw64\bin\openssl.exe' }
if (-not (Test-Path -LiteralPath $openssl)) { throw 'OpenSSL was not found in PATH or the standard Git for Windows folder.' }

if ($LanIp) {
    $parsedIp = $null
    if (-not [System.Net.IPAddress]::TryParse($LanIp, [ref]$parsedIp) -or
        $parsedIp.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
        throw "Invalid LAN IPv4 address: $LanIp"
    }
    $outDir = Join-Path $certDir 'pending-lan'
    $san = "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$LanIp"
} else {
    $outDir = $certDir
    $san = 'subjectAltName=DNS:localhost,IP:127.0.0.1'
}

New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$cert = Join-Path $outDir 'cert.pem'
$key = Join-Path $outDir 'key.pem'
if ((Test-Path -LiteralPath $cert) -or (Test-Path -LiteralPath $key)) {
    $backup = Join-Path $outDir ('backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    if (Test-Path -LiteralPath $backup) { throw "Certificate backup already exists: $backup" }
    New-Item -ItemType Directory -Path $backup | Out-Null
    foreach ($file in @($cert, $key)) {
        if (Test-Path -LiteralPath $file) {
            $dest = Join-Path $backup (Split-Path -Leaf $file)
            Copy-Item -LiteralPath $file -Destination $dest
            if ((Get-FileHash -LiteralPath $file).Hash -ne (Get-FileHash -LiteralPath $dest).Hash) {
                throw "Certificate backup mismatch: $file"
            }
        }
    }
    Write-Output "Existing certificate files backed up in $backup"
}
& $openssl req -x509 -newkey rsa:2048 -keyout $key -out $cert -days 825 -nodes -subj '/CN=localhost' -addext $san
if ($LASTEXITCODE -ne 0) { throw "OpenSSL failed with exit code $LASTEXITCODE" }
if ($LanIp) {
    Write-Output "Created staged LAN certificate for localhost and $LanIp at $cert. The live certificate was not changed."
} else {
    Copy-Item -LiteralPath $cert -Destination (Join-Path $server 'hud\kaltron.cer') -Force
    Write-Output 'Created localhost-only certificate. Trust the new cert for the current Windows user before opening the HUD.'
}
