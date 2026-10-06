"""Start the voice server with persistent logs when launched by pythonw.exe."""

import runpy
import sys
from pathlib import Path


root = Path(__file__).resolve().parent
logs = root / "logs"
logs.mkdir(exist_ok=True)
sys.stdout = (logs / "kaltron-stdout.log").open("w", encoding="utf-8", buffering=1)
sys.stderr = (logs / "kaltron-stderr.log").open("w", encoding="utf-8", buffering=1)
runpy.run_path(str(root / "server.py"), run_name="__main__")
