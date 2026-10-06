# KALTRON portable setup

Copy `KALTRON_PORTABLE` to a Windows computer with Python 3.11+ and Git for Windows. Open PowerShell in `kaltron-agent` and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Setup-On-New-PC.ps1
```

The setup creates a new virtual environment, new local secrets, and a new localhost certificate. The package contains no source machine secret, private key, model cache, or log. Hermes Agent must already be installed on the target computer.
