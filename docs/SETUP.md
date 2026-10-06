# Windows host and Mac client

## Windows localhost

Install Python 3.11 or newer and Git for Windows, then run `installer\kaltron-installer.ps1`. The installer uses `%LOCALAPPDATA%\hermes`, creates `server\.venv`, installs `requirements-windows.txt`, generates a localhost certificate, and imports the public certificate into the current user trust store.

Run `kaltron-start.bat`, open `https://localhost:8766/hud/`, and enter `KALTRON_HUD_TOKEN` from the Hermes `.env` when prompted.

## Optional login startup

Run the installer with `-RegisterStartup`. It refuses to replace an existing task named KALTRON.

## Mac client

LAN is disabled by default. Before enabling it:

1. Verify and disable any broad public inbound `pythonw.exe` firewall rule.
2. Create and verify a scoped KALTRON rule for TCP 443, the Windows LAN address, and the trusted subnet.
3. Generate a LAN SAN certificate with `server\scripts\make-certs.ps1 -LanIp <WINDOWS_IP>`.
4. Copy only `cert.pem` to the Mac. Never copy `key.pem`.
5. Import it into the login keychain, set it to Always Trust, then open `https://<WINDOWS_IP>/hud/`.

This release does not enable LAN automatically.
