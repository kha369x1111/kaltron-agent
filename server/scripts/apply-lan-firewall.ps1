#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$name = 'KALTRON HUD LAN'
$localIp = '192.168.100.12'
$remoteSubnet = '192.168.100.0/24'

$stored = @(Get-NetFirewallRule -DisplayName $name -PolicyStore PersistentStore -ErrorAction SilentlyContinue)
if ($stored.Count -gt 1) { throw "More than one stored rule is named $name; no change made." }
if ($stored.Count -eq 0) {
    New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow `
        -Protocol TCP -LocalPort 443 -LocalAddress $localIp -RemoteAddress $remoteSubnet `
        -Profile Any -PolicyStore PersistentStore -Enabled True | Out-Null
    Write-Output "Created $name in PersistentStore."
} else {
    Write-Output "$name already exists in PersistentStore; no duplicate created."
}

$active = @(Get-NetFirewallRule -DisplayName $name -PolicyStore ActiveStore -ErrorAction SilentlyContinue)
if ($active.Count -ne 1) { throw "$name is not present exactly once in ActiveStore. LAN must stay disabled." }
$rule = $active[0]
$address = $rule | Get-NetFirewallAddressFilter
$port = $rule | Get-NetFirewallPortFilter
if ($rule.Enabled -ne 'True' -or $rule.Direction -ne 'Inbound' -or
    $rule.Action -ne 'Allow' -or $rule.Profile -ne 'Any' -or
    $port.Protocol -ne 'TCP' -or $port.LocalPort -ne '443' -or
    $address.LocalAddress -ne $localIp -or
    $address.RemoteAddress -notin @($remoteSubnet, '192.168.100.0/255.255.255.0')) {
    throw "$name exists but does not match the scoped LAN settings. LAN must stay disabled."
}

Write-Output 'VERIFIED ACTIVE RULE:'
$rule | Format-List DisplayName,Enabled,Direction,Action,Profile
$port | Format-List Protocol,LocalPort,RemotePort
$address | Format-List LocalAddress,RemoteAddress
