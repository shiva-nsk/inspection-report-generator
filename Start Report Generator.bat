@echo off
REM Double-click this file on Windows to start the Report Generator.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed. Please install it from https://nodejs.org ^(LTS version^), then try again.
  echo.
  pause
  exit /b 1
)
node server.js
pause
