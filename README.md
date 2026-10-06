# KALTRON Agent 1.0.0

> وكيل ذكاء اصطناعي شخصي يعمل على Windows بواجهة عربية وإنجليزية خفيفة، وتعرّف صوتي متعدد اللغات عبر Whisper، وصوت عربي مجاني عبر Edge TTS، مع تكامل محلي وآمن مع Hermes Agent.

KALTRON is an Arabic first voice and browser interface for an existing Hermes Agent installation on Windows. It keeps Hermes on loopback, uses multilingual Whisper for speech recognition, and speaks with the free Edge TTS voice `ar-JO-TaimNeural`.

## Safe default

The HUD binds to `127.0.0.1:8766`. The default interface is the lightweight orb, with no WebGL or Three.js runtime. LAN access stays disabled until the firewall review is complete.

## Install and run

1. Run `installer\kaltron-installer.ps1` in PowerShell.
2. Start with `kaltron-start.bat`.
3. Open `https://localhost:8766/hud/`.
4. Stop only KALTRON with `kaltron-stop.bat`.
5. Run `kaltron-health.bat` for the five health checks.

The installer backs up Hermes `.env` and `config.yaml`, edits only the three KALTRON API keys, creates a private virtual environment, and generates a localhost certificate. Telegram and cron settings are not changed.

See [SETUP](docs/SETUP.md), [architecture](docs/ARCHITECTURE.md), and [troubleshooting](docs/TROUBLESHOOTING.md).

