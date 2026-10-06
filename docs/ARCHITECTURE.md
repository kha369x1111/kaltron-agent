# Architecture

```
Browser microphone/chat
        |
 HTTPS/WSS 127.0.0.1:8766
        |
 KALTRON voice server
   |          |          |
 Whisper   Edge TTS   Hermes API
 CPU STT   PCM 16 kHz 127.0.0.1:8642
```

Hermes remains the agent brain. KALTRON owns the browser HUD, microphone stream, multilingual transcription, and speech output. The dashboard proxy uses `127.0.0.1:9443` and targets the optional Hermes dashboard on `127.0.0.1:9119`.

Secrets stay in the Hermes `.env`. The server reads `KALTRON_HUD_TOKEN` and accepts `JARVIS_HUD_TOKEN` as a compatibility fallback. The default interface uses plain HTML, CSS and JavaScript to limit CPU and GPU use.
