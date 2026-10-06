"""Fail closed on Windows unless LAN port 443 has a narrow firewall rule."""

from __future__ import annotations

import os
import re
import subprocess


def _field(block: str, name: str) -> str:
    match = re.search(rf"^{re.escape(name)}:\s*(.*?)\s*$", block, re.MULTILINE)
    return match.group(1).strip().lower() if match else ""


def _rules(name: str) -> list[str]:
    result = subprocess.run(
        ["netsh", "advfirewall", "firewall", "show", "rule", f"name={name}", "verbose"],
        capture_output=True, text=True, timeout=12, check=False,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    if result.returncode:
        return []
    return re.split(r"(?=^Rule Name:)", result.stdout, flags=re.MULTILINE)


def lan_binding_allowed(lan_ip: str, subnet: str) -> tuple[bool, str]:
    if os.name != "nt":
        return False, "LAN firewall preflight requires Windows"
    for block in _rules("pythonw.exe"):
        if all((_field(block, "Enabled") == "yes",
                _field(block, "Direction") == "in",
                _field(block, "Action") == "allow",
                _field(block, "Protocol") == "tcp",
                _field(block, "RemoteIP") == "any")):
            return False, "broad inbound TCP pythonw.exe firewall rule is enabled"
    acceptable_subnets = {subnet.lower(), subnet.replace("/24", "/255.255.255.0").lower()}
    for block in _rules("KALTRON HUD LAN"):
        # netsh renders an exact -LocalAddress as an IP-to-same-IP range.
        local_ip = _field(block, "LocalIP")
        exact_local_ip = local_ip in {lan_ip.lower(), f"{lan_ip.lower()}-{lan_ip.lower()}"}
        if all((_field(block, "Enabled") == "yes",
                _field(block, "Direction") == "in",
                _field(block, "Action") == "allow",
                _field(block, "Protocol") == "tcp",
                _field(block, "LocalPort") == "443",
                exact_local_ip,
                _field(block, "RemoteIP") in acceptable_subnets)):
            return True, "scoped KALTRON firewall rule verified"
    return False, "scoped KALTRON firewall rule was not visible or did not match"
