"""Generate the HUD's three boot audio files with the configured Edge voice."""

from pathlib import Path
import sys

import edge_tts
import yaml


SERVER_DIR = Path(__file__).resolve().parents[1]
CONFIG = yaml.safe_load((SERVER_DIR / "config" / "server.yaml").read_text(encoding="utf-8"))
VOICE = CONFIG["voice"]["voice_id"]
NAME = sys.argv[1] if len(sys.argv) > 1 else "KALTRON"
GREETING = f"Systems online. I am {NAME}."
OUT_DIR = SERVER_DIR / "hud" / "audio"
OUT_DIR.mkdir(parents=True, exist_ok=True)

for period in ("morning", "afternoon", "evening"):
    path = OUT_DIR / f"boot_{period}.mp3"
    if path.exists():
        raise SystemExit(f"Refusing to overwrite {path}")
    edge_tts.Communicate(GREETING, VOICE).save_sync(str(path))
    if path.stat().st_size < 100:
        raise SystemExit(f"Generated audio is unexpectedly small: {path}")
    print(f"Created {path.name} ({path.stat().st_size} bytes)")
