"""Check the active KALTRON endpoints without printing authentication secrets."""

from pathlib import Path
import os
import ssl
import sys
import urllib.request

import requests
import yaml


ROOT = Path(__file__).resolve().parents[1]
HERMES_HOME = Path(os.environ.get("HERMES_HOME", Path(os.environ.get("LOCALAPPDATA", Path.home())) / "hermes"))
ENV_FILE = HERMES_HOME / ".env"
LOCAL_HUD = "https://localhost:8766"
CFG = yaml.safe_load((ROOT / "config" / "server.yaml").read_text(encoding="utf-8-sig"))
LAN_HUD = f"https://{CFG['server']['host']}" if CFG["server"].get("lan_enabled") else None
CERTIFICATE = str(ROOT / "certs" / "cert.pem")


def read_key(name: str) -> str:
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if line.startswith(name + "="):
            return line.split("=", 1)[1]
    raise RuntimeError(f"{name} is missing from Hermes .env")


def check(label: str, action) -> bool:
    try:
        action()
        print(f"{label}: OK")
        return True
    except Exception as exc:
        print(f"{label}: FAILED ({type(exc).__name__}: {exc})")
        return False


def main() -> int:
    api_key = read_key("API_SERVER_KEY")
    hud_token = read_key("KALTRON_HUD_TOKEN") or read_key("JARVIS_HUD_TOKEN")

    def hermes_api() -> None:
        response = requests.get("http://127.0.0.1:8642/health", headers={"Authorization": f"Bearer {api_key}"}, timeout=8)
        response.raise_for_status()
        assert response.json().get("status") == "ok"

    def hud(base: str) -> None:
        response = requests.get(f"{base}/hud/", verify=CERTIFICATE, timeout=15)
        response.raise_for_status()

    def hud_auth(base: str) -> None:
        endpoint = f"{base}/api/usage"
        no_token = requests.get(endpoint, verify=CERTIFICATE, timeout=15)
        wrong_token = requests.get(endpoint, headers={"X-Kaltron-Token": "incorrect"}, verify=CERTIFICATE, timeout=15)
        valid_token = requests.get(endpoint, headers={"X-Kaltron-Token": hud_token}, verify=CERTIFICATE, timeout=15)
        assert (no_token.status_code, wrong_token.status_code, valid_token.status_code) == (401, 401, 200)

    def windows_tls_trust() -> None:
        for base in (LOCAL_HUD, LAN_HUD) if LAN_HUD else (LOCAL_HUD,):
            with urllib.request.urlopen(f"{base}/hud/", context=ssl.create_default_context(), timeout=15) as response:
                assert response.status == 200

    checks = [
        check("Hermes API", hermes_api),
        check("Local HUD", lambda: hud(LOCAL_HUD)),
        check("Local HUD token", lambda: hud_auth(LOCAL_HUD)),
        check("Whisper model", lambda: (ROOT / "models" / "small" / "model.bin").stat()),
        check("TLS certificate", lambda: (ROOT / "certs" / "cert.pem").stat()),
        check("Windows TLS trust", windows_tls_trust),
    ]
    if LAN_HUD:
        sys.path.insert(0, str(ROOT))
        from firewall_guard import lan_binding_allowed

        def lan_firewall() -> None:
            allowed, reason = lan_binding_allowed(CFG["server"]["host"], "192.168.100.0/24")
            assert allowed, reason

        checks.extend([
            check("LAN firewall", lan_firewall),
            check("LAN HUD", lambda: hud(LAN_HUD)),
            check("LAN HUD token", lambda: hud_auth(LAN_HUD)),
        ])
    return 0 if all(checks) else 1


if __name__ == "__main__":
    sys.exit(main())
