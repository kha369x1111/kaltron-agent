@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0kaltron-health.ps1"
exit /b %ERRORLEVEL%
