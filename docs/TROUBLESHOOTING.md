# Troubleshooting

## HUD is stopped

Run `kaltron-start.bat`, then `kaltron-health.bat`. Check `server\logs\kaltron-stderr.log` if port 8766 does not open.

## Certificate warning

Regenerate the localhost certificate with `server\scripts\make-certs.ps1`, then import `server\certs\cert.pem` into the Current User Trusted Root store. Do not distribute `key.pem`.

## Access code prompt

This is expected when `KALTRON_HUD_TOKEN` is configured. The code protects local APIs and WebSocket. It is stored in the Hermes `.env` and never included in release ZIP files.

## Microphone is unavailable

Use HTTPS, allow microphone access for localhost, and close applications that hold the microphone exclusively.

## Edge TTS is silent

Edge TTS requires network access to Microsoft's speech service. Run `kaltron-health.bat` to confirm modules are installed. The server falls back from `ar-JO-TaimNeural` to `ar-SA-ZariyahNeural`.

## High CPU or GPU use

The lightweight HUD is the default. Do not load `server\hud\apex` unless developing the archived 3D interface. Whisper `small` runs on CPU with `int8`.

## LAN does not work

LAN is intentionally disabled. Do not bind to `0.0.0.0` until the broad `pythonw.exe` rule is disabled and a scoped inbound rule is verified.
