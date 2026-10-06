@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0kaltron-stop.ps1"
exit /b %ERRORLEVEL%
